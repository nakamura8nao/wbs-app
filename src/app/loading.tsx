import { Header } from "@/components/header";

// 6 つのビュー切替タブに対応したダミー幅
const TAB_WIDTHS = ["w-16", "w-20", "w-12", "w-14", "w-12", "w-16"];
// テーブルの列幅（優先度順ビューのヘッダーにおおよそ合わせている）
const COLS = ["w-8", "w-64", "w-20", "w-16", "w-24", "w-24", "w-24", "w-20", "w-16", "w-16"];

export default function Loading() {
  return (
    <div className="min-h-screen">
      {/* 上部を流れる読み込みバー：作業中であることが一目で伝わる */}
      <div className="fixed inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-primary-500/15">
        <div className="animate-loading-bar h-full w-1/2 rounded-full bg-primary-400" />
      </div>

      <Header />

      <main className="mx-auto max-w-[1600px] px-5 py-4 pb-8" aria-busy="true">
        {/* ステータス（スクリーンリーダー向け） */}
        <span className="sr-only" role="status">
          読み込み中です…
        </span>

        {/* ツールバー：ビュー切替タブ + 新規作成ボタンのスケルトン */}
        <div className="mb-4 flex items-center justify-between py-3">
          <div className="flex gap-0.5 rounded-xl bg-white/8 p-1 backdrop-blur-sm">
            {TAB_WIDTHS.map((w, i) => (
              <div
                key={i}
                className={`h-9 ${w} animate-pulse rounded-lg bg-white/10`}
              />
            ))}
          </div>
          <div className="h-9 w-28 animate-pulse rounded-lg bg-primary-500/30" />
        </div>

        {/* 一覧テーブルのスケルトン */}
        <div className="overflow-clip rounded-xl border border-white/20 bg-white shadow-xl shadow-black/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-gray-50">
                {COLS.map((w, i) => (
                  <th key={i} className="px-3 py-3 text-left">
                    <div className={`h-3 ${w} animate-pulse rounded bg-slate-200`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 9 }).map((_, row) => (
                <tr key={row}>
                  {COLS.map((w, col) => (
                    <td key={col} className="px-3 py-3.5">
                      <div
                        className={`h-3.5 ${w} animate-pulse rounded bg-slate-100`}
                        // 行ごとにわずかに位相をずらして「生きている」印象を出す
                        style={{ animationDelay: `${row * 80}ms` }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 中央のメッセージ */}
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/50">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          施策データを読み込んでいます…
        </div>
      </main>
    </div>
  );
}
