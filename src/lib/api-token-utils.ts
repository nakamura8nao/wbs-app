// 個人アクセストークン (Bearer 認証用) のユーティリティ
// 生トークンは "wbs_" プレフィックス + 32 バイトのランダム HEX。
// DB には SHA-256 ハッシュ (HEX) のみ保存し、生値は発行直後の1回だけ表示する。

const TOKEN_PREFIX = "wbs_";

export function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${TOKEN_PREFIX}${hex}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
