import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/header";
import { SnapshotView } from "@/components/snapshot-view";

export default async function SnapshotDetailPage({
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

  const { data: snapshot } = await supabase
    .from("snapshots")
    .select("*")
    .eq("id", id)
    .single();

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4 pb-24">
        <SnapshotView snapshot={snapshot} />
      </main>
    </div>
  );
}
