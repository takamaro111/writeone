import type { Feedback, PrintProgress, Submission, UserProfile } from "../types";

const keys = {
  profile: "writeone.profile",
  progress: "writeone.progress",
  submissions: "writeone.submissions",
  favorites: "writeone.favorites",
  drafts: "writeone.drafts"
};

function scopedKey(baseKey: string, ownerId?: string | null) {
  return ownerId ? `${baseKey}.${ownerId}` : baseKey;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getProfile(): UserProfile | null {
  return readJson<UserProfile | null>(keys.profile, null);
}

export function saveProfile(profile: UserProfile | null) {
  if (!profile) {
    localStorage.removeItem(keys.profile);
    return;
  }
  writeJson(keys.profile, profile);
}

export function getProgress(ownerId?: string | null): Record<string, PrintProgress> {
  return readJson<Record<string, PrintProgress>>(scopedKey(keys.progress, ownerId), {});
}

export function saveProgress(progress: Record<string, PrintProgress>, ownerId?: string | null) {
  writeJson(scopedKey(keys.progress, ownerId), progress);
}

export function getSubmissions(ownerId?: string | null): Submission[] {
  return readJson<Submission[]>(scopedKey(keys.submissions, ownerId), []);
}

export function saveSubmissions(submissions: Submission[], ownerId?: string | null) {
  writeJson(scopedKey(keys.submissions, ownerId), submissions);
}

export function getFavorites(ownerId?: string | null): string[] {
  return readJson<string[]>(scopedKey(keys.favorites, ownerId), []);
}

export function saveFavorites(favorites: string[], ownerId?: string | null) {
  writeJson(scopedKey(keys.favorites, ownerId), favorites);
}

export function getDrafts(ownerId?: string | null): Record<string, string> {
  return readJson<Record<string, string>>(scopedKey(keys.drafts, ownerId), {});
}

export function saveDraft(printId: string, answer: string, ownerId?: string | null) {
  const drafts = getDrafts(ownerId);
  drafts[printId] = answer;
  writeJson(scopedKey(keys.drafts, ownerId), drafts);
}

export function clearDraft(printId: string, ownerId?: string | null) {
  const drafts = getDrafts(ownerId);
  delete drafts[printId];
  writeJson(scopedKey(keys.drafts, ownerId), drafts);
}

export function makeFeedback(submissionId: string, score: number, answer: string): Feedback {
  return {
    id: crypto.randomUUID(),
    submissionId,
    version: 1,
    totalScore: score,
    grammarScore: Math.min(100, score + 3),
    vocabularyScore: Math.max(50, score - 4),
    logicScore: Math.max(50, score - 1),
    structureScore: Math.min(100, score + 1),
    consistencyScore: Math.max(50, score - 2),
    eikenLevelEstimate: score >= 80 ? "英検準1級合格圏" : "基礎を固める段階",
    wordCountFeedback: "語数は目安と比較して確認してください。",
    goodPoints: ["主張が明確です", "テーマに対する答えが読み取りやすいです"],
    improvementPoints: ["具体例をもう少し増やしましょう", "理由を段落ごとに整理すると説得力が上がります"],
    sentenceCorrections: [
      {
        original: "I think environment is important than economy.",
        corrected: "I think the environment is more important than the economy.",
        reason: "比較表現では more important than を使います。"
      }
    ],
    correctedSample: answer.trim()
      ? `${answer.trim()}\n\n[Sample revision] Try adding one concrete example and a clearer concluding sentence.`
      : "Please write your answer first. A corrected sample will appear here.",
    nextAdvice: "次回は理由と具体例を1セットにして書く練習をしましょう。",
    createdAt: new Date().toISOString()
  };
}
