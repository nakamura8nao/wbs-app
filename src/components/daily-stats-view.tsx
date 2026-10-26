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
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { groupByWeek, weekLabel } from "@/lib/weeks";
import {
  HIGHLIGHT_STATUSES,
  type DayStat,
  type DecreaseReason,
  type IncreaseKind,
  type StatsTargetKey,
} from "@/lib/daily-stats";

// 残数の内訳として出すステータスの折れ線・表の色
type StatusSeries = { status: string; color: string; cellClass: string };

// タブ（プチ改善／改善）の内訳。HIGHLIGHT_STATUSES と同じ順。
const BACKLOG_STATUS_SERIES: StatusSeries[] = [
  { status: HIGHLIGHT_STATUSES[0], color: "#94a3b8", cellClass: "text-slate-500" },
  { status: HIGHLIGHT_STATUSES[1], color: "#f59e0b", cellClass: "text-amber-600" },
];

// 要求定義未完了の内訳（未着手 / 調査 / 要求定義）。STATUS_OPTIONS の並び順。
const REQUIREMENT_STATUS_SERIES: StatusSeries[] = [
  { status: "未着手", color: "#94a3b8", cellClass: "text-slate-500" },
  { status: "調査", color: "#38bdf8", cellClass: "text-sky-600" },
  { status: "要求定義", color: "#f59e0b", cellClass: "text-amber-600" },
];

// 「完了（published）」の累計を折れ線で重ねるときの色（要求定義の推移で使う）
const COMPLETED_COLOR = "#10b981";

const countOf = (s: DayStat, status: string) => s.statusCounts[status] ?? 0;

// タブごとの見た目・文言。Tailwind のクラスは静的文字列で持つ（動的生成だとビルドで落ちる）。
type ViewConfig = {
  title: string;
  icon: typeof Sparkles;
  iconClass: string;
  chartTitle: string;
  chartColor: string; // SVG の stroke/fill
  // 何を主役に見せるか。
  //   remaining : 残数をゼロに近づける見方（タブの推移）。内訳ステータスの折れ線とカードを出す
  //   completed : 日々の完了数（published）を追う見方（要求定義の推移）。完了数と累計の列・折れ線を出し、
  //               サマリーは内訳ステータスごとのカードを出さず、完了数のカードに置き換える
  focus: "remaining" | "completed";
  statusSeries: StatusSeries[]; // 残数の内訳として出すステータス（表の列・グラフの破線）
  totalLabel: string; // サマリーカードの「現在値」の見出し
  totalColumnLabel: string; // テーブルの残数列の見出し
  totalSub: string;
  totalAccent: string; // サマリーカードの残数の色
  totalCellClass: string; // テーブルの残数セルの色
  rowHoverClass: string;
  publishedLabel: string; // 減少内訳 published の表示名
  movedOutLabel: string; // 減少内訳 movedOut の表示名
  emptyMessage: string;
};

export const VIEW_CONFIGS: Record<StatsTargetKey, ViewConfig> = {
  petit: {
    title: "プチ改善 増減の推移",
    icon: Sparkles,
    iconClass: "text-violet-400",
    chartTitle: "残数の推移（未消化プチ改善）",
    chartColor: "#8b5cf6",
    focus: "remaining",
    statusSeries: BACKLOG_STATUS_SERIES,
    totalLabel: "現在の残数（未完了）",
    totalColumnLabel: "残数",
    totalSub: "ゼロを目指す母数",
    totalAccent: "text-violet-300",
    totalCellClass: "text-violet-600",
    rowHoverClass: "hover:bg-violet-50/60",
    publishedLabel: "公開ずみ",
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
    focus: "remaining",
    statusSeries: BACKLOG_STATUS_SERIES,
    totalLabel: "現在の残数（未完了）",
    totalColumnLabel: "残数",
    totalSub: "改善タブの未完了施策",
    totalAccent: "text-sky-300",
    totalCellClass: "text-sky-600",
    rowHoverClass: "hover:bg-sky-50/60",
    publishedLabel: "公開ずみ",
    movedOutLabel: "改善外へ移動",
    emptyMessage:
      "集計がまだありません。日次スナップショット後、または /api/improvement-stats/backfill の実行後にここに表示されます。",
  },
  requirement: {
    title: "要求定義 完了数の推移",
    icon: ClipboardList,
    iconClass: "text-amber-400",
    chartTitle: "要求定義未完了の件数と、要求定義完了の累計",
    chartColor: "#f59e0b",
    focus: "completed",
    statusSeries: REQUIREMENT_STATUS_SERIES,
    totalLabel: "現在の要求定義未完了",
    totalColumnLabel: "未完了",
    totalSub: "置き場所を問わず未着手・調査・要求定義の施策",
    totalAccent: "text-amber-300",
    totalCellClass: "text-amber-600",
    rowHoverClass: "hover:bg-amber-50/60",
    publishedLabel: "要求定義完了",
    movedOutLabel: "対象外へ移動（別タブなど）",
    emptyMessage:
      "集計がまだありません。日次スナップショット後、または /api/requirement-stats/backfill の実行後にここに表示されます。",
  },
  backlog: {
    title: "未完了案件 増減の推移",
    icon: Repeat,
    iconClass: "text-sky-400",
    chartTitle: "残数の推移（未完了の全案件）",
    chartColor: "#0ea5e9",
    focus: "remaining",
    statusSeries: BACKLOG_STATUS_SERIES,
    totalLabel: "現在の残数（未完了）",
    totalColumnLabel: "残数",
    totalSub: "status が完了以外の全案件",
    totalAccent: "text-sky-300",
    totalCellClass: "text-sky-600",
    rowHoverClass: "hover:bg-sky-50/60",
    publishedLabel: "公開ずみ",
    movedOutLabel: "対象外へ移動（別タブなど）",
    emptyMessage:
      "集計がまだありません。日次スナップショット後、または /api/backlog-stats/backfill の実行後にここに表示されます。",
  },
};

// 日付順の行から「published（完了）の累計」を日付ごとに引けるようにする。基準日は増減が無いので 0 のまま。
function cumulativePublishedByDate(stats: DayStat[]): Map<string, number> {
  const map = new Map<string, number>();
  let acc = 0;
  for (const s of stats) {
    if (!s.isBaseline) acc += s.breakdown.published;
    map.set(s.date, acc);
  }
  return map;
}

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
function TrendChart({
  stats,
  config,
  cumulative,
}: {
  stats: DayStat[];
  config: ViewConfig;
  cumulative: Map<string, number>;
}) {
  const color = config.chartColor;
  const statusSeries = config.statusSeries;
  // completed のときは完了の累計を同じスケールで重ねる（残数より大きくなり得るので最大値に含める）
  const showCompleted = config.focus === "completed";
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

  const maxTotal = Math.max(
    1,
    ...stats.map((s) => s.total),
    ...(showCompleted ? stats.map((s) => cumulative.get(s.date) ?? 0) : [])
  );
  const x = (i: number) =>
    pad.left + (stats.length === 1 ? innerW / 2 : (i / (stats.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / maxTotal) * innerH;
  const ticks = [0, maxTotal / 2, maxTotal];

  const points = stats.map((s, i) => `${x(i)},${y(s.total)}`).join(" ");
  const areaPath = `M ${x(0)},${pad.top + innerH} L ${points
    .split(" ")
    .join(" L ")} L ${x(stats.length - 1)},${pad.top + innerH} Z`;

  return (
    <div>
      {/* 凡例 */}
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-black/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: color }} />
          {config.totalColumnLabel}
        </span>
        {showCompleted && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: COMPLETED_COLOR }} />
            {config.publishedLabel}（累計）
          </span>
        )}
        {statusSeries.map((series) => (
          <span key={series.status} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-4 border-t-2 border-dashed"
              style={{ borderColor: series.color }}
            />
            {series.status}
          </span>
        ))}
      </div>
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

          {/* 完了の累計。残数と同じ y スケールで重ねる */}
          {showCompleted && (
            <polyline
              points={stats.map((s, i) => `${x(i)},${y(cumulative.get(s.date) ?? 0)}`).join(" ")}
              fill="none"
              stroke={COMPLETED_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* 内訳（未着手 / 要求定義）の折れ線。残数と同じ y スケールで重ねる */}
          {statusSeries.map((series) => (
            <polyline
              key={series.status}
              points={stats.map((s, i) => `${x(i)},${y(countOf(s, series.status))}`).join(" ")}
              fill="none"
              stroke={series.color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

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
    </div>
  );
}

type WeekBucket = { weekStart: string; completed: number; partial: boolean };

// 日次行を週（月曜始まり）ごとに束ねて完了（published）を合計する。
// 行が無い週も 0 で埋めて並べる。最新行を含む週は集計途中なので partial。
function weeklyCompleted(stats: DayStat[]): WeekBucket[] {
  return groupByWeek(stats.filter((s) => !s.isBaseline)).map((w) => ({
    weekStart: w.weekStart,
    completed: w.rows.reduce((acc, s) => acc + s.breakdown.published, 0),
    partial: w.partial,
  }));
}

// 週別の完了数の棒グラフ（インラインSVG）。折れ線と同じく y 軸を固定し、棒だけ横スクロールする。
// 1系列なので凡例は出さず、各棒の上に件数を直接書く。集計途中の週は薄く塗る。
function WeeklyBarChart({ weeks, color, label }: { weeks: WeekBucket[]; color: string; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  if (weeks.length === 0) return null;

  const pad = { top: 18, right: 12, bottom: 28, left: 12 };
  const axisW = 32;
  const stepX = 44;
  const barW = 24;
  const innerH = 120;
  const width = pad.left + weeks.length * stepX + pad.right;
  const height = pad.top + innerH + pad.bottom;
  const max = Math.max(1, ...weeks.map((w) => w.completed));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const x = (i: number) => pad.left + i * stepX + (stepX - barW) / 2;
  const ticks = [0, max / 2, max];

  return (
    <div className="flex">
      <svg width={axisW} height={height} className="shrink-0 bg-white">
        {ticks.map((v, idx) => (
          <text key={idx} x={axisW - 6} y={y(v) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
            {Math.round(v)}
          </text>
        ))}
        <line x1={axisW - 1} y1={pad.top} x2={axisW - 1} y2={pad.top + innerH} stroke="#e2e8f0" strokeWidth={1} />
      </svg>
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
        <svg width={width} height={height}>
          {ticks.map((v, idx) => (
            <line key={idx} x1={0} y1={y(v)} x2={width} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
          ))}
          {weeks.map((w, i) => {
            const h = pad.top + innerH - y(w.completed);
            return (
              <g key={w.weekStart}>
                <title>
                  {`${weekLabel(w.weekStart)}週${w.partial ? "（集計中）" : ""}: ${label} ${w.completed}件`}
                </title>
                {/* 当たり判定を棒より広く取る（ホバーで title が出る） */}
                <rect x={pad.left + i * stepX} y={pad.top} width={stepX} height={innerH} fill="transparent" />
                {w.completed > 0 && (
                  <rect
                    x={x(i)}
                    y={y(w.completed)}
                    width={barW}
                    height={h}
                    rx={3}
                    fill={color}
                    fillOpacity={w.partial ? 0.4 : 0.85}
                  />
                )}
                <text
                  x={x(i) + barW / 2}
                  y={y(w.completed) - 4}
                  textAnchor="middle"
                  className={cn("text-[10px]", w.completed > 0 ? "fill-slate-600" : "fill-slate-300")}
                >
                  {w.completed}
                </text>
                <text x={x(i) + barW / 2} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {weekLabel(w.weekStart)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// YYYY-MM-DD の1か月前（同日）を返す。月末の日付は Date の繰り上げに任せる（例: 03-31 → 03-03 は許容）
function monthAgo(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// 期間の増減カード。増減（純）を大きく、増加・減少をその下に並べる。
// 残数はゼロに近づけるのが目的なので、純増減は減っていれば緑・増えていれば赤。
function FlowCard({
  label,
  flow,
  period,
  disabled = false,
}: {
  label: string;
  flow: { increase: number; decrease: number };
  period: string;
  disabled?: boolean;
}) {
  const net = flow.increase - flow.decrease;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] text-white/50">{label}</div>
      {disabled ? (
        <>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums text-white/40">—</div>
          <div className="mt-0.5 text-[11px] text-white/40">バックフィル後に表示</div>
        </>
      ) : (
        <>
          <div
            className={cn(
              "mt-0.5 text-2xl font-semibold tabular-nums",
              net < 0 ? "text-emerald-300" : net > 0 ? "text-rose-300" : "text-white/80"
            )}
          >
            {signed(net)}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums">
            <span className="inline-flex items-center gap-0.5 text-rose-300/80">
              <ArrowUp size={11} />
              増加 {flow.increase}
            </span>
            <span className="inline-flex items-center gap-0.5 text-emerald-300/80">
              <ArrowDown size={11} />
              減少 {flow.decrease}
            </span>
            <span className="text-white/40">{period}</span>
          </div>
        </>
      )}
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
  toolbar,
  totalSub,
}: {
  stats: DayStat[];
  target: StatsTargetKey;
  // 見出し行の右側に置く操作（要求定義のスコープ切り替えなど）
  toolbar?: React.ReactNode;
  // サマリーの「現在値」の補足文を差し替える（スコープで母数の説明が変わるとき）
  totalSub?: string;
}) {
  const config = VIEW_CONFIGS[target];
  const Icon = config.icon;
  const reasonLabel: Record<DecreaseReason, string> = {
    published: config.publishedLabel,
    movedOut: config.movedOutLabel,
    deleted: "削除",
  };
  const statusSeries = config.statusSeries;
  const showCompleted = config.focus === "completed";
  const cumulative = useMemo(() => cumulativePublishedByDate(stats), [stats]);
  const weeks = useMemo(() => (showCompleted ? weeklyCompleted(stats) : []), [stats, showCompleted]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (date: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  // 現在値（最新行）と、直近1か月（最新日の1か月前の翌日〜最新日）の増減。
  // 全体は行の increase/decrease、ステータス別は statusFlows を期間で合計する。
  const summary = useMemo(() => {
    const latest = stats[stats.length - 1];
    if (!latest) return null;
    const since = monthAgo(latest.date);
    const window = stats.filter((s) => s.date > since && !s.isBaseline);
    const sumFlow = (pick: (s: DayStat) => { increase: number; decrease: number } | undefined) =>
      window.reduce(
        (acc, s) => {
          const f = pick(s);
          acc.increase += f?.increase ?? 0;
          acc.decrease += f?.decrease ?? 0;
          return acc;
        },
        { increase: 0, decrease: 0 }
      );
    const statuses = statusSeries.map((series) => series.status);
    return {
      hasBreakdown: Object.keys(latest.statusCounts).length > 0,
      current: latest.total,
      currentByStatus: statuses.map((st) => ({ status: st, count: countOf(latest, st) })),
      // 期間の表示用（開始日は含まない日の翌日）
      windowFrom: window[0]?.date ?? latest.date,
      windowTo: latest.date,
      total: sumFlow((s) => s),
      byStatus: statuses.map((st) => ({ status: st, ...sumFlow((s) => s.statusFlows[st]) })),
      // 完了（published）の件数。直近1か月と全期間の累計
      completedMonth: window.reduce((acc, s) => acc + s.breakdown.published, 0),
      completedAll: cumulative.get(latest.date) ?? 0,
    };
  }, [stats, statusSeries, cumulative]);

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
        {toolbar && <div className="ml-auto">{toolbar}</div>}
      </div>

      {/* サマリー: 上段=現在値（全体 / 未着手 / 要求定義）、下段=直近1か月の増減（同じ並び）
          completed のときは 現在値 / 直近1か月の完了数 / 累計の完了数 と、直近1か月の増減 */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryCard
            label={config.totalLabel}
            value={`${summary.current}`}
            accent={config.totalAccent}
            sub={totalSub ?? config.totalSub}
          />
          {showCompleted && (
            <>
              <SummaryCard
                label={`直近1か月の${config.publishedLabel}`}
                value={`${summary.completedMonth}`}
                accent="text-emerald-300"
                sub={`${summary.windowFrom.slice(5)}〜${summary.windowTo.slice(5)}`}
              />
              <SummaryCard
                label={`${config.publishedLabel}の累計`}
                value={`${summary.completedAll}`}
                accent="text-emerald-300"
                sub="集計開始日からの合計"
              />
            </>
          )}
          {!showCompleted && summary.currentByStatus.map((c) => (
            <SummaryCard
              key={c.status}
              label={`現在の${c.status}`}
              value={summary.hasBreakdown ? `${c.count}` : "—"}
              accent="text-white/80"
              sub={summary.hasBreakdown ? "残数のうち" : "バックフィル後に表示"}
            />
          ))}
          <FlowCard
            label="直近1か月の増減（全体）"
            flow={summary.total}
            period={`${summary.windowFrom.slice(5)}〜${summary.windowTo.slice(5)}`}
          />
          {!showCompleted && summary.byStatus.map((f) => (
            <FlowCard
              key={f.status}
              label={`直近1か月の増減（${f.status}）`}
              flow={f}
              period={`${summary.windowFrom.slice(5)}〜${summary.windowTo.slice(5)}`}
              disabled={!summary.hasBreakdown}
            />
          ))}
        </div>
      )}

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
            <TrendChart stats={stats} config={config} cumulative={cumulative} />
          </div>

          {/* 週別の完了数（completed のときだけ） */}
          {showCompleted && weeks.length > 0 && (
            <div className="rounded-xl border border-black/5 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 text-xs">
                <span className="font-medium text-black/60">週別の{config.publishedLabel}（月曜始まり）</span>
                <span className="text-[11px] text-black/40">最新の週は集計途中（薄い棒）</span>
              </div>
              <WeeklyBarChart weeks={weeks} color={COMPLETED_COLOR} label={config.publishedLabel} />
            </div>
          )}

          {/* 日次テーブル */}
          <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className={theadClasses}>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-3 py-2">日付</th>
                  <th className="w-20 px-3 py-2 text-right">{config.totalColumnLabel}</th>
                  {statusSeries.map((series) => (
                    <th key={series.status} className="w-20 px-3 py-2 text-right font-normal">
                      {series.status}
                    </th>
                  ))}
                  {showCompleted && (
                    <>
                      <th className="w-24 px-3 py-2 text-right">{config.publishedLabel}</th>
                      <th className="w-20 px-3 py-2 text-right font-normal">累計</th>
                    </>
                  )}
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
                      cumulativePublished={cumulative.get(r.date) ?? 0}
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
  cumulativePublished,
  isOpen,
  hasDetail,
  onToggle,
}: {
  r: DayStat;
  config: ViewConfig;
  reasonLabel: Record<DecreaseReason, string>;
  cumulativePublished: number;
  isOpen: boolean;
  hasDetail: boolean;
  onToggle: () => void;
}) {
  const statusSeries = config.statusSeries;
  const showCompleted = config.focus === "completed";
  // 詳細行の colspan: 日付 / 残数 / 増加 / 減少 / 内訳 の5列 + 内訳ステータス列 + 完了・累計の2列
  const detailColSpan = 5 + statusSeries.length + (showCompleted ? 2 : 0);
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
        {statusSeries.map((series) => {
          const n = countOf(r, series.status);
          return (
            <td key={series.status} className={cn("px-3 py-2 text-right tabular-nums", n > 0 ? series.cellClass : "text-black/25")}>
              {n}
            </td>
          );
        })}
        {showCompleted && (
          <>
            <td className="px-3 py-2 text-right font-semibold tabular-nums">
              {r.isBaseline ? (
                <span className="text-black/25">—</span>
              ) : r.breakdown.published > 0 ? (
                <span className="text-emerald-600">{r.breakdown.published}</span>
              ) : (
                <span className="text-black/25">0</span>
              )}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-black/60">{cumulativePublished}</td>
          </>
        )}
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
          <td colSpan={detailColSpan} className="px-3 py-3">
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
