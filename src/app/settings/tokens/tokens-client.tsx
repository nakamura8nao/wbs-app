"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { issueToken, revokeToken } from "./actions";

type TokenRow = {
  id: string;
  name: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const fmt = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

export function TokensClient({ initialTokens }: { initialTokens: TokenRow[] }) {
  const [name, setName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await issueToken(name);
      if (result.ok) {
        setIssuedToken(result.raw);
        setName("");
      } else {
        setError(result.error);
      }
    });
  };

  const handleRevoke = (id: string, displayName: string) => {
    if (!confirm(`「${displayName}」を失効させますか？この操作は取り消せません。`)) return;
    startTransition(async () => {
      const result = await revokeToken(id);
      if (!result.ok) setError(result.error);
    });
  };

  const handleCopy = async () => {
    if (!issuedToken) return;
    await navigator.clipboard.writeText(issuedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const active = initialTokens.filter((t) => !t.revoked_at);
  const revoked = initialTokens.filter((t) => t.revoked_at);

  return (
    <div className="space-y-6 text-white">
      <header>
        <h1 className="text-xl font-bold">APIトークン</h1>
        <p className="mt-1 text-xs text-white/50">
          Claude / CLI 等から /api/wbs/* を呼び出すための個人アクセストークン。
          <br />
          発行されたトークンは <strong>この画面でしか表示されません</strong>。安全な場所に保管してください。
        </p>
      </header>

      {issuedToken && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="text-xs font-medium text-emerald-300">
            トークンを発行しました。今すぐコピーしてください。
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-black/40 px-2 py-1.5 font-mono text-xs text-emerald-100">
              {issuedToken}
            </code>
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? "コピーしました" : "コピー"}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setIssuedToken(null)}
            className="mt-3 text-xs text-white/40 hover:text-white/70"
          >
            閉じる（保存済みなら）
          </button>
        </div>
      )}

      <section className="rounded-md border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-sm font-semibold">新規発行</h2>
        <form onSubmit={handleIssue} className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="用途名 (例: claude-mac)"
            className="h-8 flex-1 rounded-md border border-white/15 bg-white/10 px-3 text-sm outline-none placeholder:text-white/25 focus:border-[#4a9eff]/50"
            maxLength={50}
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "発行中…" : "発行"}
          </Button>
        </form>
        {error && (
          <div className="mt-2 text-xs text-red-400">{error}</div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">有効なトークン ({active.length})</h2>
        {active.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-center text-xs text-white/40">
            有効なトークンはありません
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/50">
                <th className="py-2 pr-3 font-medium">名前</th>
                <th className="py-2 pr-3 font-medium">作成</th>
                <th className="py-2 pr-3 font-medium">最終利用</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((t) => (
                <tr key={t.id} className="border-b border-white/5">
                  <td className="py-2 pr-3">{t.name}</td>
                  <td className="py-2 pr-3 text-white/60">{fmt(t.created_at)}</td>
                  <td className="py-2 pr-3 text-white/60">{fmt(t.last_used_at)}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => handleRevoke(t.id, t.name)}
                      disabled={pending}
                    >
                      失効
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {revoked.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-white/40">
            失効済み ({revoked.length})
          </h2>
          <table className="w-full border-collapse text-xs text-white/40">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="py-2 pr-3 font-medium">名前</th>
                <th className="py-2 pr-3 font-medium">作成</th>
                <th className="py-2 pr-3 font-medium">失効</th>
              </tr>
            </thead>
            <tbody>
              {revoked.map((t) => (
                <tr key={t.id} className="border-b border-white/5">
                  <td className="py-2 pr-3">{t.name}</td>
                  <td className="py-2 pr-3">{fmt(t.created_at)}</td>
                  <td className="py-2 pr-3">{fmt(t.revoked_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
