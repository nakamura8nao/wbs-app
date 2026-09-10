// アサイン状況ビューの集計ロジック
//
// 「その日、その人に何本の施策が乗っているか」を置き場所（投資/改善/プチ改善/ABテスト）別に数える。
// 工数（traditional_hours など）は運用上まだ入力されていないため、
// 本数＝フェーズの予定が入っている施策の数、で近似する。
//   - 1つの施策に同じ人のフェーズが複数あっても 1 本と数える（施策単位）
//   - start/end の片方しかないフェーズは、その日 1 日だけの予定として扱う

import { placementOf, type Placement } from "@/lib/constants";

export const PLACEMENT_ORDER: Placement[] = [
  "investment",
  "improvement",
  "petit",
  "ab",
];

// 色は施策一覧の行メニュー（投資=amber / 改善=sky / プチ改善=violet / ABテスト=teal）に合わせる
export const PLACEMENT_META: Record<Placement, { label: string; color: string }> = {
  investment: { label: "投資", color: "#f59e0b" },
  improvement: { label: "改善", color: "#0ea5e9" },
  petit: { label: "プチ改善", color: "#8b5cf6" },
  ab: { label: "ABテスト", color: "#14b8a6" },
};

export type WorkloadPhaseInput = {
  project_id: string;
  assignee_id: string | null;
  start_date: string | null;
  end_date: string | null;
  name: string;
  status: string;
};

export type WorkloadProjectInput = {
  id: string;
  title: string;
  track: string;
  is_petit_improvement: boolean;
  is_ab_test: boolean;
  status: string;
};

export type ScheduledPhase = {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  placement: Placement;
  assigneeId: string | null;
  phaseName: string;
  phaseStatus: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
};

// 未割当を表す擬似メンバーのキー。Select の value にも使う
export const UNASSIGNED = "__unassigned__";
export const ALL_MEMBERS = "__all__";

// --- 日付ユーティリティ（ISO文字列のまま扱う。文字列比較で大小がそのまま使える） ---

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

// --- 集計 ---

// 「公開」そのものは作業というより当日のリリース操作で、負荷として数えると
// 実態より重く見えるので除外する。「公開前_◯◯確認」はレビュー工程なので残す。
const RELEASE_PHASE = /^公開\s*($|[(（])/;

export function isCountedPhase(name: string): boolean {
  return !RELEASE_PHASE.test(name.trim());
}

// フェーズの占有期間。日付が入っていないものは対象外（＝予定なし）
function span(phase: WorkloadPhaseInput): [string, string] | null {
  const s = phase.start_date;
  const e = phase.end_date;
  if (s && e) return s <= e ? [s, e] : [e, s];
  if (e) return [e, e];
  if (s) return [s, s];
  return null;
}

export function toScheduledPhases(
  phases: WorkloadPhaseInput[],
  projects: WorkloadProjectInput[]
): ScheduledPhase[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const out: ScheduledPhase[] = [];
  for (const ph of phases) {
    const project = byId.get(ph.project_id);
    if (!project) continue;
    if (!isCountedPhase(ph.name)) continue;
    const sp = span(ph);
    if (!sp) continue;
    out.push({
      projectId: project.id,
      projectTitle: project.title,
      projectStatus: project.status,
      placement: placementOf(project),
      assigneeId: ph.assignee_id,
      phaseName: ph.name,
      phaseStatus: ph.status,
      from: sp[0],
      to: sp[1],
    });
  }
  return out;
}

export type DayEntry = {
  key: string;
  projectId: string;
  projectTitle: string;
  placement: Placement;
  assigneeId: string | null;
  phaseNames: string[];
};

export type DayPoint = {
  date: string;
  counts: Record<Placement, number>;
  total: number;
  entries: DayEntry[];
};

function emptyCounts(): Record<Placement, number> {
  return { investment: 0, improvement: 0, petit: 0, ab: 0 };
}

/**
 * 日ごとの本数を数える。
 * assignee に ALL_MEMBERS を渡すと全員分（同じ施策に2人乗っていれば2本＝のべ）、
 * UNASSIGNED を渡すと担当未割当のフェーズだけを数える。
 */
export function buildDailySeries(
  scheduled: ScheduledPhase[],
  dates: string[],
  assignee: string
): DayPoint[] {
  const target = scheduled.filter((s) => {
    if (assignee === ALL_MEMBERS) return true;
    if (assignee === UNASSIGNED) return s.assigneeId === null;
    return s.assigneeId === assignee;
  });

  return dates.map((date) => {
    const map = new Map<string, DayEntry>();
    for (const s of target) {
      if (s.from > date || s.to < date) continue;
      // 全員表示のときは「誰の分か」で分けて数える（のべ本数）
      const key =
        assignee === ALL_MEMBERS
          ? `${s.assigneeId ?? UNASSIGNED}::${s.projectId}`
          : s.projectId;
      const found = map.get(key);
      if (found) {
        if (!found.phaseNames.includes(s.phaseName)) found.phaseNames.push(s.phaseName);
        continue;
      }
      map.set(key, {
        key,
        projectId: s.projectId,
        projectTitle: s.projectTitle,
        placement: s.placement,
        assigneeId: s.assigneeId,
        phaseNames: [s.phaseName],
      });
    }
    const counts = emptyCounts();
    for (const e of map.values()) counts[e.placement] += 1;
    const entries = [...map.values()].sort(
      (a, b) =>
        PLACEMENT_ORDER.indexOf(a.placement) - PLACEMENT_ORDER.indexOf(b.placement) ||
        a.projectTitle.localeCompare(b.projectTitle, "ja")
    );
    return {
      date,
      counts,
      total: PLACEMENT_ORDER.reduce((n, p) => n + counts[p], 0),
      entries,
    };
  });
}

// 期間内の要約（最大同時本数・平均・予定のない稼働日数）
export function summarize(points: DayPoint[], isWorkday: (date: string) => boolean) {
  const workdays = points.filter((p) => isWorkday(p.date));
  const busy = workdays.filter((p) => p.total > 0);
  const peak = points.reduce(
    (best, p) => (p.total > best.total ? p : best),
    points[0] ?? { date: "", total: 0, counts: emptyCounts(), entries: [] }
  );
  const avg =
    workdays.length === 0
      ? 0
      : workdays.reduce((n, p) => n + p.total, 0) / workdays.length;
  return {
    peak: peak.total,
    peakDate: peak.date,
    avg,
    workdayCount: workdays.length,
    busyDays: busy.length,
    freeDays: workdays.length - busy.length,
  };
}
