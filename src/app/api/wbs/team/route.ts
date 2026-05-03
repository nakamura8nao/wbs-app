// チーム概観 API
// Bearer (個人アクセストークン) 認証必須。
// 元は scripts/team.mjs にあったロジックをそのまま移植。

import { NextResponse } from "next/server";
import { authenticateBearer, createAdminClient } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export async function GET(request: Request) {
  const auth = await authenticateBearer(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmt(today);

  const weekEnd = new Date(today);
  const dow = today.getDay();
  weekEnd.setDate(today.getDate() + ((7 - dow) % 7 || 7) - 1);
  const weekEndStr = fmt(weekEnd);

  const [membersRes, projectsRes, phasesRes] = await Promise.all([
    supabase.from("members").select("id, display_name, role").order("display_name"),
    supabase
      .from("projects")
      .select(
        "id, title, status, progress, priority, target_date, group_lv1, group_lv2, group_lv3, director_id, engineer_id, designer_id, size, notes"
      )
      .neq("status", "完了")
      .order("priority"),
    supabase
      .from("phases")
      .select(
        "id, project_id, name, assignee_id, start_date, end_date, status, traditional_hours, ai_target_hours, actual_hours, sort_order"
      )
      .order("sort_order"),
  ]);

  for (const r of [membersRes, projectsRes, phasesRes]) {
    if (r.error) {
      return NextResponse.json(
        { error: "supabase query failed", detail: r.error.message },
        { status: 500 }
      );
    }
  }

  const members = membersRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const phases = phasesRes.data ?? [];

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

  const activePhases = phases.filter(
    (ph) => ph.status !== "完了" && projectById[ph.project_id]
  );

  const enriched = activePhases.map((ph) => {
    const proj = projectById[ph.project_id];
    const assignee = ph.assignee_id ? memberById[ph.assignee_id] : null;
    const daysDelayed =
      ph.end_date && ph.end_date < todayStr
        ? Math.floor((today.getTime() - new Date(ph.end_date).getTime()) / 86400000)
        : 0;
    return {
      phase_id: ph.id,
      phase_name: ph.name,
      status: ph.status,
      assignee_id: ph.assignee_id,
      assignee_name: assignee?.display_name ?? null,
      assignee_role: assignee?.role ?? null,
      start_date: ph.start_date,
      end_date: ph.end_date,
      traditional_hours: ph.traditional_hours,
      ai_target_hours: ph.ai_target_hours,
      actual_hours: ph.actual_hours,
      project_id: proj.id,
      project_title: proj.title,
      project_priority: proj.priority,
      project_group: [proj.group_lv1, proj.group_lv2, proj.group_lv3]
        .filter(Boolean)
        .join(" / "),
      days_delayed: daysDelayed,
    };
  });

  const byMember: Record<string, unknown> = {};
  for (const m of members) {
    const myPhases = enriched.filter((p) => p.assignee_id === m.id);
    byMember[m.display_name] = {
      role: m.role,
      active_phase_count: myPhases.length,
      in_progress_phase_count: myPhases.filter((p) => p.status === "進行中").length,
      delayed_phase_count: myPhases.filter((p) => p.days_delayed > 0).length,
      this_week_due_count: myPhases.filter(
        (p) => p.end_date && p.end_date >= todayStr && p.end_date <= weekEndStr
      ).length,
      projects_as_director: projects.filter((p) => p.director_id === m.id).length,
      projects_as_engineer: projects.filter((p) => p.engineer_id === m.id).length,
      projects_as_designer: projects.filter((p) => p.designer_id === m.id).length,
      phases: myPhases.map((p) => ({
        project: p.project_title,
        phase: p.phase_name,
        status: p.status,
        end_date: p.end_date,
        days_delayed: p.days_delayed,
        traditional_hours: p.traditional_hours,
        ai_target_hours: p.ai_target_hours,
        actual_hours: p.actual_hours,
      })),
    };
  }

  const delayed = enriched.filter((p) => p.days_delayed > 0);
  const thisWeek = enriched.filter(
    (p) => p.end_date && p.end_date >= todayStr && p.end_date <= weekEndStr
  );
  const unassigned = enriched.filter((p) => !p.assignee_id);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    today: todayStr,
    week_end: weekEndStr,
    summary: {
      active_projects: projects.length,
      active_phases: enriched.length,
      in_progress_phases: enriched.filter((p) => p.status === "進行中").length,
      delayed_phases: delayed.length,
      this_week_due: thisWeek.length,
      unassigned: unassigned.length,
    },
    members: byMember,
    delayed_phases: delayed
      .sort((a, b) => b.days_delayed - a.days_delayed)
      .map((p) => ({
        project: p.project_title,
        phase: p.phase_name,
        assignee: p.assignee_name,
        end_date: p.end_date,
        days_delayed: p.days_delayed,
        status: p.status,
        priority: p.project_priority,
      })),
    this_week_phases: thisWeek
      .sort((a, b) => (a.end_date || "").localeCompare(b.end_date || ""))
      .map((p) => ({
        project: p.project_title,
        phase: p.phase_name,
        assignee: p.assignee_name,
        end_date: p.end_date,
        status: p.status,
      })),
    unassigned_phases: unassigned.map((p) => ({
      project: p.project_title,
      phase: p.phase_name,
      end_date: p.end_date,
      status: p.status,
    })),
    projects_without_phases: projects
      .filter((proj) => !enriched.some((ph) => ph.project_id === proj.id))
      .map((p) => ({
        title: p.title,
        priority: p.priority,
        status: p.status,
        target_date: p.target_date,
        director: p.director_id ? memberById[p.director_id]?.display_name ?? null : null,
      })),
  });
}
