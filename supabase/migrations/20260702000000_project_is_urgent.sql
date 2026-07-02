-- 緊急フラグ（急）
-- 緊急性が高い＝公開の期日が事業部等により明確に決められている施策を示す。
-- 重要度（優先度）とは独立した軸として扱う。
alter table projects
  add column if not exists is_urgent boolean not null default false;
