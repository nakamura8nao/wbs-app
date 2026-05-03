import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // auth callback / 静的ファイル / Bearer 認証API (/api/wbs) を除外
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|api/wbs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
