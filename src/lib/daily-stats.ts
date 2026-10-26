// タブ（プチ改善／改善）や要求定義の日次増減を、スナップショット差分から算出する。
//
// 「残数」の定義は集計対象ごとに STATS_TARGETS で持つ（施策一覧の各ビューと同じ母数）。
//   - petit       : is_petit_improvement = true かつ status != 完了
//   - improvement : 置き場所が改善（track=improvement でプチ改善/ABテストのフラグなし）かつ status != 完了
//   - requirement : status が要求定義以前（未着手/調査/要求定義）＝要求定義が未完了。
//                   置き場所で絞った集計（scope = all / investment / improvement / petit）を同じ表に持つ
//
// 前日→当日でこの母数から抜けた施策を「減少」とし、内訳を判定する:
//   - published : 置き場所は変わらず status が「完了」になった（＝消化完了・公開ずみ）
//                 requirement では「要求定義より後ろのステータスへ進んだ」＝要求定義完了
//   - movedOut  : 置き場所が変わった（別タブへ移動）
//                 requirement では「選択肢に無いステータスになった」（通常は起きない）
//   - deleted   : レコードごと削除された
// 母数に新しく入った施策を「増加」とし、new（新規作成）/ inflow（既存からの流入）を区別する。

import {
  AB_TEST_STATUS,
  DEFAULT_TRACK,
  placementOf,
  STATUS_OPTIONS,
  type Placement,
} from "@/lib/constants";

export type DecreaseReason = "published" | "movedOut" | "deleted";
export type IncreaseKind = "new" | "inflow";

export type IncreaseItem = {
  id: string;
  title: string;
  kind: IncreaseKind;
};

export type DecreaseItem = {
  id: string;
  title: string;
  reason: DecreaseReason;
};

export type StatusFlow = { increase: number; decrease: number };

export type DayStat = {
  date: string; // YYYY-MM-DD（同日に複数あれば最終スナップショット）
  total: number; // その日終わりの残数
  // 残数のステータス別内訳（例: {"未着手": 5, "要求定義": 3, ...}）。合計は total に一致する。
  // どのステータスを表に出すかはビュー側で選ぶ（HIGHLIGHT_STATUSES）。
  statusCounts: Record<string, number>;
  // ステータス別の増減（前日比）。「未着手が何件増えて何件減ったか」を出すために持つ。
  //   increase: その日 status=X として残数に入った件数（新規流入 + 他ステータスから X になった）
  //   decrease: その日 status=X から抜けた件数（残数から出た + X から他ステータスへ進んだ）
  // 残数全体の increase/decrease と違い、ステータス間の移動も両側に数える。基準日は空。
  statusFlows: Record<string, StatusFlow>;
  isBaseline: boolean; // 最初のスナップショット。前日がないため増減は算出不可
  increase: number;
  decrease: number;
  breakdown: {
    published: number;
    movedOut: number;
    deleted: number;
  };
  increasedItems: IncreaseItem[];
  decreasedItems: DecreaseItem[];
};

// スナップショット行（DBの snapshots テーブル）。data は全施策の配列。
export type RawSnapshot = {
  snapshot_date: string;
  created_at: string;
  data: unknown;
};

type SnapProject = {
  id: string;
  title?: string;
  status?: string;
  track?: string;
  is_petit_improvement?: boolean;
  is_ab_test?: boolean;
};

// ---- 集計対象（タブ）の定義 ----
// 新しいタブの推移を取りたいときは、ここに1件足して同じ形の集計テーブルを用意する。

export type StatsTargetKey = "petit" | "improvement" | "requirement";

export type StatsTarget = {
  key: StatsTargetKey;
  // 作り置き集計テーブル名（1日1行・列構成は petit_daily_stats と同じ）
  table: "petit_daily_stats" | "improvement_daily_stats" | "requirement_daily_stats";
  // 同じ表に複数の母数を持つときの区分（requirement_daily_stats.scope）。無ければ表は stat_date だけが主キー
  scope?: string;
  // 残数（母集団）に入る施策か
  isInPopulation: (p: SnapProject) => boolean;
  // 母集団から抜けたが削除はされていない施策について、置き場所が変わって出て行ったか。
  // false なら置き場所はそのままで status=完了 になった（published）とみなす。
  isMovedOut: (p: SnapProject) => boolean;
};

// スナップショットの施策から置き場所を求める。
// track 列が無い古いスナップショット（2026-09-07 より前）は既定の improvement 扱いにする
// （DB 側の default と同じ。当時はプチ改善/ABテスト以外がすべて改善タブ相当だった）。
function placementOfSnap(p: SnapProject): Placement {
  return placementOf({
    track: p.track ?? DEFAULT_TRACK,
    is_petit_improvement: p.is_petit_improvement === true,
    is_ab_test: p.is_ab_test === true,
  });
}

// 残数のうち「まだ手が付いていない」ことを示すステータス。サマリー・表・グラフで内訳として出す。
export const HIGHLIGHT_STATUSES = ["未着手", "要求定義"] as const;

// ステータスの並び（STATUS_OPTIONS）での「要求定義」の位置。
// 要求定義以前（未着手/調査/要求定義）＝要求定義が未完了、後ろ（要件定義以降・ABテスト中・完了）＝要求定義完了。
// STATUS_OPTIONS に無い値（将来の追加漏れなど）はどちらにも入れない（安全側）。
const REQUIREMENT_INDEX = STATUS_OPTIONS.indexOf("要求定義");
const statusIndex = (status: string | undefined) =>
  (STATUS_OPTIONS as readonly string[]).indexOf(status ?? "");

export function isRequirementPending(status: string | undefined): boolean {
  const i = statusIndex(status);
  return i >= 0 && i <= REQUIREMENT_INDEX;
}

export function isPastRequirement(status: string | undefined): boolean {
  if (status === AB_TEST_STATUS) return true;
  return statusIndex(status) > REQUIREMENT_INDEX;
}

// 要求定義の集計を置き場所で絞るときの区分。all は置き場所を問わない（ABテストも含む）。
export type RequirementScope = "all" | "investment" | "improvement" | "petit";

export const REQUIREMENT_SCOPES: { value: RequirementScope; label: string; description: string }[] = [
  { value: "all", label: "全体", description: "置き場所を問わず" },
  { value: "investment", label: "投資", description: "投資タブの" },
  { value: "improvement", label: "改善", description: "改善タブの" },
  { value: "petit", label: "プチ改善", description: "プチ改善タブの" },
];

function requirementTarget(scope: RequirementScope): StatsTarget {
  return {
    key: "requirement",
    table: "requirement_daily_stats",
    scope,
    // 要求定義がまだ終わっていない施策（未着手/調査も「要求定義未完了」として母数に入れる）。
    // scope が置き場所のときは、その置き場所にある施策だけ
    isInPopulation: (p) =>
      isRequirementPending(p.status) && (scope === "all" || placementOfSnap(p) === scope),
    // 要求定義より後ろへ進んだ＝published（要求定義完了）。それ以外で母数から抜けた＝movedOut
    // （選択肢外のステータス、または scope の置き場所から別タブへ移った）
    isMovedOut: (p) => !isPastRequirement(p.status),
  };
}

export const REQUIREMENT_TARGETS: Record<RequirementScope, StatsTarget> = {
  all: requirementTarget("all"),
  investment: requirementTarget("investment"),
  improvement: requirementTarget("improvement"),
  petit: requirementTarget("petit"),
};

export const STATS_TARGETS: Record<StatsTargetKey, StatsTarget> = {
  petit: {
    key: "petit",
    table: "petit_daily_stats",
    isInPopulation: (p) => p.is_petit_improvement === true && p.status !== "完了",
    isMovedOut: (p) => p.is_petit_improvement !== true,
  },
  improvement: {
    key: "improvement",
    table: "improvement_daily_stats",
    isInPopulation: (p) =>
      placementOfSnap(p) === "improvement" && p.status !== "完了",
    isMovedOut: (p) => placementOfSnap(p) !== "improvement",
  },
  requirement: REQUIREMENT_TARGETS.all,
};

// cron とバックフィルが更新する集計の全件（ビュー用の STATS_TARGETS と違い、scope 違いも含む）
export const ALL_STATS_TARGETS: StatsTarget[] = [
  STATS_TARGETS.petit,
  STATS_TARGETS.improvement,
  ...Object.values(REQUIREMENT_TARGETS),
];

// upsert の衝突キー。scope を持つ表は (scope, stat_date) が主キー
export function conflictKeyOf(target: StatsTarget): string {
  return target.scope ? "scope,stat_date" : "stat_date";
}

// snapshot.data（施策配列）を id -> project の Map に整形する。
function toProjectMap(data: unknown): Map<string, SnapProject> {
  const map = new Map<string, SnapProject>();
  if (!Array.isArray(data)) return map;
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as SnapProject;
    if (typeof p.id !== "string") continue;
    map.set(p.id, p);
  }
  return map;
}

// スナップショットを日付順に1件ずつ受け取り、日次行を積み上げる逐次版。
// バックフィルで全スナップショットを一度にメモリへ載せないために使う。
//   - push は snapshot_date の昇順で呼ぶこと（同じ日付の中の順序は問わない。created_at が最新のものを採用）
//   - drain で確定済みの行を取り出す（取り出した行は捨てる）。finish で最後の日を確定する
export type DailyStatsAccumulator = {
  push: (s: RawSnapshot) => void;
  finish: () => void;
  drain: () => DayStat[];
};

export function createDailyStatsAccumulator(target: StatsTarget): DailyStatsAccumulator {
  const rows: DayStat[] = [];
  let prevAll: Map<string, SnapProject> | null = null;
  let prevPop: Set<string> | null = null;
  let pending: RawSnapshot | null = null; // まだ確定していない日の最終スナップショット

  const finalizeDay = (day: RawSnapshot) => {
    const all = toProjectMap(day.data);
    const pop = new Set<string>();
    const statusCounts: Record<string, number> = {};
    for (const [id, p] of all) {
      if (!target.isInPopulation(p)) continue;
      pop.add(id);
      const st = p.status ?? "(不明)";
      statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    }

    if (!prevAll || !prevPop) {
      rows.push({
        date: day.snapshot_date,
        total: pop.size,
        statusCounts,
        statusFlows: {},
        isBaseline: true,
        increase: 0,
        decrease: 0,
        breakdown: { published: 0, movedOut: 0, deleted: 0 },
        increasedItems: [],
        decreasedItems: [],
      });
    } else {
      const increasedItems: IncreaseItem[] = [];
      for (const id of pop) {
        if (prevPop.has(id)) continue;
        const p = all.get(id)!;
        increasedItems.push({
          id,
          title: p.title ?? "(無題)",
          kind: prevAll.has(id) ? "inflow" : "new",
        });
      }

      const decreasedItems: DecreaseItem[] = [];
      const breakdown = { published: 0, movedOut: 0, deleted: 0 };
      for (const id of prevPop) {
        if (pop.has(id)) continue;
        const c = all.get(id);
        let reason: DecreaseReason;
        if (!c) reason = "deleted";
        else if (target.isMovedOut(c)) reason = "movedOut";
        else reason = "published"; // 置き場所はそのままで status=完了 になった
        breakdown[reason] += 1;
        decreasedItems.push({
          id,
          title: c?.title ?? prevAll.get(id)?.title ?? "(無題)",
          reason,
        });
      }

      // ステータス別の増減。前日・当日それぞれの「残数内でのステータス」を比べ、
      // 変わっていれば前日側を decrease、当日側を increase に数える（残数外は null 扱い）。
      const statusFlows: Record<string, StatusFlow> = {};
      const flowOf = (st: string) =>
        (statusFlows[st] ??= { increase: 0, decrease: 0 });
      for (const id of new Set([...prevPop, ...pop])) {
        const prevSt = prevPop.has(id) ? (prevAll.get(id)?.status ?? "(不明)") : null;
        const curSt = pop.has(id) ? (all.get(id)?.status ?? "(不明)") : null;
        if (prevSt === curSt) continue;
        if (prevSt !== null) flowOf(prevSt).decrease += 1;
        if (curSt !== null) flowOf(curSt).increase += 1;
      }

      rows.push({
        date: day.snapshot_date,
        total: pop.size,
        statusCounts,
        statusFlows,
        isBaseline: false,
        increase: increasedItems.length,
        decrease: decreasedItems.length,
        breakdown,
        increasedItems,
        decreasedItems,
      });
    }

    prevAll = all;
    prevPop = pop;
  
  };

  return {
    push(s) {
      if (!s.snapshot_date) return;
      if (pending && s.snapshot_date !== pending.snapshot_date) {
        if (s.snapshot_date < pending.snapshot_date) {
          throw new Error("snapshots must be pushed in snapshot_date ascending order");
        }
        finalizeDay(pending);
        pending = null;
      }
      if (!pending || s.created_at > pending.created_at) pending = s;
    },
    finish() {
      if (pending) finalizeDay(pending);
      pending = null;
    },
    drain() {
      return rows.splice(0, rows.length);
    },
  };
}

export function computeDailyStats(
  snapshots: RawSnapshot[],
  target: StatsTarget
): DayStat[] {
  const acc = createDailyStatsAccumulator(target);
  for (const s of [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))) {
    acc.push(s);
  }
  acc.finish();
  return acc.drain();
}

// ---- 作り置き集計テーブル（*_daily_stats）との変換 ----
// snapshots を毎回丸ごと差分すると転送量が日数×全施策で膨らむため、
// 集計結果を1日1行の軽量テーブルに保存し、ビューはそれだけを読む。

export type DailyStatRow = {
  scope?: string; // scope を持つ表（requirement_daily_stats）だけ
  stat_date: string;
  total: number;
  status_counts: Record<string, number>;
  status_flows: Record<string, StatusFlow>;
  is_baseline: boolean;
  increase: number;
  decrease: number;
  published: number;
  moved_out: number;
  deleted: number;
  increased_items: IncreaseItem[];
  decreased_items: DecreaseItem[];
};

// DayStat（計算結果） → DB行（snake_case）。target に scope があれば行にも付ける
export function dayStatToRow(s: DayStat, target?: StatsTarget): DailyStatRow {
  return {
    ...(target?.scope ? { scope: target.scope } : {}),
    stat_date: s.date,
    total: s.total,
    status_counts: s.statusCounts,
    status_flows: s.statusFlows,
    is_baseline: s.isBaseline,
    increase: s.increase,
    decrease: s.decrease,
    published: s.breakdown.published,
    moved_out: s.breakdown.movedOut,
    deleted: s.breakdown.deleted,
    increased_items: s.increasedItems,
    decreased_items: s.decreasedItems,
  };
}

// DB行 → DayStat（ビューが期待する形）
export function rowToDayStat(row: DailyStatRow): DayStat {
  return {
    date: row.stat_date,
    total: row.total,
    statusCounts: row.status_counts ?? {}, // 列追加前の行は空（バックフィルで埋まる）
    statusFlows: row.status_flows ?? {},
    isBaseline: row.is_baseline,
    increase: row.increase,
    decrease: row.decrease,
    breakdown: {
      published: row.published,
      movedOut: row.moved_out,
      deleted: row.deleted,
    },
    increasedItems: row.increased_items ?? [],
    decreasedItems: row.decreased_items ?? [],
  };
}
