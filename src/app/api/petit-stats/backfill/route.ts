import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  computePetitStats,
  petitDayStatToRow,
  type RawSnapshot,
} from "@/lib/petit-stats";

// 既存の全スナップショットから petit_daily_stats を再計算して埋め戻す。
// 初回の一度きり、または集計ロジックを直した後の再計算に使う（upsert なので何度でも安全）。
// CRON_SECRET で認証。service_role で RLS をバイパス。
//
//   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/petit-stats/backfill"
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: snapshots, error } = await supabase
    .from("snapshots")
    .select("snapshot_date, created_at, data")
    .order("snapshot_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = computePetitStats((snapshots ?? []) as RawSnapshot[]);
  if (stats.length === 0) {
    return NextResponse.json({ ok: true, upserted: 0 });
  }

  const now = new Date().toISOString();
  const rows = stats.map((s) => ({ ...petitDayStatToRow(s), updated_at: now }));

  const { error: upsertError } = await supabase
    .from("petit_daily_stats")
    .upsert(rows, { onConflict: "stat_date" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    upserted: rows.length,
    from: rows[0].stat_date,
    to: rows[rows.length - 1].stat_date,
  });
}
