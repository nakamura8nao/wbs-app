"use client";

// 一覧の行展開で使う、フェーズの読み取り専用コンパクトガント。
// 編集・追加・自動生成は PhasePanel（リスト表示）側が担う。
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Phase } from "@/lib/types/models";

const DAY_W = 24;
const LABEL_W = 220;
const ROW_H = 30;

const MS_PER_DAY = 86400000;
// YYYY-MM-DD → UTC ミリ秒（TZ の影響を受けないよう UTC で扱う）
const toUtc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const diffDays = (a: number, b: number) => Math.round((b - a) / MS_PER_DAY);
const todayUtc = () => {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
};

// バー色（ガントと統一：完了=灰 / 進行中=青 / 未着手=緑）
const barColor = (status: string) => {
  switch (status) {
    case "完了":
      return "bg-black/20";
    case "進行中":
      return "bg-[#4a9eff]";
    default:
      return "bg-emerald-400";
  }
};

export function PhaseGantt({ phases }: { phases: Phase[] }) {
  const dated = useMemo(
    () => phases.filter((p) => p.start_date && p.end_date),
    [phases]
  );

  const range = useMemo(() => {
    if (dated.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const p of dated) {
      const s = toUtc(p.start_date!);
      const e = toUtc(p.end_date!);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    // 前後に少し余白
    const start = min - 2 * MS_PER_DAY;
    const end = max + 2 * MS_PER_DAY;
    return { start, end, totalDays: diffDays(start, end) + 1 };
  }, [dated]);

  if (phases.length === 0) {
    return <p className="px-4 py-3 text-xs text-black/30">フェーズがありません</p>;
  }
  if (!range) {
    return (
      <p className="px-4 py-3 text-xs text-black/30">
        日付が設定されたフェーズがありません（リスト表示で日付を入力してください）
      </p>
    );
  }

  const today = todayUtc();
  const todayOffset =
    today >= range.start && today <= range.end ? diffDays(range.start, today) : null;

  const days = Array.from({ length: range.totalDays }, (_, i) => {
    const ms = range.start + i * MS_PER_DAY;
    const d = new Date(ms);
    const dow = d.getUTCDay();
    return { i, label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, weekend: dow === 0 || dow === 6 };
  });
  const timelineWidth = range.totalDays * DAY_W;

  return (
    <div className="overflow-x-auto px-4 py-2">
      <div style={{ width: LABEL_W + timelineWidth }}>
        {/* ヘッダー（日付） */}
        <div className="flex border-b border-black/10" style={{ height: 24 }}>
          <div className="shrink-0 text-[11px] font-semibold text-black/50 flex items-end pb-0.5" style={{ width: LABEL_W }}>
            フェーズ
          </div>
          <div className="relative" style={{ width: timelineWidth }}>
            <div className="flex">
              {days.map((d) => (
                <div
                  key={d.i}
                  className={cn(
                    "shrink-0 text-center text-[9px] text-black/40 border-l border-black/5",
                    d.weekend && "bg-black/[0.02]"
                  )}
                  style={{ width: DAY_W }}
                >
                  {d.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 行 */}
        {phases.map((phase) => {
          const hasDates = phase.start_date && phase.end_date;
          const left = hasDates ? diffDays(range.start, toUtc(phase.start_date!)) * DAY_W : 0;
          const width = hasDates
            ? (diffDays(toUtc(phase.start_date!), toUtc(phase.end_date!)) + 1) * DAY_W
            : 0;
          return (
            <div key={phase.id} className="flex items-center border-b border-black/5" style={{ height: ROW_H }}>
              <div className="shrink-0 flex items-center gap-2 pr-2 min-w-0" style={{ width: LABEL_W }}>
                <span className="truncate text-xs text-black/70" title={phase.name}>{phase.name}</span>
                {phase.assignee?.display_name && (
                  <span className="shrink-0 text-[10px] text-black/40">{phase.assignee.display_name}</span>
                )}
              </div>
              <div className="relative" style={{ width: timelineWidth, height: ROW_H }}>
                {/* 週末の薄い縦帯 */}
                {days.map((d) =>
                  d.weekend ? (
                    <div key={d.i} className="absolute top-0 bottom-0 bg-black/[0.02]" style={{ left: d.i * DAY_W, width: DAY_W }} />
                  ) : null
                )}
                {/* 今日の縦線 */}
                {todayOffset !== null && (
                  <div className="absolute top-0 bottom-0 w-px bg-[#4a9eff]/50" style={{ left: todayOffset * DAY_W }} />
                )}
                {/* バー */}
                {hasDates ? (
                  <div
                    className={cn("absolute top-1/2 -translate-y-1/2 h-3.5 rounded", barColor(phase.status))}
                    style={{ left, width }}
                    title={`${phase.name}（${phase.start_date}〜${phase.end_date}）`}
                  />
                ) : (
                  <span className="absolute top-1/2 -translate-y-1/2 left-1 text-[10px] text-black/30">日付未設定</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
