"use client";

import { useState, useCallback, useMemo, useRef, memo, lazy, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectDialog } from "@/components/project-dialog";
import { ProgressIcon } from "@/components/progress-icon";
import { GroupLv2Icon, GroupLv3Icon } from "@/components/group-icon";
import { PhasePanel } from "@/components/phase-panel";
import { NotesContent } from "@/components/notes-content";
import { ChevronDown, ChevronRight, ExternalLink, EllipsisVertical, Pencil, Copy, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Pin, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
const GanttChart = lazy(() => import("@/components/gantt-chart").then((m) => ({ default: m.GanttChart })));
import { GROUP_LV2_OPTIONS, GROUP_LV3_OPTIONS, SIZE_OPTIONS, STATUS_OPTIONS, PROGRESS_OPTIONS } from "@/lib/constants";
import type { ApprovalState } from "@/lib/constants";
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

type ViewMode = "priority" | "group" | "engineer" | "gantt" | "released" | "petit";

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
  onTogglePetit,
  petitLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: MenuAnchor | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePriority?: () => void;
  priorityLabel?: string;
  onTogglePetit?: () => void;
  petitLabel?: string;
}) {
  return (
    <Menu.Root open={open} onOpenChange={(open) => onOpenChange(open)} modal={false}>
      <Menu.Portal>
        <Menu.Positioner anchor={anchor} side="bottom" align="start" sideOffset={4} className="z-[60]">
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
            {onTogglePetit && (
              <Menu.Item className={cn(menuItemClasses, "text-violet-600 data-highlighted:text-violet-700")} onClick={onTogglePetit}>
                <Sparkles size={14} />
                {petitLabel}
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

// 備考テキストのリンク表示は NotesContent（共通コンポーネント）に集約

// 備考のインライン編集セル。クリックで textarea を表示し、blur / Cmd+Enter で保存・Esc で取消
function InlineNotesCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        rows={3}
        placeholder="メモ / [表示名](https://...) でリンク"
        className="w-full rounded-md border border-[#4a9eff]/50 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#4a9eff]/20 resize-y"
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className="cursor-text rounded-md px-1 -mx-1 py-0.5 hover:bg-gray-50 min-h-[1.5em]"
      title="クリックして編集（[表示名](URL) でリンク）"
    >
      {value ? <NotesContent text={value} /> : <span className="text-slate-300">クリックして入力</span>}
    </div>
  );
}

// 須川さんチェック（承認）の3状態。クリックで巡回切り替え
//   pending（青・要対応）→ approved（グレー・完了と同色）→ skipped（濃いグレー）→ pending
// 未承認は「須川さんチェック待ち」を目立たせるため青。承認後はグレー系に落とす。
const approvalConfig: Record<ApprovalState, { cls: string; label: string }> = {
  pending: { cls: "bg-[#4a9eff] text-white", label: "未承認" },
  approved: { cls: "bg-black/20 text-white", label: "承認済み" },
  skipped: { cls: "bg-slate-600 text-white", label: "承認不要（事後報告）" },
};

const nextApprovalState = (s: ApprovalState): ApprovalState =>
  s === "pending" ? "approved" : s === "approved" ? "skipped" : "pending";

// 色の凡例（ツールチップに添える）
const approvalLegend = "青=未承認（要対応） / グレー=承認済み / 濃いグレー=承認不要（事後報告）";

function ApprovalToggle({
  state,
  onChange,
  label,
  gateTitle,
}: {
  state: ApprovalState;
  onChange: (next: ApprovalState) => void;
  label: string;
  gateTitle: string;
}) {
  return (
    <button
      type="button"
      title={`${gateTitle}｜${approvalLegend}（現在: ${approvalConfig[state].label}）`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(nextApprovalState(state));
      }}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold transition-colors cursor-pointer",
        approvalConfig[state].cls
      )}
    >
      {label}
    </button>
  );
}

// 承認3ゲートをまとめたセル（W=WFレビュー / デ=デザインレビュー / 公=公開前レビュー）
function ApprovalCell({
  project,
  onUpdateField,
}: {
  project: Project;
  onUpdateField: (id: string, patch: Partial<Project>) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <ApprovalToggle
        state={project.wf_approved}
        onChange={(next) => onUpdateField(project.id, { wf_approved: next })}
        label="W"
        gateTitle="WFレビュー（須川さん）"
      />
      <ApprovalToggle
        state={project.design_approved}
        onChange={(next) => onUpdateField(project.id, { design_approved: next })}
        label="デ"
        gateTitle="デザインレビュー（須川さん）"
      />
      <ApprovalToggle
        state={project.release_approved}
        onChange={(next) => onUpdateField(project.id, { release_approved: next })}
        label="公"
        gateTitle="公開前レビュー（須川さん）"
      />
    </div>
  );
}

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
        <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-[60]">
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
// 日付選択のたびに確定すると、公開目安ソート中は即再ソートで行が動いて操作しづらい。
// そのため編集中はローカルのドラフトに溜め、「適用」または閉じたときに一度だけ確定する。
function InlineDateCell({
  value,
  tentative,
  onChange,
}: {
  value: string | null;
  tentative: boolean;
  onChange: (value: string | null, tentative: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<string | null>(value);
  const [draftTentative, setDraftTentative] = useState(tentative);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // 開くとき：現在の確定値でドラフトを初期化
      setDraftValue(value);
      setDraftTentative(tentative);
    } else if (draftValue !== value || draftTentative !== tentative) {
      // 閉じるとき：差分があればここで初めて確定（このタイミングで行が動く）
      onChange(draftValue, draftTentative);
    }
    setOpen(next);
  };

  return (
    <Menu.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <Menu.Trigger className={inlineCellClasses} onClick={(e) => e.stopPropagation()}>
        {value ? (
          tentative ? <span className="text-xs text-slate-400">{value} 仮</span> : value
        ) : "-"}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-[60]">
          <Menu.Popup className={cn(menuPopupClasses, "p-3 min-w-[220px]")}>
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="date"
                value={draftValue ?? ""}
                onChange={(e) => setDraftValue(e.target.value || null)}
                className="h-8 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#4a9eff]"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draftTentative}
                  onChange={(e) => setDraftTentative(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                仮
              </label>
              <div className="flex items-center justify-between">
                {draftValue ? (
                  <button
                    type="button"
                    onClick={() => setDraftValue(null)}
                    className="text-left text-xs text-slate-500 hover:text-red-500"
                  >
                    クリア
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-md bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-400 cursor-pointer"
                >
                  適用
                </button>
              </div>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// 公開マスト期日のインライン編集。事業部等により期日が確定しており「絶対に動かせない日」を持つ。
// 公開目安（target_date）とは別の日付として扱う軸で、重要度（優先度）とも独立。
// 期日が入っていること自体が「動かせない」印なので、旧 is_urgent フラグは廃止しこの日付に統合した。
// 未設定のときは行ホバーで薄いピンだけを出し、行の高さを増やさない。
function MustDateCell({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<string | null>(value);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftValue(value);
    } else if (draftValue !== value) {
      onChange(draftValue);
    }
    setOpen(next);
  };

  return (
    <Menu.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <Menu.Trigger
        onClick={(e) => e.stopPropagation()}
        data-tooltip={value
          ? "公開マスト期日：事業部等により期日が確定しており、後ろ倒しできない日。クリックで変更・クリア。"
          : "クリックで「公開マスト期日」（絶対に動かせない日）を設定。公開目安とは別日で持てる。"}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 -mx-1 outline-none cursor-pointer transition-colors",
          value
            ? "text-red-500 hover:text-red-600"
            : "text-slate-300 opacity-0 transition-opacity hover:text-slate-500 group-hover:opacity-100"
        )}
      >
        <Pin size={13} fill={value ? "currentColor" : "none"} className="shrink-0" />
        {value && <span className="text-xs font-medium">{value}</span>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-[60]">
          <Menu.Popup className={cn(menuPopupClasses, "p-3 min-w-[220px]")}>
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs font-medium text-slate-500">公開マスト期日</span>
              <input
                type="date"
                value={draftValue ?? ""}
                onChange={(e) => setDraftValue(e.target.value || null)}
                className="h-8 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#4a9eff]"
              />
              <div className="flex items-center justify-between">
                {draftValue ? (
                  <button
                    type="button"
                    onClick={() => setDraftValue(null)}
                    className="text-left text-xs text-slate-500 hover:text-red-500"
                  >
                    クリア
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-md bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-400 cursor-pointer"
                >
                  適用
                </button>
              </div>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// 公開目安（上段）と公開マスト期日（下段）を1セルにまとめたセル。
// マスト期日が未設定の行は上段だけになるので、一覧の行高は今までと変わらない。
function ReleaseDateCell({
  project,
  onUpdateField,
}: {
  project: Project;
  onUpdateField: (id: string, patch: Partial<Project>) => void;
}) {
  const mustDateCell = (
    <MustDateCell
      value={project.must_date}
      onChange={(v) => onUpdateField(project.id, { must_date: v })}
    />
  );

  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1">
        <span className="min-w-0 flex-1">
          <InlineDateCell
            value={project.target_date}
            tentative={project.target_date_tentative}
            onChange={(v, tentative) => onUpdateField(project.id, { target_date: v, target_date_tentative: tentative })}
          />
        </span>
        {!project.must_date && mustDateCell}
      </span>
      {project.must_date && mustDateCell}
    </span>
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
  onTogglePetit,
  onUpdateField,
  onPhasesChange,
  members,
  dragDisabled = false,
  displayNo,
}: {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePriority?: () => void;
  onTogglePetit?: () => void;
  onUpdateField: (id: string, patch: Partial<Project>) => void;
  onPhasesChange?: () => void;
  members: Member[];
  dragDisabled?: boolean;
  // 表示用の連番（1始まり）。渡されると # 列に DB の priority ではなくこの値を表示する。
  displayNo?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: dragDisabled });

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
        {dragDisabled ? (
          <span className="text-slate-200" title="優先度順のときだけ並び替えできます">⠿</span>
        ) : (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
            title="ドラッグして並び替え"
          >
            ⠿
          </span>
        )}
      </td>
      <td className="w-10 py-3 px-4 text-center font-mono text-xs text-slate-500">
        {project.priority_undecided ? "-" : displayNo ?? project.priority}
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
      <td className="w-36 py-3 px-4 text-sm text-body whitespace-nowrap">
        <ReleaseDateCell project={project} onUpdateField={onUpdateField} />
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
      <td className="w-24 py-3 pl-6 pr-2 whitespace-nowrap">
        <ApprovalCell project={project} onUpdateField={onUpdateField} />
      </td>
      <td className="py-3 px-4 text-xs text-body whitespace-pre-wrap break-words w-[200px] max-w-[200px]">
        <InlineNotesCell
          value={project.notes ?? ""}
          onSave={(text) => onUpdateField(project.id, { notes: text || null })}
        />
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
      onTogglePetit={onTogglePetit}
      petitLabel={project.is_petit_improvement ? "プチ改善から戻す" : "プチ改善に移動"}
    />
    {isExpanded && (
      <tr>
        <td colSpan={13} className="p-0">
          <PhasePanel projectId={project.id} project={project} members={members} directorId={project.director_id} designerId={project.designer_id} engineerId={project.engineer_id} onPhasesChange={onPhasesChange} />
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
  onTogglePetit,
  onUpdateField,
  onPhasesChange,
  hidePriority,
  hideSize,
  showProposedDate,
  showPetitBadge,
  members,
  sortable,
}: {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePetit?: () => void;
  onUpdateField: (id: string, patch: Partial<Project>) => void;
  onPhasesChange?: () => void;
  hidePriority?: boolean;
  hideSize?: boolean;
  showProposedDate?: boolean;
  showPetitBadge?: boolean;
  members: Member[];
  // ドラッグ並び替え対応（プチ改善ビューなどで使用）。渡されると先頭にドラッグハンドル列を表示する。
  sortable?: {
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown> | undefined;
    isDragging: boolean;
  };
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
    <tr
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={cn(
        "group transition-colors hover:bg-gray-50",
        sortable?.isDragging && "relative z-10 bg-white shadow-md"
      )}
      onContextMenu={handleContextMenu}
    >
      {sortable && (
        <td className="w-8 py-3 px-2 text-center">
          <span
            {...sortable.attributes}
            {...sortable.listeners}
            className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
            title="ドラッグして並び替え"
          >
            ⠿
          </span>
        </td>
      )}
      {!hidePriority && (
        <td className="w-10 py-3 px-4 text-center font-mono text-xs text-slate-500">
          {project.priority_undecided ? "-" : project.priority}
        </td>
      )}
      <td className="min-w-[240px] py-3 px-4 text-sm text-slate-900 cursor-pointer" onClick={onToggle}>
        <span className="flex items-center gap-1 group/title">
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {showPetitBadge && project.is_petit_improvement && (
            <span className="inline-flex shrink-0 text-violet-500" data-tooltip="プチ改善から公開された施策">
              <Sparkles size={14} />
            </span>
          )}
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
      <td className="w-36 py-3 px-4 text-sm text-body whitespace-nowrap">
        <ReleaseDateCell project={project} onUpdateField={onUpdateField} />
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
        <InlineNotesCell
          value={project.notes ?? ""}
          onSave={(text) => onUpdateField(project.id, { notes: text || null })}
        />
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
      onTogglePetit={onTogglePetit}
      petitLabel={project.is_petit_improvement ? "プチ改善から戻す" : "プチ改善に移動"}
    />
    {isExpanded && (
      <tr>
        <td colSpan={sortable ? 10 : 9} className="p-0">
          <PhasePanel projectId={project.id} project={project} members={members} directorId={project.director_id} designerId={project.designer_id} engineerId={project.engineer_id} onPhasesChange={onPhasesChange} />
        </td>
      </tr>
    )}
    </>
  );
});

// プチ改善ビューでドラッグ並び替えするための ProjectRow ラッパー。
// useSortable は DndContext 内でのみ呼ぶため、通常の ProjectRow とは分離している。
const SortableProjectRow = memo(function SortableProjectRow(
  props: React.ComponentProps<typeof ProjectRow>
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.project.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <ProjectRow
      {...props}
      sortable={{
        setNodeRef,
        style,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as Record<string, unknown> | undefined,
        isDragging,
      }}
    />
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
  // 優先度順ビューの並び替え。priority=本来の優先度順（D&D可）、target_date=公開目安日順
  const [sortKey, setSortKey] = useState<"priority" | "target_date">("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const isPrioritySort = sortKey === "priority";

  // 公開目安ヘッダーをクリックしたとき：target_date 昇順 → 降順 → 優先度順に戻る
  const toggleTargetDateSort = useCallback(() => {
    if (sortKey !== "target_date") {
      setSortKey("target_date");
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey("priority");
    }
  }, [sortKey, sortDir]);

  const resetToPrioritySort = useCallback(() => setSortKey("priority"), []);

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

  // プチ改善フラグ付き施策は通常の一覧（優先度順/Eng別/事業別/ガント/公開済み）から外し、
  // 専用のプチ改善ビューに集約する。
  // 公開済み（完了）とそれ以外を分離
  const activeProjects = useMemo(() => projects.filter((p) => p.status !== "完了" && !p.is_petit_improvement && filterProject(p)), [projects, filterProject]);
  const decidedProjects = useMemo(() => activeProjects.filter((p) => !p.priority_undecided), [activeProjects]);
  const undecidedProjects = useMemo(() => activeProjects.filter((p) => p.priority_undecided), [activeProjects]);

  // 表示用の決定済みリスト。target_date 並び替え時は公開目安日でソート（未設定は末尾）
  const displayedDecidedProjects = useMemo(() => {
    if (isPrioritySort) return decidedProjects;
    const sorted = [...decidedProjects].sort((a, b) => {
      if (!a.target_date && !b.target_date) return 0;
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return a.target_date.localeCompare(b.target_date);
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [decidedProjects, isPrioritySort, sortDir]);

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

  // 公開済み（完了）は通常施策・プチ改善施策の両方を含める。
  // プチ改善由来のものは公開済みビューで紫のプチ改善アイコンを付けて区別する。
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

  // プチ改善ビュー：未完了のプチ改善バックログのみ（完了したものは公開済みビューへ卒業）。優先度順。
  const petitProjects = useMemo(() =>
    [...projects.filter((p) => p.is_petit_improvement && p.status !== "完了" && filterProject(p))]
      .sort((a, b) => a.priority - b.priority),
    [projects, filterProject]
  );

  // エンジニア別グルーピング（施策の engineer で分類、未割当は末尾）
  // 各グループ内は activeProjects の順（=優先度順）を維持
  const engineerGroups = useMemo(() => {
    const map = new Map<string, { name: string; items: Project[] }>();
    for (const p of activeProjects) {
      const key = p.engineer_id ?? "__none__";
      const name = p.engineer?.display_name ?? "未割当";
      if (!map.has(key)) map.set(key, { name, items: [] });
      map.get(key)!.items.push(p);
    }
    // タスク数の多い順。未割当は末尾。同数は名前順
    return [...map.values()].sort((a, b) => {
      if (a.name === "未割当") return 1;
      if (b.name === "未割当") return -1;
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [activeProjects]);

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

    // プチ改善タスクは通常の優先度順一覧に載らないため、既存の priority はずらさない
    if (!formData.is_petit_improvement) {
      // 既存の決定済み施策の priority を +1 してずらす
      const decided = projects.filter((p) => !p.priority_undecided && p.status !== "完了");
      for (const p of decided) {
        await supabase.from("projects").update({ priority: p.priority + 1 } as never).eq("id", p.id);
      }
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
      must_date: formData.must_date || null,
      is_petit_improvement: formData.is_petit_improvement,
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
        must_date: formData.must_date || null,
        is_petit_improvement: formData.is_petit_improvement,
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
      must_date: project.must_date,
      is_petit_improvement: project.is_petit_improvement,
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

  // プチ改善フラグの付け外し。付けると通常一覧から外れ、プチ改善ビューへ集約される。
  const handleTogglePetit = useCallback(async (project: Project) => {
    await supabase
      .from("projects")
      .update({ is_petit_improvement: !project.is_petit_improvement } as never)
      .eq("id", project.id);
    await reload();
  }, [supabase, reload]);

  // プチ改善ビューのD&D完了時：並び順を priority に反映して保存。
  // メイン一覧とは独立させるため、プチ改善施策が元々持つ priority 値を昇順スロットとして
  // 新しい並び順へ再割り当てする（メイン一覧の priority には手を付けない）。
  const handlePetitDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = [...petitProjects];
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, moved);

    const slots = petitProjects.map((p) => p.priority).sort((a, b) => a - b);
    const reordered = items.map((p, i) => ({ ...p, priority: slots[i] }));

    // 楽観的更新
    const reorderedById = new Map(reordered.map((p) => [p.id, p]));
    setProjects((prev) => prev.map((p) => reorderedById.get(p.id) ?? p));

    // priority が変わった行だけ保存
    const changed = reordered.filter((p) => {
      const orig = petitProjects.find((o) => o.id === p.id);
      return orig && orig.priority !== p.priority;
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
  // 優先度順テーブルのヘッダーをスクロール追従させる。
  // 上にグローバルヘッダー(45px) + ビュー切替バー(約60px) があるので top を 105px に。
  const stickyTh = "sticky top-[105px] z-[12] bg-gray-50";

  // sticky=true で優先度順ビュー（1本の長い表）用にヘッダー追従。
  // グループ表示（Eng別など）は小さい表が積み重なるので sticky を外す。
  const priorityTableHead = (sticky = true) => {
    const th = sticky ? stickyTh : "bg-gray-50";
    return (
    <thead>
      <tr className={theadClasses}>
        <th scope="col" className={cn("w-8 py-3 px-2", th)}></th>
        <th scope="col" className={cn("w-10 py-3 px-4 text-center text-xs font-medium text-slate-500", th)}>
          <button
            type="button"
            onClick={resetToPrioritySort}
            className={cn("cursor-pointer hover:text-slate-700", isPrioritySort && "text-slate-900 font-semibold")}
            title="優先度順に並べる（リセット）"
          >
            #{isPrioritySort && " ▼"}
          </button>
        </th>
        <th scope="col" className={cn("w-10 min-[1500px]:w-36 py-3 px-2 min-[1500px]:px-4 text-left text-xs font-medium text-slate-500", th)}><span className="hidden min-[1500px]:inline">事業</span></th>
        <th scope="col" className={cn("min-w-[240px] py-3 px-4 text-left text-xs font-medium text-slate-500", th)}>タイトル</th>
        <th scope="col" className={cn("w-36 py-3 px-4 text-left text-xs font-medium text-slate-500", th)}>
          <button
            type="button"
            onClick={toggleTargetDateSort}
            className={cn("inline-flex items-center gap-1 cursor-pointer hover:text-slate-700", sortKey === "target_date" && "text-slate-900 font-semibold")}
            title="公開目安日で並び替え（昇順→降順→優先度順）"
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="flex items-center gap-1">
                公開目安
                {sortKey === "target_date"
                  ? (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                  : <ArrowUpDown size={12} className="opacity-40" />}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] font-normal text-red-400">
                <Pin size={9} fill="currentColor" />
                ＝動かせない日
              </span>
            </span>
          </button>
        </th>
        <th scope="col" className={cn("w-24 py-3 px-4 text-left text-xs font-medium text-slate-500", th)}>Dir</th>
        <th scope="col" className={cn("w-24 py-3 px-4 text-left text-xs font-medium text-slate-500", th)}>Des</th>
        <th scope="col" className={cn("w-24 py-3 px-4 text-left text-xs font-medium text-slate-500", th)}>Eng</th>
        <th scope="col" className={cn("w-24 py-3 px-4 text-left text-xs font-medium text-slate-500", th)}>状態</th>
        <th scope="col" className={cn("w-8 py-3 px-2", th)}></th>
        <th scope="col" className={cn("w-24 py-3 pl-6 pr-2 text-left text-xs font-medium text-slate-500", th)} data-tooltip="須川さんのレビューが必要なゲート（W=WFレビュー / デ=デザインレビュー / 公=公開前レビュー）。青=要レビュー（須川さん待ち）／クリックで巡回：青=未対応 → グレー=完了 → 濃いグレー=不要">
          <span className="flex flex-col leading-tight">
            <span>要承認</span>
            <span className="text-[10px] font-normal text-[#4a9eff]">青=要確認</span>
          </span>
        </th>
        <th scope="col" className={cn("py-3 px-4 text-left text-xs font-medium text-slate-500", th)}>備考</th>
        <th scope="col" className={cn("w-10 py-3 px-2", th)}></th>
      </tr>
    </thead>
    );
  };

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
              onClick={() => setViewMode("petit")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                viewMode === "petit"
                  ? "bg-white text-slate-900 shadow-md shadow-black/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <Sparkles size={14} />
              プチ改善
            </button>
            <button
              onClick={() => setViewMode("engineer")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                viewMode === "engineer"
                  ? "bg-white text-slate-900 shadow-md shadow-black/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              Eng別
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
          {/* 決定済みカード（ヘッダー sticky のため overflow-clip。hidden だと sticky が効かない） */}
          <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-clip">
            <table className="w-full text-sm">
              {priorityTableHead()}
              {activeProjects.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-base text-slate-500">
                      施策がまだありません。「新規作成」から追加してください。
                    </td>
                  </tr>
                </tbody>
              ) : decidedProjects.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-sm text-slate-500">
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
                    items={displayedDecidedProjects.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody className="divide-y divide-slate-100">
                      {displayedDecidedProjects.map((project, index) => (
                        <SortableRow
                          key={project.id}
                          project={project}
                          displayNo={index + 1}
                          isExpanded={expandedProjectId === project.id}
                          onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                          onEdit={() => setEditingProject(project)}
                          onDuplicate={() => handleDuplicate(project)}
                          onDelete={() => handleDelete(project.id)}
                          onTogglePriority={() => handleTogglePriority(project)}
                          onTogglePetit={() => handleTogglePetit(project)}
                          onUpdateField={handleUpdateField}
                          onPhasesChange={reloadPhaseAssignees}
                          members={members}
                          dragDisabled={!isPrioritySort}
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
            <div className="bg-white rounded-xl border border-amber-200 shadow-xl shadow-black/20 overflow-clip">
              <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <h3 className="text-sm font-semibold text-amber-900">優先順位 未決定</h3>
                </div>
                <span className="text-xs text-amber-700">{undecidedProjects.length}件</span>
              </div>
              <table className="w-full text-sm">
                {priorityTableHead()}
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
                          onTogglePetit={() => handleTogglePetit(project)}
                          onUpdateField={handleUpdateField}
                          onPhasesChange={reloadPhaseAssignees}
                          members={members}
                          dragDisabled={!isPrioritySort}
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
                            <th scope="col" className="w-36 py-3 px-4 text-left text-xs font-medium text-slate-500">公開目安</th>
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
                              onTogglePetit={() => handleTogglePetit(project)}
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

      {/* Eng別ビュー（列構成は優先度順と同じ。エンジニアでグルーピング、ドラッグ並び替えは無効） */}
      {viewMode === "engineer" && (
        <div className="space-y-6">
          {engineerGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 px-4 py-16 text-center text-base text-slate-500">
              施策がありません。
            </div>
          ) : (
            engineerGroups.map((group) => (
              <div
                key={group.name}
                className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden"
              >
                <div className="flex items-center gap-2 border-b border-slate-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                  <span className="text-xs text-slate-500">{group.items.length}件</span>
                </div>
                <table className="w-full text-sm">
                  {priorityTableHead(false)}
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((project) => (
                      <SortableRow
                        key={project.id}
                        project={project}
                        isExpanded={expandedProjectId === project.id}
                        onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                        onEdit={() => setEditingProject(project)}
                        onDuplicate={() => handleDuplicate(project)}
                        onDelete={() => handleDelete(project.id)}
                        onTogglePetit={() => handleTogglePetit(project)}
                        onUpdateField={handleUpdateField}
                        onPhasesChange={reloadPhaseAssignees}
                        members={members}
                        dragDisabled
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
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
                    onTogglePetit={() => handleTogglePetit(project)}
                    onUpdateField={handleUpdateField}
                    onPhasesChange={reloadPhaseAssignees}
                    hidePriority
                    showProposedDate
                    showPetitBadge
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
          <GanttChart projects={activeProjects} members={members} filterMemberId={filterMemberId} />
        </Suspense>
      )}

      {/* プチ改善ビュー */}
      {viewMode === "petit" && (
        <div className="space-y-4">
          {/* 取り組みの説明バナー */}
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-violet-900">プチ改善</h3>
              <span className="text-xs text-violet-700">{petitProjects.length}件</span>
              <Link
                href="/petit-improvement"
                className="ml-auto flex items-center gap-1 rounded-md border border-violet-300 bg-white/60 px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-white"
              >
                <TrendingUp size={13} />
                増減の推移
              </Link>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-violet-800/80">
              メイン開発の裏で後回しになりがちな「小さな修正・改善」を少しずつ消化する枠。
              1日30分を目安に、隔週でアサインを決めて気軽に進めます。
              施策の編集または行メニューの「プチ改善に移動」でここに集約できます。
            </p>
          </div>

          <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className={theadClasses}>
                  <th scope="col" className="w-8 py-3 px-2"></th>
                  <th scope="col" className="min-w-[240px] py-3 px-4 text-left text-xs font-medium text-slate-500">タイトル</th>
                  <th scope="col" className="w-36 py-3 px-4 text-left text-xs font-medium text-slate-500">公開目安</th>
                  <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Dir</th>
                  <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Des</th>
                  <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">Eng</th>
                  <th scope="col" className="w-24 py-3 px-4 text-left text-xs font-medium text-slate-500">状態</th>
                  <th scope="col" className="w-8 py-3 px-2"></th>
                  <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-slate-500">備考</th>
                  <th scope="col" className="w-10 py-3 px-2"></th>
                </tr>
              </thead>
              {petitProjects.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-base text-slate-500">
                      プチ改善タスクはまだありません。施策の編集または行メニューの「プチ改善に移動」で追加できます。
                    </td>
                  </tr>
                </tbody>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handlePetitDragEnd}
                >
                  <SortableContext
                    items={petitProjects.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody className="divide-y divide-slate-100">
                      {petitProjects.map((project) => (
                        <SortableProjectRow
                          key={project.id}
                          project={project}
                          isExpanded={expandedProjectId === project.id}
                          onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                          onEdit={() => setEditingProject(project)}
                          onDuplicate={() => handleDuplicate(project)}
                          onDelete={() => handleDelete(project.id)}
                          onTogglePetit={() => handleTogglePetit(project)}
                          onUpdateField={handleUpdateField}
                          onPhasesChange={reloadPhaseAssignees}
                          hidePriority
                          hideSize
                          members={members}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              )}
            </table>
          </div>
        </div>
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
