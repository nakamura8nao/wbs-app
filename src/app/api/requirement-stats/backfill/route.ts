import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { STATS_TARGETS } from "@/lib/daily-stats";
import { backfillDailyStats } from "@/lib/daily-stats-backfill";

// 既存の全スナップショットから requirement_daily_stats を再計算して埋め戻す。
// 初回の一度きり、または集計ロジックを直した後の再計算に使う（upsert なので何度でも安全）。
// CRON_SECRET で認証。service_role で RLS をバイパス。
//
//   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/requirement-stats/backfill"
// 全スナップショットを少しずつ読んで集計するので時間がかかる。Vercel の関数上限を広げる。
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await backfillDailyStats(supabase, STATS_TARGETS.requirement);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
