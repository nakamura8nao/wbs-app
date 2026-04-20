import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectList } from "@/components/project-list";
import { Header } from "@/components/header";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      *,
      director:members!projects_director_id_fkey(id, display_name, role),
      engineer:members!projects_engineer_id_fkey(id, display_name, role),
      designer:members!projects_designer_id_fkey(id, display_name, role)
    `)
    .order("priority", { ascending: true });

  const { data: phaseAssignees } = await supabase
    .from("phases")
    .select("project_id, assignee_id")
    .not("assignee_id", "is", null);

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("display_name");

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1600px] px-5 py-4 pb-8">
        <ProjectList
          initialProjects={projects ?? []}
          initialPhaseAssignees={(phaseAssignees ?? []) as { project_id: string; assignee_id: string }[]}
          members={members ?? []}
        />
      </main>
    </div>
  );
}
