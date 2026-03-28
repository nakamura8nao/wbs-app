// 選択肢の定義を集約
// 値の追加・変更はここだけで行う

export const GROUP_LV1_OPTIONS = [
  "メディア",
  "SaaS",
  "カウンター",
  "フェア",
] as const;

export const GROUP_LV2_OPTIONS = [
  // 必要に応じて追加
] as const;

export const GROUP_LV3_OPTIONS = [
  // 必要に応じて追加
] as const;

export const STATUS_OPTIONS = [
  "未着手",
  "調査",
  "要求定義",
  "要件定義",
  "システム",
  "テスト",
  "公開待ち",
  "完了",
] as const;

export const PROGRESS_OPTIONS = [
  { value: "paused", label: "⏸️" },
  { value: "active", label: "▶️" },
  { value: "done", label: "✅️" },
] as const;

export const PHASE_STATUS_OPTIONS = [
  "未着手",
  "進行中",
  "完了",
] as const;

export const MEMBER_ROLE_OPTIONS = [
  "ディレクター",
  "エンジニア",
  "デザイナー",
] as const;

// 型定義
export type GroupLv1 = (typeof GROUP_LV1_OPTIONS)[number];
export type Status = (typeof STATUS_OPTIONS)[number];
export type Progress = (typeof PROGRESS_OPTIONS)[number]["value"];
export type PhaseStatus = (typeof PHASE_STATUS_OPTIONS)[number];
export type MemberRole = (typeof MEMBER_ROLE_OPTIONS)[number];
