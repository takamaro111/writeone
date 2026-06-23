import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { print, answer, submission_id } = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";

    if (!apiKey) {
      return json(mockFeedback(answer), 200);
    }

    const prompt = [
      "You are an expert English writing examiner for Japanese learners.",
      "Return only valid JSON with these keys:",
      "total_score, grammar_score, vocabulary_score, logic_score, structure_score, consistency_score, good_points, improvement_points, corrected_sample, next_advice.",
      `Print code: ${print?.code}`,
      `Level: ${print?.level}`,
      `Topic JP: ${print?.topicJp}`,
      `Topic EN: ${print?.topicEn}`,
      `Word range: ${print?.wordCountMin}-${print?.wordCountMax}`,
      `Answer: ${answer}`
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You grade writing strictly but helpfully. Japanese comments are preferred." },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : mockFeedback(answer);
    parsed.submission_id = submission_id;
    return json(parsed, 200);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

function mockFeedback(answer: string) {
  const words = String(answer ?? "").trim().split(/\s+/).filter(Boolean).length;
  const score = words > 80 ? 84 : 72;
  return {
    total_score: score,
    grammar_score: score + 2,
    vocabulary_score: score - 2,
    logic_score: score,
    structure_score: score + 1,
    consistency_score: score - 1,
    good_points: ["主張が明確です"],
    improvement_points: ["具体例をもう少し増やしましょう"],
    corrected_sample: "This is a sample revised answer. Add clear reasons and one concrete example.",
    next_advice: "次回は理由と具体例を分けて書きましょう。"
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
