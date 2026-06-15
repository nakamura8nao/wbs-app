-- 須川さんチェックを 2値(boolean) → 3状態(text) に拡張
--   pending  : 未承認（須川さん待ち）
--   approved : 承認済み
--   skipped  : 承認不要（事前承認をスキップ、詳細は備考で拾う）
-- 既存の boolean を変換: true → 'approved' / false → 'pending'
alter table projects
  alter column impl_approved drop default,
  alter column impl_approved type text using (case when impl_approved then 'approved' else 'pending' end),
  alter column impl_approved set default 'pending',
  alter column impl_approved set not null;

alter table projects
  alter column release_approved drop default,
  alter column release_approved type text using (case when release_approved then 'approved' else 'pending' end),
  alter column release_approved set default 'pending',
  alter column release_approved set not null;
