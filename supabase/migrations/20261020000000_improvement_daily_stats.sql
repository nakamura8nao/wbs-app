-- 改善タブ（継続改善・運用強化）の日次増減サマリー（作り置き集計）
--
-- プチ改善の petit_daily_stats と同じ仕組み・同じ列構成。
-- 1日1行の軽量な集計をこの表に持たせ、推移ビューはこの表だけを読む（読み取り O(行数)）。
-- 書き込みは cron（/api/snapshot）とバックフィル（/api/improvement-stats/backfill）から
-- service_role で行う（RLSをバイパス）。読み取りはログインユーザー全員（チーム共有の集計）。
--
-- 残数の定義: 置き場所が改善（track = 'improvement' かつプチ改善/ABテストのフラグなし）かつ status != '完了'
-- 減少内訳: published=置き場所そのままで status 完了 / moved_out=別タブへ移動 / deleted=レコード削除
--
-- 初回は作成後にバックフィルを一度流す:
--   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/improvement-stats/backfill"

create table if not exists public.improvement_daily_stats (
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
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.improvement_daily_stats enable row level security;

-- ログインユーザーは誰でも閲覧可。書き込みは service_role のみ（RLSをバイパスするため専用ポリシーは不要）。
drop policy if exists "authenticated read improvement_daily_stats" on public.improvement_daily_stats;
create policy "authenticated read improvement_daily_stats"
  on public.improvement_daily_stats for select
  to authenticated
  using (true);
