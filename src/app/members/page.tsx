import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { MemberList } from "@/components/member-list";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("display_name");

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-5 py-4">
        <MemberList initialMembers={members ?? []} />
      </main>
    </div>
  );
}
