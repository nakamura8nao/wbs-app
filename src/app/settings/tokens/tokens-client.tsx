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

type CopyKey = "token" | "url";

export function TokensClient({ initialTokens }: { initialTokens: TokenRow[] }) {
  const [name, setName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<CopyKey | null>(null);

  const dumpUrl = issuedToken
    ? (typeof window !== "undefined" ? window.location.origin : "") +
      `/api/wbs/dump?token=${encodeURIComponent(issuedToken)}`
    : "";

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

  const handleCopy = async (key: CopyKey, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const active = initialTokens.filter((t) => !t.revoked_at);
  const revoked = initialTokens.filter((t) => t.revoked_at);

  return (
    <div className="space-y-8 text-base font-normal text-white">
      <header>
        <h1 className="text-2xl font-semibold">APIトークン</h1>
        <p className="mt-2 text-base text-white/80">
          Claude / CLI 等から <code className="rounded bg-white/10 px-1 font-mono text-white">/api/wbs/*</code> を呼び出すための個人アクセストークン。
          <br />
          発行されたトークンは <span className="font-semibold text-white">この画面でしか表示されません</span>。安全な場所に保管してください。
        </p>
      </header>

      {/* このAPIについて */}
      <section className="rounded-md border border-[#4a9eff]/30 bg-[#4a9eff]/[0.07] p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">このAPIでできること</h2>
        <p className="text-base leading-relaxed text-white/85">
          WBS の全データ（施策・フェーズ・メンバー・依存関係）をまとめて取得できます。
          集計はせず生データを返すので、Claude に渡せば「いま誰が何を持ってる？」「遅れてる施策は？」
          といった質問にそのまま答えてもらえます。
        </p>
        <div className="mt-3 rounded bg-black/30 px-4 py-3 text-base text-white/85">
          <div className="mb-1 text-sm font-semibold text-white/70">Claude での使い方（例）</div>
          発行した「完成URL」を貼って、こう聞くだけ：<br />
          <span className="text-white">「このURLのWBSデータを見て、今週遅れている施策を教えて → &lt;完成URL&gt;」</span>
        </div>
      </section>

      {issuedToken && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-5">
          <div className="text-base text-emerald-300">
            トークンを発行しました。今すぐコピーしてください。
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1.5 text-sm font-medium text-white/70">トークン本体</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-black/40 px-3 py-2 font-mono text-sm text-emerald-100">
                  {issuedToken}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy("token", issuedToken)}
                >
                  {copied === "token" ? "コピーしました" : "コピー"}
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-sm font-medium text-white/70">
                完成URL（dump 用、Claude WebFetch やブラウザにそのまま貼れる）
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-black/40 px-3 py-2 font-mono text-sm text-emerald-100">
                  {dumpUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy("url", dumpUrl)}
                >
                  {copied === "url" ? "コピーしました" : "URLコピー"}
                </Button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIssuedToken(null)}
            className="mt-4 text-sm text-white/60 hover:text-white/90"
          >
            閉じる（保存済みなら）
          </button>
        </div>
      )}

      <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-semibold">新規発行</h2>
        <form onSubmit={handleIssue} className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="用途名 (例: claude-mac)"
            className="h-10 flex-1 rounded-md border border-white/20 bg-white/10 px-3 text-base outline-none placeholder:text-white/40 focus:border-[#4a9eff]/60"
            maxLength={50}
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "発行中…" : "発行"}
          </Button>
        </form>
        {error && (
          <div className="mt-2 text-base text-red-400">{error}</div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">有効なトークン ({active.length})</h2>
        {active.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-center text-base text-white/65">
            有効なトークンはありません
          </div>
        ) : (
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/70">
                <th className="py-3 pr-3 font-normal">名前</th>
                <th className="py-3 pr-3 font-normal">作成</th>
                <th className="py-3 pr-3 font-normal">最終利用</th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((t) => (
                <tr key={t.id} className="border-b border-white/5">
                  <td className="py-3 pr-3">{t.name}</td>
                  <td className="py-3 pr-3 text-white/80">{fmt(t.created_at)}</td>
                  <td className="py-3 pr-3 text-white/80">{fmt(t.last_used_at)}</td>
                  <td className="py-3 text-right">
                    <Button
                      size="sm"
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

      <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-semibold">使い方</h2>

        <div className="space-y-6 text-base text-white/85">
          <div>
            <div className="mb-2 text-base text-white/90">完成URLをそのまま使う</div>
            <p className="mb-2 text-base text-white/80">
              発行直後に表示される「完成URL」をそのまま使います。Claude の WebFetch やブラウザに貼るだけで動きます。
            </p>
            <pre className="overflow-x-auto rounded bg-black/40 p-4 font-mono text-sm leading-relaxed text-white/90">
{`<このサイトのURL>/api/wbs/dump?token=wbs_xxxxxxxx`}
            </pre>
            <p className="mt-2 text-base text-white/70">
              <code className="text-white/70">401</code> が返ったらトークン失効。再発行してください。
            </p>
          </div>

          <div>
            <div className="mb-2 text-base text-white/90">利用可能なエンドポイント</div>
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/70">
                  <th className="py-2 pr-3 font-normal">パス</th>
                  <th className="py-2 pr-3 font-normal">クエリ</th>
                  <th className="py-2 font-normal">用途</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-3 font-mono text-white/80">GET /api/wbs/dump</td>
                  <td className="py-2 pr-3 text-white/80">
                    <code>?include_completed=1</code><br />
                    <code>?since=YYYY-MM-DD</code>
                  </td>
                  <td className="py-2 text-white/80">
                    members / projects / phases / phase_dependencies を一括取得（ローデータ）。
                    集計は呼び出し側で行う想定。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-base text-amber-200">
            ⚠️ トークンを Slack やチャットに貼らないでください（パスワード相当）。
            漏れた場合はこの画面で <span className="text-amber-100">失効</span> → 新しく発行し直してください。
          </div>
        </div>
      </section>

      {revoked.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white/55">
            失効済み ({revoked.length})
          </h2>
          <table className="w-full border-collapse text-base text-white/55">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="py-3 pr-3 font-normal">名前</th>
                <th className="py-3 pr-3 font-normal">作成</th>
                <th className="py-3 pr-3 font-normal">失効</th>
              </tr>
            </thead>
            <tbody>
              {revoked.map((t) => (
                <tr key={t.id} className="border-b border-white/5">
                  <td className="py-3 pr-3">{t.name}</td>
                  <td className="py-3 pr-3">{fmt(t.created_at)}</td>
                  <td className="py-3 pr-3">{fmt(t.revoked_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
