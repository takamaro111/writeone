import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    total_score: { type: "integer" },
    grammar_score: { type: "integer" },
    vocabulary_score: { type: "integer" },
    logic_score: { type: "integer" },
    structure_score: { type: "integer" },
    consistency_score: { type: "integer" },
    eiken_level_estimate: { type: "string" },
    word_count_feedback: { type: "string" },
    good_points: { type: "array", items: { type: "string" } },
    improvement_points: { type: "array", items: { type: "string" } },
    sentence_corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          reason: { type: "string" }
        },
        required: ["original", "corrected", "reason"]
      }
    },
    corrected_sample: { type: "string" },
    next_advice: { type: "string" }
  },
  required: [
    "total_score",
    "grammar_score",
    "vocabulary_score",
    "logic_score",
    "structure_score",
    "consistency_score",
    "eiken_level_estimate",
    "word_count_feedback",
    "good_points",
    "improvement_points",
    "sentence_corrections",
    "corrected_sample",
    "next_advice"
  ]
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = mustEnv("SUPABASE_URL");
    const anonKey = mustEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = mustEnv("OPENAI_API_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json();
    const { submission_id, print_code, image_data_url } = body;

    if (image_data_url) {
      return await gradeFromImage({
        imageDataUrl: image_data_url,
        printCode: print_code,
        userId: userData.user.id,
        adminClient,
        openAiKey
      });
    }

    if (!submission_id) {
      return json({ error: "submission_id is required" }, 400);
    }

    const { data: submission, error: submissionError } = await userClient
      .from("submissions")
      .select(`
        id,
        user_id,
        answer_text,
        word_count,
        status,
        prints (
          code,
          level,
          title,
          topic_jp,
          topic_en,
          word_count_min,
          word_count_max,
          structure,
          tips
        )
      `)
      .eq("id", submission_id)
      .single();

    if (submissionError || !submission) {
      return json({ error: "submission not found" }, 404);
    }
    if (submission.user_id !== userData.user.id) {
      return json({ error: "forbidden" }, 403);
    }
    if (submission.status === "reviewed") {
      return json({ error: "already reviewed" }, 409);
    }
    if (!String(submission.answer_text ?? "").trim()) {
      return json({ error: "answer is empty" }, 400);
    }
    if (submission.word_count < 5) {
      return json({ error: "answer is too short" }, 400);
    }

    const limit = await checkMonthlyLimit(adminClient, userData.user.id);
    if (!limit.allowed) {
      return json({ error: "monthly limit exceeded", plan: limit.plan, limit: limit.limit }, 429);
    }

    const print = Array.isArray(submission.prints) ? submission.prints[0] : submission.prints;
    const prompt = buildPrompt(print, submission.answer_text, submission.word_count);
    const aiResult = await callOpenAI(openAiKey, prompt);
    const feedback = normalizeFeedback(aiResult.feedback);

    const { data: insertedFeedback, error: feedbackError } = await adminClient
      .from("feedbacks")
      .insert({
        submission_id,
        version: 1,
        total_score: feedback.total_score,
        grammar_score: feedback.grammar_score,
        vocabulary_score: feedback.vocabulary_score,
        logic_score: feedback.logic_score,
        structure_score: feedback.structure_score,
        consistency_score: feedback.consistency_score,
        eiken_level_estimate: feedback.eiken_level_estimate,
        word_count_feedback: feedback.word_count_feedback,
        good_points: feedback.good_points,
        improvement_points: feedback.improvement_points,
        sentence_corrections: feedback.sentence_corrections,
        corrected_sample: feedback.corrected_sample,
        next_advice: feedback.next_advice,
        raw_feedback: feedback
      })
      .select("*")
      .single();

    if (feedbackError) {
      console.error("failed to save feedback", feedbackError);
      throw new Error("failed to save feedback");
    }

    await adminClient
      .from("submissions")
      .update({ status: "reviewed", updated_at: new Date().toISOString() })
      .eq("id", submission_id);

    await adminClient.from("ai_usage_logs").insert({
      user_id: userData.user.id,
      submission_id,
      model,
      input_tokens: aiResult.inputTokens,
      output_tokens: aiResult.outputTokens,
      estimated_cost: 0
    });

    return json({ feedback: insertedFeedback }, 200);
  } catch (error) {
    console.error("grade essay failed", error);
    return json({ error: "grade essay failed" }, 500);
  }
});

function mustEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function gradeFromImage({
  imageDataUrl,
  printCode,
  userId,
  adminClient,
  openAiKey
}: {
  imageDataUrl: string;
  printCode: string;
  userId: string;
  adminClient: any;
  openAiKey: string;
}) {
  if (!printCode) {
    return json({ error: "print_code is required" }, 400);
  }
  if (!String(imageDataUrl).startsWith("data:image/")) {
    return json({ error: "invalid image" }, 400);
  }

  const limit = await checkMonthlyLimit(adminClient, userId);
  if (!limit.allowed) {
    return json({ error: "monthly limit exceeded", plan: limit.plan, limit: limit.limit }, 429);
  }

  const { data: print, error: printError } = await adminClient
    .from("prints")
    .select("id, code, level, title, topic_jp, topic_en, word_count_min, word_count_max, structure, tips")
    .eq("code", printCode)
    .maybeSingle();

  if (printError || !print) {
    return json({ error: "print not found" }, 404);
  }

  const extracted = await extractAnswerFromImage(openAiKey, imageDataUrl);
  const answerText = extracted.answerText.trim();
  if (!answerText) {
    return json({ error: "answer is empty" }, 400);
  }
  const wordCount = countWords(answerText);
  if (wordCount < 5) {
    return json({ error: "answer is too short" }, 400);
  }

  const { data: submission, error: submissionError } = await adminClient
    .from("submissions")
    .insert({
      user_id: userId,
      print_id: print.id,
      answer_text: answerText,
      word_count: wordCount,
      status: "submitted"
    })
    .select("id, print_id, answer_text, word_count, status, created_at, updated_at")
    .single();

  if (submissionError || !submission) {
    console.error("failed to save image submission", submissionError);
    throw new Error("failed to save image submission");
  }

  const prompt = buildPrompt(print, answerText, wordCount);
  const aiResult = await callOpenAI(openAiKey, prompt);
  const feedback = normalizeFeedback(aiResult.feedback);

  const { data: insertedFeedback, error: feedbackError } = await adminClient
    .from("feedbacks")
    .insert({
      submission_id: submission.id,
      version: 1,
      total_score: feedback.total_score,
      grammar_score: feedback.grammar_score,
      vocabulary_score: feedback.vocabulary_score,
      logic_score: feedback.logic_score,
      structure_score: feedback.structure_score,
      consistency_score: feedback.consistency_score,
      eiken_level_estimate: feedback.eiken_level_estimate,
      word_count_feedback: feedback.word_count_feedback,
      good_points: feedback.good_points,
      improvement_points: feedback.improvement_points,
      sentence_corrections: feedback.sentence_corrections,
      corrected_sample: feedback.corrected_sample,
      next_advice: feedback.next_advice,
      raw_feedback: { ...feedback, image_ocr: extracted.rawText }
    })
    .select("*")
    .single();

  if (feedbackError) {
    console.error("failed to save image feedback", feedbackError);
    throw new Error("failed to save image feedback");
  }

  await adminClient
    .from("submissions")
    .update({ status: "reviewed", updated_at: new Date().toISOString() })
    .eq("id", submission.id);

  await adminClient.from("ai_usage_logs").insert({
    user_id: userId,
    submission_id: submission.id,
    model,
    input_tokens: extracted.inputTokens + aiResult.inputTokens,
    output_tokens: extracted.outputTokens + aiResult.outputTokens,
    estimated_cost: 0
  });

  return json({ submission, feedback: insertedFeedback }, 200);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function checkMonthlyLimit(adminClient: any, userId: string) {
  const { data: profile } = await adminClient
    .from("profiles")
    .select("subscription_plan, is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.is_admin) {
    return { allowed: true, plan: "Admin", limit: null };
  }

  const plan = profile?.subscription_plan ?? "Free";
  const limits: Record<string, number> = { Free: 3, Premium: 100, Pro: 300 };
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await adminClient
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  const used = count ?? 0;
  const limit = limits[plan] ?? limits.Free;
  return { allowed: used < limit, plan, limit };
}

function buildPrompt(print: any, answer: string, wordCount: number) {
  const levelCriteria: Record<string, string> = {
    Opinion: "50〜80語。意見と理由が書けているか。簡単でも正しい英文か。",
    Essay: "130〜170語。導入・本論・結論があるか。理由と具体例があるか。",
    Advanced: "180〜200語。英検準1級相当。意見、理由2つ、結論があるか。論理的な接続があるか。",
    Master: "240〜260語。英検1級相当。導入、本論、反対意見、再反論、結論があるか。抽象度の高いテーマを論理的に扱えているか。"
  };
  return `
あなたは日本人英語学習者向けの英作文添削者です。必ず日本語で簡潔にコメントしてください。
eiken_level_estimate は必ず「英検2級相当」「英検準1級合格圏」のように日本語の「英検」表記にしてください。
「EIKEN」「Eiken」「eiken」という英字表記は使わないでください。

レベル: ${print.level}
プリントコード: ${print.code}
タイトル: ${print.title}
日本語トピック: ${print.topic_jp}
英語トピック: ${print.topic_en}
語数目安: ${print.word_count_min}〜${print.word_count_max}語
実際の語数: ${wordCount}語
構成: ${JSON.stringify(print.structure)}
書く内容のポイント: ${JSON.stringify(print.tips)}

レベル別評価基準:
${levelCriteria[print.level] ?? ""}

採点項目:
- grammar_score: 文法の正確さ
- vocabulary_score: 語彙の自然さ・多様性
- logic_score: 論理展開
- structure_score: 構成の明確さ
- consistency_score: 内容の一貫性
- total_score: 上記5項目の平均を基本に100点満点

ユーザーの回答英文:
${answer}
`;
}

async function callOpenAI(apiKey: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You are a strict but supportive English writing examiner. Return only structured JSON."
        },
        { role: "user", content: prompt }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "essay_feedback",
          strict: true,
          schema: feedbackSchema
        }
      }
    })
  });

  if (!response.ok) {
    console.error("openai error", response.status, await response.text());
    throw new Error("openai error");
  }

  const data = await response.json();
  const text = data.output_text ?? data.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === "output_text")?.text;
  if (!text) {
    console.error("empty openai response", data);
    throw new Error("empty openai response");
  }

  return {
    feedback: JSON.parse(text),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0
  };
}

async function extractAnswerFromImage(apiKey: string, imageDataUrl: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You extract handwritten or printed English essay answers from worksheet photos. Return only the answer text, not the topic, labels, headers, scores, or Japanese instructions."
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "この画像の回答欄に書かれている英作文だけを読み取ってください。問題文、見出し、罫線、チェックリスト、日本語の説明は含めないでください。読み取れない単語は推測しすぎず、自然な英文として復元してください。"
            },
            {
              type: "input_image",
              image_url: imageDataUrl
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    console.error("openai image extraction error", response.status, await response.text());
    throw new Error("openai image extraction error");
  }

  const data = await response.json();
  const text = data.output_text ?? data.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === "output_text")?.text ?? "";
  return {
    answerText: String(text).trim(),
    rawText: text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0
  };
}

function normalizeFeedback(value: any) {
  const scores = ["grammar_score", "vocabulary_score", "logic_score", "structure_score", "consistency_score"];
  for (const key of scores) {
    value[key] = clampScore(value[key]);
  }
  const average = Math.round(scores.reduce((sum, key) => sum + value[key], 0) / scores.length);
  value.total_score = clampScore(value.total_score ?? average);
  return {
    ...value,
    eiken_level_estimate: normalizeEikenText(value.eiken_level_estimate),
    good_points: Array.isArray(value.good_points) ? value.good_points : [],
    improvement_points: Array.isArray(value.improvement_points) ? value.improvement_points : [],
    sentence_corrections: Array.isArray(value.sentence_corrections) ? value.sentence_corrections : []
  };
}

function normalizeEikenText(value: unknown) {
  const text = String(value ?? "").replace(/\bEIKEN\b/gi, "英検").replace(/英検\s+/g, "英検").trim();
  if (!text) return "";
  return text.startsWith("英検") ? text : `英検${text}`;
}

function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
