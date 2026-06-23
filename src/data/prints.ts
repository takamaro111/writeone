import type { Level, PrintItem } from "../types";
import records from "./printRecords.json";

export const levels: Level[] = ["Opinion", "Essay", "Advanced", "Master"];
export const prints = records as PrintItem[];

export function getPrintByCode(code: string) {
  return prints.find((item) => item.code === code);
}
