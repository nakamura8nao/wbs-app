-- 要求定義ビュー専用の並び順
-- 「いま要求定義を書いている施策」を、どれから片づけるかで並べ替えるための列。
-- priority はタブ（投資/改善/プチ改善/ABテスト）の並びに使っているため、
-- そちらを動かさずに並べ替えられるよう、このビュー専用の列を分けて持つ。
-- null は未設定。表示時は null を末尾にして priority 順で並べ、
-- 並べ替えたときにその時点の一覧へ 1..n を振り直す。
alter table projects
  add column if not exists requirement_priority integer;

comment on column projects.requirement_priority is
  '要求定義ビュー専用の並び順（1..n / null は未設定）。他ビューの priority には影響しない';
