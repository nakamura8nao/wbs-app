-- ステータスに「ABテスト中」を追加する
--
-- 公開してから効果を測っている間の状態。ABテストタブでのみ選べるようにしており、
-- 公開目安の欄には「ABテスト中（公開目安日〜）」と出す。
--
-- status には projects_status_check（許可値の列挙）が付いているため、値を足すには
-- 制約を作り直す必要がある。列挙は src/lib/constants.ts の STATUS_OPTIONS ＋
-- AB_TEST_STATUS と一致させる（片方だけ増やすと保存時に制約違反になる）。
--
-- 既存行に列挙外のステータスが残っていると、この制約追加は失敗する（＝壊れずに止まる）。
-- そのときは `select distinct status from projects order by 1;` で実際の値を確認する。

alter table projects drop constraint if exists projects_status_check;

alter table projects
  add constraint projects_status_check check (
    status in (
      '未着手',
      '調査',
      '要求定義',
      '要件定義',
      'システム',
      'テスト',
      '公開待ち',
      'ABテスト中',
      '完了'
    )
  );
