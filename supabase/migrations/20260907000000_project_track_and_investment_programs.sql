-- 施策の3分類（トラック）と、新規投資の「大きな塊」＝プロジェクト
--
-- 施策は必ず次の3つのうち1つに属する（MECE）。not null + default + check で担保する。
--   investment  新規投資・構造改革 … 将来のリターン（インパクト）を狙って大きな工数を投じる施策
--   improvement 継続改善・運用強化 … 既存機能の価値を高め、日々の成果や業務効率を底上げする施策
--   idea        アイデア           … 実施が未確定の検討案や、将来的な施策の候補
--
-- 「新規投資・構造改革」は施策をそのまま並べるのではなく、10個以下の大きな塊
-- （例: イエタテアプリ / 管理画面とLINEの連携 / インセンティブ管理システム）にまとめて見る。
-- その塊を investment_programs として持ち、塊ごとに「成功条件（目的）」と「大まかな期日」を保持する。

create table if not exists public.investment_programs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  goal          text,        -- 何が達成されたら成功と言えるか。ビュー上に常に表示する
  target_period text,        -- 大まかな期日。「2026年下期」「2026Q4」など自由記述
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists investment_programs_sort_order_idx
  on public.investment_programs(sort_order);

alter table public.investment_programs enable row level security;

-- 施策と同じくチーム全員で見て編集する運用なので、ログインユーザーに全操作を許可する。
-- create policy に if not exists が無く、再実行すると落ちて全体がロールバックされるため、
-- 何度流しても同じ状態になるよう毎回作り直す。
drop policy if exists "authenticated read investment_programs" on public.investment_programs;
create policy "authenticated read investment_programs"
  on public.investment_programs for select
  to authenticated
  using (true);

drop policy if exists "authenticated insert investment_programs" on public.investment_programs;
create policy "authenticated insert investment_programs"
  on public.investment_programs for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated update investment_programs" on public.investment_programs;
create policy "authenticated update investment_programs"
  on public.investment_programs for update
  to authenticated
  using (true);

drop policy if exists "authenticated delete investment_programs" on public.investment_programs;
create policy "authenticated delete investment_programs"
  on public.investment_programs for delete
  to authenticated
  using (true);

alter table projects
  add column if not exists track text not null default 'improvement',
  -- 投資トラックの施策がどの塊に属するか。未割当（null）は投資ビューの「未割当」に出る
  add column if not exists investment_program_id uuid references public.investment_programs(id) on delete set null;

alter table projects drop constraint if exists projects_track_check;
alter table projects
  add constraint projects_track_check check (track in ('investment', 'improvement', 'idea'));

create index if not exists projects_track_idx on public.projects(track);
create index if not exists projects_investment_program_id_idx
  on public.projects(investment_program_id);

-- 初期分類: 優先順が未決定＝まだ実施が確定していないので「アイデア」に寄せる。
-- それ以外は既存機能の改善が大半なので default の improvement のまま。投資は運用側で振り分ける。
-- 再実行で運用中の分類を巻き戻さないよう、既定値のままの施策だけを対象にする
update projects
  set track = 'idea'
  where priority_undecided = true
    and track = 'improvement';
