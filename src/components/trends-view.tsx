"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATS_SCOPES, type StatsScope } from "@/lib/daily-stats";
import { ScopeToggle } from "@/components/scope-toggle";

// 推移ページの1日分。backlog（全案件）と requirement（要求定義）の軽量な数だけを持つ。
// どちらかの集計が無い日は null（バックフィル前など）。
export type TrendMetric = {
  total: number; // その日終わりの未完了数
  published: number; // 前日から完了した数
  increase: number; // 前日から増えた数
  isBaseline: boolean; // 最初の日。前日が無いので完了・増加は出せない
};

export type TrendRow = {
  date: string; // YYYY-MM-DD
  backlog: TrendMetric | null;
  requirement: TrendMetric | null;
};

// 系列の色。案件全体＝sky、要求定義＝amber（要求定義ページの残数の色と同じ）
const SERIES = {
  backlog: { label: "未完了案件", color: "#0ea5e9", cellClass: "text-sky-600" },
  requirement: { label: "要求定義未完了", color: "#f59e0b", cellClass: "text-amber-600" },
} as const;

const mmdd = (date: string) => date.slice(5).replace("-", "/");

function monthAgo(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

// 最新日まで横スクロールした状態で開く（折れ線・棒で共通）
function useScrollToEnd(dep: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [dep]);
  return ref;
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-black/60">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className={cn("inline-block w-4", it.dashed ? "border-t-2 border-dashed" : "h-0.5 rounded")}
            style={it.dashed ? { borderColor: it.color } : { backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function YAxis({ ticks, y, height, pad }: { ticks: number[]; y: (v: number) => number; height: number; pad: { top: number }; }) {
  const axisW = 32;
  return (
    <svg width={axisW} height={height} className="shrink-0 bg-white">
      {ticks.map((v, idx) => (
        <text key={idx} x={axisW - 6} y={y(v) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
          {Math.round(v)}
        </text>
      ))}
      <line x1={axisW - 1} y1={pad.top} x2={axisW - 1} y2={y(0)} stroke="#e2e8f0" strokeWidth={1} />
    </svg>
  );
}

// 未完了数の折れ線（案件全体と要求定義を同じ軸に重ねる）
function RemainingChart({ rows }: { rows: TrendRow[] }) {
  const ref = useScrollToEnd(rows.length);
  if (rows.length === 0) return null;

  const pad = { top: 16, right: 16, bottom: 28, left: 16 };
  const stepX = 48;
  const innerW = Math.max((rows.length - 1) * stepX, stepX);
  const innerH = 140;
  const width = pad.left + innerW + pad.right;
  const height = pad.top + innerH + pad.bottom;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.backlog?.total ?? 0, r.requirement?.total ?? 0)));
  const x = (i: number) => pad.left + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const line = (pick: (r: TrendRow) => number | null) =>
    rows
      .map((r, i) => {
        const v = pick(r);
        return v === null ? null : `${x(i)},${y(v)}`;
      })
      .filter((p): p is string => p !== null)
      .join(" ");

  return (
    <div>
      <Legend items={[SERIES.backlog, SERIES.requirement]} />
      <div className="flex">
        <YAxis ticks={ticks} y={y} height={height} pad={pad} />
        <div ref={ref} className="min-w-0 flex-1 overflow-x-auto">
          <svg width={width} height={height}>
            {ticks.map((v, idx) => (
              <line key={idx} x1={0} y1={y(v)} x2={width} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            ))}
            <polyline points={line((r) => r.backlog?.total ?? null)} fill="none" stroke={SERIES.backlog.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={line((r) => r.requirement?.total ?? null)} fill="none" stroke={SERIES.requirement.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {rows.map((r, i) => (
              <g key={r.date}>
                <title>{`${mmdd(r.date)}  未完了 ${r.backlog?.total ?? "—"} / 要求定義未完了 ${r.requirement?.total ?? "—"}`}</title>
                <rect x={x(i) - stepX / 2} y={pad.top} width={stepX} height={innerH} fill="transparent" />
                {r.backlog && <circle cx={x(i)} cy={y(r.backlog.total)} r={3} fill={SERIES.backlog.color} />}
                {r.requirement && <circle cx={x(i)} cy={y(r.requirement.total)} r={3} fill={SERIES.requirement.color} />}
                <text x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {r.date.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

// 日別の完了数の棒（案件全体の完了と要求定義完了を日ごとに並べる）
function CompletedChart({ rows }: { rows: TrendRow[] }) {
  const ref = useScrollToEnd(rows.length);
  const days = rows.filter((r) => !(r.backlog?.isBaseline ?? r.requirement?.isBaseline ?? true));
  if (days.length === 0) return null;

  const pad = { top: 18, right: 12, bottom: 28, left: 12 };
  const stepX = 48;
  const barW = 14;
  const innerH = 120;
  const width = pad.left + days.length * stepX + pad.right;
  const height = pad.top + innerH + pad.bottom;
  const max = Math.max(1, ...days.map((r) => Math.max(r.backlog?.published ?? 0, r.requirement?.published ?? 0)));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const bar = (i: number, slot: 0 | 1, v: number, color: string) => {
    const x = pad.left + i * stepX + (stepX - barW * 2 - 2) / 2 + slot * (barW + 2);
    return (
      <>
        {v > 0 && <rect x={x} y={y(v)} width={barW} height={pad.top + innerH - y(v)} rx={3} fill={color} fillOpacity={0.85} />}
        <text x={x + barW / 2} y={y(v) - 4} textAnchor="middle" className={cn("text-[10px]", v > 0 ? "fill-slate-600" : "fill-slate-300")}>
          {v}
        </text>
      </>
    );
  };

  return (
    <div>
      <Legend items={[{ label: "完了（全案件）", color: SERIES.backlog.color }, { label: "要求定義完了", color: SERIES.requirement.color }]} />
      <div className="flex">
        <YAxis ticks={ticks} y={y} height={height} pad={pad} />
        <div ref={ref} className="min-w-0 flex-1 overflow-x-auto">
          <svg width={width} height={height}>
            {ticks.map((v, idx) => (
              <line key={idx} x1={0} y1={y(v)} x2={width} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            ))}
            {days.map((r, i) => (
              <g key={r.date}>
                <title>{`${mmdd(r.date)}  完了 ${r.backlog?.published ?? "—"} / 要求定義完了 ${r.requirement?.published ?? "—"}`}</title>
                <rect x={pad.left + i * stepX} y={pad.top} width={stepX} height={innerH} fill="transparent" />
                {bar(i, 0, r.backlog?.published ?? 0, SERIES.backlog.color)}
                {bar(i, 1, r.requirement?.published ?? 0, SERIES.requirement.color)}
                <text x={pad.left + i * stepX + stepX / 2} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {r.date.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", accent)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

// 「前日から」の数。基準日や集計の無い日は — を出す
function DeltaCell({ m, pick, tone }: { m: TrendMetric | null; pick: "published" | "increase"; tone: "good" | "bad" }) {
  if (!m || m.isBaseline) return <td className="px-3 py-2 text-right text-black/25">—</td>;
  const v = m[pick];
  return (
    <td className={cn("px-3 py-2 text-right tabular-nums", v === 0 ? "text-black/25" : tone === "good" ? "text-emerald-600" : "text-rose-500")}>
      {v}
    </td>
  );
}

export function TrendsView({ rowsByScope }: { rowsByScope: Record<StatsScope, TrendRow[]> }) {
  const [scope, setScope] = useState<StatsScope>("all");
  const rows = useMemo(() => rowsByScope[scope] ?? [], [rowsByScope, scope]);
  const scopeLabel = STATS_SCOPES.find((s) => s.value === scope)?.label ?? "全体";

  // 現在値と直近1か月（最新日の1か月前の翌日〜最新日）の完了数
  const summary = useMemo(() => {
    const latest = rows[rows.length - 1];
    if (!latest) return null;
    const since = monthAgo(latest.date);
    const window = rows.filter((r) => r.date > since);
    const sum = (pick: (r: TrendRow) => TrendMetric | null) =>
      window.reduce((acc, r) => {
        const m = pick(r);
        return acc + (m && !m.isBaseline ? m.published : 0);
      }, 0);
    return {
      backlogTotal: latest.backlog?.total,
      requirementTotal: latest.requirement?.total,
      backlogDone: sum((r) => r.backlog),
      requirementDone: sum((r) => r.requirement),
      period: `${mmdd(window[0]?.date ?? latest.date)}〜${mmdd(latest.date)}`,
    };
  }, [rows]);

  const desc = useMemo(() => [...rows].reverse(), [rows]);
  const thead = "border-b border-black/5 text-left text-[11px] font-medium text-black/60";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-sky-400" />
          <h2 className="text-sm font-medium text-white">推移</h2>
          <span className="text-xs text-white/40">毎朝のスナップショット時点の件数と、前日からの完了・増加</span>
        </div>
        <div className="ml-auto">
          <ScopeToggle value={scope} onChange={setScope} />
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label={`未完了案件（${scopeLabel}）`} value={summary.backlogTotal === undefined ? "—" : `${summary.backlogTotal}`} accent="text-sky-300" sub="status が完了以外" />
          <SummaryCard label="直近1か月の完了" value={`${summary.backlogDone}`} accent="text-emerald-300" sub={summary.period} />
          <SummaryCard label={`要求定義未完了（${scopeLabel}）`} value={summary.requirementTotal === undefined ? "—" : `${summary.requirementTotal}`} accent="text-amber-300" sub="未着手・調査・要求定義" />
          <SummaryCard label="直近1か月の要求定義完了" value={`${summary.requirementDone}`} accent="text-emerald-300" sub={summary.period} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 py-16 text-center text-sm text-white/50">
          集計がまだありません。日次スナップショット後、または /api/backlog-stats/backfill と /api/requirement-stats/backfill の実行後にここに表示されます。
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <div className="mb-2 text-xs font-medium text-black/60">未完了数の推移</div>
            <RemainingChart rows={rows} />
          </div>
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <div className="mb-2 text-xs font-medium text-black/60">日別の完了数（前日からの差分）</div>
            <CompletedChart rows={rows} />
          </div>

          <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className={thead}>
                  <th rowSpan={2} className="px-3 py-2 align-bottom">日付</th>
                  <th colSpan={3} className="border-l border-black/5 px-3 pt-2 text-center text-sky-700">未完了案件</th>
                  <th colSpan={3} className="border-l border-black/5 px-3 pt-2 text-center text-amber-700">要求定義</th>
                </tr>
                <tr className={thead}>
                  <th className="w-24 border-l border-black/5 px-3 pb-2 text-right">未完了案件数</th>
                  <th className="w-28 px-3 pb-2 text-right font-normal">前日から完了した数</th>
                  <th className="w-28 px-3 pb-2 text-right font-normal">前日から増えた数</th>
                  <th className="w-24 border-l border-black/5 px-3 pb-2 text-right">未完了案件数</th>
                  <th className="w-28 px-3 pb-2 text-right font-normal">前日から完了した数</th>
                  <th className="w-28 px-3 pb-2 text-right font-normal">前日から増えた数</th>
                </tr>
              </thead>
              <tbody>
                {desc.map((r) => (
                  <tr key={r.date} className="border-b border-black/5">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {r.date}
                      {(r.backlog?.isBaseline || r.requirement?.isBaseline) && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">基準日</span>
                      )}
                    </td>
                    <td className={cn("border-l border-black/5 px-3 py-2 text-right font-semibold tabular-nums", SERIES.backlog.cellClass)}>
                      {r.backlog?.total ?? <span className="font-normal text-black/25">—</span>}
                    </td>
                    <DeltaCell m={r.backlog} pick="published" tone="good" />
                    <DeltaCell m={r.backlog} pick="increase" tone="bad" />
                    <td className={cn("border-l border-black/5 px-3 py-2 text-right font-semibold tabular-nums", SERIES.requirement.cellClass)}>
                      {r.requirement?.total ?? <span className="font-normal text-black/25">—</span>}
                    </td>
                    <DeltaCell m={r.requirement} pick="published" tone="good" />
                    <DeltaCell m={r.requirement} pick="increase" tone="bad" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
            <span>どの施策が増減したかの明細:</span>
            <Link href="/requirement" className="underline-offset-2 hover:text-white/80 hover:underline">要求定義</Link>
            <Link href="/improvement" className="underline-offset-2 hover:text-white/80 hover:underline">改善</Link>
            <Link href="/petit-improvement" className="underline-offset-2 hover:text-white/80 hover:underline">プチ改善</Link>
          </div>
        </>
      )}
    </div>
  );
}
