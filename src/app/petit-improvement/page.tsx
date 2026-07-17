import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { rowToPetitDayStat, type PetitDailyStatRow } from "@/lib/petit-stats";
import { PetitStatsView } from "@/components/petit-stats-view";

export default async function PetitImprovementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 作り置き集計テーブルを読むだけ（snapshots は差分せず転送量を最小化）。
  // 集計は cron（/api/snapshot）が日次で書き込み、過去分は /api/petit-stats/backfill で埋め戻す。
  const { data: rows } = await supabase
    .from("petit_daily_stats")
    .select("*")
    .order("stat_date", { ascending: true });

  const stats = (rows ?? []).map((r) =>
    rowToPetitDayStat(r as unknown as PetitDailyStatRow)
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4">
        <PetitStatsView stats={stats} />
      </main>
    </div>
  );
}
