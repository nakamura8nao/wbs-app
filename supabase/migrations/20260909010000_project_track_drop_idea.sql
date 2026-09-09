-- トラックから「アイデア」を廃止する
--
-- アイデア専用タブを畳んだため、置き場所は 投資 / 改善 / プチ改善 / ABテスト の4つになった。
-- track の許可値を investment / improvement の2値に狭める。
--
-- 廃止時点でアイデアの施策は0件だが、残っていると制約追加が失敗するので、
-- 念のため改善へ寄せてから制約を張り直す（0件なら何もしない）。
update projects set track = 'improvement' where track = 'idea';

alter table projects drop constraint if exists projects_track_check;
alter table projects
  add constraint projects_track_check check (track in ('investment', 'improvement'));
