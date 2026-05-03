// Bearer トークン認証 (個人アクセストークン)
// /api/wbs/* 用。Cookie ではなく Authorization ヘッダの Bearer を見る。

import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { sha256Hex } from "@/lib/api-token-utils";

export type ApiAuthSuccess = {
  ok: true;
  userId: string;
  tokenId: string;
};

export type ApiAuthFailure = {
  ok: false;
  status: number;
  error: string;
};

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

export function createAdminClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function authenticateBearer(request: Request): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: "missing bearer token" };
  }
  const raw = match[1].trim();
  if (!raw) {
    return { ok: false, status: 401, error: "empty bearer token" };
  }

  const hash = await sha256Hex(raw);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "auth lookup failed" };
  }
  if (!data) {
    return { ok: false, status: 401, error: "invalid bearer token" };
  }

  // last_used_at をベストエフォートで更新 (失敗しても認証は成功扱い)
  void supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  return { ok: true, userId: data.user_id, tokenId: data.id };
}
