"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Repeat,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DayStat,
  DecreaseReason,
  IncreaseKind,
  StatsTargetKey,
} from "@/lib/daily-stats";

// タブごとの見た目・文言。Tailwind のクラスは静的文字列で持つ（動的生成だとビルドで落ちる）。
type ViewConfig = {
  title: string;
  icon: typeof Sparkles;
  iconClass: string;
  chartTitle: string;
  chartColor: string; // SVG の stroke/fill
  totalSub: string;
  totalAccent: string; // サマリーカードの残数の色
  totalCellClass: string; // テーブルの残数セルの色
  rowHoverClass: string;
  movedOutLabel: string;
  emptyMessage: string;
};

export const VIEW_CONFIGS: Record<StatsTargetKey, ViewConfig> = {
  petit: {
    title: "プチ改善 増減の推移",
    icon: Sparkles,
    iconClass: "text-violet-400",
    chartTitle: "残数の推移（未消化プチ改善）",
    chartColor: "#8b5cf6",
    totalSub: "ゼロを目指す母数",
    totalAccent: "text-violet-300",
    totalCellClass: "text-violet-600",
    rowHoverClass: "hover:bg-violet-50/60",
    movedOutLabel: "プチ改善外へ移動",
    emptyMessage:
      "スナップショットがまだありません。スナップショットが撮られると、ここに日次の増減が表示されます。",
  },
  improvement: {
    title: "改善 増減の推移",
    icon: Repeat,
    iconClass: "text-sky-400",
    chartTitle: "残数の推移（未完了の改善施策）",
    chartColor: "#0ea5e9",
    totalSub: "改善タブの未完了施策",
    totalAccent: "text-sky-300",
    totalCellClass: "text-sky-600",
    rowHoverClass: "hover:bg-sky-50/60",
    movedOutLabel: "改善外へ移動",
    emptyMessage:
      "集計がまだありません。日次スナップショット後、または /api/improvement-stats/backfill の実行後にここに表示されます。",
  },
};

const REASON_STYLE: Record<DecreaseReason, string> = {
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  movedOut: "bg-amber-50 text-amber-700 border-amber-200",
  deleted: "bg-slate-100 text-slate-600 border-slate-200",
};

const KIND_LABEL: Record<IncreaseKind, string> = {
  new: "新規",
  inflow: "流入",
};

// 残数の推移を描くシンプルな折れ線グラフ（外部ライブラリなし・インラインSVG）
// 横スクロールしても数値が読めるよう、y軸（目盛りの数値）はスクロール領域の外に固定で置き、
// 折れ線だけを横スクロールさせる。両者は同じ高さ・同じ y 変換を使う。
function TrendChart({ stats, color }: { stats: DayStat[]; color: string }) {
  // 1日48px固定幅なので日数が増えると横スクロールになる。
  // 見たいのは直近なので、表示時は右端（最新日）までスクロールしておく。
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [stats.length]);

  if (stats.length === 0) return null;

  const pad = { top: 16, right: 16, bottom: 28, left: 16 };
  const axisW = 32; // 固定表示するy軸の幅
  const stepX = 48;
  const innerW = Math.max((stats.length - 1) * stepX, stepX);
  const innerH = 140;
  const width = pad.left + innerW + pad.right;
  const height = pad.top + innerH + pad.bottom;

  const maxTotal = Math.max(1, ...stats.map((s) => s.total));
  const x = (i: number) =>
    pad.left + (stats.length === 1 ? innerW / 2 : (i / (stats.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / maxTotal) * innerH;
  const ticks = [0, maxTotal / 2, maxTotal];

  const points = stats.map((s, i) => `${x(i)},${y(s.total)}`).join(" ");
  const areaPath = `M ${x(0)},${pad.top + innerH} L ${points
    .split(" ")
    .join(" L ")} L ${x(stats.length - 1)},${pad.top + innerH} Z`;

  return (
    <div className="flex">
      {/* y軸（固定） */}
      <svg width={axisW} height={height} className="shrink-0 bg-white">
        {ticks.map((v, idx) => (
          <text
            key={idx}
            x={axisW - 6}
            y={y(v) + 3}
            textAnchor="end"
            className="fill-slate-400 text-[10px]"
          >
            {Math.round(v)}
          </text>
        ))}
        <line
          x1={axisW - 1}
          y1={pad.top}
          x2={axisW - 1}
          y2={pad.top + innerH}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      </svg>

      {/* 折れ線（横スクロール） */}
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
        <svg width={width} height={height}>
          {/* y軸グリッド（0 / 中間 / 最大） */}
          {ticks.map((v, idx) => (
            <line
              key={idx}
              x1={0}
              y1={y(v)}
              x2={width}
              y2={y(v)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          ))}

          <path d={areaPath} fill={color} fillOpacity={0.08} />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {stats.map((s, i) => (
            <g key={s.date}>
              <circle cx={x(i)} cy={y(s.total)} r={3} fill={color} />
              {/* 日付は毎日出す（1日48px幅なので MM-DD が収まる） */}
              <text
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {s.date.slice(5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
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

export function DailyStatsView({
  stats,
  target,
}: {
  stats: DayStat[];
  target: StatsTargetKey;
}) {
  const config = VIEW_CONFIGS[target];
  const Icon = config.icon;
  const reasonLabel: Record<DecreaseReason, string> = {
    published: "公開ずみ",
    movedOut: config.movedOutLabel,
    deleted: "削除",
  };
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
          <Icon size={16} className={config.iconClass} />
          <h2 className="text-sm font-medium text-white">{config.title}</h2>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="現在の残数（未完了）"
          value={`${summary.current}`}
          accent={config.totalAccent}
          sub={config.totalSub}
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
          {config.emptyMessage}
        </div>
      ) : (
        <>
          {/* 残数の推移チャート */}
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <div className="mb-2 text-xs font-medium text-black/60">
              {config.chartTitle}
            </div>
            <TrendChart stats={stats} color={config.chartColor} />
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
                      config={config}
                      reasonLabel={reasonLabel}
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
  config,
  reasonLabel,
  isOpen,
  hasDetail,
  onToggle,
}: {
  r: DayStat;
  config: ViewConfig;
  reasonLabel: Record<DecreaseReason, string>;
  isOpen: boolean;
  hasDetail: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-black/5 transition-colors",
          hasDetail && cn("cursor-pointer", config.rowHoverClass)
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
        <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", config.totalCellClass)}>
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
                ] as [DecreaseReason, number][]
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
                    {reasonLabel[reason]} {n}
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
                          {reasonLabel[it.reason]}
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
