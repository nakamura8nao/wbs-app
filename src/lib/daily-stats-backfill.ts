import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeDailyStats,
  dayStatToRow,
  type RawSnapshot,
  type StatsTarget,
} from "@/lib/daily-stats";

// 既存の全スナップショットから集計テーブルを再計算して埋め戻す（upsert なので何度でも安全）。
// service_role のクライアントを渡すこと（RLS をバイパスして書き込む）。
export async function backfillDailyStats(
  supabase: SupabaseClient,
  target: StatsTarget
): Promise<
  | { ok: true; upserted: number; from?: string; to?: string }
  | { ok: false; error: string }
> {
  const { data: snapshots, error } = await supabase
    .from("snapshots")
    .select("snapshot_date, created_at, data")
    .order("snapshot_date", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const stats = computeDailyStats((snapshots ?? []) as RawSnapshot[], target);
  if (stats.length === 0) return { ok: true, upserted: 0 };

  const now = new Date().toISOString();
  const rows = stats.map((s) => ({ ...dayStatToRow(s), updated_at: now }));

  const { error: upsertError } = await supabase
    .from(target.table)
    .upsert(rows, { onConflict: "stat_date" });

  if (upsertError) return { ok: false, error: upsertError.message };

  return {
    ok: true,
    upserted: rows.length,
    from: rows[0].stat_date,
    to: rows[rows.length - 1].stat_date,
  };
}
