-- プチ改善タスクの日次増減サマリー（作り置き集計）
--
-- snapshots を毎回丸ごと差分すると「日数 × 全施策(＋フェーズ)」のJSONを転送することになり、
-- 日次スナップショットが年単位で溜まると推移グラフの表示が重くなる。
-- そこで 1日1行の軽量な集計をこの表に持たせ、推移ビューはこの表だけを読む（読み取り O(行数)）。
--
-- 書き込みは cron（/api/snapshot）とバックフィル（/api/petit-stats/backfill）から
-- service_role で行う（RLSをバイパス）。読み取りはログインユーザー全員（チーム共有の集計）。
--
-- 残数の定義: is_petit_improvement = true かつ status != '完了'
-- 減少内訳: published=フラグ残しstatus完了 / moved_out=フラグを外した / deleted=レコード削除

create table if not exists public.petit_daily_stats (
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

alter table public.petit_daily_stats enable row level security;

-- ログインユーザーは誰でも閲覧可。書き込みは service_role のみ（RLSをバイパスするため専用ポリシーは不要）。
create policy "authenticated read petit_daily_stats"
  on public.petit_daily_stats for select
  to authenticated
  using (true);
