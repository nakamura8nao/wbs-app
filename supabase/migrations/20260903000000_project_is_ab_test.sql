-- ABテストフラグ
-- リリース前にABテストで効果を検証する施策を示す。
-- フラグを立てた施策は通常の一覧（優先度順/Eng別/事業別/ガント）から外れ、
-- 専用の「ABテスト」ビューに集約される。プチ改善とは排他（片方を立てるともう片方は下りる）。
alter table projects
  add column if not exists is_ab_test boolean not null default false;
