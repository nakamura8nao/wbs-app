// 週（月曜始まり）の計算。推移系グラフを週次に束ねるときに使う。日付は YYYY-MM-DD の文字列で扱う。

// その日を含む週の月曜日
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // 月=0 … 日=6
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 日付順の行を週ごとに束ねる。行が無い週も空配列で埋めて並べる（横軸を等間隔にするため）。
// 最後の週は集計途中なので partial。
export type WeekGroup<T> = { weekStart: string; rows: T[]; partial: boolean };

export function groupByWeek<T extends { date: string }>(rows: T[]): WeekGroup<T>[] {
  if (rows.length === 0) return [];
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = weekStartOf(r.date);
    (map.get(key) ?? map.set(key, []).get(key)!).push(r);
  }
  const first = weekStartOf(rows[0].date);
  const last = weekStartOf(rows[rows.length - 1].date);
  const out: WeekGroup<T>[] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) {
    out.push({ weekStart: w, rows: map.get(w) ?? [], partial: w === last });
  }
  return out;
}

// 週の見出し（MM/DD）
export const weekLabel = (weekStart: string) => weekStart.slice(5).replace("-", "/");
