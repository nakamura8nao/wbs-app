-- 全案件（未完了）の日次集計（作り置き集計）
--
-- 「未完了の案件が何件あり、日に何件完了したか」を日次で追うための表。
-- requirement_daily_stats と同じ仕組み・同じ列構成（scope 付き・1スコープ1日1行）。
-- 書き込みは cron（/api/snapshot）とバックフィル（/api/backlog-stats/backfill）から
-- service_role で行う（RLSをバイパス）。読み取りはログインユーザー全員（チーム共有の集計）。
--
-- 母数の定義: status != '完了'（ABテスト中も未完了として含む）。
--   scope = all         … 置き場所（投資/改善/プチ改善/ABテスト）を問わない
--   scope = investment  … 投資タブにあるもの
--   scope = improvement … 改善タブにあるもの（improvement_daily_stats と同じ数）
--   scope = petit       … プチ改善タブにあるもの（petit_daily_stats と同じ数）
-- 減少内訳: published=置き場所そのままで status が完了になった
--           moved_out=scope の置き場所から別タブへ移った
--           deleted=レコード削除
-- 増加内訳（increased_items.kind）: new=新規作成 / inflow=別タブから移ってきた・完了から戻った
-- status_counts: 母数のステータス別内訳。status_flows: その前日比
--
-- 初回は作成後にバックフィルを一度流す:
--   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/backlog-stats/backfill"

create table if not exists public.backlog_daily_stats (
  scope           text not null default 'all', -- all / investment / improvement / petit
  stat_date       date not null,
  total           integer not null default 0,
  is_baseline     boolean not null default false,
  increase        integer not null default 0,
  decrease        integer not null default 0,
  published       integer not null default 0,
  moved_out       integer not null default 0,
  deleted         integer not null default 0,
  increased_items jsonb   not null default '[]'::jsonb, -- [{id,title,kind}]
  decreased_items jsonb   not null default '[]'::jsonb, -- [{id,title,reason}]
  status_counts   jsonb   not null default '{}'::jsonb,
  status_flows    jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (scope, stat_date)
);

alter table public.backlog_daily_stats enable row level security;

-- ログインユーザーは誰でも閲覧可。書き込みは service_role のみ（RLSをバイパスするため専用ポリシーは不要）。
drop policy if exists "authenticated read backlog_daily_stats" on public.backlog_daily_stats;
create policy "authenticated read backlog_daily_stats"
  on public.backlog_daily_stats for select
  to authenticated
  using (true);
