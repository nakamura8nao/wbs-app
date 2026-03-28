// 選択肢の定義を集約
// 値の追加・変更はここだけで行う

// グループ階層定義
// lv2 は lv1 に、lv3 は lv2 に紐づく
export const GROUP_LV1_OPTIONS = [
  "サービス開発",
  "保守",
] as const;

export const GROUP_LV2_OPTIONS = [
  { value: "SaaS", parent: "サービス開発", icon: "Cloud", color: "text-violet-500" },
  { value: "カウンター・フェア", parent: "サービス開発", icon: "Users", color: "text-emerald-500" },
  { value: "メディア", parent: "サービス開発", icon: "Globe", color: "text-blue-500" },
  { value: "保守", parent: "保守", icon: "Wrench", color: "text-orange-500" },
] as const;

export const GROUP_LV3_OPTIONS = [
  { value: "工務店向け", parent: "SaaS", icon: "Building2" },
  { value: "不動産事業者向け", parent: "SaaS", icon: "Building" },
  { value: "集客", parent: "カウンター・フェア", icon: "Megaphone" },
  { value: "カウンター相談", parent: "カウンター・フェア", icon: "MessageCircle" },
  { value: "フェア当日", parent: "カウンター・フェア", icon: "CalendarCheck" },
  { value: "フォロー", parent: "カウンター・フェア", icon: "Mail" },
  { value: "周辺事務", parent: "カウンター・フェア", icon: "ClipboardList" },
  { value: "イエタテ", parent: "メディア", icon: "Home" },
  { value: "オウチーノ", parent: "メディア", icon: "Search" },
  { value: "保守", parent: "保守", icon: "Settings" },
] as const;

// lv1 を選択したら lv2 の選択肢を絞る
export function getGroupLv2Options(lv1: string) {
  return GROUP_LV2_OPTIONS.filter((o) => o.parent === lv1);
}

// lv2 を選択したら lv3 の選択肢を絞る
export function getGroupLv3Options(lv2: string) {
  return GROUP_LV3_OPTIONS.filter((o) => o.parent === lv2);
}

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
