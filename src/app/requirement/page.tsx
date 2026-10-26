import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import {
  REQUIREMENT_SCOPES,
  rowToDayStat,
  STATS_TARGETS,
  type DailyStatRow,
  type DayStat,
  type RequirementScope,
} from "@/lib/daily-stats";
import { RequirementStatsView } from "@/components/requirement-stats-view";

const TARGET = STATS_TARGETS.requirement;

export default async function RequirementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 作り置き集計テーブルを読むだけ（snapshots は差分せず転送量を最小化）。
  // 集計は cron（/api/snapshot）が日次で書き込み、過去分は /api/requirement-stats/backfill で埋め戻す。
  // 全体／投資／改善／プチ改善の4スコープを一度に読み、切り替えはクライアント側で行う。
  const { data: rows } = await supabase
    .from(TARGET.table)
    .select("*")
    .order("stat_date", { ascending: true });

  const statsByScope = Object.fromEntries(
    REQUIREMENT_SCOPES.map((s) => [s.value, [] as DayStat[]])
  ) as Record<RequirementScope, DayStat[]>;
  for (const raw of rows ?? []) {
    const r = raw as unknown as DailyStatRow;
    const scope = (r.scope ?? "all") as RequirementScope;
    statsByScope[scope]?.push(rowToDayStat(r));
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4">
        <RequirementStatsView statsByScope={statsByScope} />
      </main>
    </div>
  );
}
