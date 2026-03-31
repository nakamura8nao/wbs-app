"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "施策一覧" },
  { href: "/members", label: "メンバー" },
  { href: "/snapshots", label: "スナップショット" },
];

export function Header({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f1923]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-6">
          <h1 className="text-base font-bold tracking-tight text-white">WBS</h1>
          <nav aria-label="メインナビゲーション" className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                  pathname === item.href
                    ? "bg-primary-500/20 text-primary-300 shadow-sm shadow-primary-500/10"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                )}
                {...(pathname === item.href ? { "aria-current": "page" as const } : {})}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {children && (
          <div className="flex items-center gap-3">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
