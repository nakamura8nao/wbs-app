-- 残数のステータス別内訳と、ステータス別の増減を日次集計に持たせる
--
-- 「未完了のうち、未着手・要求定義のものが何件か」「それが直近1か月でどれだけ増減したか」を見たい。
--   status_counts: 残数（total）を status ごとに数えた jsonb（例: {"未着手": 5, "要求定義": 3}）
--   status_flows : status ごとの前日比の増減（例: {"未着手": {"increase": 1, "decrease": 2}}）。
--                  ステータス間の移動は前のステータスの decrease・後のステータスの increase に数える
-- どのステータスを画面に出すかはアプリ側で選ぶので、列は全ステータスぶん持つ。
--
-- 既存行は空 '{}' のままになるので、適用後にバックフィルを両方流して埋める:
--   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/petit-stats/backfill"
--   curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/improvement-stats/backfill"

alter table public.petit_daily_stats
  add column if not exists status_counts jsonb not null default '{}'::jsonb,
  add column if not exists status_flows  jsonb not null default '{}'::jsonb;

alter table public.improvement_daily_stats
  add column if not exists status_counts jsonb not null default '{}'::jsonb,
  add column if not exists status_flows  jsonb not null default '{}'::jsonb;
