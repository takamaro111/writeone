import { supabase } from "./supabase";

export interface AdminStats {
  users: number;
  submissions: number;
  aiUsage: number;
}

async function countRows(table: string) {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadAdminStats(): Promise<AdminStats> {
  const [users, submissions, aiUsage] = await Promise.all([
    countRows("profiles"),
    countRows("submissions"),
    countRows("ai_usage_logs")
  ]);

  return { users, submissions, aiUsage };
}
