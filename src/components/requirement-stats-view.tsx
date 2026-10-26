"use client";

import { useState } from "react";
import { REQUIREMENT_SCOPES, type DayStat, type RequirementScope } from "@/lib/daily-stats";
import { DailyStatsView } from "@/components/daily-stats-view";
import { ScopeToggle } from "@/components/scope-toggle";

// 要求定義の推移。全体／投資／改善／プチ改善のどの母数で見るかを上部のトグルで切り替える。
// 4スコープぶんの集計はページ側で読み込み済みなので、切り替えは再取得なしで即時。
export function RequirementStatsView({
  statsByScope,
}: {
  statsByScope: Record<RequirementScope, DayStat[]>;
}) {
  const [scope, setScope] = useState<RequirementScope>("all");
  const current = REQUIREMENT_SCOPES.find((s) => s.value === scope) ?? REQUIREMENT_SCOPES[0];

  return (
    <DailyStatsView
      key={scope}
      stats={statsByScope[scope] ?? []}
      target="requirement"
      toolbar={<ScopeToggle value={scope} onChange={setScope} />}
      totalSub={`${current.description}未着手・調査・要求定義の施策`}
    />
  );
}
