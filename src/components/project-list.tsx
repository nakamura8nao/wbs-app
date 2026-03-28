"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectDialog } from "@/components/project-dialog";
import { ProgressIcon } from "@/components/progress-icon";
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

type ViewMode = "priority" | "group";

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
    case "要求定義":
      return "bg-cyan-50 text-cyan-600";
    case "調査":
      return "bg-orange-50 text-orange-600";
    default:
      return "bg-black/[0.03] text-black/60";
  }
};

// ドラッグ可能な行
function SortableRow({
  project,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
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
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-black/5 transition-colors hover:bg-black/[0.02]",
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
        {project.priority}
      </td>
      <td className="w-24 px-2 py-2 text-xs text-black/60">
        {project.group_lv2 ?? project.group_lv1 ?? "-"}
      </td>
      <td className="px-2 py-2 text-sm text-foreground">{project.title}</td>
      <td className="w-28 px-2 py-2 text-sm text-black/60">
        {project.target_date ? (
          project.target_date_tentative
            ? <span className="text-xs">{project.target_date} 仮</span>
            : project.target_date
        ) : "-"}
      </td>
      <td className="w-20 px-2 py-2 text-sm text-black/60">
        {project.director?.display_name ?? "-"}
      </td>
      <td className="w-20 px-2 py-2 text-sm text-black/60">
        {project.designer?.display_name ?? "-"}
      </td>
      <td className="w-20 px-2 py-2 text-sm text-black/60">
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
      <td className="px-2 py-2">
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 [tr:hover_&]:opacity-100">
          <button onClick={onEdit} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">編集</button>
          <button onClick={onDuplicate} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">複製</button>
          <button onClick={onDelete} className="rounded px-1.5 py-0.5 text-[11px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">削除</button>
        </div>
      </td>
    </tr>
  );
}

// 通常の行（事業別ビュー用、D&Dなし）
function ProjectRow({
  project,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-black/5 transition-colors hover:bg-black/[0.02]">
      <td className="w-10 px-2 py-2 text-center font-mono text-xs text-black/60">
        {project.priority}
      </td>
      <td className="px-2 py-2 text-sm text-foreground">{project.title}</td>
      <td className="w-28 px-2 py-2 text-sm text-black/60">
        {project.target_date ? (
          project.target_date_tentative
            ? <span className="text-xs">{project.target_date} 仮</span>
            : project.target_date
        ) : "-"}
      </td>
      <td className="w-20 px-2 py-2 text-sm text-black/60">
        {project.director?.display_name ?? "-"}
      </td>
      <td className="w-20 px-2 py-2 text-sm text-black/60">
        {project.designer?.display_name ?? "-"}
      </td>
      <td className="w-20 px-2 py-2 text-sm text-black/60">
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
      <td className="px-2 py-2">
        <div className="flex gap-0.5 opacity-0 transition-opacity [tr:hover_&]:opacity-100">
          <button onClick={onEdit} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">編集</button>
          <button onClick={onDuplicate} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">複製</button>
          <button onClick={onDelete} className="rounded px-1.5 py-0.5 text-[11px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">削除</button>
        </div>
      </td>
    </tr>
  );
}

export function ProjectList({ initialProjects, members }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [viewMode, setViewMode] = useState<ViewMode>("priority");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reload = async () => {
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
  };

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
      target_date: formData.target_date || null,
      target_date_tentative: formData.target_date_tentative,
      director_id: formData.director_id || null,
      engineer_id: formData.engineer_id || null,
      designer_id: formData.designer_id || null,
      status: formData.status,
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
        status: formData.status,
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
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // ローカルで並び替え
    const reordered = [...projects];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // 優先順を 1, 2, 3... で振り直す
    const updated = reordered.map((p, i) => ({ ...p, priority: i + 1 }));
    setProjects(updated);

    // DBに保存（並列で更新）
    await Promise.all(
      updated.map((p) =>
        supabase
          .from("projects")
          .update({ priority: p.priority } as never)
          .eq("id", p.id)
      )
    );
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

    for (const project of projects) {
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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 rounded-md bg-black/[0.03] p-0.5">
            <button
              onClick={() => setViewMode("priority")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "priority"
                  ? "bg-black/5 text-foreground"
                  : "text-black/60 hover:text-black/60"
              )}
            >
              優先度順
            </button>
            <button
              onClick={() => setViewMode("group")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "group"
                  ? "bg-black/5 text-foreground"
                  : "text-black/60 hover:text-black/60"
              )}
            >
              事業別
            </button>
          </div>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="rounded-md bg-[#5e5ce6] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4e4cd6] cursor-pointer"
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
                <th className="w-24 px-2 py-2"></th>
              </tr>
            </thead>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={projects.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-8 text-center text-xs text-black/60"
                      >
                        施策がまだありません。「新規作成」から追加してください。
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => (
                      <SortableRow
                        key={project.id}
                        project={project}
                        onEdit={() => setEditingProject(project)}
                        onDuplicate={() => handleDuplicate(project)}
                        onDelete={() => handleDelete(project.id)}
                      />
                    ))
                  )}
                </tbody>
              </SortableContext>
            </DndContext>
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
                  <h3 className="text-base font-bold text-black/80">{group.lv2}</h3>
                  <span className="text-[11px] text-black/40">
                    {totalItems}件
                  </span>
                </div>
                {group.lv3Groups.map((lv3Group) => (
                  <div key={lv3Group.name}>
                    <div className="flex items-center gap-2 border-t-2 border-black/8 bg-black/[0.02] px-4 py-2.5 first:border-t-0">
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
                            <th className="w-24 px-2 py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lv3Group.items.map((project) => (
                            <ProjectRow
                              key={project.id}
                              project={project}
                              onEdit={() => setEditingProject(project)}
                              onDuplicate={() => handleDuplicate(project)}
                              onDelete={() => handleDelete(project.id)}
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

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <p className="text-xs text-black/60">{projects.length}件</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="rounded px-2.5 py-1 text-xs text-black/60 transition-colors hover:bg-black/5 hover:text-black/60 cursor-pointer"
            >
              Top
            </button>
            <button
              onClick={() => setDialogOpen(true)}
              className="rounded-md bg-[#5e5ce6] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#4e4cd6] cursor-pointer"
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
