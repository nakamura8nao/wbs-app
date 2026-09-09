"use client";

import { useState, useCallback, useMemo, useRef, memo, Fragment, lazy, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectDialog } from "@/components/project-dialog";
import { ProgressIcon } from "@/components/progress-icon";
import { PhasePanel } from "@/components/phase-panel";
import { NotesContent } from "@/components/notes-content";
import { ChevronDown, ChevronRight, ExternalLink, EllipsisVertical, Pencil, Copy, Trash2, Pin, Sparkles, FlaskConical, TrendingUp, Rocket, Repeat, Lightbulb, Target, CalendarClock, Plus, ChartGantt } from "lucide-react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
const GanttChart = lazy(() => import("@/components/gantt-chart").then((m) => ({ default: m.GanttChart })));
import { STATUS_OPTIONS, PROGRESS_OPTIONS, TRACK_OPTIONS, INVESTMENT_PROGRAM_SOFT_LIMIT } from "@/lib/constants";
import type { Track } from "@/lib/constants";
import { InvestmentProgramDialog } from "@/components/investment-program-dialog";
import type { Project, Member, ProjectFormData, InvestmentProgram, InvestmentProgramFormData } from "@/lib/types/models";
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
  initialInvestmentPrograms: InvestmentProgram[];
  members: Member[];
};

// investment / improvement / idea は施策の3分類（MECE）ビュー。
// petit / ab は運用上の受け皿、released は公開済みの記録。
type ViewMode = "investment" | "improvement" | "petit" | "ab" | "released" | "idea";

// タブの並び。「取り組み中の4本 ｜ 公開済み ｜ アイデア」の3ブロックで、
// ブロックの切れ目に区切り線を入れる。
type TabDef = {
  key: ViewMode;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title?: string;
};

const VIEW_TAB_GROUPS: TabDef[][] = [
  [
    { key: "investment", label: "投資", icon: Rocket, title: "新規投資・構造改革：将来のリターンを狙って大きな工数を投じる施策" },
    { key: "improvement", label: "改善", icon: Repeat, title: "継続改善・運用強化：既存機能の価値を高め、日々の成果や業務効率を底上げする施策" },
    { key: "petit", label: "プチ改善", icon: Sparkles, title: "投資・改善施策と並行して進めるサブタスク" },
    { key: "ab", label: "ABテスト", icon: FlaskConical, title: "リリース前にABテストで効果を検証する施策" },
  ],
  [{ key: "released", label: "公開済み", title: "公開（完了）した施策" }],
  [{ key: "idea", label: "アイデア", icon: Lightbulb, title: "実施が未確定の検討案や、将来的な施策の候補" }],
];

// 並び替えスロット。同じ priority が複数あると順序を表現できず、D&Dしても同じ値が
// 書き戻されて行が元に戻ってしまう。昇順に並べたうえで厳密な増加列に補正する（[1,1,1] → [1,2,3]）。
const ascendingSlots = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] <= sorted[i - 1]) sorted[i] = sorted[i - 1] + 1;
  }
  return sorted;
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
  onTogglePetit,
  petitLabel,
  onToggleAb,
  abLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: MenuAnchor | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePetit?: () => void;
  petitLabel?: string;
  onToggleAb?: () => void;
  abLabel?: string;
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
            {onTogglePetit && (
              <Menu.Item className={cn(menuItemClasses, "text-violet-600 data-highlighted:text-violet-700")} onClick={onTogglePetit}>
                <Sparkles size={14} />
                {petitLabel}
              </Menu.Item>
            )}
            {onToggleAb && (
              <Menu.Item className={cn(menuItemClasses, "text-teal-600 data-highlighted:text-teal-700")} onClick={onToggleAb}>
                <FlaskConical size={14} />
                {abLabel}
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

// YYYY-MM-DD 同士の日数差（end - start）
const diffDays = (start: string, end: string): number => {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const msPerDay = 86400000;
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / msPerDay);
};

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

// 通常の行（D&Dなし）。公開済みビューで使い、SortableProjectRow のベースにもなる。
const ProjectRow = memo(function ProjectRow({
  project,
  isExpanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onTogglePetit,
  onToggleAb,
  onUpdateField,
  onPhasesChange,
  hidePriority,
  hideProgress,
  showProposedDate,
  showPetitBadge,
  showAbBadge,
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
  onToggleAb?: () => void;
  onUpdateField: (id: string, patch: Partial<Project>) => void;
  onPhasesChange?: () => void;
  hidePriority?: boolean;
  // 公開済みビュー用。完了済みの行では進行状況（⏸/▶/✅）が意味を持たないので出さない
  hideProgress?: boolean;
  showProposedDate?: boolean;
  showPetitBadge?: boolean;
  showAbBadge?: boolean;
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

  // 展開パネルを表で全幅に伸ばすための列数。表示条件付きの列を足し引きして数える。
  // 固定列 = タイトル / 公開目安 / Dir / Des / Eng / 状態 / 備考 / ケバブ = 8
  const colCount =
    8 +
    (sortable ? 1 : 0) +
    (hidePriority ? 0 : 1) +
    (hideProgress ? 0 : 1) +
    (showProposedDate ? 2 : 0);

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
          {showAbBadge && project.is_ab_test && (
            <span className="inline-flex shrink-0 text-teal-500" data-tooltip="ABテストから公開された施策">
              <FlaskConical size={14} />
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
      {!hideProgress && (
        <td className="w-8 py-3 px-2 text-center text-sm">
          <InlineMenuCell
            value={project.progress}
            options={progressOptions}
            onChange={(v) => onUpdateField(project.id, { progress: v })}
          >
            <ProgressIcon value={project.progress} />
          </InlineMenuCell>
        </td>
      )}
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
      onToggleAb={onToggleAb}
      abLabel={project.is_ab_test ? "ABテストから戻す" : "ABテストに移動"}
    />
    {isExpanded && (
      <tr>
        <td colSpan={colCount} className="p-0">
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

// 投資ビューの塊（プロジェクト）カードをドラッグ並び替えするためのラッパー。
// カード内の施策テーブルは別の DndContext を持つので、掴む場所は見出しのハンドルだけに限定する。
function SortableProgramCard({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const dragHandle = (
    <span
      {...attributes}
      {...listeners}
      className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
      title="ドラッグしてプロジェクトを並び替え"
    >
      ⠿
    </span>
  );
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden",
        isDragging && "relative z-10 opacity-90"
      )}
    >
      {children(dragHandle)}
    </div>
  );
}

export function ProjectList({ initialProjects, initialPhaseAssignees, initialInvestmentPrograms, members }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [phaseAssignees, setPhaseAssignees] = useState(initialPhaseAssignees);
  const [investmentPrograms, setInvestmentPrograms] = useState(initialInvestmentPrograms);

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
  const [viewMode, setViewMode] = useState<ViewMode>("investment");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<InvestmentProgram | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  // ガントはタブ（施策の分類）とは別軸の見方なので、タブとは独立した表示トグルで持つ
  const [ganttOpen, setGanttOpen] = useState(false);
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

  // プチ改善／ABテストのフラグ付き施策は3分類ビュー（投資/改善/アイデア）から外し、
  // それぞれ専用タブに集約する。2つのフラグは排他運用（片方を立てるともう片方は下りる）。
  // 公開済み（完了）とそれ以外を分離
  const activeProjects = useMemo(() => projects.filter((p) => p.status !== "完了" && !p.is_petit_improvement && !p.is_ab_test && filterProject(p)), [projects, filterProject]);
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

  // ABテストビュー：未完了のABテスト施策のみ（完了したものは公開済みビューへ卒業）。優先度順。
  const abProjects = useMemo(() =>
    [...projects.filter((p) => p.is_ab_test && p.status !== "完了" && filterProject(p))]
      .sort((a, b) => a.priority - b.priority),
    [projects, filterProject]
  );

  // 3分類（投資/改善/アイデア）ビュー。母集団は activeProjects（未完了・プチ改善/ABテスト以外）。
  //   - 完了（公開済み）は「公開済み」タブへ卒業させる
  //   - プチ改善／ABテストはそれぞれの専用タブに集約したまま
  // これで各施策はどのタブにも高々1回しか現れない。
  const trackProjects = useMemo(() => {
    const map = new Map<Track, Project[]>(TRACK_OPTIONS.map((t) => [t.value, [] as Project[]]));
    for (const p of activeProjects) {
      (map.get(p.track as Track) ?? map.get("improvement")!).push(p);
    }
    // D&Dの並び替えスロット計算が priority 昇順を前提にするので、ここでそろえる
    for (const list of map.values()) list.sort((a, b) => a.priority - b.priority);
    return map;
  }, [activeProjects]);

  const investmentProjects = useMemo(() => trackProjects.get("investment") ?? [], [trackProjects]);
  const improvementProjects = useMemo(() => trackProjects.get("improvement") ?? [], [trackProjects]);
  const ideaProjects = useMemo(() => trackProjects.get("idea") ?? [], [trackProjects]);

  // 投資ビュー：塊（プロジェクト）ごとに施策をぶら下げる。塊が空でもカードは出す
  // （成功条件と期日を置く器なので、施策0件でも見えていた方がよい）。
  const investmentGroups = useMemo(() => {
    const groups = investmentPrograms.map((program) => ({ program, items: [] as Project[] }));
    const unassigned: Project[] = [];
    for (const p of investmentProjects) {
      const group = groups.find((g) => g.program.id === p.investment_program_id);
      if (group) group.items.push(p);
      else unassigned.push(p);
    }
    return { groups, unassigned };
  }, [investmentPrograms, investmentProjects]);

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

  const reloadInvestmentPrograms = useCallback(async () => {
    const { data } = await supabase
      .from("investment_programs")
      .select("*")
      .order("sort_order")
      .order("created_at");
    if (data) setInvestmentPrograms(data as InvestmentProgram[]);
  }, [supabase]);

  const handleCreateProgram = async (formData: InvestmentProgramFormData) => {
    const maxSort = investmentPrograms.reduce((max, p) => Math.max(max, p.sort_order), 0);
    await supabase.from("investment_programs").insert({
      name: formData.name,
      goal: formData.goal || null,
      target_period: formData.target_period || null,
      sort_order: maxSort + 1,
    } as never);
    await reloadInvestmentPrograms();
    setProgramDialogOpen(false);
  };

  const handleUpdateProgram = async (formData: InvestmentProgramFormData) => {
    if (!editingProgram) return;
    await supabase
      .from("investment_programs")
      .update({
        name: formData.name,
        goal: formData.goal || null,
        target_period: formData.target_period || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", editingProgram.id);
    await reloadInvestmentPrograms();
    setEditingProgram(null);
  };

  // 塊を消しても配下の施策は消さない（FK は on delete set null なので未割当に落ちる）
  const handleDeleteProgram = async (program: InvestmentProgram) => {
    const count = investmentProjects.filter((p) => p.investment_program_id === program.id).length;
    const message = count > 0
      ? `「${program.name}」を削除しますか？\n配下の施策${count}件は削除されず「未割当」に移動します。`
      : `「${program.name}」を削除しますか？`;
    if (!confirm(message)) return;
    await supabase.from("investment_programs").delete().eq("id", program.id);
    await Promise.all([reloadInvestmentPrograms(), reload()]);
  };

  const handleCreate = async (formData: ProjectFormData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // プチ改善／ABテストのタスクは専用タブに入るので、3分類タブ側の priority はずらさない
    if (!formData.is_petit_improvement && !formData.is_ab_test) {
      // 3分類タブに載る既存施策の priority を +1 してずらし、新規を先頭に置く
      const decided = projects.filter((p) => !p.priority_undecided && p.status !== "完了");
      for (const p of decided) {
        await supabase.from("projects").update({ priority: p.priority + 1 } as never).eq("id", p.id);
      }
    } else {
      // 新規のプチ改善／ABテストは priority=1（各タブの先頭）で入れる。同じタブの既存タスクが
      // 1 以下に居ると同値スロットになって並び替えできなくなるので、2 以上の増加列に押し出す。
      // 絞り込みに関係なく全タスクを対象にするため petitProjects / abProjects は使わない
      const inSameView = formData.is_ab_test
        ? (p: Project) => p.is_ab_test
        : (p: Project) => p.is_petit_improvement;
      const siblings = projects
        .filter((p) => inSameView(p) && p.status !== "完了")
        .sort((a, b) => a.priority - b.priority);
      let prev = 1;
      for (const p of siblings) {
        const next = Math.max(p.priority, prev + 1);
        if (next !== p.priority) {
          await supabase.from("projects").update({ priority: next } as never).eq("id", p.id);
        }
        prev = next;
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
      is_ab_test: formData.is_ab_test,
      track: formData.track,
      investment_program_id: formData.track === "investment" ? (formData.investment_program_id || null) : null,
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
        is_ab_test: formData.is_ab_test,
        track: formData.track,
        investment_program_id: formData.track === "investment" ? (formData.investment_program_id || null) : null,
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
      is_ab_test: project.is_ab_test,
      track: project.track,
      investment_program_id: project.investment_program_id,
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

  // プチ改善／ABテストのフラグ付け外し。付けると通常一覧から外れ、専用ビューへ集約される。
  // 2つのビューは排他なので、片方を立てるときにもう片方は必ず下ろす。
  // 移動時は priority をそのまま持ち込むが、移動先ビューの既存タスクと同値だと並び替えできない
  // スロットになるため、衝突したときだけ移動先ビューの末尾に置き直す。
  const toggleViewFlag = useCallback(async (project: Project, target: "petit" | "ab") => {
    const isPetit = target === "petit";
    const turningOn = isPetit ? !project.is_petit_improvement : !project.is_ab_test;
    const patch: { is_petit_improvement: boolean; is_ab_test: boolean; priority?: number } = {
      is_petit_improvement: isPetit ? turningOn : false,
      is_ab_test: isPetit ? false : turningOn,
    };
    if (turningOn) {
      const used = projects
        .filter((p) => (isPetit ? p.is_petit_improvement : p.is_ab_test) && p.status !== "完了" && p.id !== project.id)
        .map((p) => p.priority);
      if (used.includes(project.priority)) {
        patch.priority = Math.max(...used, project.priority) + 1;
      }
    }
    await supabase.from("projects").update(patch as never).eq("id", project.id);
    await reload();
  }, [supabase, reload, projects]);

  const handleTogglePetit = useCallback(
    (project: Project) => toggleViewFlag(project, "petit"),
    [toggleViewFlag]
  );
  const handleToggleAb = useCallback(
    (project: Project) => toggleViewFlag(project, "ab"),
    [toggleViewFlag]
  );

  // 各ビューのD&D完了時：並び順を priority に反映して保存。
  // ビューをまたいで影響しないよう、そのビュー（塊）の施策が元々持つ priority 値を
  // 昇順スロットとして新しい並び順へ再割り当てする（他の施策の priority には触らない）。
  const handleSubViewDragEnd = async (event: DragEndEvent, viewProjects: Project[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = [...viewProjects];
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, moved);

    const slots = ascendingSlots(viewProjects.map((p) => p.priority));
    const reordered = items.map((p, i) => ({ ...p, priority: slots[i] }));

    // 楽観的更新
    const reorderedById = new Map(reordered.map((p) => [p.id, p]));
    setProjects((prev) => prev.map((p) => reorderedById.get(p.id) ?? p));

    // priority が変わった行だけ保存
    const changed = reordered.filter((p) => {
      const orig = viewProjects.find((o) => o.id === p.id);
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

  const handlePetitDragEnd = (event: DragEndEvent) => handleSubViewDragEnd(event, petitProjects);
  const handleAbDragEnd = (event: DragEndEvent) => handleSubViewDragEnd(event, abProjects);
  // 3分類ビューの並び替え。母集団はメイン一覧と同じなので、そのビューが持つ priority 値の
  // 昇順スロットを詰め替える（他トラックの priority には触らない）。
  const handleImprovementDragEnd = (event: DragEndEvent) => handleSubViewDragEnd(event, improvementProjects);
  const handleIdeaDragEnd = (event: DragEndEvent) => handleSubViewDragEnd(event, ideaProjects);

  // 投資ビューの塊（プロジェクト）の並び替え。カードの表示順 = sort_order を 1..n で振り直す。
  const handleProgramDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = [...investmentPrograms];
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, moved);
    const reordered = items.map((p, i) => ({ ...p, sort_order: i + 1 }));

    // 楽観的更新（カードの並びは investmentPrograms の順で決まる）
    const previous = investmentPrograms;
    setInvestmentPrograms(reordered);

    const changed = reordered.filter(
      (p) => previous.find((o) => o.id === p.id)?.sort_order !== p.sort_order
    );
    if (changed.length > 0) {
      await Promise.all(
        changed.map((p) =>
          supabase
            .from("investment_programs")
            .update({ sort_order: p.sort_order, updated_at: new Date().toISOString() } as never)
            .eq("id", p.id)
        )
      );
    }
  };

  const theadClasses = "border-b border-slate-200 bg-gray-50";
  // 3分類ビュー（投資/改善/アイデア）の表ヘッダー。
  // 列順は ProjectRow の td と対応させる（drag → タイトル … 状態 → 進行 → 備考 → メニュー）。
  // 分類とプロジェクトは行に出さない（タブと塊の見出しで分かるので、行では冗長）。
  const trackTableHead = ({ drag = false }: { drag?: boolean }) => (
    <thead>
      <tr className={theadClasses}>
        {drag && <th scope="col" className="w-8 py-3 px-2"></th>}
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
  );

  // 投資ビューの施策テーブル。塊カード内と未割当カードで共用する。
  // 並び替えは塊の中だけで完結させたいので、DndContext はカードごとに独立させ、
  // 渡された items が持つ priority 値の昇順スロットを詰め替える（他の塊には触らない）。
  const investmentProjectTable = (items: Project[]) => (
    <table className="w-full text-sm">
      {trackTableHead({ drag: true })}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => handleSubViewDragEnd(event, items)}
      >
        <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <tbody className="divide-y divide-slate-100">
            {items.map((project) => (
              <SortableProjectRow
                key={project.id}
                project={project}
                isExpanded={expandedProjectId === project.id}
                onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                onEdit={() => setEditingProject(project)}
                onDuplicate={() => handleDuplicate(project)}
                onDelete={() => handleDelete(project.id)}
                onTogglePetit={() => handleTogglePetit(project)}
                onToggleAb={() => handleToggleAb(project)}
                onUpdateField={handleUpdateField}
                onPhasesChange={reloadPhaseAssignees}
                hidePriority
                members={members}
              />
            ))}
          </tbody>
        </SortableContext>
      </DndContext>
    </table>
  );

  return (
    <div>
      {/* ヘッダー + ビュー切替 */}
      <div className="sticky top-[45px] z-[15] mb-4" style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", width: "100vw", left: 0 }}>
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
        <div className="relative mx-auto flex max-w-[1600px] items-center justify-between px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex gap-0.5 rounded-xl bg-white/8 p-1 backdrop-blur-sm">
            {VIEW_TAB_GROUPS.map((group, groupIndex) => (
              <Fragment key={group[0].key}>
                {groupIndex > 0 && <span className="mx-1 my-1.5 w-px bg-white/10" />}
                {group.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setViewMode(tab.key);
                      setGanttOpen(false);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                      viewMode === tab.key && !ganttOpen
                        ? "bg-white text-slate-900 shadow-md shadow-black/10"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    )}
                    title={tab.title}
                  >
                    {tab.icon && <tab.icon size={14} />}
                    {tab.label}
                  </button>
                ))}
              </Fragment>
            ))}
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
        <div className="flex items-center gap-3">
          {/* ガントはタブとは別軸（施策の分類ではなく期間の見方）なので、
              タブ群から離してアウトライン表示のトグルとして置く */}
          <button
            onClick={() => setGanttOpen((prev) => !prev)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium rounded-lg border transition-all duration-200 cursor-pointer",
              ganttOpen
                ? "border-primary-400/60 bg-primary-500/20 text-primary-200"
                : "border-white/15 bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80"
            )}
            title="全施策を期間で見る（タブの分類とは別軸）"
            aria-pressed={ganttOpen}
          >
            <ChartGantt size={15} />
            ガント
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-400 shadow-lg shadow-primary-500/25 transition-all duration-200 cursor-pointer"
          >
            + 新規作成
          </button>
        </div>
        </div>
      </div>

      {/* 3分類ビュー：新規投資・構造改革（大きな塊 → 配下の施策） */}
      {/* ガント（タブとは独立。未完了の投資／改善／アイデアの施策を期間で見る） */}
      {ganttOpen && (
        <Suspense fallback={<div className="py-8 text-center text-sm text-white/30">読み込み中...</div>}>
          {/* 高さはページがスクロールしない範囲に収める（グローバルヘッダー45 + タブバー60 +
              余白64 = 約170px）。ページが縦スクロールすると、ガント内の日付ヘッダーが
              固定ヘッダーの裏に隠れて読めなくなるため。 */}
          <GanttChart
            projects={activeProjects}
            members={members}
            filterMemberId={filterMemberId}
            height="calc(100vh - 175px)"
          />
        </Suspense>
      )}

      {!ganttOpen && viewMode === "investment" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Rocket size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-amber-900">新規投資・構造改革</h3>
              <span className="text-xs text-amber-700">
                プロジェクト{investmentPrograms.length}件 / 施策{investmentProjects.length}件
              </span>
              <span className="text-xs text-amber-700/70">
                将来のリターン（インパクト）を狙って大きな工数を投じる施策
              </span>
              <button
                onClick={() => setProgramDialogOpen(true)}
                className="ml-auto flex items-center gap-1 rounded-md border border-amber-300 bg-white/60 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-white cursor-pointer"
              >
                <Plus size={13} />
                プロジェクトを追加
              </button>
            </div>
            {investmentPrograms.length > INVESTMENT_PROGRAM_SOFT_LIMIT && (
              <p className="mt-2 text-xs text-amber-800">
                プロジェクトが{INVESTMENT_PROGRAM_SOFT_LIMIT}個を超えています。塊が細かくなりすぎていないか見直しを。
              </p>
            )}
          </div>

          {investmentPrograms.length === 0 && investmentGroups.unassigned.length === 0 ? (
            <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 px-4 py-16 text-center text-base text-slate-500">
              「＋ プロジェクトを追加」で大きな塊を作り、施策の分類を「投資」にすると配下に並びます。
            </div>
          ) : (
            <div className="space-y-6">
              {/* 塊（プロジェクト）の並び替え。掴めるのは見出しのハンドルだけで、
                  施策行の並び替えはカードごとの内側の DndContext が受け持つ。 */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleProgramDragEnd}
              >
                <SortableContext
                  items={investmentGroups.groups.map((g) => g.program.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-6">
                    {investmentGroups.groups.map(({ program, items }) => (
                      <SortableProgramCard key={program.id} id={program.id}>
                        {(dragHandle) => (
                          <>
                            {/* 塊の見出し。成功条件（目的）と大まかな期日を常に表示する */}
                            <div className="border-b border-slate-200 bg-gray-50 px-4 py-3">
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 shrink-0">{dragHandle}</span>
                                <Rocket size={16} className="mt-1 shrink-0 text-amber-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h3 className="text-base font-bold text-slate-900">{program.name}</h3>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                                      <CalendarClock size={12} />
                                      {program.target_period || "期日未設定"}
                                    </span>
                                    <span className="text-xs text-slate-500">{items.length}件</span>
                                  </div>
                                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
                                    <Target size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                                    {program.goal ? (
                                      <span className="whitespace-pre-wrap">{program.goal}</span>
                                    ) : (
                                      <span className="text-slate-400">
                                        成功条件が未記入。「どうなったら成功と言えるか」を編集から入れる
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    onClick={() => setEditingProgram(program)}
                                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-gray-200 hover:text-slate-700 cursor-pointer"
                                    title="プロジェクトを編集"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProgram(program)}
                                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                    title="プロジェクトを削除（配下の施策は未割当に移動）"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {items.length === 0 ? (
                              <div className="px-4 py-4 text-sm text-slate-400">
                                施策なし。施策を編集して分類を「投資」にし、このプロジェクトを選ぶと配下に並びます。
                              </div>
                            ) : (
                              investmentProjectTable(items)
                            )}
                          </>
                        )}
                      </SortableProgramCard>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* プロジェクト未割当の投資施策。塊ではないので並び替えの対象外に置く */}
              {investmentGroups.unassigned.length > 0 && (
                <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-gray-50 px-4 py-3">
                    <h3 className="text-base font-bold text-slate-900">未割当</h3>
                    <span className="text-xs text-slate-500">{investmentGroups.unassigned.length}件</span>
                    <span className="text-xs text-slate-400">どのプロジェクトにも紐づいていない投資施策</span>
                  </div>
                  {investmentProjectTable(investmentGroups.unassigned)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3分類ビュー：継続改善・運用強化 / アイデア（どちらもフラットな1本の表） */}
      {!ganttOpen && (viewMode === "improvement" || viewMode === "idea") && (() => {
        const isIdea = viewMode === "idea";
        const items = isIdea ? ideaProjects : improvementProjects;
        const option = TRACK_OPTIONS.find((t) => t.value === (isIdea ? "idea" : "improvement"))!;
        const tone = isIdea
          ? { border: "border-slate-300", bg: "bg-slate-100", title: "text-slate-800", sub: "text-slate-600", icon: "text-slate-500" }
          : { border: "border-sky-200", bg: "bg-sky-50", title: "text-sky-900", sub: "text-sky-700", icon: "text-sky-500" };
        const Icon = isIdea ? Lightbulb : Repeat;
        return (
          <div className="space-y-4">
            <div className={cn("rounded-xl border px-5 py-3", tone.border, tone.bg)}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Icon size={16} className={tone.icon} />
                <h3 className={cn("text-sm font-semibold", tone.title)}>{option.label}</h3>
                <span className={cn("text-xs", tone.sub)}>{items.length}件</span>
                <span className={cn("text-xs opacity-70", tone.sub)}>{option.description}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
              <table className="w-full text-sm">
                {trackTableHead({ drag: true })}
                {items.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-base text-slate-500">
                        該当する施策はありません。施策を編集して分類を変えるとこのタブに入ります。
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={isIdea ? handleIdeaDragEnd : handleImprovementDragEnd}
                  >
                    <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((project) => (
                          <SortableProjectRow
                            key={project.id}
                            project={project}
                            isExpanded={expandedProjectId === project.id}
                            onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                            onEdit={() => setEditingProject(project)}
                            onDuplicate={() => handleDuplicate(project)}
                            onDelete={() => handleDelete(project.id)}
                            onTogglePetit={() => handleTogglePetit(project)}
                            onToggleAb={() => handleToggleAb(project)}
                            onUpdateField={handleUpdateField}
                            onPhasesChange={reloadPhaseAssignees}
                            hidePriority
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
        );
      })()}

      {/* 公開済みビュー */}
      {!ganttOpen && viewMode === "released" && (
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
                <th scope="col" className="w-10 py-3 px-2"></th>
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
                    onTogglePetit={() => handleTogglePetit(project)}
                    onToggleAb={() => handleToggleAb(project)}
                    onUpdateField={handleUpdateField}
                    onPhasesChange={reloadPhaseAssignees}
                    hidePriority
                    hideProgress
                    showProposedDate
                    showPetitBadge
                    showAbBadge
                    members={members}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* プチ改善ビュー */}
      {!ganttOpen && viewMode === "petit" && (
        <div className="space-y-4">
          {/* 見出し */}
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-violet-900">プチ改善</h3>
              <span className="text-xs text-violet-700">{petitProjects.length}件</span>
              <span className="text-xs text-violet-700/70">投資・改善施策と並行して進めるサブタスク</span>
              <Link
                href="/petit-improvement"
                className="ml-auto flex items-center gap-1 rounded-md border border-violet-300 bg-white/60 px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-white"
              >
                <TrendingUp size={13} />
                増減の推移
              </Link>
            </div>
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
                          onToggleAb={() => handleToggleAb(project)}
                          onUpdateField={handleUpdateField}
                          onPhasesChange={reloadPhaseAssignees}
                          hidePriority
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

      {/* ABテストビュー */}
      {!ganttOpen && viewMode === "ab" && (
        <div className="space-y-4">
          {/* 見出し */}
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <FlaskConical size={16} className="text-teal-500" />
              <h3 className="text-sm font-semibold text-teal-900">ABテスト</h3>
              <span className="text-xs text-teal-700">{abProjects.length}件</span>
            </div>
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
              {abProjects.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-base text-slate-500">
                      ABテスト施策はまだありません。施策の編集または行メニューの「ABテストに移動」で追加できます。
                    </td>
                  </tr>
                </tbody>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleAbDragEnd}
                >
                  <SortableContext
                    items={abProjects.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody className="divide-y divide-slate-100">
                      {abProjects.map((project) => (
                        <SortableProjectRow
                          key={project.id}
                          project={project}
                          isExpanded={expandedProjectId === project.id}
                          onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                          onEdit={() => setEditingProject(project)}
                          onDuplicate={() => handleDuplicate(project)}
                          onDelete={() => handleDelete(project.id)}
                          onTogglePetit={() => handleTogglePetit(project)}
                          onToggleAb={() => handleToggleAb(project)}
                          onUpdateField={handleUpdateField}
                          onPhasesChange={reloadPhaseAssignees}
                          hidePriority
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
        investmentPrograms={investmentPrograms}
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
        investmentPrograms={investmentPrograms}
        title="施策を編集"
        defaultValues={editingProject ?? undefined}
      />

      {/* 投資プロジェクト（大きな塊）の新規作成 / 編集 */}
      <InvestmentProgramDialog
        open={programDialogOpen}
        onOpenChange={setProgramDialogOpen}
        onSubmit={handleCreateProgram}
        title="プロジェクトを新規作成"
      />
      <InvestmentProgramDialog
        open={editingProgram !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProgram(null);
        }}
        onSubmit={handleUpdateProgram}
        title="プロジェクトを編集"
        defaultValues={editingProgram ?? undefined}
      />
    </div>
  );
}
