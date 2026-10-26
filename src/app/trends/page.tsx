import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { daysBefore, TABLE_PAGE_DAYS } from "@/lib/trends";
import { fetchTrendRowsFull, fetchTrendRowsLight } from "@/lib/trends-query";
import { TrendsView } from "@/components/trends-view";

export default async function TrendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // グラフ・サマリーは数字だけの行を全期間読む（軽い）。
  // 表は施策名の JSON 込みなので直近 TABLE_PAGE_DAYS 日だけ読み、残りは「もっと見る」で /api/trends から足す。
  const rowsByScope = await fetchTrendRowsLight(supabase);
  const latest = rowsByScope.all[rowsByScope.all.length - 1]?.date;
  const tableFrom = latest ? daysBefore(latest, TABLE_PAGE_DAYS - 1) : null;
  const tableRowsByScope = tableFrom
    ? await fetchTrendRowsFull(supabase, { from: tableFrom })
    : rowsByScope;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4">
        <TrendsView
          rowsByScope={rowsByScope}
          initialTableRowsByScope={tableRowsByScope}
          initialTableFrom={tableFrom}
        />
      </main>
    </div>
  );
}
