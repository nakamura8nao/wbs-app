import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import {
  rowToDayStat,
  STATS_TARGETS,
  type DailyStatRow,
} from "@/lib/daily-stats";
import { DailyStatsView } from "@/components/daily-stats-view";

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
  const { data: rows } = await supabase
    .from(TARGET.table)
    .select("*")
    .order("stat_date", { ascending: true });

  const stats = (rows ?? []).map((r) =>
    rowToDayStat(r as unknown as DailyStatRow)
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4">
        <DailyStatsView stats={stats} target={TARGET.key} />
      </main>
    </div>
  );
}
