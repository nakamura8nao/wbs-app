"use client";

import { cn } from "@/lib/utils";
import { STATS_SCOPES, type StatsScope } from "@/lib/daily-stats";

// 集計の範囲（全体／投資／改善／プチ改善）を切り替えるトグル。推移系ページの見出し右に置く。
export function ScopeToggle({
  value,
  onChange,
}: {
  value: StatsScope;
  onChange: (scope: StatsScope) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="集計の範囲"
      className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5"
    >
      {STATS_SCOPES.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          onClick={() => onChange(s.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === s.value
              ? "bg-white/15 text-white shadow-sm"
              : "text-white/50 hover:bg-white/5 hover:text-white/80"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
