import type { Feedback, PrintItem, Submission } from "../types";
import { requestAiFeedback } from "./ai";
import { supabase } from "./supabase";

export interface GradeEssayResult {
  submission: Submission;
  feedback: Feedback;
}

interface GradeEssayOptions {
  imageDataUrl?: string;
}

function toCamelFeedback(row: any): Feedback {
  return {
    id: row.id,
    submissionId: row.submission_id,
    version: row.version,
    totalScore: row.total_score,
    grammarScore: row.grammar_score,
    vocabularyScore: row.vocabulary_score,
    logicScore: row.logic_score,
    structureScore: row.structure_score,
    consistencyScore: row.consistency_score,
    eikenLevelEstimate: row.eiken_level_estimate ?? undefined,
    wordCountFeedback: row.word_count_feedback ?? undefined,
    goodPoints: row.good_points ?? [],
    improvementPoints: row.improvement_points ?? [],
    sentenceCorrections: row.sentence_corrections ?? [],
    correctedSample: row.corrected_sample ?? "",
    nextAdvice: row.next_advice ?? "",
    createdAt: row.created_at
  };
}

async function readFunctionError(error: any) {
  const response = error?.context;
  if (!response || typeof response.json !== "function") return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function gradeEssay(print: PrintItem, answer: string, options: GradeEssayOptions = {}): Promise<GradeEssayResult> {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  if (!supabase) {
    const submissionId = crypto.randomUUID();
    const feedback = await requestAiFeedback(print, answer, submissionId);
    return {
      submission: {
        id: submissionId,
        printId: print.id,
        answerText: answer,
        wordCount,
        status: "reviewed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        feedback
      },
      feedback
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    throw new Error("AI添削を利用するにはログインが必要です。");
  }

  const { data: dbPrint, error: printError } = await supabase
    .from("prints")
    .select("id")
    .eq("code", print.code)
    .single();

  if (printError || !dbPrint) {
    throw new Error("プリントデータがSupabaseに見つかりません。printsテーブルを確認してください。");
  }

  if (options.imageDataUrl) {
    const { data, error } = await supabase.functions.invoke("grade-essay", {
      body: {
        print_code: print.code,
        image_data_url: options.imageDataUrl
      }
    });

    if (error) {
      const details = await readFunctionError(error);
      if (details?.error === "monthly limit exceeded") {
        const limit = Number(details.limit) || 3;
        const plan = details.plan ?? "Free";
        throw new Error(`${plan}プランのAI添削は月${limit}回までです。来月になると再び利用できます。`);
      }
      if (details?.error === "answer is empty") {
        throw new Error("写真から英文を読み取れませんでした。明るい場所で、回答欄が大きく写るように撮影してください。");
      }
      if (details?.error === "answer is too short") {
        throw new Error("写真から読み取れた英文が短すぎました。回答欄全体が大きく写るように撮り直してください。");
      }
      throw new Error("画像からのAI添削に失敗しました。写真を撮り直してもう一度お試しください。");
    }

    const feedbackRow = data?.feedback;
    const submissionRow = data?.submission;
    if (!feedbackRow || !submissionRow) {
      throw new Error("添削結果を取得できませんでした。");
    }

    const feedback = toCamelFeedback(feedbackRow);
    return {
      submission: {
        id: submissionRow.id,
        printId: print.id,
        answerText: submissionRow.answer_text,
        wordCount: submissionRow.word_count,
        status: "reviewed",
        createdAt: submissionRow.created_at,
        updatedAt: submissionRow.updated_at,
        feedback
      },
      feedback
    };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert({
      user_id: user.id,
      print_id: dbPrint.id,
      answer_text: answer,
      word_count: wordCount,
      status: "submitted"
    })
    .select("id, print_id, answer_text, word_count, status, created_at, updated_at")
    .single();

  if (submissionError || !submission) {
    throw new Error("回答の保存に失敗しました。");
  }

  const { data, error } = await supabase.functions.invoke("grade-essay", {
    body: { submission_id: submission.id }
  });

  if (error) {
    const details = await readFunctionError(error);
    if (details?.error === "monthly limit exceeded") {
      const limit = Number(details.limit) || 3;
      const plan = details.plan ?? "Free";
      throw new Error(`${plan}プランのAI添削は月${limit}回までです。来月になると再び利用できます。`);
    }
    throw new Error("AI添削に失敗しました。しばらくしてからもう一度お試しください。");
  }

  const feedbackRow = data?.feedback;
  if (!feedbackRow) {
    throw new Error("添削結果を取得できませんでした。");
  }

  const feedback = toCamelFeedback(feedbackRow);
  return {
    submission: {
      id: submission.id,
      printId: print.id,
      answerText: submission.answer_text,
      wordCount: submission.word_count,
      status: "reviewed",
      createdAt: submission.created_at,
      updatedAt: submission.updated_at,
      feedback
    },
    feedback
  };
}
