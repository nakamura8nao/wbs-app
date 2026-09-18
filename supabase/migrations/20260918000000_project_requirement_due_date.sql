-- 要求定義の期日
-- 「この施策の要求定義をいつまでに書き上げるか」の自分たちの締切。
-- 公開目安（target_date）や公開マスト期日（must_date）が公開の日付なのに対し、
-- こちらは要求定義フェーズだけの期日なので別の列として持つ。
-- 要求定義ビューでの表示・編集に使い、null は未設定。
alter table projects
  add column if not exists requirement_due_date date;

comment on column projects.requirement_due_date is
  '要求定義を書き上げる期日（null は未設定）。公開日 target_date / must_date とは別の軸';
