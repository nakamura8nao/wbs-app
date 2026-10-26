"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { REQUIREMENT_SCOPES, type DayStat, type RequirementScope } from "@/lib/daily-stats";
import { DailyStatsView } from "@/components/daily-stats-view";

// 要求定義の推移。全体／投資／改善／プチ改善のどの母数で見るかを上部のトグルで切り替える。
// 4スコープぶんの集計はページ側で読み込み済みなので、切り替えは再取得なしで即時。
export function RequirementStatsView({
  statsByScope,
}: {
  statsByScope: Record<RequirementScope, DayStat[]>;
}) {
  const [scope, setScope] = useState<RequirementScope>("all");
  const current = REQUIREMENT_SCOPES.find((s) => s.value === scope) ?? REQUIREMENT_SCOPES[0];

  const toolbar = (
    <div
      role="radiogroup"
      aria-label="集計の範囲"
      className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5"
    >
      {REQUIREMENT_SCOPES.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={scope === s.value}
          onClick={() => setScope(s.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            scope === s.value
              ? "bg-white/15 text-white shadow-sm"
              : "text-white/50 hover:bg-white/5 hover:text-white/80"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  return (
    <DailyStatsView
      key={scope}
      stats={statsByScope[scope] ?? []}
      target="requirement"
      toolbar={toolbar}
      totalSub={`${current.description}未着手・調査・要求定義の施策`}
    />
  );
}
