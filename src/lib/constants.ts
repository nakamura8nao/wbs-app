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
  { value: "カウンター・フェア", parent: "サービス開発", icon: "Handshake", color: "text-emerald-600" },
  { value: "メディア", parent: "サービス開発", icon: "Globe", color: "text-blue-500" },
  { value: "保守", parent: "保守", icon: "Wrench", color: "text-orange-500" },
] as const;

// lv3 は「どの持ち場のKPIを狙うか」で付ける（画面の場所ではない）。kpi は改善タブの見出しに出す目安。
export const GROUP_LV3_OPTIONS = [
  { value: "工務店向け", parent: "SaaS", icon: "Building2", kpi: "" },
  { value: "不動産事業者向け", parent: "SaaS", icon: "Building", kpi: "" },
  { value: "集客", parent: "カウンター・フェア", icon: "Megaphone", kpi: "予約数" },
  { value: "カウンター相談", parent: "カウンター・フェア", icon: "MessageCircle", kpi: "紹介数" },
  { value: "フェア当日", parent: "カウンター・フェア", icon: "CalendarCheck", kpi: "来場・初回アンケート回答" },
  { value: "フォロー", parent: "カウンター・フェア", icon: "Mail", kpi: "成約・継続" },
  { value: "周辺事務", parent: "カウンター・フェア", icon: "ClipboardList", kpi: "業務の手間" },
  // メディアは「狙うKPI」で割る。イエタテ／オウチーノは媒体名でKPIが割れないので、
  // 新規の施策には下の3つを使う（既存データの互換のため媒体名も残している）。
  { value: "流入", parent: "メディア", icon: "Eye", kpi: "PV・UU" },
  { value: "送客", parent: "メディア", icon: "ArrowRightLeft", kpi: "カウンター・フェアへの予約" },
  { value: "メディアCV", parent: "メディア", icon: "MousePointerClick", kpi: "住宅会社への反響" },
  { value: "イエタテ", parent: "メディア", icon: "Home", kpi: "" },
  { value: "オウチーノ", parent: "メディア", icon: "Search", kpi: "" },
  { value: "保守", parent: "保守", icon: "Settings", kpi: "守り（障害・脆弱性）" },
] as const;

// lv1 を選択したら lv2 の選択肢を絞る
export function getGroupLv2Options(lv1: string) {
  return GROUP_LV2_OPTIONS.filter((o) => o.parent === lv1);
}

// lv2 を選択したら lv3 の選択肢を絞る
export function getGroupLv3Options(lv2: string) {
  return GROUP_LV3_OPTIONS.filter((o) => o.parent === lv2);
}

// DB側に projects_status_check（許可値の列挙）があるので、ここを増やすときは
// supabase/migrations の制約も合わせて更新する（片方だけだと保存が制約違反で落ちる）。
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

// ABテストタブ限定のステータス。公開して効果を測っている間の状態で、
// この状態のときは公開目安の欄に「ABテスト中（公開目安日〜）」と出す。
// 通常のステータス選択肢には入れず、ABテストタブと、その施策を編集するときだけ出す。
export const AB_TEST_STATUS = "ABテスト中";

export const AB_STATUS_OPTIONS: readonly string[] = [
  ...STATUS_OPTIONS.filter((s) => s !== "完了"),
  AB_TEST_STATUS,
  "完了",
];

export const PROGRESS_OPTIONS = [
  { value: "paused", label: "⏸️" },
  { value: "active", label: "▶️" },
  { value: "done", label: "✅️" },
] as const;

export const SIZE_OPTIONS = [
  { value: "1", label: "1pt (1h)" },
  { value: "2", label: "2pt (2h)" },
  { value: "4", label: "4pt (4h)" },
  { value: "8", label: "8pt (1日)" },
  { value: "16", label: "16pt (2日)" },
  { value: "24", label: "24pt (3日)" },
  { value: "32", label: "32pt (4日)" },
  { value: "40", label: "40pt (1週間)" },
  { value: "80", label: "80pt (2週間)" },
  { value: "120", label: "120pt (3週間)" },
  { value: "160", label: "160pt (1か月)" },
  { value: "240", label: "240pt (1か月半)" },
  { value: "320", label: "320pt (2か月)" },
  { value: "400", label: "400pt (2か月半)" },
  { value: "480", label: "480pt (3か月)" },
] as const;

// 施策のトラック。施策は必ずこのどちらか1つに属する（MECE）。
// 分ける軸は「売上アップへの道筋が見えているか」の1本（規模や工数では分けない）。
// 問1 投資施策の開始時マイルストンなら投資のまま / 問2 利益を守る施策は入れ替えなら投資・手入れなら改善 /
// 問3 売上までの裏付けのない仮説が2つ以上なら投資。詳しい判定フローと具体例は TRACK_GUIDELINE_URL。
// short はタブなどの狭い場所での略称。
export const TRACK_GUIDELINE_URL = "https://claude.ai/artifact/Ec9hJxy2Lck6nxTo2xraCA";

export const TRACK_OPTIONS = [
  {
    value: "investment",
    label: "新規投資・構造改革",
    short: "投資",
    description: "売上アップにつながる道筋はまだ見えていないが、可能性がありそうな施策。または、今の仕組みを止めて別の仕組みに入れ替える施策。",
  },
  {
    value: "improvement",
    label: "継続改善・運用強化",
    short: "改善",
    description: "売上アップにつながる道筋が見えている施策。または、今の仕組みに手を入れて利益を守る施策。",
  },
] as const;

export const DEFAULT_TRACK = "improvement";

// 投資ビューの大きな塊は「多くても10個以下」で運用する。超えたら畳む方向に見直す合図。
export const INVESTMENT_PROGRAM_SOFT_LIMIT = 10;

// 施策の置き場所＝表示タブ。施策は必ずこの4つのどれか1つに属する（MECE）。
// DB上は投資/改善が track 列、プチ改善/ABテストが専用フラグに分かれているが、
// 運用上は「どのタブに置くか」の1択なので、入力はこの5択にまとめて保存時にマッピングする。
// （プチ改善の日次集計とスナップショット履歴がフラグを見ているため、列構成はそのまま残す）
// short はタブや集計表などの狭い場所での略称。
export const PLACEMENT_OPTIONS = [
  { value: "investment", label: "投資（新規投資・構造改革）", short: "投資", description: "売上アップにつながる道筋はまだ見えていないが、可能性がありそうな施策。または、今の仕組みを止めて別の仕組みに入れ替える施策。" },
  { value: "improvement", label: "改善（継続改善・運用強化）", short: "改善", description: "売上アップにつながる道筋が見えている施策。または、今の仕組みに手を入れて利益を守る施策。" },
  { value: "petit", label: "プチ改善", short: "プチ改善", description: "投資・改善施策と並行して進めるサブタスク" },
  { value: "ab", label: "ABテスト", short: "ABテスト", description: "リリース前にABテストで効果を検証する施策" },
] as const;

type PlacementSource = {
  track: string;
  is_petit_improvement: boolean;
  is_ab_test: boolean;
};

// 施策の現在値から置き場所を求める。プチ改善／ABテストのフラグが立っていれば
// そちらが表示タブになる（3分類ビューはフラグ付きを除外しているため）。
export function placementOf(project: PlacementSource): Placement {
  if (project.is_ab_test) return "ab";
  if (project.is_petit_improvement) return "petit";
  return TRACK_OPTIONS.some((t) => t.value === project.track)
    ? (project.track as Track)
    : DEFAULT_TRACK;
}

// 置き場所から保存する値へ。プチ改善／ABテストのときは track を書き換えず、
// 元の track（フラグを外したときの戻り先）をそのまま残す。
export function placementToFields(placement: Placement, currentTrack: Track) {
  return {
    track: placement === "petit" || placement === "ab" ? currentTrack : placement,
    is_petit_improvement: placement === "petit",
    is_ab_test: placement === "ab",
  };
}

export function placementLabel(project: PlacementSource) {
  const placement = placementOf(project);
  return PLACEMENT_OPTIONS.find((o) => o.value === placement)?.label ?? placement;
}

export function placementShortLabel(value: string) {
  return PLACEMENT_OPTIONS.find((o) => o.value === value)?.short ?? value;
}

export function trackLabel(value: string) {
  return TRACK_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

export function trackShortLabel(value: string) {
  return TRACK_OPTIONS.find((t) => t.value === value)?.short ?? value;
}

// 須川さんチェック（承認）の3状態
export const APPROVAL_STATES = ["pending", "approved", "skipped"] as const;

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
export type Size = (typeof SIZE_OPTIONS)[number]["value"];
export type ApprovalState = (typeof APPROVAL_STATES)[number];
export type Track = (typeof TRACK_OPTIONS)[number]["value"];
export type Placement = (typeof PLACEMENT_OPTIONS)[number]["value"];
