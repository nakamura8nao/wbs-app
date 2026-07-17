// プチ改善タスクの日次増減を、スナップショット差分から算出する。
//
// 「残数（未消化プチ改善）」の定義:
//   is_petit_improvement === true かつ status !== "完了"
//   （project-list.tsx の petitProjects と同じ母数。これをゼロに近づけるのが取り組みの目的）
//
// 前日→当日でこの母数から抜けた施策を「減少」とし、内訳を判定する:
//   - published : プチ改善フラグは残ったまま status が「完了」になった（＝消化完了・公開ずみ）
//   - movedOut  : プチ改善フラグを外した（通常開発などプチ改善外へ移動）
//   - deleted   : レコードごと削除された
// 母数に新しく入った施策を「増加」とし、new（新規作成）/ inflow（既存からの流入）を区別する。

export type PetitDecreaseReason = "published" | "movedOut" | "deleted";
export type PetitIncreaseKind = "new" | "inflow";

export type PetitIncreaseItem = {
  id: string;
  title: string;
  kind: PetitIncreaseKind;
};

export type PetitDecreaseItem = {
  id: string;
  title: string;
  reason: PetitDecreaseReason;
};

export type PetitDayStat = {
  date: string; // YYYY-MM-DD（同日に複数あれば最終スナップショット）
  total: number; // その日終わりの残数
  isBaseline: boolean; // 最初のスナップショット。前日がないため増減は算出不可
  increase: number;
  decrease: number;
  breakdown: {
    published: number;
    movedOut: number;
    deleted: number;
  };
  increasedItems: PetitIncreaseItem[];
  decreasedItems: PetitDecreaseItem[];
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
  is_petit_improvement?: boolean;
};

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

// 未消化プチ改善（残数）に該当するか
function isBacklog(p: SnapProject): boolean {
  return p.is_petit_improvement === true && p.status !== "完了";
}

export function computePetitStats(snapshots: RawSnapshot[]): PetitDayStat[] {
  // 1日1件に集約（同日は created_at が最新のものを採用）
  const byDate = new Map<string, RawSnapshot>();
  for (const s of snapshots) {
    if (!s.snapshot_date) continue;
    const cur = byDate.get(s.snapshot_date);
    if (!cur || s.created_at > cur.created_at) byDate.set(s.snapshot_date, s);
  }
  const days = [...byDate.values()].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date)
  );

  const rows: PetitDayStat[] = [];
  let prevAll: Map<string, SnapProject> | null = null;
  let prevPop: Set<string> | null = null;

  for (const day of days) {
    const all = toProjectMap(day.data);
    const pop = new Set<string>();
    for (const [id, p] of all) {
      if (isBacklog(p)) pop.add(id);
    }

    if (!prevAll || !prevPop) {
      rows.push({
        date: day.snapshot_date,
        total: pop.size,
        isBaseline: true,
        increase: 0,
        decrease: 0,
        breakdown: { published: 0, movedOut: 0, deleted: 0 },
        increasedItems: [],
        decreasedItems: [],
      });
    } else {
      const increasedItems: PetitIncreaseItem[] = [];
      for (const id of pop) {
        if (prevPop.has(id)) continue;
        const p = all.get(id)!;
        increasedItems.push({
          id,
          title: p.title ?? "(無題)",
          kind: prevAll.has(id) ? "inflow" : "new",
        });
      }

      const decreasedItems: PetitDecreaseItem[] = [];
      const breakdown = { published: 0, movedOut: 0, deleted: 0 };
      for (const id of prevPop) {
        if (pop.has(id)) continue;
        const c = all.get(id);
        let reason: PetitDecreaseReason;
        if (!c) reason = "deleted";
        else if (c.is_petit_improvement !== true) reason = "movedOut";
        else reason = "published"; // まだプチ改善フラグは立っているが status=完了 になった
        breakdown[reason] += 1;
        decreasedItems.push({
          id,
          title: c?.title ?? prevAll.get(id)?.title ?? "(無題)",
          reason,
        });
      }

      rows.push({
        date: day.snapshot_date,
        total: pop.size,
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
  }

  return rows;
}

// ---- 作り置き集計テーブル（petit_daily_stats）との変換 ----
// snapshots を毎回丸ごと差分すると転送量が日数×全施策で膨らむため、
// 集計結果を1日1行の軽量テーブルに保存し、ビューはそれだけを読む。

export type PetitDailyStatRow = {
  stat_date: string;
  total: number;
  is_baseline: boolean;
  increase: number;
  decrease: number;
  published: number;
  moved_out: number;
  deleted: number;
  increased_items: PetitIncreaseItem[];
  decreased_items: PetitDecreaseItem[];
};

// PetitDayStat（計算結果） → DB行（snake_case）
export function petitDayStatToRow(s: PetitDayStat): PetitDailyStatRow {
  return {
    stat_date: s.date,
    total: s.total,
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

// DB行 → PetitDayStat（ビューが期待する形）
export function rowToPetitDayStat(row: PetitDailyStatRow): PetitDayStat {
  return {
    date: row.stat_date,
    total: row.total,
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
