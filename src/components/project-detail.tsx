"use client";

import { lazy, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";
import { PhasePanel } from "@/components/phase-panel";
const GanttChart = lazy(() => import("@/components/gantt-chart").then((m) => ({ default: m.GanttChart })));
import { SIZE_OPTIONS } from "@/lib/constants";
import type { Project, Member } from "@/lib/types/models";
import { cn } from "@/lib/utils";

const sizeLabel = (value: string | null) => {
  if (!value) return "-";
  return SIZE_OPTIONS.find((s) => s.value === value)?.label ?? value;
};

const statusConfig = (status: string) => {
  switch (status) {
    case "完了":
      return { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
    case "公開待ち":
      return { badge: "bg-primary-50 text-primary-700", dot: "bg-primary-500" };
    case "テスト":
      return { badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500" };
    case "システム":
      return { badge: "bg-violet-50 text-violet-700", dot: "bg-violet-500" };
    case "要件定義":
      return { badge: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500" };
    case "要求定義":
      return { badge: "bg-pink-50 text-pink-700", dot: "bg-pink-500" };
    case "調査":
      return { badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" };
    default:
      return { badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400" };
  }
};

export function ProjectDetail({
  project,
  members,
}: {
  project: Project;
  members: Member[];
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* ヘッダー部分 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-bold text-white">{project.title}</h2>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", statusConfig(project.status).badge)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig(project.status).dot)} />
            {project.status}
          </span>
        </div>
        <button
          onClick={handleCopyUrl}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors cursor-pointer"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          {copied ? "コピーしました" : "URLをコピー"}
        </button>
      </div>

      {/* 施策情報 */}
      <div className="rounded-lg border border-black/8 bg-white px-6 py-5">
        <h3 className="text-xs font-semibold text-black/40 tracking-wide mb-4">施策情報</h3>
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-4">
          <InfoItem label="事業" value={[project.group_lv2, project.group_lv3].filter(Boolean).join(" / ") || project.group_lv1 || "-"} />
          <InfoItem label="目標日" value={
            project.target_date
              ? project.target_date_tentative ? `${project.target_date} (仮)` : project.target_date
              : "-"
          } />
          <InfoItem label="規模" value={sizeLabel(project.size)} />
          <InfoItem label="優先度" value={project.priority_undecided ? "未決定" : `${project.priority}`} />
          <InfoItem label="ディレクター" value={project.director?.display_name ?? "-"} />
          <InfoItem label="デザイナー" value={project.designer?.display_name ?? "-"} />
          <InfoItem label="エンジニア" value={project.engineer?.display_name ?? "-"} />
          {project.notes && (
            <div className="col-span-full pt-1 border-t border-black/5">
              <span className="text-xs text-black/40 block mb-1">備考</span>
              <span className="text-sm text-black/70 whitespace-pre-wrap leading-relaxed">{project.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* フェーズ一覧 */}
      <div className="rounded-lg border border-black/8 bg-white overflow-hidden">
        <PhasePanel
          projectId={project.id}
          members={members}
          directorId={project.director_id}
          designerId={project.designer_id}
          engineerId={project.engineer_id}
        />
      </div>

      {/* ガントチャート */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 tracking-wide mb-3">ガントチャート</h3>
        <Suspense fallback={<div className="py-8 text-center text-xs text-black/40">読み込み中...</div>}>
          <GanttChart
            projects={[project]}
            members={members}
          />
        </Suspense>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-black/40 block mb-1">{label}</span>
      <span className="text-[15px] text-black/80">{value}</span>
    </div>
  );
}
