-- 要求定義の日次集計（作り置き集計）
--
-- 「要求定義が日に何件完了したか」を日次で追うための表。
-- プチ改善の petit_daily_stats・改善の improvement_daily_stats と同じ仕組み・同じ列構成。
-- 1日1行の軽量な集計をこの表に持たせ、推移ビューはこの表だけを読む（読み取り O(行数)）。
-- 書き込みは cron（/api/snapshot）とバックフィル（/api/requirement-stats/backfill）から
-- service_role で行う（RLSをバイパス）。読み取りはログインユーザー全員（チーム共有の集計）。
--
-- 母数の定義: 置き場所（投資/改善/プチ改善/ABテスト）を問わず status = '要求定義'
--             （施策一覧の要求定義ビューと同じ母数）
-- 減少内訳: published=要求定義より後ろのステータス（要件定義以降・ABテスト中・完了）へ進んだ＝要求定義完了
--           moved_out=要求定義より前のステータス（未着手/調査）へ戻った
--           deleted=レコード削除
-- 増加内訳（increased_items.kind）: new=新規作成でいきなり要求定義 / inflow=他ステータスから要求定義へ
-- status_counts / status_flows は列構成を揃えるために持つだけ（母数が単一ステータスなので実質使わない）
--
-- 初回は作成後にバックフィルを一度流す:
--   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/requirement-stats/backfill"

create table if not exists public.requirement_daily_stats (
  stat_date       date primary key,
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
  updated_at      timestamptz not null default now()
);

alter table public.requirement_daily_stats enable row level security;

-- ログインユーザーは誰でも閲覧可。書き込みは service_role のみ（RLSをバイパスするため専用ポリシーは不要）。
drop policy if exists "authenticated read requirement_daily_stats" on public.requirement_daily_stats;
create policy "authenticated read requirement_daily_stats"
  on public.requirement_daily_stats for select
  to authenticated
  using (true);
