import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { TokensClient } from "./tokens-client";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tokens } = await supabase
    .from("api_tokens")
    .select("id, name, last_used_at, revoked_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[800px] px-5 py-6">
        <TokensClient initialTokens={tokens ?? []} />
      </main>
    </div>
  );
}
