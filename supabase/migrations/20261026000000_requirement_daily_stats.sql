-- 要求定義の日次集計（作り置き集計）
--
-- 「要求定義が日に何件完了したか」を日次で追うための表。
-- プチ改善の petit_daily_stats・改善の improvement_daily_stats と同じ仕組み・同じ列構成に
-- scope（全体 / 投資 / 改善 / プチ改善のどの母数か）を足したもの。1スコープ1日1行。
-- 推移ビューはこの表だけを読み、画面上部のトグルで scope を切り替える（読み取り O(行数)）。
-- 書き込みは cron（/api/snapshot）とバックフィル（/api/requirement-stats/backfill）から
-- service_role で行う（RLSをバイパス）。読み取りはログインユーザー全員（チーム共有の集計）。
--
-- 母数の定義: status が要求定義以前（未着手 / 調査 / 要求定義）＝要求定義が未完了の施策。
--   scope = all         … 置き場所（投資/改善/プチ改善/ABテスト）を問わない
--   scope = investment  … 投資タブにあるもの
--   scope = improvement … 改善タブにあるもの
--   scope = petit       … プチ改善タブにあるもの
-- 減少内訳: published=要求定義より後ろのステータス（要件定義以降・ABテスト中・完了）へ進んだ＝要求定義完了
--           moved_out=選択肢に無いステータスになった（通常は起きない）、または scope の置き場所から別タブへ移った
--           deleted=レコード削除
-- 増加内訳（increased_items.kind）: new=新規作成 / inflow=完了などから未着手〜要求定義へ戻った
-- status_counts: 母数の内訳（未着手 / 調査 / 要求定義）。status_flows: その前日比
--
-- 初回は作成後にバックフィルを一度流す:
--   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/requirement-stats/backfill"

create table if not exists public.requirement_daily_stats (
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

alter table public.requirement_daily_stats enable row level security;

-- ログインユーザーは誰でも閲覧可。書き込みは service_role のみ（RLSをバイパスするため専用ポリシーは不要）。
drop policy if exists "authenticated read requirement_daily_stats" on public.requirement_daily_stats;
create policy "authenticated read requirement_daily_stats"
  on public.requirement_daily_stats for select
  to authenticated
  using (true);
