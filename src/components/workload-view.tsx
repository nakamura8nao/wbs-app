"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isHoliday, getHolidayName } from "@/lib/holidays";
import type { Member } from "@/lib/types/models";
import type { Placement } from "@/lib/constants";
import {
  ALL_MEMBERS,
  PLACEMENT_META,
  PLACEMENT_ORDER,
  UNASSIGNED,
  addDays,
  buildDailySeries,
  eachDate,
  parseDate,
  summarize,
  toDateStr,
  toScheduledPhases,
  type DayPoint,
  type WorkloadPhaseInput,
  type WorkloadProjectInput,
} from "@/lib/workload";

const RANGE_OPTIONS = [
  { value: 14, label: "2週間" },
  { value: 30, label: "1か月" },
  { value: 60, label: "2か月" },
  { value: 90, label: "3か月" },
];

const DAY_WIDTH = 26;
const CHART_H = 200;
const PAD = { top: 12, right: 16, bottom: 36, left: 34 };

function isWeekend(date: string) {
  const d = parseDate(date).getDay();
  return d === 0 || d === 6;
}

function isWorkday(date: string) {
  return !isWeekend(date) && !isHoliday(date);
}

function fmtMD(date: string) {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 積み上げエリアの各層の上端・下端を求める
function stackBounds(points: DayPoint[]) {
  return points.map((p) => {
    const bounds: Record<Placement, { lower: number; upper: number }> = {
      investment: { lower: 0, upper: 0 },
      improvement: { lower: 0, upper: 0 },
      petit: { lower: 0, upper: 0 },
      ab: { lower: 0, upper: 0 },
    };
    let acc = 0;
    for (const key of PLACEMENT_ORDER) {
      bounds[key] = { lower: acc, upper: acc + p.counts[key] };
      acc += p.counts[key];
    }
    return bounds;
  });
}

function StackedAreaChart({
  points,
  today,
  memberName,
  nameOf,
  chartH = CHART_H,
  maxYOverride,
}: {
  points: DayPoint[];
  today: string;
  memberName: string;
  nameOf: (id: string | null) => string;
  // メンバー別に並べるときは高さを抑えつつ縦軸を共通化する
  chartH?: number;
  maxYOverride?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const maxY = Math.max(4, maxYOverride ?? 0, ...points.map((p) => p.total));
  const innerW = points.length * DAY_WIDTH;
  const width = PAD.left + innerW + PAD.right;
  const height = PAD.top + chartH + PAD.bottom;

  const x = (i: number) => PAD.left + i * DAY_WIDTH + DAY_WIDTH / 2;
  const y = (v: number) => PAD.top + chartH - (v / maxY) * chartH;

  const bounds = stackBounds(points);
  const tickStep = Math.max(1, Math.ceil(maxY / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= maxY; v += tickStep) ticks.push(v);

  const labelEvery = points.length <= 20 ? 1 : points.length <= 45 ? 2 : 7;
  const hovered = hover === null ? null : points[hover];

  return (
    <div className="relative overflow-x-auto">
      <svg width={width} height={height} className="block">
        {/* 土日祝の背景 */}
        {points.map((p, i) => {
          const holiday = isHoliday(p.date);
          if (!holiday && !isWeekend(p.date)) return null;
          return (
            <rect
              key={`bg-${p.date}`}
              x={PAD.left + i * DAY_WIDTH}
              y={PAD.top}
              width={DAY_WIDTH}
              height={chartH}
              fill={holiday ? "#fef2f2" : "#f1f5f9"}
            />
          );
        })}

        {/* y軸グリッド */}
        {ticks.map((v) => (
          <g key={`tick-${v}`}>
            <line
              x1={PAD.left}
              y1={y(v)}
              x2={PAD.left + innerW}
              y2={y(v)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[10px] tabular-nums"
            >
              {v}
            </text>
          </g>
        ))}

        {/* 積み上げエリア（下から 投資 → 改善 → プチ改善 → ABテスト） */}
        {PLACEMENT_ORDER.map((key) => {
          const meta = PLACEMENT_META[key];
          const upper = points.map((_, i) => `${x(i)},${y(bounds[i][key].upper)}`);
          const lower = points
            .map((_, i) => `${x(i)},${y(bounds[i][key].lower)}`)
            .reverse();
          if (upper.length === 0) return null;
          return (
            <g key={key}>
              <path
                d={`M ${upper.join(" L ")} L ${lower.join(" L ")} Z`}
                fill={meta.color}
                fillOpacity={0.22}
              />
              <polyline
                points={upper.join(" ")}
                fill="none"
                stroke={meta.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* 今日 */}
        {points.some((p) => p.date === today) && (
          <line
            x1={x(points.findIndex((p) => p.date === today))}
            y1={PAD.top}
            x2={x(points.findIndex((p) => p.date === today))}
            y2={PAD.top + chartH}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* x軸ラベル */}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`label-${p.date}`}
              x={x(i)}
              y={PAD.top + chartH + 16}
              textAnchor="middle"
              className={cn(
                "text-[10px] tabular-nums",
                p.date === today
                  ? "fill-red-500"
                  : isHoliday(p.date) || isWeekend(p.date)
                    ? "fill-slate-300"
                    : "fill-slate-400"
              )}
            >
              {fmtMD(p.date)}
            </text>
          ) : null
        )}

        {/* ホバー領域 */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.date}`}
            x={PAD.left + i * DAY_WIDTH}
            y={PAD.top}
            width={DAY_WIDTH}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
          />
        ))}

        {hover !== null && (
          <line
            x1={x(hover)}
            y1={PAD.top}
            x2={x(hover)}
            y2={PAD.top + chartH}
            stroke="#94a3b8"
            strokeWidth={1}
          />
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-64 rounded-lg border border-black/10 bg-white p-2.5 shadow-lg"
          style={{
            left: Math.min(x(hover!) + 10, PAD.left + innerW - 250),
          }}
        >
          <div className="text-[11px] font-medium text-black/70">
            {hovered.date}
            {getHolidayName(hovered.date) && (
              <span className="ml-1 text-rose-500">{getHolidayName(hovered.date)}</span>
            )}
            <span className="ml-1 text-black/40">/ {memberName}</span>
          </div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-black/80">
            {hovered.total}
            <span className="ml-1 text-[11px] font-normal text-black/40">本</span>
          </div>
          {hovered.entries.length === 0 ? (
            <div className="mt-1 text-xs text-black/30">予定なし</div>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {hovered.entries.map((e) => (
                <li key={e.key} className="flex gap-1.5 text-[11px] leading-tight">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: PLACEMENT_META[e.placement].color }}
                  />
                  <span className="text-black/70">
                    {e.projectTitle}
                    <span className="block text-black/35">
                      {nameOf(e.assigneeId)} / {e.phaseNames.join("・")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums text-white/90">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

export function WorkloadView({
  members,
  projects,
  phases,
}: {
  members: Member[];
  projects: WorkloadProjectInput[];
  phases: WorkloadPhaseInput[];
}) {
  const today = toDateStr(new Date());
  const [days, setDays] = useState(30);
  const [offset, setOffset] = useState(0); // 期間の前後移動（日数）
  const [includeDone, setIncludeDone] = useState(false);
  const [selected, setSelected] = useState<string>(ALL_MEMBERS);

  const start = addDays(today, -3 + offset);
  const end = addDays(start, days - 1);
  const dates = useMemo(() => eachDate(start, end), [start, end]);

  const nameById = useMemo(
    () => new Map(members.map((m) => [m.id, m.display_name])),
    [members]
  );
  const nameOf = (id: string | null) => (id ? (nameById.get(id) ?? "不明") : "未割当");

  // 完了ぶんの扱い。既定では完了した施策・フェーズを落として「これから捌く量」を見る
  const scheduled = useMemo(() => {
    const ps = includeDone ? projects : projects.filter((p) => p.status !== "完了");
    const phs = includeDone ? phases : phases.filter((p) => p.status !== "完了");
    return toScheduledPhases(phs, ps);
  }, [projects, phases, includeDone]);

  // 選択肢に出すのは「期間内に予定があるメンバー」だけ
  const inRange = useMemo(
    () => scheduled.filter((s) => s.from <= end && s.to >= start),
    [scheduled, start, end]
  );
  const activeIds = useMemo(() => new Set(inRange.map((s) => s.assigneeId)), [inRange]);

  const tabs = useMemo(() => {
    const list: { key: string; label: string; role?: string | null }[] = [
      { key: ALL_MEMBERS, label: "全員（のべ）" },
    ];
    for (const m of members) {
      if (!activeIds.has(m.id)) continue;
      list.push({ key: m.id, label: m.display_name, role: m.role });
    }
    if (activeIds.has(null)) list.push({ key: UNASSIGNED, label: "未割当" });
    return list;
  }, [members, activeIds]);

  const points = useMemo(
    () => buildDailySeries(scheduled, dates, selected),
    [scheduled, dates, selected]
  );
  const stats = useMemo(() => summarize(points, isWorkday), [points]);

  // メンバー一覧のミニチャート（ピークが高い順）
  const perMember = useMemo(() => {
    const rows = tabs
      .filter((t) => t.key !== ALL_MEMBERS)
      .map((t) => {
        const pts = buildDailySeries(scheduled, dates, t.key);
        return {
          key: t.key,
          label: t.label,
          role: t.role,
          points: pts,
          peak: Math.max(0, ...pts.map((p) => p.total)),
          busy: pts.filter((p) => isWorkday(p.date) && p.total > 0).length,
          workdays: pts.filter((p) => isWorkday(p.date)).length,
        };
      });
    rows.sort((a, b) => b.peak - a.peak || a.label.localeCompare(b.label, "ja"));
    return rows;
  }, [tabs, scheduled, dates]);

  const memberMaxY = Math.max(1, ...perMember.map((r) => r.peak));
  const selectedLabel = tabs.find((t) => t.key === selected)?.label ?? "全員（のべ）";

  return (
    <div className="space-y-4">
      {/* 操作バー */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-medium text-white">アサイン状況</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-8 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-white/80 outline-none"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="text-black">
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - days)}
            className="rounded-lg border border-white/15 p-1 text-white/60 hover:bg-white/10"
            aria-label="前の期間"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setOffset(0)}
            className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/60 hover:bg-white/10"
          >
            今日
          </button>
          <button
            onClick={() => setOffset((o) => o + days)}
            className="rounded-lg border border-white/15 p-1 text-white/60 hover:bg-white/10"
            aria-label="次の期間"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <span className="text-xs text-white/40 tabular-nums">
          {start} 〜 {end}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-white/50">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => setIncludeDone(e.target.checked)}
            className="accent-primary-500"
          />
          完了ぶんも含める
        </label>
      </div>

      {/* メンバー切り替え */}
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              selected === t.key
                ? "bg-primary-500/20 text-primary-200"
                : "text-white/45 hover:bg-white/5 hover:text-white/70"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 要約 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="ピーク（同時本数）"
          value={`${stats.peak}`}
          sub={stats.peakDate ? `${stats.peakDate}` : undefined}
        />
        <SummaryCard label="平均（稼働日あたり）" value={stats.avg.toFixed(1)} />
        <SummaryCard
          label="予定が入っている稼働日"
          value={`${stats.busyDays}/${stats.workdayCount}`}
        />
        <SummaryCard label="予定なしの稼働日" value={`${stats.freeDays}`} sub="土日祝を除く" />
      </div>

      {/* メインチャート */}
      <div className="rounded-xl border border-black/5 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium text-black/60">
            {selectedLabel} の日別アサイン本数
          </div>
          <div className="flex gap-3">
            {[...PLACEMENT_ORDER].reverse().map((key) => (
              <span key={key} className="flex items-center gap-1 text-[11px] text-black/50">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: PLACEMENT_META[key].color }}
                />
                {PLACEMENT_META[key].label}
              </span>
            ))}
          </div>
        </div>
        <StackedAreaChart
          points={points}
          today={today}
          memberName={selectedLabel}
          nameOf={nameOf}
        />
        <p className="mt-2 text-[11px] text-black/35">
          フェーズに開始日／終了日が入っている施策だけを数えています（施策単位・工数は未考慮）。
          日付が入っていないフェーズはこのグラフに出ません。
        </p>
      </div>

      {/* メンバー別。縦軸は全員で共通にして高さをそのまま比べられるようにする */}
      <div className="flex items-baseline justify-between px-1 pt-1">
        <h3 className="text-sm font-medium text-white">メンバー別</h3>
        <span className="text-[11px] text-white/40">
          ピークが高い順 / 縦軸は共通（最大 {memberMaxY} 本）
        </span>
      </div>
      <div className="space-y-3">
        {perMember.map((r) => (
          <div
            key={r.key}
            className={cn(
              "rounded-xl border bg-white p-4",
              selected === r.key ? "border-primary-300" : "border-black/5"
            )}
          >
            <div className="mb-1.5 flex items-baseline justify-between">
              <button
                onClick={() => setSelected(r.key)}
                className="text-sm font-medium text-black/70 hover:text-primary-600"
              >
                {r.label}
                {r.role && <span className="ml-1.5 text-[11px] text-black/35">{r.role}</span>}
              </button>
              <span className="text-[11px] tabular-nums text-black/40">
                ピーク {r.peak}本 / 予定あり {r.busy}日 / 稼働日 {r.workdays}日
              </span>
            </div>
            <StackedAreaChart
              points={r.points}
              today={today}
              memberName={r.label}
              nameOf={nameOf}
              chartH={120}
              maxYOverride={memberMaxY}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
