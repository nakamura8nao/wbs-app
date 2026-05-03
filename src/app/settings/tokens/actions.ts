"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateRawToken, sha256Hex } from "@/lib/api-token-utils";

export type IssueTokenResult =
  | { ok: true; raw: string; id: string }
  | { ok: false; error: string };

export async function issueToken(name: string): Promise<IssueTokenResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "名前を入力してください" };
  if (trimmed.length > 50) return { ok: false, error: "名前は50文字以内で入力してください" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログインです" };

  const raw = generateRawToken();
  const hash = await sha256Hex(raw);

  const { data, error } = await supabase
    .from("api_tokens")
    .insert({ user_id: user.id, name: trimmed, token_hash: hash })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "発行に失敗しました" };
  }

  revalidatePath("/settings/tokens");
  return { ok: true, raw, id: data.id };
}

export async function revokeToken(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログインです" };

  const { error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/tokens");
  return { ok: true };
}
