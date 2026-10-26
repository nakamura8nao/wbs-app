// 推移ページ（/trends）の共有ロジック。ページ・API・ビューから使う純粋モジュール（DB アクセスは trends-query.ts）。
//
// 表は日付が増え続けるので、施策名（increased_items / decreased_items の JSON）込みの行は
// 直近 TABLE_PAGE_DAYS 日だけ読み、「もっと見る」で TABLE_PAGE_DAYS 日ずつ足す。
// グラフとサマリーは数字だけの軽い行を全期間読む。

import type { DailyStatRow, IncreaseKind, StatsScope } from "@/lib/daily-stats";
import { STATS_SCOPES } from "@/lib/daily-stats";

// 表を一度に出す日数（初期表示と「もっと見る」1回ぶん）
export const TABLE_PAGE_DAYS = 30;

export type TrendMetric = {
  total: number; // その日終わりの未完了数
  published: number; // 前日から完了した数
  increase: number; // 前日から増えた数
  isBaseline: boolean; // 最初の日。前日が無いので完了・増加は出せない
  publishedTitles: string[]; // 完了した施策名（ホバーで出す。軽い行では空）
  increasedItems: { title: string; kind: IncreaseKind }[]; // 増えた施策名と区分（新規／流入。軽い行では空）
};

export type TrendRow = {
  date: string; // YYYY-MM-DD
  backlog: TrendMetric | null; // 全案件の集計。無い日は null（バックフィル前など）
  requirement: TrendMetric | null; // 要求定義の集計
};

export type TrendRowsByScope = Record<StatsScope, TrendRow[]>;

// 数字だけの列（グラフ・サマリー用。全期間読む）
export const TREND_LIGHT_COLUMNS = "scope, stat_date, total, published, increase, is_baseline";
// 施策名込み（表用。直近だけ読む）
export const TREND_FULL_COLUMNS = `${TREND_LIGHT_COLUMNS}, increased_items, decreased_items`;

// 集計行 → 推移ページの1指標。items が無い（軽い行）ときは空配列
export function toMetric(r: DailyStatRow): TrendMetric {
  return {
    total: r.total,
    published: r.published,
    increase: r.increase,
    isBaseline: r.is_baseline,
    // 完了した施策＝減少のうち published（置き場所そのままで完了になった）
    publishedTitles: (r.decreased_items ?? [])
      .filter((it) => it.reason === "published")
      .map((it) => it.title),
    increasedItems: (r.increased_items ?? []).map((it) => ({ title: it.title, kind: it.kind })),
  };
}

// 全案件と要求定義の集計行を、スコープごとに日付でつき合わせて日付昇順に並べる
export function buildRowsByScope(backlogRows: unknown[], requirementRows: unknown[]): TrendRowsByScope {
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
  for (const r of backlogRows) put(r, "backlog");
  for (const r of requirementRows) put(r, "requirement");

  return Object.fromEntries(
    [...byScope].map(([scope, dates]) => [
      scope,
      [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)),
    ])
  ) as TrendRowsByScope;
}

// YYYY-MM-DD の days 日前
export function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// 「もっと見る」API（/api/trends）の応答
export type TrendsPageResponse = {
  rows: TrendRowsByScope; // 追加ぶん（日付昇順）
  from: string; // 読んだ範囲（from 以上 before 未満）
  before: string;
};
