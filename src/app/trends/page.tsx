import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { STATS_SCOPES, type DailyStatRow, type StatsScope } from "@/lib/daily-stats";
import { TrendsView, type TrendMetric, type TrendRow } from "@/components/trends-view";

// 作り置き集計行から、推移ページで使う数と、ホバーで出す施策名だけ取り出す
function toMetric(r: DailyStatRow): TrendMetric {
  return {
    total: r.total,
    published: r.published,
    increase: r.increase,
    isBaseline: r.is_baseline,
    // 完了した施策＝減少のうち published（置き場所そのままで完了になった）
    publishedTitles: (r.decreased_items ?? []).filter((it) => it.reason === "published").map((it) => it.title),
    increasedItems: (r.increased_items ?? []).map((it) => ({ title: it.title, kind: it.kind })),
  };
}

export default async function TrendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 全案件（backlog_daily_stats）と要求定義（requirement_daily_stats）を4スコープぶん読み、
  // 日付でつき合わせる。増減した施策の名前はホバーで出すので items も読む（ステータス内訳などは不要）。
  const cols = "scope, stat_date, total, published, increase, is_baseline, increased_items, decreased_items";
  const [{ data: backlogRows }, { data: requirementRows }] = await Promise.all([
    supabase.from("backlog_daily_stats").select(cols).order("stat_date", { ascending: true }),
    supabase.from("requirement_daily_stats").select(cols).order("stat_date", { ascending: true }),
  ]);

  const byScope = new Map<StatsScope, Map<string, TrendRow>>(
    STATS_SCOPES.map((s) => [s.value, new Map()])
  );
  const put = (raw: unknown, key: "backlog" | "requirement") => {
    const r = raw as DailyStatRow;
    const scope = (r.scope ?? "all") as StatsScope;
    const dates = byScope.get(scope);
    if (!dates) return;
    const row = dates.get(r.stat_date) ?? { date: r.stat_date, backlog: null, requirement: null };
    row[key] = toMetric(r);
    dates.set(r.stat_date, row);
  };
  for (const r of backlogRows ?? []) put(r, "backlog");
  for (const r of requirementRows ?? []) put(r, "requirement");

  const rowsByScope = Object.fromEntries(
    [...byScope].map(([scope, dates]) => [
      scope,
      [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)),
    ])
  ) as Record<StatsScope, TrendRow[]>;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4">
        <TrendsView rowsByScope={rowsByScope} />
      </main>
    </div>
  );
}
