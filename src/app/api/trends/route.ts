import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { daysBefore, isYmd, TABLE_PAGE_DAYS, type TrendsPageResponse } from "@/lib/trends";
import { fetchTrendRowsFull } from "@/lib/trends-query";

// 推移ページの表の「もっと見る」。before（YYYY-MM-DD）より前の days 日ぶんを、施策名込みで全スコープ返す。
// ログインユーザーの cookie で認証（RLS は select のみ許可）。未ログインは 401。
//
//   GET /api/trends?before=2026-09-27&days=30  → 2026-08-28 以上 2026-09-27 未満
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const before = url.searchParams.get("before") ?? "";
  const daysRaw = Number(url.searchParams.get("days") ?? TABLE_PAGE_DAYS);
  if (!isYmd(before)) {
    return NextResponse.json({ error: "before は YYYY-MM-DD で指定" }, { status: 400 });
  }
  const days = Number.isInteger(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : TABLE_PAGE_DAYS;
  const from = daysBefore(before, days);

  const rows = await fetchTrendRowsFull(supabase, { from, before });
  const body: TrendsPageResponse = { rows, from, before };
  return NextResponse.json(body);
}
