import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { WorkloadView } from "@/components/workload-view";
import type {
  WorkloadPhaseInput,
  WorkloadProjectInput,
} from "@/lib/workload";

export default async function WorkloadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 集計はクライアント側（期間・メンバーの切り替えが即時に効くように）。
  // 転送量を抑えるため、必要な列と「日付が入っているフェーズ」だけを取る。
  const [projectsRes, phasesRes, membersRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, track, is_petit_improvement, is_ab_test, status"),
    supabase
      .from("phases")
      .select("project_id, assignee_id, start_date, end_date, name, status")
      .or("start_date.not.is.null,end_date.not.is.null"),
    supabase.from("members").select("*").order("display_name"),
  ]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4 pb-8">
        <WorkloadView
          members={membersRes.data ?? []}
          projects={(projectsRes.data ?? []) as WorkloadProjectInput[]}
          phases={(phasesRes.data ?? []) as WorkloadPhaseInput[]}
        />
      </main>
    </div>
  );
}
