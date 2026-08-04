-- 公開マスト期日
-- 事業部等により確定していて「絶対に動かせない」公開期日。
-- target_date（公開目安）は社内の見込みで前後しうるのに対し、こちらは動かせない日として別に持つ。
-- 期日が入っていること自体が「動かせない」ことを示すので、旧 is_urgent フラグはこの列に統合して廃止する。
alter table projects
  add column if not exists must_date date;

-- 旧フラグが立っていた施策は、その時点の公開目安日をマスト期日として引き継ぐ
update projects
  set must_date = target_date
  where is_urgent = true
    and target_date is not null
    and must_date is null;

alter table projects
  drop column if exists is_urgent;
