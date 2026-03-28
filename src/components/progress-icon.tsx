import { Pause, Play, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const config = {
  paused: {
    icon: Pause,
    className: "text-black/30",
    title: "一時停止",
  },
  active: {
    icon: Play,
    className: "text-blue-500",
    title: "進行中",
  },
  done: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    title: "完了",
  },
} as const;

export function ProgressIcon({
  value,
  size = 15,
}: {
  value: string;
  size?: number;
}) {
  const c = config[value as keyof typeof config];
  if (!c) return <span>{value}</span>;

  const Icon = c.icon;
  return (
    <span title={c.title}>
      <Icon size={size} className={cn(c.className)} />
    </span>
  );
}
