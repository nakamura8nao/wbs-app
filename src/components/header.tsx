"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "施策一覧" },
  { href: "/members", label: "メンバー" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center px-5 py-2">
        <div className="flex items-center gap-5">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">WBS</h1>
          <nav className="flex gap-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  pathname === item.href
                    ? "bg-black/5 text-foreground"
                    : "text-black/40 hover:text-black/70"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
