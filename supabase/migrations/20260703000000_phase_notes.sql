-- フェーズごとのメモ
-- 各フェーズに自由記述のメモを持たせる。UI ではホバーで内容を表示する。
alter table phases
  add column if not exists notes text;
