import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = "kufusumai.co.jp";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // ドメインチェック
    const email = data.session?.user?.email;
    if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      await supabase.auth.signOut();
      const url = new URL("/login", origin);
      url.searchParams.set("error", "unauthorized_domain");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(origin);
}
