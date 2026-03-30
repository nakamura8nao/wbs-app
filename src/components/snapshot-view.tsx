"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProgressIcon } from "@/components/progress-icon";
import { GroupLv2Icon } from "@/components/group-icon";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type SnapshotData = {
  id: string;
  snapshot_date: string;
  label: string | null;
  data: any[];
  created_at: string;
};

const statusStyle = (status: string) => {
  switch (status) {
    case "完了": return "bg-emerald-50 text-emerald-600";
    case "公開待ち": return "bg-blue-50 text-blue-600";
    case "テスト": return "bg-amber-50 text-amber-600";
    case "システム": return "bg-violet-50 text-violet-600";
    case "要件定義": return "bg-cyan-50 text-cyan-600";
    case "要求定義": return "bg-pink-50 text-pink-600";
    case "調査": return "bg-orange-50 text-orange-600";
    default: return "bg-white/10 text-black/60";
  }
};

export function SnapshotView({ snapshot }: { snapshot: SnapshotData }) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const projects = snapshot.data ?? [];

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const theadClasses = "border-b border-black/5 text-left text-[11px] font-medium text-black/60";

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/snapshots")}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white/70 cursor-pointer"
        >
          <ArrowLeft size={13} />
          戻る
        </button>
        <h2 className="text-sm font-medium text-white">
          {snapshot.label ?? snapshot.snapshot_date}
        </h2>
        <span className="text-xs text-white/40">{snapshot.snapshot_date}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">
          閲覧専用
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className={theadClasses}>
              <th className="w-10 px-2 py-2 text-center">#</th>
              <th className="w-24 px-2 py-2">事業</th>
              <th className="px-2 py-2">タイトル</th>
              <th className="w-28 px-2 py-2">公開目安</th>
              <th className="w-20 px-2 py-2">Dir</th>
              <th className="w-20 px-2 py-2">Des</th>
              <th className="w-20 px-2 py-2">Eng</th>
              <th className="w-20 px-2 py-2">状態</th>
              <th className="w-8 px-1 py-2"></th>
              <th className="w-[300px] px-2 py-2">備考</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-xs text-black/40">
                  データがありません
                </td>
              </tr>
            ) : (
              projects.map((project: any) => (
                <>
                  <tr
                    key={project.id}
                    className="border-b border-black/5 transition-colors hover:bg-blue-50/70 cursor-pointer"
                    onClick={() => toggleExpand(project.id)}
                  >
                    <td className="w-10 px-2 py-2 text-center font-mono text-xs text-black/60">
                      {project.priority_undecided ? "-" : project.priority}
                    </td>
                    <td className="w-24 px-2 py-2 text-xs text-black/60">
                      <span className="flex items-center gap-1">
                        {project.group_lv2 && <GroupLv2Icon value={project.group_lv2} size={12} />}
                        {project.group_lv2 ?? project.group_lv1 ?? "-"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-foreground">
                      <span className="flex items-center gap-1">
                        {expandedIds.has(project.id)
                          ? <ChevronDown size={14} className="text-black/30" />
                          : <ChevronRight size={14} className="text-black/30" />}
                        {project.title}
                      </span>
                    </td>
                    <td className="w-28 px-2 py-2 text-sm text-foreground">
                      {project.target_date ? (
                        project.target_date_tentative
                          ? <span className="text-xs text-black/40">{project.target_date} 仮</span>
                          : project.target_date
                      ) : "-"}
                    </td>
                    <td className="w-20 px-2 py-2 text-sm text-foreground">
                      {project.director?.display_name ?? "-"}
                    </td>
                    <td className="w-20 px-2 py-2 text-sm text-foreground">
                      {project.designer?.display_name ?? "-"}
                    </td>
                    <td className="w-20 px-2 py-2 text-sm text-foreground">
                      {project.engineer?.display_name ?? "-"}
                    </td>
                    <td className="w-20 px-2 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusStyle(project.status))}>
                        {project.status}
                      </span>
                    </td>
                    <td className="w-8 px-1 py-2 text-center text-sm">
                      <ProgressIcon value={project.progress} />
                    </td>
                    <td className="px-2 py-2 text-[11px] text-foreground whitespace-pre-wrap break-words w-[300px] max-w-[300px]">
                      {project.notes ?? ""}
                    </td>
                  </tr>
                  {/* フェーズ展開 */}
                  {expandedIds.has(project.id) && project.phases?.length > 0 && (
                    <tr key={`${project.id}-phases`}>
                      <td colSpan={10} className="p-0">
                        <div className="border-t border-black/5 bg-[#f8f8fc] px-4 py-2">
                          <div className="space-y-0.5">
                            {project.phases.map((phase: any) => (
                              <div
                                key={phase.id}
                                className="grid items-center rounded-md px-2 py-1.5"
                                style={{ gridTemplateColumns: "20px 1fr 80px 180px 160px" }}
                              >
                                <ProgressIcon
                                  value={phase.status === "完了" ? "done" : phase.status === "進行中" ? "active" : "paused"}
                                  size={14}
                                />
                                <span className="min-w-0 truncate text-sm text-black/80">
                                  {phase.name}
                                </span>
                                <span className="text-xs text-black/60 truncate">
                                  {phase.assignee?.display_name ?? ""}
                                </span>
                                <span className="text-xs text-black/60">
                                  {phase.start_date && phase.end_date
                                    ? `${phase.start_date} 〜 ${phase.end_date}`
                                    : ""}
                                </span>
                                <span className="text-xs text-black/60">
                                  {(phase.traditional_hours || phase.ai_target_hours || phase.actual_hours)
                                    ? `${phase.traditional_hours ?? "-"}h → ${phase.ai_target_hours ?? "-"}h → ${phase.actual_hours ?? "-"}h`
                                    : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
