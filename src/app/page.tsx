import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">WBS管理</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
      </header>
      <main className="p-6">
        <p className="text-zinc-500">施策一覧がここに表示されます</p>
      </main>
    </div>
  );
}
