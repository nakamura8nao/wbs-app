import {
  Cloud,
  Users,
  Globe,
  Wrench,
  Building2,
  Building,
  Megaphone,
  MessageCircle,
  CalendarCheck,
  Mail,
  ClipboardList,
  Home,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { GROUP_LV2_OPTIONS, GROUP_LV3_OPTIONS } from "@/lib/constants";

const iconMap: Record<string, LucideIcon> = {
  Cloud,
  Users,
  Globe,
  Wrench,
  Building2,
  Building,
  Megaphone,
  MessageCircle,
  CalendarCheck,
  Mail,
  ClipboardList,
  Home,
  Search,
  Settings,
};

export function GroupLv2Icon({
  value,
  size = 14,
}: {
  value: string;
  size?: number;
}) {
  const group = GROUP_LV2_OPTIONS.find((g) => g.value === value);
  if (!group) return null;
  const Icon = iconMap[group.icon];
  if (!Icon) return null;
  return <Icon size={size} className={group.color} />;
}

export function GroupLv3Icon({
  value,
  size = 13,
}: {
  value: string;
  size?: number;
}) {
  const group = GROUP_LV3_OPTIONS.find((g) => g.value === value);
  if (!group) return null;
  const Icon = iconMap[group.icon];
  if (!Icon) return null;

  // 親のLv2からカラーを取得
  const parentLv2 = GROUP_LV2_OPTIONS.find((g) => g.value === group.parent);
  const color = parentLv2?.color ?? "text-black/40";

  return <Icon size={size} className={color} />;
}
