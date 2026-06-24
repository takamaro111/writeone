import { getPrintByCode } from "../data/prints";
import type { Feedback, PrintItem, PrintProgress, Submission } from "../types";
import { supabase } from "./supabase";

function toFeedback(row: any): Feedback {
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

async function getDbPrintId(print: PrintItem) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("prints")
    .select("id")
    .eq("code", print.code)
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export async function loadCloudLearningState() {
  if (!supabase) {
    return { submissions: [] as Submission[], progress: {} as Record<string, PrintProgress>, favorites: [] as string[] };
  }

  const [submissionResult, progressResult, favoriteResult] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, answer_text, word_count, status, created_at, updated_at, prints!inner(code), feedbacks(*)")
      .order("created_at", { ascending: true }),
    supabase
      .from("user_print_progress")
      .select("status, best_score, completed_at, prints!inner(code)"),
    supabase
      .from("favorites")
      .select("prints!inner(code)")
  ]);

  if (submissionResult.error) throw new Error(submissionResult.error.message);
  if (progressResult.error) throw new Error(progressResult.error.message);
  if (favoriteResult.error) throw new Error(favoriteResult.error.message);

  const submissions = (submissionResult.data ?? []).flatMap((row: any) => {
    const print = getPrintByCode(row.prints?.code);
    if (!print) return [];
    const feedbackRows = Array.isArray(row.feedbacks) ? row.feedbacks : [];
    const feedback = feedbackRows
      .slice()
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(toFeedback)[0];

    return [{
      id: row.id,
      printId: print.id,
      answerText: row.answer_text,
      wordCount: row.word_count,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      feedback
    } satisfies Submission];
  });

  const progress = (progressResult.data ?? []).reduce((acc: Record<string, PrintProgress>, row: any) => {
    const print = getPrintByCode(row.prints?.code);
    if (!print) return acc;
    acc[print.id] = {
      printId: print.id,
      status: row.status,
      bestScore: row.best_score ?? undefined,
      completedAt: row.completed_at ?? undefined
    };
    return acc;
  }, {});

  const favorites = (favoriteResult.data ?? []).flatMap((row: any) => {
    const print = getPrintByCode(row.prints?.code);
    return print ? [print.id] : [];
  });

  return { submissions, progress, favorites };
}

export async function upsertCloudProgress(print: PrintItem, progress: PrintProgress, userId: string) {
  if (!supabase) return;
  const printId = await getDbPrintId(print);
  if (!printId) return;

  const { error } = await supabase.from("user_print_progress").upsert({
    user_id: userId,
    print_id: printId,
    status: progress.status,
    best_score: progress.bestScore ?? null,
    completed_at: progress.completedAt ?? null
  }, { onConflict: "user_id,print_id" });

  if (error) throw new Error(error.message);
}

export async function setCloudFavorite(print: PrintItem, isFavorite: boolean, userId: string) {
  if (!supabase) return;
  const printId = await getDbPrintId(print);
  if (!printId) return;

  if (isFavorite) {
    const { error } = await supabase.from("favorites").upsert({
      user_id: userId,
      print_id: printId
    }, { onConflict: "user_id,print_id" });
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("print_id", printId);

  if (error) throw new Error(error.message);
}
