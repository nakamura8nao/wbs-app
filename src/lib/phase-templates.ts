// 施策を開いたときに自動生成されるフェーズのテンプレート。
// role は施策の担当者（ディレクター／デザイナー／エンジニア）に対応し、
// 生成時にその人がフェーズの担当者として入る。

export type PhaseRole = "director" | "designer" | "engineer";

export const DEFAULT_PHASES: { name: string; role?: PhaseRole }[] = [
  { name: "ディレクターキックオフ", role: "director" },
  { name: "要求定義_作成", role: "director" },
  { name: "要求定義_レビュー", role: "director" },
  { name: "要求定義_修正〜fix", role: "director" },
  { name: "要求定義_須川さん確認", role: "director" },
  { name: "デザイン_作成", role: "designer" },
  { name: "デザイン_レビュー", role: "designer" },
  { name: "デザイン_修正〜fix", role: "designer" },
  { name: "デザイン_須川さん確認", role: "designer" },
  { name: "要件定義_作成", role: "engineer" },
  { name: "要件定義_レビュー", role: "engineer" },
  { name: "要件定義_修正〜fix", role: "engineer" },
  { name: "設計_作成", role: "engineer" },
  { name: "設計_レビュー", role: "engineer" },
  { name: "設計_修正〜fix", role: "engineer" },
  { name: "実装_PR1", role: "engineer" },
  { name: "実装_PR2", role: "engineer" },
  { name: "実装_PR3", role: "engineer" },
  { name: "実装_PR4", role: "engineer" },
  { name: "実装_PR5", role: "engineer" },
  { name: "テスト_仕様書作成", role: "engineer" },
  { name: "テスト_実施", role: "director" },
  { name: "テスト_修正~fix", role: "engineer" },
  { name: "公開前_須川さん確認", role: "director" },
  { name: "公開前_事業部確認", role: "director" },
  { name: "公開(BETA解除)", role: "engineer" },
];

export const PHASE_ROLE_LABEL: Record<PhaseRole, string> = {
  director: "ディレクター",
  designer: "デザイナー",
  engineer: "エンジニア",
};

export const PHASE_ROLE_ORDER: PhaseRole[] = ["director", "designer", "engineer"];

const ROLE_BY_PHASE_NAME = new Map<string, PhaseRole>(
  DEFAULT_PHASES.filter((p) => p.role).map((p) => [p.name, p.role as PhaseRole])
);

// テンプレートと同じ名前のフェーズなら、その役割を返す（自由入力のフェーズは null）
export function templateRoleOf(phaseName: string): PhaseRole | null {
  return ROLE_BY_PHASE_NAME.get(phaseName.trim()) ?? null;
}

export type RoleAssignees = Record<PhaseRole, string | null>;

export type PhaseSyncCandidate = {
  phaseId: string;
  phaseName: string;
  phaseStatus: string;
  role: PhaseRole;
  currentAssigneeId: string | null;
  nextAssigneeId: string | null;
  // 既定でチェックを入れるか。前の担当者のままか未割当のフェーズだけを既定にして、
  // 個別に別の人へ振り替えたフェーズや完了ぶんは勝手に書き換えない
  recommended: boolean;
};

/**
 * 施策の担当者を変えたときに、追随させられるフェーズを洗い出す。
 * 対象はテンプレートと同じ名前のフェーズだけ（自由に足したフェーズは触らない）。
 */
export function buildPhaseSyncCandidates(
  phases: {
    id: string;
    name: string;
    status: string;
    assignee_id: string | null;
  }[],
  before: RoleAssignees,
  after: RoleAssignees
): PhaseSyncCandidate[] {
  const changed = PHASE_ROLE_ORDER.filter((r) => before[r] !== after[r]);
  if (changed.length === 0) return [];

  const out: PhaseSyncCandidate[] = [];
  for (const phase of phases) {
    const role = templateRoleOf(phase.name);
    if (!role || !changed.includes(role)) continue;
    const next = after[role];
    if (phase.assignee_id === next) continue;
    out.push({
      phaseId: phase.id,
      phaseName: phase.name,
      phaseStatus: phase.status,
      role,
      currentAssigneeId: phase.assignee_id,
      nextAssigneeId: next,
      recommended:
        phase.status !== "完了" &&
        (phase.assignee_id === before[role] || phase.assignee_id === null),
    });
  }
  return out.sort(
    (a, b) => PHASE_ROLE_ORDER.indexOf(a.role) - PHASE_ROLE_ORDER.indexOf(b.role)
  );
}
