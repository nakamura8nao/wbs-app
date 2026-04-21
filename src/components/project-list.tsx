"use client";

import { useState, useCallback, useMemo, useRef, memo, lazy, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectDialog } from "@/components/project-dialog";
import { ProgressIcon } from "@/components/progress-icon";
import { GroupLv2Icon, GroupLv3Icon } from "@/components/group-icon";
import { PhasePanel } from "@/components/phase-panel";
import { ChevronDown, ChevronRight, ExternalLink, EllipsisVertical, Pencil, Copy, ArrowUpDown, Trash2 } from "lucide-react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
const GanttChart = lazy(() => import("@/components/gantt-chart").then((m) => ({ default: m.GanttChart })));
import { GROUP_LV2_OPTIONS, GROUP_LV3_OPTIONS, SIZE_OPTIONS, STATUS_OPTIONS, PROGRESS_OPTIONS } from "@/lib/constants";
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

type PhaseAssigneeRow = { project_id: string; assignee_id: string };

type Props = {
  initialProjects: Project[];
  initialPhaseAssignees: PhaseAssigneeRow[];
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

// 行アクションメニュー（三点メニュー + 右クリック共通）
type MenuAnchor = Element | { getBoundingClientRect: () => DOMRect };

const menuItemClasses = "flex items-center gap-2 px-3 py-2 text-sm text-slate-700 outline-none cursor-default select-none data-highlighted:bg-gray-100 data-highlighted:text-slate-900";
const menuPopupClasses = "min-w-[140px] rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/10 origin-(--transform-origin) transition-[transform,scale,opacity] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

function ProjectActionMenu({
  open,
  onOpenChange,
  anchor,
  onEdit,
  onDuplicate,
  onDelete,
  onTogglePriority,
  priorityLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: MenuAnchor | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePriority?: () => void;
  priorityLabel?: string;
}) {
  return (
    <Menu.Root open={open} onOpenChange={(open) => onOpenChange(open)} modal={false}>
      <Menu.Portal>
        <Menu.Positioner anchor={anchor} side="bottom" align="start" sideOffset={4}>
          <Menu.Popup className={menuPopupClasses}>
            <Menu.Item className={menuItemClasses} onClick={onEdit}>
              <Pencil size={14} />
              編集
            </Menu.Item>
            <Menu.Item className={menuItemClasses} onClick={onDuplicate}>
              <Copy size={14} />
              複製
            </Menu.Item>
            {onTogglePriority && (
              <Menu.Item className={cn(menuItemClasses, "text-amber-600 data-highlighted:text-amber-700")} onClick={onTogglePriority}>
                <ArrowUpDown size={14} />
                {priorityLabel}
              </Menu.Item>
            )}
            <Menu.Item className={cn(menuItemClasses, "text-red-500 data-highlighted:bg-red-50 data-highlighted:text-red-600")} onClick={onDelete}>
              <Trash2 size={14} />
              削除
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const EmptyPlaceholder = () => <span className="text-xs text-slate-400">未設定</span>;

// YYYY-MM-DD 同士の日数差（end - start）
const diffDays = (start: string, end: string): number => {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const msPerDay = 86400000;
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / msPerDay);
};

const sizeOptionsWithNone = [
  { value: "", label: <span className="text-slate-400">未設定</span> },
  ...SIZE_OPTIONS.map((s) => ({ value: s.value, label: s.label as React.ReactNode })),
];

const progressOptions = PROGRESS_OPTIONS.map((p) => ({
  value: p.value,
  label: (
    <span className="flex items-center gap-2">
      <span>{p.label}</span>
      <span className="text-xs text-slate-500">
        {p.value === "paused" ? "未着手" : p.value === "active" ? "進行中" : "完了"}
      </span>
    </span>
  ),
}));

// メンバー選択肢を推奨ロール優先で並び替え
function memberOptions(members: Member[], preferredRole: string) {
  const preferred = members.filter((m) => m.role === preferredRole);
  const others = members.filter((m) => m.role !== preferredRole);
  const format = (m: Member) => `${m.display_name}${m.role ? ` (${m.role})` : ""}`;
  return [
    { value: "", label: <span className="text-slate-400">未設定</span> },
    ...preferred.map((m) => ({ value: m.id, label: format(m) })),
    ...others.map((m) => ({ value: m.id, label: format(m) })),
  ];
}

// インライン編集用の共通メニューセル
const inlineCellClasses = "w-full text-left rounded-md px-2 py-1 -mx-2 -my-1 outline-none cursor-pointer";

function InlineMenuCell<T extends string>({
  value,
  options,
  onChange,
  children,
  placeholder = "-",
}: {
  value: T | null;
  options: Array<{ value: T; label: React.ReactNode }>;
  onChange: (value: T) => void;
  children?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className={inlineCellClasses} onClick={(e) => e.stopPropagation()}>
        {children ?? (value ?? placeholder)}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4}>
          <Menu.Popup className={menuPopupClasses}>
            {options.map((opt) => (
              <Menu.Item
                key={opt.value}
                className={cn(menuItemClasses, opt.value === value && "bg-gray-50 font-semibold")}
                onClick={() => onChange(opt.value)}
              >
                {opt.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// インライン日付編集セル
function InlineDateCell({
  value,
  tentative,
  onChange,
}: {
  value: string | null;
  tentative: boolean;
  onChange: (value: string | null, tentative: boolean) => void;
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className={inlineCellClasses} onClick={(e) => e.stopPropagation()}>
        {value ? (
          tentative ? <span className="text-xs text-slate-400">{value} 仮</span> : value
        ) : "-"}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4}>
          <Menu.Popup className={cn(menuPopupClasses, "p-3 min-w-[220px]")}>
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="date"
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value || null, tentative)}
                className="h-8 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#4a9eff]"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={tentative}
                  onChange={(e) => onChange(value, e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                仮
              </label>
              {value && (
                <button
                  type="button"
                  onClick={() => onChange(null, tentative)}
                  className="text-left text-xs text-slate-500 hover:text-red-500"
                >
                  クリア
                </button>
              )}
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// ドラッグ可能な行
const SortableRow = memo(function SortableRow({
  project,
  isExpanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onTogglePriority,
  onUpdateField,
  onPhasesChange,
  members,
}: {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePriority?: () => void;
  onUpdateField: (id: string, patch: Partial<Project>) => void;
  onPhasesChange?: () => void;
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    setMenuAnchor({ getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) });
    setMenuOpen(true);
  }, []);

  const handleKebabClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAnchor(kebabRef.current);
    setMenuOpen(true);
  }, []);

  return (
    <>
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "group transition-colors hover:bg-gray-50",
        isDragging && "relative z-10 bg-white shadow-md"
      )}
      onContextMenu={handleContextMenu}
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
      <td className="w-10 min-[1500px]:w-36 py-3 px-2 min-[1500px]:px-4 text-xs text-slate-500 whitespace-nowrap">
        <span className="flex items-center gap-1" title={project.group_lv2 ?? project.group_lv1 ?? undefined}>
          {project.group_lv2 ? <GroupLv2Icon value={project.group_lv2} size={20} /> : null}
          <span className="hidden min-[1500px]:inline">{project.group_lv2 ?? project.group_lv1 ?? "-"}</span>
          {!project.group_lv2 && <span className="min-[1500px]:hidden">-</span>}
        </span>
      </td>
      <td className="min-w-[240px] py-3 px-4 text-sm text-slate-900 cursor-pointer" onClick={onToggle}>
        <span className="flex items-center gap-1 group/title">
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {project.title}
          <Link
            href={`/projects/${project.id}`}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-[#4a9eff] transition-all ml-1"
            title="施策の個別ページを開く"
          >
            <ExternalLink size={13} />
          </Link>
        </span>
      </td>
      <td className="w-32 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineDateCell
          value={project.target_date}
          tentative={project.target_date_tentative}
          onChange={(v, tentative) => onUpdateField(project.id, { target_date: v, target_date_tentative: tentative })}
        />
      </td>
      <td className="w-24 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineMenuCell
          value={project.director_id}
          options={memberOptions(members, "ディレクター")}
          onChange={(v) => onUpdateField(project.id, { director_id: v || null })}
        >
          {project.director?.display_name ?? <EmptyPlaceholder />}
        </InlineMenuCell>
      </td>
      <td className="w-24 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineMenuCell
          value={project.designer_id}
          options={memberOptions(members, "デザイナー")}
          onChange={(v) => onUpdateField(project.id, { designer_id: v || null })}
        >
          {project.designer?.display_name ?? <EmptyPlaceholder />}
        </InlineMenuCell>
      </td>
      <td className="w-24 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineMenuCell
          value={project.engineer_id}
          options={memberOptions(members, "エンジニア")}
          onChange={(v) => onUpdateField(project.id, { engineer_id: v || null })}
        >
          {project.engineer?.display_name ?? <EmptyPlaceholder />}
        </InlineMenuCell>
      </td>
      <td className="w-24 py-3 px-4 whitespace-nowrap">
        <InlineMenuCell
          value={project.status}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          onChange={(v) => onUpdateField(project.id, { status: v })}
        >
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", statusConfig(project.status).badge)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig(project.status).dot)} />
            {project.status}
          </span>
        </InlineMenuCell>
      </td>
      <td className="w-8 py-3 px-2 text-center text-sm">
        <InlineMenuCell
          value={project.progress}
          options={progressOptions}
          onChange={(v) => onUpdateField(project.id, { progress: v })}
        >
          <ProgressIcon value={project.progress} />
        </InlineMenuCell>
      </td>
      <td className="py-3 px-4 text-xs text-body whitespace-pre-wrap break-words w-[300px] max-w-[300px]">
        {project.notes ?? ""}
      </td>
      <td className="w-10 py-3 px-2">
        <button
          ref={kebabRef}
          onClick={handleKebabClick}
          className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-slate-600"
        >
          <EllipsisVertical size={16} />
        </button>
      </td>
    </tr>
    <ProjectActionMenu
      open={menuOpen}
      onOpenChange={setMenuOpen}
      anchor={menuAnchor}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onTogglePriority={onTogglePriority}
      priorityLabel={project.priority_undecided ? "↑ 決定" : "↓ 未決定"}
    />
    {isExpanded && (
      <tr>
        <td colSpan={12} className="p-0">
          <PhasePanel projectId={project.id} members={members} directorId={project.director_id} designerId={project.designer_id} engineerId={project.engineer_id} onPhasesChange={onPhasesChange} />
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
  onUpdateField,
  onPhasesChange,
  hidePriority,
  hideSize,
  showProposedDate,
  members,
}: {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateField: (id: string, patch: Partial<Project>) => void;
  onPhasesChange?: () => void;
  hidePriority?: boolean;
  hideSize?: boolean;
  showProposedDate?: boolean;
  members: Member[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    setMenuAnchor({ getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) });
    setMenuOpen(true);
  }, []);

  const handleKebabClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAnchor(kebabRef.current);
    setMenuOpen(true);
  }, []);

  return (
    <>
    <tr className="group transition-colors hover:bg-gray-50" onContextMenu={handleContextMenu}>
      {!hidePriority && (
        <td className="w-10 py-3 px-4 text-center font-mono text-xs text-slate-500">
          {project.priority_undecided ? "-" : project.priority}
        </td>
      )}
      <td className="min-w-[240px] py-3 px-4 text-sm text-slate-900 cursor-pointer" onClick={onToggle}>
        <span className="flex items-center gap-1 group/title">
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {project.title}
          <Link
            href={`/projects/${project.id}`}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-[#4a9eff] transition-all ml-1"
            title="施策の個別ページを開く"
          >
            <ExternalLink size={13} />
          </Link>
        </span>
      </td>
      <td className="w-32 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineDateCell
          value={project.target_date}
          tentative={project.target_date_tentative}
          onChange={(v, tentative) => onUpdateField(project.id, { target_date: v, target_date_tentative: tentative })}
        />
      </td>
      <td className="w-24 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineMenuCell
          value={project.director_id}
          options={memberOptions(members, "ディレクター")}
          onChange={(v) => onUpdateField(project.id, { director_id: v || null })}
        >
          {project.director?.display_name ?? <EmptyPlaceholder />}
        </InlineMenuCell>
      </td>
      <td className="w-24 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineMenuCell
          value={project.designer_id}
          options={memberOptions(members, "デザイナー")}
          onChange={(v) => onUpdateField(project.id, { designer_id: v || null })}
        >
          {project.designer?.display_name ?? <EmptyPlaceholder />}
        </InlineMenuCell>
      </td>
      <td className="w-24 py-3 px-4 text-sm text-body whitespace-nowrap">
        <InlineMenuCell
          value={project.engineer_id}
          options={memberOptions(members, "エンジニア")}
          onChange={(v) => onUpdateField(project.id, { engineer_id: v || null })}
        >
          {project.engineer?.display_name ?? <EmptyPlaceholder />}
        </InlineMenuCell>
      </td>
      <td className="w-24 py-3 px-4 whitespace-nowrap">
        <InlineMenuCell
          value={project.status}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          onChange={(v) => onUpdateField(project.id, { status: v })}
        >
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", statusConfig(project.status).badge)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig(project.status).dot)} />
            {project.status}
          </span>
        </InlineMenuCell>
      </td>
      {showProposedDate && (
        <td className="w-28 py-3 px-4 text-xs text-body whitespace-nowrap">
          {project.proposed_date ?? "-"}
        </td>
      )}
      {showProposedDate && (
        <td className="w-28 py-3 px-4 text-xs text-body whitespace-nowrap text-right">
          {project.proposed_date && project.target_date
            ? `${diffDays(project.proposed_date, project.target_date) + 1}日`
            : "-"}
        </td>
      )}
      {!hideSize && (
        <td className="w-20 py-3 px-4 text-xs text-body whitespace-nowrap">
          <InlineMenuCell
            value={project.size ?? ""}
            options={sizeOptionsWithNone}
            onChange={(v) => onUpdateField(project.id, { size: v || null })}
          >
            {project.size ? sizeLabel(project.size) : <EmptyPlaceholder />}
          </InlineMenuCell>
        </td>
      )}
      <td className="w-8 py-3 px-2 text-center text-sm">
        <InlineMenuCell
          value={project.progress}
          options={progressOptions}
          onChange={(v) => onUpdateField(project.id, { progress: v })}
        >
          <ProgressIcon value={project.progress} />
        </InlineMenuCell>
      </td>
      <td className="py-3 px-4 text-xs text-body whitespace-pre-wrap break-words w-[300px] max-w-[300px]">
        {project.notes ?? ""}
      </td>
      <td className="w-10 py-3 px-2">
        <button
          ref={kebabRef}
          onClick={handleKebabClick}
          className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-slate-600"
        >
          <EllipsisVertical size={16} />
        </button>
      </td>
    </tr>
    <ProjectActionMenu
      open={menuOpen}
      onOpenChange={setMenuOpen}
      anchor={menuAnchor}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />
    {isExpanded && (
      <tr>
        <td colSpan={9} className="p-0">
          <PhasePanel projectId={project.id} members={members} directorId={project.director_id} designerId={project.designer_id} engineerId={project.engineer_id} onPhasesChange={onPhasesChange} />
        </td>
      </tr>
    )}
    </>
  );
});

export function ProjectList({ initialProjects, initialPhaseAssignees, members }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [phaseAssignees, setPhaseAssignees] = useState(initialPhaseAssignees);

  const phaseAssigneesByProjectId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of phaseAssignees) {
      if (!row.assignee_id) continue;
      let set = map.get(row.project_id);
      if (!set) {
        set = new Set<string>();
        map.set(row.project_id, set);
      }
      set.add(row.assignee_id);
    }
    return map;
  }, [phaseAssignees]);
  const [viewMode, setViewMode] = useState<ViewMode>("priority");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string>("");
  const [filterStartStatus, setFilterStartStatus] = useState<"" | "not_started" | "started">("");

  // メンバー + 着手状況フィルタ
  // メンバー絞り込みは施策の director/designer/engineer に加え、フェーズ担当者も対象にする
  // （1施策を複数エンジニアで分担する場合、フェーズ側にのみ担当者が入るケースがあるため）
  const filterProject = useCallback((p: Project) => {
    if (filterMemberId) {
      const matchedAtProject = p.director_id === filterMemberId || p.designer_id === filterMemberId || p.engineer_id === filterMemberId;
      const matchedAtPhase = phaseAssigneesByProjectId.get(p.id)?.has(filterMemberId) ?? false;
      if (!matchedAtProject && !matchedAtPhase) return false;
    }
    if (filterStartStatus === "not_started" && p.status !== "未着手") return false;
    if (filterStartStatus === "started" && p.status === "未着手") return false;
    return true;
  }, [filterMemberId, filterStartStatus, phaseAssigneesByProjectId]);

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

  const reloadPhaseAssignees = useCallback(async () => {
    const { data } = await supabase
      .from("phases")
      .select("project_id, assignee_id")
      .not("assignee_id", "is", null);
    if (data) setPhaseAssignees(data as PhaseAssigneeRow[]);
  }, [supabase]);

  const reload = useCallback(async () => {
    const [{ data }] = await Promise.all([
      supabase
        .from("projects")
        .select(`
          *,
          director:members!projects_director_id_fkey(id, display_name, role),
          engineer:members!projects_engineer_id_fkey(id, display_name, role),
          designer:members!projects_designer_id_fkey(id, display_name, role)
        `)
        .order("priority", { ascending: true }),
      reloadPhaseAssignees(),
    ]);
    if (data) setProjects(data);
  }, [supabase, reloadPhaseAssignees]);

  const handleCreate = async (formData: ProjectFormData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 既存の決定済み施策の priority を +1 してずらす
    const decided = projects.filter((p) => !p.priority_undecided && p.status !== "完了");
    for (const p of decided) {
      await supabase.from("projects").update({ priority: p.priority + 1 } as never).eq("id", p.id);
    }

    await supabase.from("projects").insert({
      created_by: user.id,
      title: formData.title,
      group_lv1: formData.group_lv1 || null,
      group_lv2: formData.group_lv2 || null,
      group_lv3: formData.group_lv3 || null,
      priority: 1,
      priority_undecided: false,
      target_date: formData.target_date || null,
      target_date_tentative: formData.target_date_tentative,
      director_id: formData.director_id || null,
      engineer_id: formData.engineer_id || null,
      designer_id: formData.designer_id || null,
      status: formData.progress === "done" ? "完了" : formData.status,
      progress: formData.progress,
      size: formData.size || null,
      notes: formData.notes || null,
      proposed_date: formData.proposed_date || new Date().toLocaleDateString("sv-SE"),
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
        proposed_date: formData.proposed_date || undefined,
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
      proposed_date: new Date().toLocaleDateString("sv-SE"),
    } as never);

    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この施策を削除しますか？")) return;
    await supabase.from("projects").delete().eq("id", id);
    await reload();
  };

  const handleUpdateField = useCallback(async (id: string, patch: Partial<Project>) => {
    await supabase.from("projects").update(patch as never).eq("id", id);
    await reload();
  }, [supabase, reload]);

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

  const priorityTableHead = (
    <thead>
      <tr className={theadClasses}>
        <th scope="col" className="w-8 py-3 px-2"></th>
        <th scope="col" className="w-10 py-3 px-4 text-center text-xs font-medium text-slate-500">#</th>
        <th scope="col" className="w-10 min-[1500px]:w-36 py-3 px-2 min-[1500px]:px-4 text-left text-xs font-medium text-slate-500"><span className="hidden min-[1500px]:inline">事業</span></th>
        <th scope="col" className="min-w-[240px] py-3 px-4 text-left text-xs font-medium text-slate-500">タイトル</th>
        <th scope="col" className="w-32 py-3 px-4 text-left text-xs font-medium text-slate-500">公開目安</th>
        <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Dir</th>
        <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Des</th>
        <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Eng</th>
        <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">状態</th>
        <th scope="col" className="w-8 py-3 px-2"></th>
        <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">備考</th>
        <th scope="col" className="w-10 py-3 px-2"></th>
      </tr>
    </thead>
  );

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
          {/* 着手状況フィルター */}
          <select
            value={filterStartStatus}
            onChange={(e) => setFilterStartStatus(e.target.value as "" | "not_started" | "started")}
            className="h-9 rounded-lg border border-white/15 bg-white/8 px-3 text-sm text-white/70 outline-none cursor-pointer backdrop-blur-sm focus:ring-2 focus:ring-primary-400/30"
          >
            <option value="">全ての着手状況</option>
            <option value="not_started">未着手のみ</option>
            <option value="started">着手中</option>
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
        <div className="space-y-6">
          {/* 決定済みカード */}
          <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
            <table className="w-full text-sm">
              {priorityTableHead}
              {activeProjects.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-base text-slate-500">
                      施策がまだありません。「新規作成」から追加してください。
                    </td>
                  </tr>
                </tbody>
              ) : decidedProjects.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-sm text-slate-500">
                      優先順位が決定済みの施策はありません。
                    </td>
                  </tr>
                </tbody>
              ) : (
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
                          onUpdateField={handleUpdateField}
                          onPhasesChange={reloadPhaseAssignees}
                          members={members}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              )}
            </table>
          </div>

          {/* 未決定カード */}
          {undecidedProjects.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <h3 className="text-sm font-semibold text-amber-900">優先順位 未決定</h3>
                </div>
                <span className="text-xs text-amber-700">{undecidedProjects.length}件</span>
              </div>
              <table className="w-full text-sm">
                {priorityTableHead}
                  {undecidedGrouped.map((group) => (
                    <tbody key={group.lv2} className="divide-y divide-slate-100">
                      <tr>
                        <td colSpan={12} className="p-0">
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
                          onUpdateField={handleUpdateField}
                          onPhasesChange={reloadPhaseAssignees}
                          members={members}
                        />
                      ))}
                    </tbody>
                  ))}
              </table>
            </div>
          )}
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
                            <th scope="col" className="min-w-[240px] py-3 px-4 text-left text-xs font-medium text-slate-500">タイトル</th>
                            <th scope="col" className="w-32 py-3 px-4 text-left text-xs font-medium text-slate-500">公開目安</th>
                            <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Dir</th>
                            <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Des</th>
                            <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Eng</th>
                            <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">状態</th>
                            <th scope="col" className="w-8 py-3 px-2"></th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">備考</th>
                            <th scope="col" className="w-10 py-3 px-2"></th>
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
                              onUpdateField={handleUpdateField}
                              onPhasesChange={reloadPhaseAssignees}
                              hideSize
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
                <th scope="col" className="min-w-[240px] py-3 px-4 text-left text-xs font-medium text-slate-500">タイトル</th>
                <th scope="col" className="w-32 py-3 px-4 text-left text-xs font-medium text-slate-500">公開日</th>
                <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Dir</th>
                <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Des</th>
                <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Eng</th>
                <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">状態</th>
                <th scope="col" className="w-28 py-3 px-4 text-left text-xs font-medium text-slate-500">起案日</th>
                <th scope="col" className="w-28 py-3 px-4 text-right text-xs font-medium text-slate-500 whitespace-nowrap" data-tooltip="起案日と公開日が同日の場合は1日">起案日からの日数</th>
                <th scope="col" className="w-20 py-3 px-4 text-left text-xs font-medium text-slate-500 cursor-help" data-tooltip="エンジニア対応見積工数。アウトプット量 = 規模 × 施策数 とし、アウトプット量の推移を確認するために使用する。">規模</th>
                <th scope="col" className="w-8 py-3 px-2"></th>
                <th scope="col" className="w-10 py-3 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {releasedProjects.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-base text-slate-500">
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
                    onUpdateField={handleUpdateField}
                    onPhasesChange={reloadPhaseAssignees}
                    hidePriority
                    showProposedDate
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
