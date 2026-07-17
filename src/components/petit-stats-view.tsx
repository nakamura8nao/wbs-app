"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PetitDayStat,
  PetitDecreaseReason,
  PetitIncreaseKind,
} from "@/lib/petit-stats";

const REASON_LABEL: Record<PetitDecreaseReason, string> = {
  published: "公開ずみ",
  movedOut: "プチ改善外へ移動",
  deleted: "削除",
};

const REASON_STYLE: Record<PetitDecreaseReason, string> = {
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  movedOut: "bg-amber-50 text-amber-700 border-amber-200",
  deleted: "bg-slate-100 text-slate-600 border-slate-200",
};

const KIND_LABEL: Record<PetitIncreaseKind, string> = {
  new: "新規",
  inflow: "流入",
};

// 残数の推移を描くシンプルな折れ線グラフ（外部ライブラリなし・インラインSVG）
function TrendChart({ stats }: { stats: PetitDayStat[] }) {
  if (stats.length === 0) return null;

  const pad = { top: 16, right: 16, bottom: 28, left: 32 };
  const stepX = 48;
  const innerW = Math.max((stats.length - 1) * stepX, stepX);
  const innerH = 140;
  const width = pad.left + innerW + pad.right;
  const height = pad.top + innerH + pad.bottom;

  const maxTotal = Math.max(1, ...stats.map((s) => s.total));
  const x = (i: number) =>
    pad.left + (stats.length === 1 ? innerW / 2 : (i / (stats.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / maxTotal) * innerH;

  const points = stats.map((s, i) => `${x(i)},${y(s.total)}`).join(" ");
  const areaPath = `M ${x(0)},${pad.top + innerH} L ${points
    .split(" ")
    .join(" L ")} L ${x(stats.length - 1)},${pad.top + innerH} Z`;

  // x軸ラベルは詰まりすぎないよう間引く
  const labelEvery = Math.ceil(stats.length / 12);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        {/* y軸グリッド（0 / 中間 / 最大） */}
        {[0, maxTotal / 2, maxTotal].map((v, idx) => (
          <g key={idx}>
            <line
              x1={pad.left}
              y1={y(v)}
              x2={pad.left + innerW}
              y2={y(v)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[10px]"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="#8b5cf6" fillOpacity={0.08} />
        <polyline
          points={points}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {stats.map((s, i) => (
          <g key={s.date}>
            <circle cx={x(i)} cy={y(s.total)} r={3} fill="#8b5cf6" />
            {i % labelEvery === 0 && (
              <text
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {s.date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", accent)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

export function PetitStatsView({ stats }: { stats: PetitDayStat[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (date: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  // 期間累計（減少内訳）と現在値
  const summary = useMemo(() => {
    const latest = stats[stats.length - 1];
    const totals = stats.reduce(
      (acc, s) => {
        acc.increase += s.increase;
        acc.published += s.breakdown.published;
        acc.movedOut += s.breakdown.movedOut;
        acc.deleted += s.breakdown.deleted;
        return acc;
      },
      { increase: 0, published: 0, movedOut: 0, deleted: 0 }
    );
    const decrease = totals.published + totals.movedOut + totals.deleted;
    return {
      current: latest?.total ?? 0,
      increase: totals.increase,
      decrease,
      published: totals.published,
      movedOut: totals.movedOut,
      deleted: totals.deleted,
    };
  }, [stats]);

  // テーブルは新しい日付が上
  const rows = useMemo(() => [...stats].reverse(), [stats]);

  const theadClasses =
    "border-b border-black/5 text-left text-[11px] font-medium text-black/60";

  return (
    <div className="space-y-4">
      {/* 見出し + 施策一覧のプチ改善ビューへ戻る導線 */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white/70"
        >
          <ArrowLeft size={13} />
          施策一覧へ
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-400" />
          <h2 className="text-sm font-medium text-white">プチ改善 増減の推移</h2>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="現在の残数（未消化）"
          value={`${summary.current}`}
          accent="text-violet-300"
          sub="ゼロを目指す母数"
        />
        <SummaryCard
          label="累計 増加"
          value={`+${summary.increase}`}
          accent="text-rose-300"
        />
        <SummaryCard
          label="累計 減少"
          value={`−${summary.decrease}`}
          accent="text-emerald-300"
          sub={`公開${summary.published} / 移動${summary.movedOut} / 削除${summary.deleted}`}
        />
        <SummaryCard
          label="純増減（累計）"
          value={
            summary.increase - summary.decrease >= 0
              ? `+${summary.increase - summary.decrease}`
              : `${summary.increase - summary.decrease}`
          }
          accent="text-white/80"
        />
      </div>

      {stats.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 py-16 text-center text-sm text-white/50">
          スナップショットがまだありません。スナップショットが撮られると、ここに日次の増減が表示されます。
        </div>
      ) : (
        <>
          {/* 残数の推移チャート */}
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <div className="mb-2 text-xs font-medium text-black/60">
              残数の推移（未消化プチ改善）
            </div>
            <TrendChart stats={stats} />
          </div>

          {/* 日次テーブル */}
          <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className={theadClasses}>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-3 py-2">日付</th>
                  <th className="w-20 px-3 py-2 text-right">残数</th>
                  <th className="w-20 px-3 py-2 text-right">増加</th>
                  <th className="w-20 px-3 py-2 text-right">減少</th>
                  <th className="px-3 py-2">減少の内訳</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const hasDetail =
                    r.increasedItems.length > 0 || r.decreasedItems.length > 0;
                  const isOpen = expanded.has(r.date);
                  return (
                    <FragmentRow
                      key={r.date}
                      r={r}
                      isOpen={isOpen}
                      hasDetail={hasDetail}
                      onToggle={() => hasDetail && toggle(r.date)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FragmentRow({
  r,
  isOpen,
  hasDetail,
  onToggle,
}: {
  r: PetitDayStat;
  isOpen: boolean;
  hasDetail: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-black/5 transition-colors",
          hasDetail && "cursor-pointer hover:bg-violet-50/60"
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-2 text-black/30">
          {hasDetail ? (
            isOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : null}
        </td>
        <td className="px-3 py-2 font-medium text-foreground">
          {r.date}
          {r.isBaseline && (
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
              基準日
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums text-violet-600">
          {r.total}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {r.isBaseline ? (
            <span className="text-black/25">—</span>
          ) : r.increase > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-rose-500">
              <ArrowUp size={12} />
              {r.increase}
            </span>
          ) : (
            <span className="text-black/25">0</span>
          )}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {r.isBaseline ? (
            <span className="text-black/25">—</span>
          ) : r.decrease > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <ArrowDown size={12} />
              {r.decrease}
            </span>
          ) : (
            <span className="text-black/25">0</span>
          )}
        </td>
        <td className="px-3 py-2">
          {r.isBaseline ? (
            <span className="text-xs text-black/25">—</span>
          ) : r.decrease === 0 ? (
            <span className="text-xs text-black/25">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["published", r.breakdown.published],
                  ["movedOut", r.breakdown.movedOut],
                  ["deleted", r.breakdown.deleted],
                ] as [PetitDecreaseReason, number][]
              )
                .filter(([, n]) => n > 0)
                .map(([reason, n]) => (
                  <span
                    key={reason}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px]",
                      REASON_STYLE[reason]
                    )}
                  >
                    {REASON_LABEL[reason]} {n}
                  </span>
                ))}
            </div>
          )}
        </td>
      </tr>

      {isOpen && hasDetail && (
        <tr className="border-b border-black/5 bg-slate-50/60">
          <td></td>
          <td colSpan={5} className="px-3 py-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-rose-500">
                  増加 {r.increasedItems.length}件
                </div>
                {r.increasedItems.length === 0 ? (
                  <div className="text-xs text-black/30">なし</div>
                ) : (
                  <ul className="space-y-1">
                    {r.increasedItems.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-xs">
                        <span className="rounded bg-rose-50 px-1 py-0.5 text-[10px] text-rose-600">
                          {KIND_LABEL[it.kind]}
                        </span>
                        <span className="text-black/70">{it.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-emerald-600">
                  減少 {r.decreasedItems.length}件
                </div>
                {r.decreasedItems.length === 0 ? (
                  <div className="text-xs text-black/30">なし</div>
                ) : (
                  <ul className="space-y-1">
                    {r.decreasedItems.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            "rounded border px-1 py-0.5 text-[10px]",
                            REASON_STYLE[it.reason]
                          )}
                        >
                          {REASON_LABEL[it.reason]}
                        </span>
                        <span className="text-black/70">{it.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
