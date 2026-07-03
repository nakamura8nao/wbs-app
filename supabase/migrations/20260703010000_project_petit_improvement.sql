-- プチ改善フラグ
-- メイン開発の裏で少しずつ消化する「小さな修正・改善」を示す。
-- フラグを立てた施策は通常の一覧（優先度順/Eng別/事業別/ガント）から外れ、
-- 専用の「プチ改善」ビューに集約される。重要度（優先度）とは独立した運用軸。
alter table projects
  add column if not exists is_petit_improvement boolean not null default false;
