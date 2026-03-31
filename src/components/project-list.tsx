"use client";

import { useState, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectDialog } from "@/components/project-dialog";
import { ProgressIcon } from "@/components/progress-icon";
import { GroupLv2Icon, GroupLv3Icon } from "@/components/group-icon";
import { PhasePanel } from "@/components/phase-panel";
import { ChevronDown, ChevronRight } from "lucide-react";
const GanttChart = lazy(() => import("@/components/gantt-chart").then((m) => ({ default: m.GanttChart })));
import { GROUP_LV2_OPTIONS, GROUP_LV3_OPTIONS } from "@/lib/constants";
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

const statusStyle = (status: string) => {
  switch (status) {
    case "完了":
      return "bg-emerald-50 text-emerald-600";
    case "公開待ち":
      return "bg-blue-50 text-blue-600";
    case "テスト":
      return "bg-amber-50 text-amber-600";
    case "システム":
      return "bg-violet-50 text-violet-600";
    case "要件定義":
      return "bg-cyan-50 text-cyan-600";
    case "要求定義":
      return "bg-pink-50 text-pink-600";
    case "調査":
      return "bg-orange-50 text-orange-600";
    default:
      return "bg-white/10 text-black/60";
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
        "border-b border-black/5 transition-colors hover:bg-blue-50/70",
        isDragging && "relative z-10 bg-white shadow-lg shadow-black/10"
      )}
    >
      <td className="w-8 px-1.5 py-2 text-center">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-black/40 hover:text-black/60 active:cursor-grabbing"
          title="ドラッグして並び替え"
        >
          ⠿
        </span>
      </td>
      <td className="w-10 px-2 py-2 text-center font-mono text-xs text-black/60">
        {project.priority_undecided ? "-" : project.priority}
      </td>
      <td className="w-24 px-2 py-2 text-xs text-black/60">
        <span className="flex items-center gap-1">
          {project.group_lv2 && <GroupLv2Icon value={project.group_lv2} size={12} />}
          {project.group_lv2 ?? project.group_lv1 ?? "-"}
        </span>
      </td>
      <td className="px-2 py-2 text-sm text-foreground cursor-pointer" onClick={onToggle}>
        <span className="flex items-center gap-1">
          {isExpanded ? <ChevronDown size={14} className="text-black/30" /> : <ChevronRight size={14} className="text-black/30" />}
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
      <td className="px-2 py-2">
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 [tr:hover_&]:opacity-100">
          <button onClick={onEdit} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">編集</button>
          <button onClick={onDuplicate} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">複製</button>
          {onTogglePriority && (
            <button onClick={onTogglePriority} className="rounded px-1.5 py-0.5 text-[11px] text-orange-400/70 hover:bg-orange-50 hover:text-orange-500">
              {project.priority_undecided ? "↑ 決定" : "↓ 未決定"}
            </button>
          )}
          <button onClick={onDelete} className="rounded px-1.5 py-0.5 text-[11px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">削除</button>
        </div>
      </td>
    </tr>
    {isExpanded && (
      <tr>
        <td colSpan={12} className="p-0">
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
    <tr className="border-b border-black/5 transition-colors hover:bg-blue-50/70">
      {!hidePriority && (
        <td className="w-10 px-2 py-2 text-center font-mono text-xs text-black/60">
          {project.priority_undecided ? "-" : project.priority}
        </td>
      )}
      <td className="px-2 py-2 text-sm text-foreground cursor-pointer" onClick={onToggle}>
        <span className="flex items-center gap-1">
          {isExpanded ? <ChevronDown size={14} className="text-black/30" /> : <ChevronRight size={14} className="text-black/30" />}
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
      <td className="px-2 py-2">
        <div className="flex gap-0.5 opacity-0 transition-opacity [tr:hover_&]:opacity-100">
          <button onClick={onEdit} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">編集</button>
          <button onClick={onDuplicate} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">複製</button>
          <button onClick={onDelete} className="rounded px-1.5 py-0.5 text-[11px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">削除</button>
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

  const theadClasses = "border-b border-black/5 text-left text-[11px] font-medium text-black/60";

  return (
    <div>
      {/* ヘッダー + ビュー切替 */}
      <div className="sticky top-[37px] z-[15] -mx-5 mb-3 flex items-center justify-between border-b border-white/5 bg-[#141e2b] px-5 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 rounded-md bg-white/10 p-0.5">
            <button
              onClick={() => setViewMode("priority")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "priority"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              優先度順
            </button>
            <button
              onClick={() => setViewMode("group")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "group"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              事業別
            </button>
            <button
              onClick={() => setViewMode("gantt")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "gantt"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              ガント
            </button>
            <button
              onClick={() => setViewMode("released")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "released"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              公開済み
            </button>
          </div>
          {/* メンバーフィルター */}
          <select
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
            className="h-7 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white/70 outline-none cursor-pointer"
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
          className="rounded-md bg-[#4a9eff] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3a8eef] cursor-pointer"
        >
          + 新規作成
        </button>
      </div>

      {/* 優先度順ビュー（D&D対応） */}
      {viewMode === "priority" && (
        <div className="overflow-hidden rounded-md border border-black/5 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className={theadClasses}>
                <th className="w-8 px-1.5 py-2"></th>
                <th className="w-10 px-2 py-2 text-center">#</th>
                <th className="w-24 px-2 py-2">事業</th>
                <th className="px-2 py-2">タイトル</th>
                <th className="w-28 px-2 py-2">公開目安</th>
                <th className="w-20 px-2 py-2">Dir</th>
                <th className="w-20 px-2 py-2">Des</th>
                <th className="w-20 px-2 py-2">Eng</th>
                <th className="w-20 px-2 py-2">状態</th>
                <th className="w-8 px-1 py-2"></th>
                <th className="px-2 py-2">備考</th>
                <th className="w-24 px-2 py-2"></th>
              </tr>
            </thead>
            {activeProjects.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={12} className="py-8 text-center text-xs text-black/60">
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
                    <tbody>
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
                    <td colSpan={12} className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2 bg-black/[0.03]">
                        <div className="flex-1 border-t-2 border-dashed border-orange-300/50" />
                        <span className="text-xs font-medium text-orange-400/70 whitespace-nowrap">優先順位 未決定</span>
                        <div className="flex-1 border-t-2 border-dashed border-orange-300/50" />
                      </div>
                    </td>
                  </tr>
                </tbody>

                {/* 未決定セクション（グループ別） */}
                {undecidedGrouped.map((group) => (
                  <tbody key={group.lv2}>
                    <tr>
                      <td colSpan={12} className="p-0">
                        <div className="flex items-center gap-2 px-10 py-1.5 bg-black/[0.02]">
                          <GroupLv2Icon value={group.lv2} size={12} />
                          <span className="text-xs font-medium text-black/40">{group.lv2}</span>
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
                className="overflow-hidden rounded-md border border-black/5 bg-white"
              >
                <div className="flex items-center gap-2 border-b border-black/5 bg-black/[0.01] px-4 py-2.5">
                  <span className="text-[11px] text-black/60">{group.lv1}</span>
                  {group.lv1 && <span className="text-[11px] text-black/30">/</span>}
                  <GroupLv2Icon value={group.lv2} size={16} />
                  <h3 className="text-base font-bold text-black/80">{group.lv2}</h3>
                  <span className="text-[11px] text-black/40">
                    {totalItems}件
                  </span>
                </div>
                {group.lv3Groups.map((lv3Group) => (
                  <div key={lv3Group.name}>
                    <div className="flex items-center gap-2 border-t-2 border-black/8 bg-black/[0.02] px-4 py-2.5 first:border-t-0">
                      <GroupLv3Icon value={lv3Group.name} />
                      <span className="text-sm font-semibold text-black/60">
                        {lv3Group.name}
                      </span>
                      <span className="text-[11px] text-black/40">
                        {lv3Group.items.length}件
                      </span>
                    </div>
                    {lv3Group.items.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-black/30">
                        施策なし
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={theadClasses}>
                            <th className="w-10 px-2 py-1.5 text-center">#</th>
                            <th className="px-2 py-1.5">タイトル</th>
                            <th className="w-28 px-2 py-1.5">公開目安</th>
                            <th className="w-20 px-2 py-1.5">Dir</th>
                            <th className="w-20 px-2 py-1.5">Des</th>
                            <th className="w-20 px-2 py-1.5">Eng</th>
                            <th className="w-20 px-2 py-1.5">状態</th>
                            <th className="w-8 px-1 py-1.5"></th>
                            <th className="px-2 py-1.5">備考</th>
                            <th className="w-24 px-2 py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
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
        <div className="overflow-hidden rounded-md border border-black/5 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className={theadClasses}>
                <th className="px-2 py-2">タイトル</th>
                <th className="w-28 px-2 py-2">公開日</th>
                <th className="w-20 px-2 py-2">Dir</th>
                <th className="w-20 px-2 py-2">Des</th>
                <th className="w-20 px-2 py-2">Eng</th>
                <th className="w-20 px-2 py-2">状態</th>
                <th className="w-8 px-1 py-2"></th>
                <th className="w-24 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {releasedProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-black/60">
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
        <Suspense fallback={<div className="py-8 text-center text-xs text-black/30">読み込み中...</div>}>
          <GanttChart projects={activeProjects} members={members} />
        </Suspense>
      )}

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-[#0e1620]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3">
          <p className="text-xs text-white/40">{viewMode === "released" ? releasedProjects.length : activeProjects.length}件</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="rounded px-2.5 py-1 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/60 cursor-pointer"
            >
              Top
            </button>
            <button
              onClick={() => setDialogOpen(true)}
              className="rounded-md bg-[#4a9eff] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3a8eef] cursor-pointer"
            >
              + 新規作成
            </button>
          </div>
        </div>
      </div>

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
