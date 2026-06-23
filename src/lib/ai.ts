import type { Feedback, PrintItem } from "../types";
import { makeFeedback } from "./storage";

export async function requestAiFeedback(print: PrintItem, answer: string, submissionId: string): Promise<Feedback> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const wordFit = answer.split(/\s+/).filter(Boolean).length >= print.wordCountMin;
  return makeFeedback(submissionId, wordFit ? 84 : 72, answer);
}
