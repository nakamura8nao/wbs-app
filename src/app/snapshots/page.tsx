import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { SnapshotList } from "@/components/snapshot-list";

export default async function SnapshotsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: snapshots } = await supabase
    .from("snapshots")
    .select("id, snapshot_date, label, created_at")
    .order("snapshot_date", { ascending: false });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4">
        <SnapshotList initialSnapshots={snapshots ?? []} />
      </main>
    </div>
  );
}
