import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conflictKeyOf,
  createDailyStatsAccumulator,
  dayStatToRow,
  type RawSnapshot,
  type StatsTarget,
} from "@/lib/daily-stats";

// 1回の SELECT で取るスナップショット数。
// snapshots.data は「全施策＋フェーズ」の JSON で1行が重く、全件を1クエリで取ると
// Postgres の statement timeout（canceling statement due to statement timeout）に当たる。
// 小さく区切って逐次集計し、集計行もまとめて書く。
const FETCH_CHUNK = 10;
const UPSERT_CHUNK = 100;

// 既存の全スナップショットから集計テーブルを再計算して埋め戻す（upsert なので何度でも安全）。
// 複数ターゲットを渡すとスナップショットを1回読むだけで全部を集計する（重い snapshots.data を何度も読まない）。
// service_role のクライアントを渡すこと（RLS をバイパスして書き込む）。
export async function backfillDailyStats(
  supabase: SupabaseClient,
  targets: StatsTarget | StatsTarget[]
): Promise<
  | { ok: true; upserted: number; snapshots: number; from?: string; to?: string }
  | { ok: false; error: string }
> {
  const list = Array.isArray(targets) ? targets : [targets];
  const accs = list.map((target) => ({ target, acc: createDailyStatsAccumulator(target) }));
  const now = new Date().toISOString();
  let upserted = 0;
  let fetched = 0;
  let from: string | undefined;
  let to: string | undefined;

  const flush = async (final: boolean) => {
    for (const { target, acc } of accs) {
      if (final) acc.finish();
      const rows = acc.drain().map((s) => ({ ...dayStatToRow(s, target), updated_at: now }));
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const chunk = rows.slice(i, i + UPSERT_CHUNK);
        const { error } = await supabase
          .from(target.table)
          .upsert(chunk, { onConflict: conflictKeyOf(target) });
        if (error) return error.message;
        upserted += chunk.length;
        from ??= chunk[0].stat_date;
        to = chunk[chunk.length - 1].stat_date;
      }
    }
    return null;
  };

  for (let offset = 0; ; offset += FETCH_CHUNK) {
    const { data, error } = await supabase
      .from("snapshots")
      .select("snapshot_date, created_at, data")
      .order("snapshot_date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + FETCH_CHUNK - 1);
    if (error) return { ok: false, error: error.message };

    const snaps = (data ?? []) as RawSnapshot[];
    for (const s of snaps) for (const { acc } of accs) acc.push(s);
    fetched += snaps.length;

    const flushError = await flush(false);
    if (flushError) return { ok: false, error: flushError };

    if (snaps.length < FETCH_CHUNK) break;
  }

  const flushError = await flush(true);
  if (flushError) return { ok: false, error: flushError };

  return { ok: true, upserted, snapshots: fetched, from, to };
}
