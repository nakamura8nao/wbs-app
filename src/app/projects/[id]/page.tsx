import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/header";
import { ProjectDetail } from "@/components/project-detail";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select(`
      *,
      director:members!projects_director_id_fkey(id, display_name, role),
      engineer:members!projects_engineer_id_fkey(id, display_name, role),
      designer:members!projects_designer_id_fkey(id, display_name, role)
    `)
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("display_name");

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1600px] px-5 py-4 pb-8">
        <ProjectDetail
          project={project}
          members={members ?? []}
        />
      </main>
    </div>
  );
}
