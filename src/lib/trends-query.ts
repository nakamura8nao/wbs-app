import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRowsByScope,
  buildWeekPlan,
  todayJst,
  TREND_FULL_COLUMNS,
  TREND_LIGHT_COLUMNS,
  type TrendRowsByScope,
  type WeekPlan,
  type WeekPlanSource,
} from "@/lib/trends";

// 推移ページの集計行の読み込み。ログインユーザーのクライアント（RLS で select のみ）で呼ぶ。

const TABLES = ["backlog_daily_stats", "requirement_daily_stats"] as const;

// 数字だけの行を全期間（グラフ・サマリー用）
export async function fetchTrendRowsLight(supabase: SupabaseClient): Promise<TrendRowsByScope> {
  const [backlog, requirement] = await Promise.all(
    TABLES.map((t) =>
      supabase.from(t).select(TREND_LIGHT_COLUMNS).order("stat_date", { ascending: true })
    )
  );
  return buildRowsByScope(backlog.data ?? [], requirement.data ?? []);
}

// 施策名込みの行を日付範囲で（表用）。from 以上 before 未満。before を省くと上限なし
export async function fetchTrendRowsFull(
  supabase: SupabaseClient,
  range: { from: string; before?: string }
): Promise<TrendRowsByScope> {
  const [backlog, requirement] = await Promise.all(
    TABLES.map((t) => {
      let q = supabase.from(t).select(TREND_FULL_COLUMNS).gte("stat_date", range.from);
      if (range.before) q = q.lt("stat_date", range.before);
      return q.order("stat_date", { ascending: true });
    })
  );
  return buildRowsByScope(backlog.data ?? [], requirement.data ?? []);
}

// 今週（月〜日・日本時間）に公開目安か要求定義期日がある施策。表の下の「今週の予定」用
export async function fetchWeekPlan(supabase: SupabaseClient): Promise<WeekPlan> {
  const empty = buildWeekPlan([], todayJst());
  const { data } = await supabase
    .from("projects")
    .select(
      "id, title, status, track, is_petit_improvement, is_ab_test, target_date, target_date_tentative, requirement_due_date, director:members!projects_director_id_fkey(display_name)"
    )
    .or(
      `and(target_date.gte.${empty.weekStart},target_date.lte.${empty.weekEnd}),and(requirement_due_date.gte.${empty.weekStart},requirement_due_date.lte.${empty.weekEnd})`
    );
  return buildWeekPlan((data ?? []) as WeekPlanSource[], empty.today);
}
