-- 要承認ゲートを 2つ → 3つ に変更
--   wf_approved      : W  = WFレビュー（旧 impl_approved をリネーム）
--   design_approved  : デ = デザインレビュー（新規）
--   release_approved : 公 = 公開前レビュー（既存のまま）
-- いずれも 3状態 text: pending / approved / skipped
alter table projects rename column impl_approved to wf_approved;

alter table projects
  add column if not exists design_approved text not null default 'pending';
