export type Level = "Opinion" | "Essay" | "Advanced" | "Master";
export type PrintStatus = "locked" | "unlocked" | "completed";
export type SubmissionStatus = "draft" | "submitted" | "reviewed" | "review_failed";
export type Plan = "Free" | "Premium" | "Pro";

export interface PrintItem {
  id: string;
  code: string;
  level: Level;
  title: string;
  topicJp: string;
  topicEn: string;
  wordCountMin: number;
  wordCountMax: number;
  structure: string[];
  tips: string[];
  pdfUrl: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface Feedback {
  id: string;
  submissionId: string;
  version: number;
  totalScore: number;
  grammarScore: number;
  vocabularyScore: number;
  logicScore: number;
  structureScore: number;
  consistencyScore: number;
  eikenLevelEstimate?: string;
  wordCountFeedback?: string;
  goodPoints: string[];
  improvementPoints: string[];
  sentenceCorrections?: SentenceCorrection[];
  correctedSample: string;
  nextAdvice: string;
  createdAt: string;
}

export interface SentenceCorrection {
  original: string;
  corrected: string;
  reason: string;
}

export interface Submission {
  id: string;
  printId: string;
  answerText: string;
  wordCount: number;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  feedback?: Feedback;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  subscriptionPlan: Plan;
  subscriptionStatus: "active" | "trialing" | "inactive" | "canceled";
  isAdmin?: boolean;
}

export interface PrintProgress {
  printId: string;
  status: PrintStatus;
  bestScore?: number;
  completedAt?: string;
}
