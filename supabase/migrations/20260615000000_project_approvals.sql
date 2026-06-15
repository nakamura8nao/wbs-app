-- 須川さんチェック（承認）フラグ
-- impl_approved   : 実装開始前チェック（要件定義 → システム の前）
-- release_approved : 公開前チェック（公開待ち → 完了 の前）
alter table projects
  add column if not exists impl_approved boolean not null default false,
  add column if not exists release_approved boolean not null default false;
