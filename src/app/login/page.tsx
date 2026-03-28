"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません");
    } else {
      router.push("/");
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-xs">
        <div className="mb-1 text-center text-2xl font-bold tracking-tight text-foreground">
          WBS
        </div>
        <p className="mb-8 text-center text-xs text-black/30">
          施策・スケジュール管理
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-black/50">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-9 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-foreground outline-none placeholder:text-black/25 focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-black/50">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-9 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-foreground outline-none placeholder:text-black/25 focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#5e5ce6] py-2 text-sm font-medium text-white transition-colors hover:bg-[#4e4cd6] disabled:opacity-50 cursor-pointer"
          >
            {loading ? "処理中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
