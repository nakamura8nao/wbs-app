// 全データ一括取得 API
// Bearer (個人アクセストークン) 認証必須。
// 集計は呼び出し側 (Claude / CLI) で行う前提のローデータ提供。
//
// クエリ:
//   include_completed=1   完了済プロジェクト/フェーズも含める (デフォルト: 除外)
//   since=YYYY-MM-DD      updated_at がこの日以降のものだけ (差分取得用)

import { NextResponse } from "next/server";
import { authenticateBearer, createAdminClient } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateBearer(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const includeCompleted = url.searchParams.get("include_completed") === "1";
  const since = url.searchParams.get("since");

  const supabase = createAdminClient();

  let projectsQuery = supabase.from("projects").select("*").order("priority");
  if (!includeCompleted) projectsQuery = projectsQuery.neq("status", "完了");
  if (since) projectsQuery = projectsQuery.gte("updated_at", since);

  let phasesQuery = supabase.from("phases").select("*").order("sort_order");
  if (since) phasesQuery = phasesQuery.gte("updated_at", since);

  const [membersRes, projectsRes, phasesRes, depsRes] = await Promise.all([
    supabase
      .from("members")
      .select("id, user_id, display_name, role")
      .order("display_name"),
    projectsQuery,
    phasesQuery,
    supabase.from("phase_dependencies").select("*"),
  ]);

  for (const r of [membersRes, projectsRes, phasesRes, depsRes]) {
    if (r.error) {
      return NextResponse.json(
        { error: "supabase query failed", detail: r.error.message },
        { status: 500 }
      );
    }
  }

  // 完了プロジェクトを除外したときは、配下フェーズも合わせて落とす
  const projectIds = new Set((projectsRes.data ?? []).map((p) => p.id));
  const phases = includeCompleted
    ? phasesRes.data ?? []
    : (phasesRes.data ?? []).filter((ph) => projectIds.has(ph.project_id));

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    filters: {
      include_completed: includeCompleted,
      since: since || null,
    },
    members: membersRes.data ?? [],
    projects: projectsRes.data ?? [],
    phases,
    phase_dependencies: depsRes.data ?? [],
  });
}
