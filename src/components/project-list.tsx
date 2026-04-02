"use client";

import { useState, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectDialog } from "@/components/project-dialog";
import { ProgressIcon } from "@/components/progress-icon";
import { GroupLv2Icon, GroupLv3Icon } from "@/components/group-icon";
import { PhasePanel } from "@/components/phase-panel";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
const GanttChart = lazy(() => import("@/components/gantt-chart").then((m) => ({ default: m.GanttChart })));
import { GROUP_LV2_OPTIONS, GROUP_LV3_OPTIONS, SIZE_OPTIONS } from "@/lib/constants";
import type { Project, Member, ProjectFormData } from "@/lib/types/models";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type Props = {
  initialProjects: Project[];
  members: Member[];
};

type ViewMode = "priority" | "group" | "gantt" | "released";

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

// ドラッグ可能な行
const SortableRow = memo(function SortableRow({
  project,
  isExpanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onTogglePriority,
  members,
}: {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePriority?: () => void;
  members: Member[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-colors hover:bg-gray-50",
        isDragging && "relative z-10 bg-white shadow-md"
      )}
    >
      <td className="w-8 py-3 px-2 text-center">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          title="ドラッグして並び替え"
        >
          ⠿
        </span>
      </td>
      <td className="w-10 py-3 px-4 text-center font-mono text-xs text-slate-500">
        {project.priority_undecided ? "-" : project.priority}
      </td>
      <td className="w-36 py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
        <span className="flex items-center gap-1">
          {project.group_lv2 && <GroupLv2Icon value={project.group_lv2} size={20} />}
          {project.group_lv2 ?? project.group_lv1 ?? "-"}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-900 cursor-pointer" onClick={onToggle}>
        <span className="flex items-center gap-1 group/title">
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {project.title}
          <Link
            href={`/projects/${project.id}`}
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-[#4a9eff] transition-all ml-1"
            title="施策の個別ページを開く"
          >
            <ExternalLink size={13} />
          </Link>
        </span>
      </td>
      <td className="w-32 py-3 px-4 text-sm text-body whitespace-nowrap">
        {project.target_date ? (
          project.target_date_tentative
            ? <span className="text-xs text-slate-400">{project.target_date} 仮</span>
            : project.target_date
        ) : "-"}
      </td>
      <td className="w-20 py-3 px-4 text-sm text-body">
        {project.director?.display_name ?? "-"}
      </td>
      <td className="w-20 py-3 px-4 text-sm text-body">
        {project.designer?.display_name ?? "-"}
      </td>
      <td className="w-20 py-3 px-4 text-sm text-body">
        {project.engineer?.display_name ?? "-"}
      </td>
      <td className="w-24 py-3 px-4 whitespace-nowrap">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", statusConfig(project.status).badge)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig(project.status).dot)} />
          {project.status}
        </span>
      </td>
      <td className="w-20 py-3 px-4 text-xs text-body whitespace-nowrap">
        {sizeLabel(project.size)}
      </td>
      <td className="w-8 py-3 px-2 text-center text-sm">
        <ProgressIcon value={project.progress} />
      </td>
      <td className="py-3 px-4 text-xs text-body whitespace-pre-wrap break-words w-[300px] max-w-[300px]">
        {project.notes ?? ""}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 [tr:hover_&]:opacity-100">
          <button onClick={onEdit} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-gray-50 hover:text-slate-700 transition-colors">編集</button>
          <button onClick={onDuplicate} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-gray-50 hover:text-slate-700 transition-colors">複製</button>
          {onTogglePriority && (
            <button onClick={onTogglePriority} className="rounded-lg px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors">
              {project.priority_undecided ? "↑ 決定" : "↓ 未決定"}
            </button>
          )}
          <button onClick={onDelete} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">削除</button>
        </div>
      </td>
    </tr>
    {isExpanded && (
      <tr>
        <td colSpan={13} className="p-0">
          <PhasePanel projectId={project.id} members={members} directorId={project.director_id} designerId={project.designer_id} engineerId={project.engineer_id} />
        </td>
      </tr>
    )}
    </>
  );
});

// 通常の行（事業別ビュー用、D&Dなし）
const ProjectRow = memo(function ProjectRow({
  project,
  isExpanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  hidePriority,
  members,
}: {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  hidePriority?: boolean;
  members: Member[];
}) {
  return (
    <>
    <tr className="transition-colors hover:bg-gray-50">
      {!hidePriority && (
        <td className="w-10 py-3 px-4 text-center font-mono text-xs text-slate-500">
          {project.priority_undecided ? "-" : project.priority}
        </td>
      )}
      <td className="py-3 px-4 text-sm text-slate-900 cursor-pointer" onClick={onToggle}>
        <span className="flex items-center gap-1 group/title">
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {project.title}
          <Link
            href={`/projects/${project.id}`}
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-[#4a9eff] transition-all ml-1"
            title="施策の個別ページを開く"
          >
            <ExternalLink size={13} />
          </Link>
        </span>
      </td>
      <td className="w-32 py-3 px-4 text-sm text-body whitespace-nowrap">
        {project.target_date ? (
          project.target_date_tentative
            ? <span className="text-xs text-slate-400">{project.target_date} 仮</span>
            : project.target_date
        ) : "-"}
      </td>
      <td className="w-20 py-3 px-4 text-sm text-body">
        {project.director?.display_name ?? "-"}
      </td>
      <td className="w-20 py-3 px-4 text-sm text-body">
        {project.designer?.display_name ?? "-"}
      </td>
      <td className="w-20 py-3 px-4 text-sm text-body">
        {project.engineer?.display_name ?? "-"}
      </td>
      <td className="w-24 py-3 px-4 whitespace-nowrap">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", statusConfig(project.status).badge)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig(project.status).dot)} />
          {project.status}
        </span>
      </td>
      <td className="w-20 py-3 px-4 text-xs text-body whitespace-nowrap">
        {sizeLabel(project.size)}
      </td>
      <td className="w-8 py-3 px-2 text-center text-sm">
        <ProgressIcon value={project.progress} />
      </td>
      <td className="py-3 px-4 text-xs text-body whitespace-pre-wrap break-words w-[300px] max-w-[300px]">
        {project.notes ?? ""}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1 opacity-0 transition-opacity [tr:hover_&]:opacity-100">
          <button onClick={onEdit} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-gray-50 hover:text-slate-700 transition-colors">編集</button>
          <button onClick={onDuplicate} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-gray-50 hover:text-slate-700 transition-colors">複製</button>
          <button onClick={onDelete} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">削除</button>
        </div>
      </td>
    </tr>
    {isExpanded && (
      <tr>
        <td colSpan={9} className="p-0">
          <PhasePanel projectId={project.id} members={members} directorId={project.director_id} designerId={project.designer_id} engineerId={project.engineer_id} />
        </td>
      </tr>
    )}
    </>
  );
});

export function ProjectList({ initialProjects, members }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [viewMode, setViewMode] = useState<ViewMode>("priority");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string>("");

  // メンバーフィルタ
  const filterProject = useCallback((p: Project) => {
    if (!filterMemberId) return true;
    return p.director_id === filterMemberId || p.designer_id === filterMemberId || p.engineer_id === filterMemberId;
  }, [filterMemberId]);

  // 公開済み（完了）とそれ以外を分離
  const activeProjects = useMemo(() => projects.filter((p) => p.status !== "完了" && filterProject(p)), [projects, filterProject]);
  const decidedProjects = useMemo(() => activeProjects.filter((p) => !p.priority_undecided), [activeProjects]);
  const undecidedProjects = useMemo(() => activeProjects.filter((p) => p.priority_undecided), [activeProjects]);

  // 未決定施策をグループ（lv2）順に並べる
  const undecidedGrouped = useMemo(() => {
    const groups: { lv2: string; items: Project[] }[] = [];
    for (const lv2 of GROUP_LV2_OPTIONS) {
      groups.push({ lv2: lv2.value, items: [] });
    }
    groups.push({ lv2: "未分類", items: [] });
    for (const p of undecidedProjects) {
      const key = p.group_lv2 ?? "未分類";
      const group = groups.find((g) => g.lv2 === key);
      if (group) group.items.push(p);
      else groups.find((g) => g.lv2 === "未分類")!.items.push(p);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [undecidedProjects]);

  const releasedProjects = useMemo(() =>
    [...projects.filter((p) => p.status === "完了" && filterProject(p))]
      .sort((a, b) => {
        if (!a.target_date && !b.target_date) return 0;
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return b.target_date.localeCompare(a.target_date);
      }),
    [projects, filterProject]
  );

  const supabase = useMemo(() => createClient(), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select(`
        *,
        director:members!projects_director_id_fkey(id, display_name, role),
        engineer:members!projects_engineer_id_fkey(id, display_name, role),
        designer:members!projects_designer_id_fkey(id, display_name, role)
      `)
      .order("priority", { ascending: true });
    if (data) setProjects(data);
  }, [supabase]);

  const handleCreate = async (formData: ProjectFormData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("projects").insert({
      created_by: user.id,
      title: formData.title,
      group_lv1: formData.group_lv1 || null,
      group_lv2: formData.group_lv2 || null,
      group_lv3: formData.group_lv3 || null,
      priority: formData.priority,
      priority_undecided: true,
      target_date: formData.target_date || null,
      target_date_tentative: formData.target_date_tentative,
      director_id: formData.director_id || null,
      engineer_id: formData.engineer_id || null,
      designer_id: formData.designer_id || null,
      status: formData.progress === "done" ? "完了" : formData.status,
      progress: formData.progress,
      size: formData.size || null,
      notes: formData.notes || null,
    } as never);

    await reload();
    setDialogOpen(false);
  };

  const handleUpdate = async (formData: ProjectFormData) => {
    if (!editingProject) return;

    await supabase
      .from("projects")
      .update({
        title: formData.title,
        group_lv1: formData.group_lv1 || null,
        group_lv2: formData.group_lv2 || null,
        group_lv3: formData.group_lv3 || null,
        priority: formData.priority,
        target_date: formData.target_date || null,
        target_date_tentative: formData.target_date_tentative,
        director_id: formData.director_id || null,
        engineer_id: formData.engineer_id || null,
        designer_id: formData.designer_id || null,
        status: formData.progress === "done" ? "完了" : formData.status,
        progress: formData.progress,
        size: formData.size || null,
        notes: formData.notes || null,
      } as never)
      .eq("id", editingProject.id);

    await reload();
    setEditingProject(null);
  };

  const handleDuplicate = async (project: Project) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const maxPriority = projects.reduce((max, p) => Math.max(max, p.priority), 0);

    await supabase.from("projects").insert({
      created_by: user.id,
      title: `${project.title}（コピー）`,
      group_lv1: project.group_lv1,
      group_lv2: project.group_lv2,
      group_lv3: project.group_lv3,
      priority: maxPriority + 1,
      priority_undecided: true,
      target_date: project.target_date,
      target_date_tentative: project.target_date_tentative,
      director_id: project.director_id,
      engineer_id: project.engineer_id,
      designer_id: project.designer_id,
      status: "未着手",
      progress: "paused",
      size: project.size,
      notes: project.notes,
    } as never);

    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この施策を削除しますか？")) return;
    await supabase.from("projects").delete().eq("id", id);
    await reload();
  };

  // D&D完了時：優先順を振り直してDBに保存
  const handleTogglePriority = async (project: Project) => {
    const newUndecided = !project.priority_undecided;
    await supabase
      .from("projects")
      .update({ priority_undecided: newUndecided } as never)
      .eq("id", project.id);
    await reload();
  };

  const handleSectionDragEnd = async (event: DragEndEvent, isUndecidedSection: boolean) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sectionProjects = isUndecidedSection ? [...undecidedProjects] : [...decidedProjects];
    const oldIndex = sectionProjects.findIndex((p) => p.id === active.id);
    const newIndex = sectionProjects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = sectionProjects.splice(oldIndex, 1);
    sectionProjects.splice(newIndex, 0, moved);

    // 決定済み + 未決定を結合して優先順を振り直し
    const newDecided = isUndecidedSection ? decidedProjects : sectionProjects;
    const newUndecided = isUndecidedSection ? sectionProjects : undecidedProjects;
    const allActive = [...newDecided, ...newUndecided].map((p, i) => ({ ...p, priority: i + 1 }));

    const completedProjects = projects.filter((p) => p.status === "完了");
    setProjects([...allActive, ...completedProjects]);

    // 変更があった行だけ更新
    const changed = allActive.filter((p, i) => {
      const orig = [...decidedProjects, ...undecidedProjects][i];
      return !orig || orig.id !== p.id || orig.priority !== p.priority;
    });
    if (changed.length > 0) {
      await Promise.all(
        changed.map((p) =>
          supabase
            .from("projects")
            .update({ priority: p.priority } as never)
            .eq("id", p.id)
        )
      );
    }
  };

  // 事業別のグルーピング（lv2 > lv3 の2階層、定義順、空グループも表示）
  const groupedProjects = () => {
    type Lv3Group = { name: string; items: Project[] };
    type Lv2Group = { lv1: string; lv2: string; lv3Groups: Lv3Group[] };

    const result: Lv2Group[] = [];

    for (const lv2 of GROUP_LV2_OPTIONS) {
      // この lv2 に属する lv3 を定義順で作成
      const lv3s = GROUP_LV3_OPTIONS.filter((o) => o.parent === lv2.value);
      const lv3Groups: Lv3Group[] = lv3s.map((lv3) => ({
        name: lv3.value,
        items: [],
      }));
      result.push({ lv1: lv2.parent, lv2: lv2.value, lv3Groups });
    }

    for (const project of activeProjects) {
      const lv2Key = project.group_lv2;
      const lv3Key = project.group_lv3;
      const lv2Group = result.find((g) => g.lv2 === lv2Key);
      if (lv2Group) {
        const lv3Group = lv2Group.lv3Groups.find((g) => g.name === lv3Key);
        if (lv3Group) {
          lv3Group.items.push(project);
        } else {
          // lv3 未設定 or 定義外 → lv2 の最初の lv3 に入れる
          lv2Group.lv3Groups[0]?.items.push(project);
        }
      }
    }

    return result;
  };

  const theadClasses = "border-b border-slate-200 bg-gray-50";

  return (
    <div>
      {/* ヘッダー + ビュー切替 */}
      <div className="sticky top-[45px] z-[15] mb-4" style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", width: "100vw", left: 0 }}>
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
        <div className="relative mx-auto flex max-w-[1600px] items-center justify-between px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex gap-0.5 rounded-xl bg-white/8 p-1 backdrop-blur-sm">
            <button
              onClick={() => setViewMode("priority")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                viewMode === "priority"
                  ? "bg-white text-slate-900 shadow-md shadow-black/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              優先度順
            </button>
            <button
              onClick={() => setViewMode("group")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                viewMode === "group"
                  ? "bg-white text-slate-900 shadow-md shadow-black/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              事業別
            </button>
            <button
              onClick={() => setViewMode("gantt")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                viewMode === "gantt"
                  ? "bg-white text-slate-900 shadow-md shadow-black/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              ガント
            </button>
            <button
              onClick={() => setViewMode("released")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                viewMode === "released"
                  ? "bg-white text-slate-900 shadow-md shadow-black/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              公開済み
            </button>
          </div>
          {/* メンバーフィルター */}
          <select
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-white/8 px-3 text-sm text-white/70 outline-none cursor-pointer backdrop-blur-sm focus:ring-2 focus:ring-primary-400/30"
          >
            <option value="">全メンバー</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}{m.role ? ` (${m.role})` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-400 shadow-lg shadow-primary-500/25 transition-all duration-200 cursor-pointer"
        >
          + 新規作成
        </button>
        </div>
      </div>

      {/* 優先度順ビュー（D&D対応） */}
      {viewMode === "priority" && (
        <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className={theadClasses}>
                <th scope="col" className="w-8 py-3 px-2"></th>
                <th scope="col" className="w-10 py-3 px-4 text-center text-xs font-medium text-slate-500">#</th>
                <th scope="col" className="w-36 py-3 px-4 text-left text-xs font-medium text-slate-500">事業</th>
                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">タイトル</th>
                <th scope="col" className="w-32 py-3 px-4 text-left text-xs font-medium text-slate-500">公開目安</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Dir</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Des</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Eng</th>
                <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">状態</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500 cursor-help" data-tooltip="エンジニア対応見積工数。アウトプット量 = 規模 × 施策数 とし、アウトプット量の推移を確認するために使用する。">規模</th>
                <th scope="col" className="w-8 py-3 px-2"></th>
                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">備考</th>
                <th scope="col" className="w-24 py-3 px-4"></th>
              </tr>
            </thead>
            {activeProjects.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={13} className="py-16 text-center text-base text-slate-500">
                    施策がまだありません。「新規作成」から追加してください。
                  </td>
                </tr>
              </tbody>
            ) : (
              <>
                {/* 決定済みセクション */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleSectionDragEnd(event, false)}
                >
                  <SortableContext
                    items={decidedProjects.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody className="divide-y divide-slate-100">
                      {decidedProjects.map((project) => (
                        <SortableRow
                          key={project.id}
                          project={project}
                          isExpanded={expandedProjectId === project.id}
                          onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                          onEdit={() => setEditingProject(project)}
                          onDuplicate={() => handleDuplicate(project)}
                          onDelete={() => handleDelete(project.id)}
                          onTogglePriority={() => handleTogglePriority(project)}
                          members={members}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>

                {/* 区切り線 */}
                <tbody>
                  <tr>
                    <td colSpan={13} className="p-0">
                      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50">
                        <div className="flex-1 border-t border-slate-200" />
                        <span className="text-xs font-medium text-amber-700 whitespace-nowrap">優先順位 未決定</span>
                        <div className="flex-1 border-t border-slate-200" />
                      </div>
                    </td>
                  </tr>
                </tbody>

                {/* 未決定セクション（グループ別） */}
                {undecidedGrouped.map((group) => (
                  <tbody key={group.lv2} className="divide-y divide-slate-100">
                    <tr>
                      <td colSpan={13} className="p-0">
                        <div className="flex items-center gap-2 px-10 py-2 bg-gray-50 border-t border-slate-200">
                          <GroupLv2Icon value={group.lv2} size={16} />
                          <span className="text-xs font-medium text-slate-500">{group.lv2}</span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((project) => (
                      <SortableRow
                        key={project.id}
                        project={project}
                        isExpanded={expandedProjectId === project.id}
                        onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                        onEdit={() => setEditingProject(project)}
                        onDuplicate={() => handleDuplicate(project)}
                        onDelete={() => handleDelete(project.id)}
                        onTogglePriority={() => handleTogglePriority(project)}
                        members={members}
                      />
                    ))}
                  </tbody>
                ))}
              </>
            )}
          </table>
        </div>
      )}

      {/* 事業別ビュー */}
      {viewMode === "group" && (
        <div className="space-y-6">
          {groupedProjects().map((group) => {
            const totalItems = group.lv3Groups.reduce((sum, g) => sum + g.items.length, 0);
            return (
              <div
                key={group.lv2}
                className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden"
              >
                <div className="flex items-center gap-2 border-b border-slate-200 bg-gray-50 px-4 py-3">
                  <span className="text-xs text-slate-500">{group.lv1}</span>
                  {group.lv1 && <span className="text-xs text-slate-400">/</span>}
                  <GroupLv2Icon value={group.lv2} size={16} />
                  <h3 className="text-base font-bold text-slate-900">{group.lv2}</h3>
                  <span className="text-xs text-slate-500">
                    {totalItems}件
                  </span>
                </div>
                {group.lv3Groups.map((lv3Group) => (
                  <div key={lv3Group.name}>
                    <div className="flex items-center gap-2 border-t border-slate-200 bg-gray-50 px-4 py-2.5 first:border-t-0">
                      <GroupLv3Icon value={lv3Group.name} />
                      <span className="text-sm font-semibold text-slate-700">
                        {lv3Group.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {lv3Group.items.length}件
                      </span>
                    </div>
                    {lv3Group.items.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        施策なし
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={theadClasses}>
                            <th scope="col" className="w-10 py-3 px-4 text-center text-xs font-medium text-slate-500">#</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">タイトル</th>
                            <th scope="col" className="w-32 py-3 px-4 text-left text-xs font-medium text-slate-500">公開目安</th>
                            <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Dir</th>
                            <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Des</th>
                            <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Eng</th>
                            <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">状態</th>
                            <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500 cursor-help" data-tooltip="エンジニア対応見積工数。アウトプット量 = 規模 × 施策数 とし、アウトプット量の推移を確認するために使用する。">規模</th>
                            <th scope="col" className="w-8 py-3 px-2"></th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">備考</th>
                            <th scope="col" className="w-24 py-3 px-4"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lv3Group.items.map((project) => (
                            <ProjectRow
                              key={project.id}
                              project={project}
                              isExpanded={expandedProjectId === project.id}
                              onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                              onEdit={() => setEditingProject(project)}
                              onDuplicate={() => handleDuplicate(project)}
                              onDelete={() => handleDelete(project.id)}
                              members={members}
                            />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 公開済みビュー */}
      {viewMode === "released" && (
        <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className={theadClasses}>
                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">タイトル</th>
                <th scope="col" className="w-32 py-3 px-4 text-left text-xs font-medium text-slate-500">公開日</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Dir</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Des</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500">Eng</th>
                <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">状態</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500 cursor-help" data-tooltip="エンジニア対応見積工数。アウトプット量 = 規模 × 施策数 とし、アウトプット量の推移を確認するために使用する。">規模</th>
                <th scope="col" className="w-8 py-3 px-2"></th>
                <th scope="col" className="w-24 py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {releasedProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-base text-slate-500">
                    公開済みの施策はありません
                  </td>
                </tr>
              ) : (
                releasedProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    isExpanded={expandedProjectId === project.id}
                    onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                    onEdit={() => setEditingProject(project)}
                    onDuplicate={() => handleDuplicate(project)}
                    onDelete={() => handleDelete(project.id)}
                    hidePriority
                    members={members}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ガントチャートビュー */}
      {viewMode === "gantt" && (
        <Suspense fallback={<div className="py-8 text-center text-sm text-white/30">読み込み中...</div>}>
          <GanttChart projects={activeProjects} members={members} />
        </Suspense>
      )}

      {/* 新規作成ダイアログ */}
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
        members={members}
        title="施策を新規作成"
      />

      {/* 編集ダイアログ */}
      <ProjectDialog
        open={editingProject !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null);
        }}
        onSubmit={handleUpdate}
        members={members}
        title="施策を編集"
        defaultValues={editingProject ?? undefined}
      />
    </div>
  );
}
