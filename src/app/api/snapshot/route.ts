import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  computePetitStats,
  petitDayStatToRow,
  type RawSnapshot,
} from "@/lib/petit-stats";

// Cron から呼ばれる API。service_role key でRLSをバイパス。
// CRON_SECRET で認証。
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 全施策 + フェーズを取得
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      *,
      director:members!projects_director_id_fkey(id, display_name, role),
      engineer:members!projects_engineer_id_fkey(id, display_name, role),
      designer:members!projects_designer_id_fkey(id, display_name, role)
    `)
    .order("priority", { ascending: true });

  const { data: phases } = await supabase
    .from("phases")
    .select(`
      *,
      assignee:members!phases_assignee_id_fkey(id, display_name, role),
      dependencies:phase_dependencies!phase_dependencies_phase_id_fkey(depends_on_phase_id)
    `)
    .order("sort_order", { ascending: true });

  const snapshotData = (projects ?? []).map(
    (proj: { id: string; [k: string]: unknown }) => ({
      ...proj,
      phases: (phases ?? []).filter(
        (ph: { project_id: string; [k: string]: unknown }) =>
          ph.project_id === proj.id
      ),
    })
  );

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  await supabase.from("snapshots").insert({
    snapshot_date: dateStr,
    label: `${dateStr} 定期`,
    data: snapshotData,
  });

  // プチ改善の日次集計（作り置き）を更新する。
  // 今日の行だけ算出したいので直近の数日ぶんスナップショットを取り、前日との差分を出す。
  // computePetitStats はウィンドウ先頭を基準日扱いするが、使うのは常に末尾＝今日の行なので影響しない。
  const { data: recentSnaps } = await supabase
    .from("snapshots")
    .select("snapshot_date, created_at, data")
    .lte("snapshot_date", dateStr)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const stats = computePetitStats((recentSnaps ?? []) as RawSnapshot[]);
  const todayStat = stats.find((s) => s.date === dateStr);
  if (todayStat) {
    await supabase.from("petit_daily_stats").upsert(
      { ...petitDayStatToRow(todayStat), updated_at: new Date().toISOString() },
      { onConflict: "stat_date" }
    );
  }

  return NextResponse.json({ ok: true, date: dateStr });
}
