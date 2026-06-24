import type { UserProfile } from "../types";
import { isSupabaseEnabled, supabase } from "./supabase";

interface AuthInput {
  email: string;
  password: string;
  displayName: string;
}

const DEFAULT_DISPLAY_NAME = "山田太郎";

function toProfile(row: any, fallbackEmail = ""): UserProfile {
  return {
    id: row.id,
    email: row.email ?? fallbackEmail,
    displayName: row.display_name ?? DEFAULT_DISPLAY_NAME,
    createdAt: row.created_at ?? new Date().toISOString(),
    subscriptionPlan: row.subscription_plan ?? "Free",
    subscriptionStatus: row.subscription_status ?? "active",
    isAdmin: Boolean(row.is_admin)
  };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return ensureProfile(user.id, user.email ?? "", user.user_metadata?.display_name ?? DEFAULT_DISPLAY_NAME);
}

export async function signUpWithEmail(input: AuthInput): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabaseが設定されていません。");
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName || DEFAULT_DISPLAY_NAME }
    }
  });
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error("ユーザー作成に失敗しました。");
  return ensureProfile(user.id, user.email ?? input.email, input.displayName || DEFAULT_DISPLAY_NAME);
}

export async function signInWithEmail(email: string, password: string): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabaseが設定されていません。");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error("ログインに失敗しました。");
  return ensureProfile(user.id, user.email ?? email, user.user_metadata?.display_name ?? DEFAULT_DISPLAY_NAME);
}

export async function signInWithProvider(provider: "google" | "apple") {
  if (!supabase) throw new Error("Supabaseが設定されていません。");
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export function canUseSupabaseAuth() {
  return isSupabaseEnabled;
}

async function ensureProfile(id: string, email: string, displayName: string): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabaseが設定されていません。");
  const { data } = await supabase
    .from("profiles")
    .select("id, email, display_name, created_at, subscription_plan, subscription_status, is_admin")
    .eq("id", id)
    .maybeSingle();
  if (data) return toProfile(data, email);

  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({
      id,
      email,
      display_name: displayName || DEFAULT_DISPLAY_NAME,
      subscription_plan: "Free",
      subscription_status: "active"
    })
    .select("id, email, display_name, created_at, subscription_plan, subscription_status, is_admin")
    .single();

  if (error) throw new Error(error.message);
  return toProfile(inserted, email);
}
