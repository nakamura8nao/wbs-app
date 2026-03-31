"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Member, Phase, PhaseFormData } from "@/lib/types/models";
import { isHoliday, getHolidayName } from "@/lib/holidays";
import { ProgressIcon } from "@/components/progress-icon";
import { PhaseForm } from "@/components/phase-panel";
import { MemberSelect } from "@/components/member-select";

type GanttPhase = Phase & {
  assignee?: Member | null;
};

type GanttProject = Project & {
  phases: GanttPhase[];
};

const DAY_WIDTH = 32;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 48;

// 時刻を 00:00:00 に正規化して日付だけの比較を正確にする
function normalizeDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = normalizeDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(a: Date, b: Date): number {
  const na = normalizeDate(a);
  const nb = normalizeDate(b);
  return Math.round((nb.getTime() - na.getTime()) / (1000 * 60 * 60 * 24));
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 今日を含む前後の範囲を計算
function calcRange(projects: GanttProject[]): { start: Date; end: Date } {
  const today = new Date();
  let minDate = addDays(today, -14);
  let maxDate = addDays(today, 60);

  for (const proj of projects) {
    for (const phase of proj.phases) {
      if (phase.start_date) {
        const d = parseDate(phase.start_date);
        if (d < minDate) minDate = addDays(d, -7);
      }
      if (phase.end_date) {
        const d = parseDate(phase.end_date);
        if (d > maxDate) maxDate = addDays(d, 7);
      }
    }
  }

  return { start: minDate, end: maxDate };
}

// 日付ヘッダー
function DateHeader({ start, totalDays }: { start: Date; totalDays: number }) {
  const months: { label: string; span: number; x: number }[] = [];
  const days: { label: string; x: number; isToday: boolean; isWeekend: boolean; isHoliday: boolean; holidayName?: string }[] = [];
  const today = toDateStr(new Date());

  let currentMonth = "";
  let monthStart = 0;
  let monthSpan = 0;

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const dateStr = toDateStr(d);
    const monthLabel = `${d.getFullYear()}/${d.getMonth() + 1}`;
    const dayOfWeek = d.getDay();

    if (monthLabel !== currentMonth) {
      if (currentMonth) {
        months.push({ label: currentMonth, span: monthSpan, x: monthStart });
      }
      currentMonth = monthLabel;
      monthStart = i;
      monthSpan = 0;
    }
    monthSpan++;

    days.push({
      label: `${d.getDate()}`,
      x: i,
      isToday: dateStr === today,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isHoliday: isHoliday(dateStr),
      holidayName: getHolidayName(dateStr),
    });
  }
  if (currentMonth) {
    months.push({ label: currentMonth, span: monthSpan, x: monthStart });
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-black/10" style={{ height: HEADER_HEIGHT }}>
      {/* 月 */}
      <div className="flex" style={{ height: HEADER_HEIGHT / 2 }}>
        {months.map((m) => (
          <div
            key={`${m.label}-${m.x}`}
            className="border-r border-black/5 text-xs font-medium text-black/60 px-1 flex items-center"
            style={{ width: m.span * DAY_WIDTH }}
          >
            {m.label}
          </div>
        ))}
      </div>
      {/* 日 */}
      <div className="flex" style={{ height: HEADER_HEIGHT / 2 }}>
        {days.map((d) => (
          <div
            key={d.x}
            className={cn(
              "border-r border-black/5 text-xs flex items-center justify-center",
              d.isToday ? "bg-[#4a9eff]/10 text-[#4a9eff] font-bold"
                : d.isHoliday ? "text-red-400 bg-red-50/50"
                : d.isWeekend ? "text-black/35 bg-black/[0.02]"
                : "text-black/50"
            )}
            style={{ width: DAY_WIDTH }}
            title={d.holidayName}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// 日付未設定のフェーズ行：ドラッグで日付を作成
function EmptyPhaseRow({
  phaseId,
  rangeStart,
  totalDays,
  onCreateDates,
}: {
  phaseId: string;
  rangeStart: Date;
  totalDays: number;
  onCreateDates: (phaseId: string, startDate: string, endDate: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const getDayFromX = (clientX: number): number => {
    if (!rowRef.current) return 0;
    const rect = rowRef.current.getBoundingClientRect();
    return Math.floor((clientX - rect.left) / DAY_WIDTH);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const day = getDayFromX(e.clientX);
    setDragging(true);
    setDragStart(day);
    setDragEnd(day);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!rowRef.current) return;
      const d = getDayFromX(ev.clientX);
      setDragEnd(d);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      const endDay = getDayFromX(ev.clientX);
      setDragging(false);

      if (dragStart !== null) {
        const startDay = Math.min(dragStart, endDay);
        const finalEnd = Math.max(dragStart, endDay);
        const startDate = toDateStr(addDays(rangeStart, startDay));
        const endDate = toDateStr(addDays(rangeStart, finalEnd));
        onCreateDates(phaseId, startDate, endDate);
      }
      setDragStart(null);
      setDragEnd(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const barLeft = dragging && dragStart !== null && dragEnd !== null
    ? Math.min(dragStart, dragEnd) * DAY_WIDTH
    : 0;
  const barWidth = dragging && dragStart !== null && dragEnd !== null
    ? (Math.abs(dragEnd - dragStart) + 1) * DAY_WIDTH
    : 0;

  return (
    <div
      ref={rowRef}
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
    >
      {dragging && barWidth > 0 && (
        <div
          className="absolute top-1 rounded-md bg-[#4a9eff]/30 border border-[#4a9eff]/50"
          style={{ left: barLeft, width: barWidth, height: ROW_HEIGHT - 8 }}
        />
      )}
    </div>
  );
}

// バー
function GanttBar({
  phase,
  rangeStart,
  onUpdate,
}: {
  phase: GanttPhase;
  rangeStart: Date;
  onUpdate: (phaseId: string, startDate: string, endDate: string) => void;
}) {
  const dragRef = useRef<{
    type: "move" | "resize-start" | "resize-end";
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const [tempOffset, setTempOffset] = useState({ startDelta: 0, endDelta: 0 });

  if (!phase.start_date || !phase.end_date) return null;

  const startDay = diffDays(rangeStart, parseDate(phase.start_date)) + tempOffset.startDelta;
  const endDay = diffDays(rangeStart, parseDate(phase.end_date)) + tempOffset.endDelta;
  const barWidth = Math.max((endDay - startDay + 1) * DAY_WIDTH, DAY_WIDTH);
  const barLeft = startDay * DAY_WIDTH;

  const statusColor = () => {
    switch (phase.status) {
      case "完了": return "bg-emerald-400";
      case "進行中": return "bg-[#4a9eff]";
      default: return "bg-black/20";
    }
  };

  const handleMouseDown = (e: React.MouseEvent, type: "move" | "resize-start" | "resize-end") => {
    e.preventDefault();
    e.stopPropagation();

    const origStart = diffDays(rangeStart, parseDate(phase.start_date!));
    const origEnd = diffDays(rangeStart, parseDate(phase.end_date!));

    dragRef.current = { type, startX: e.clientX, origStart, origEnd };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = Math.round((ev.clientX - dragRef.current.startX) / DAY_WIDTH);

      if (dragRef.current.type === "move") {
        setTempOffset({ startDelta: dx, endDelta: dx });
      } else if (dragRef.current.type === "resize-start") {
        const newStart = dragRef.current.origStart + dx;
        if (newStart <= dragRef.current.origEnd) {
          setTempOffset({ startDelta: dx, endDelta: 0 });
        }
      } else {
        const newEnd = dragRef.current.origEnd + dx;
        if (newEnd >= dragRef.current.origStart) {
          setTempOffset({ startDelta: 0, endDelta: dx });
        }
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        const finalStartDelta = dragRef.current.type === "resize-end" ? 0 : tempOffset.startDelta || Math.round((window.event ? 0 : 0));
        const finalEndDelta = dragRef.current.type === "resize-start" ? 0 : tempOffset.endDelta || 0;

        // Use the latest tempOffset via a trick: calculate from mouse position
        const currentX = dragRef.current.startX; // fallback
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      }
      dragRef.current = null;
    };

    // Better approach: use a ref for tracking
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = Math.round((ev.clientX - dragRef.current.startX) / DAY_WIDTH);

      let sd = 0, ed = 0;
      if (dragRef.current.type === "move") {
        sd = dx; ed = dx;
      } else if (dragRef.current.type === "resize-start") {
        if (dragRef.current.origStart + dx <= dragRef.current.origEnd) sd = dx;
      } else {
        if (dragRef.current.origEnd + dx >= dragRef.current.origStart) ed = dx;
      }
      setTempOffset({ startDelta: sd, endDelta: ed });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      if (dragRef.current) {
        // Read current offset from state won't work here, so recalculate
        // We'll use a simpler approach
      }
      dragRef.current = null;
    };

    // Simplify: track in a closure
    let latestSD = 0, latestED = 0;

    const moveHandler = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = Math.round((ev.clientX - dragRef.current.startX) / DAY_WIDTH);

      if (dragRef.current.type === "move") {
        latestSD = dx; latestED = dx;
      } else if (dragRef.current.type === "resize-start") {
        if (dragRef.current.origStart + dx <= dragRef.current.origEnd) { latestSD = dx; latestED = 0; }
      } else {
        if (dragRef.current.origEnd + dx >= dragRef.current.origStart) { latestSD = 0; latestED = dx; }
      }
      setTempOffset({ startDelta: latestSD, endDelta: latestED });
    };

    const upHandler = () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);

      if (dragRef.current) {
        const newStart = toDateStr(addDays(rangeStart, dragRef.current.origStart + latestSD));
        const newEnd = toDateStr(addDays(rangeStart, dragRef.current.origEnd + latestED));
        onUpdate(phase.id, newStart, newEnd);
      }
      dragRef.current = null;
      setTempOffset({ startDelta: 0, endDelta: 0 });
    };

    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
  };

  return (
    <div
      className={cn("absolute top-1 rounded-md flex items-center group/bar", statusColor())}
      style={{
        left: barLeft,
        width: barWidth,
        height: ROW_HEIGHT - 8,
      }}
    >
      {/* 左リサイズハンドル */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-l-md"
        onMouseDown={(e) => handleMouseDown(e, "resize-start")}
      />
      {/* 中央ドラッグ */}
      <div
        className="flex-1 h-full cursor-grab active:cursor-grabbing flex items-center justify-center overflow-hidden px-2"
        onMouseDown={(e) => handleMouseDown(e, "move")}
      >
        <span className="text-xs text-white font-medium truncate">
          {phase.name}
        </span>
      </div>
      {/* 右リサイズハンドル */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-r-md"
        onMouseDown={(e) => handleMouseDown(e, "resize-end")}
      />
    </div>
  );
}

export function GanttChart({
  projects: initialProjects,
  members,
}: {
  projects: Project[];
  members: Member[];
}) {
  const [ganttProjects, setGanttProjects] = useState<GanttProject[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(initialProjects.map((p) => p.id)));
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PhaseFormData | null>(null);
  const [addingForProjectId, setAddingForProjectId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<PhaseFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelScrollRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  const loadAllPhases = async () => {
    const projectIds = initialProjects.map((p) => p.id);
    if (projectIds.length === 0) {
      setGanttProjects([]);
      setLoading(false);
      return;
    }

    const { data: phases } = await supabase
      .from("phases")
      .select(`
        *,
        assignee:members!phases_assignee_id_fkey(id, display_name, role)
      `)
      .in("project_id", projectIds)
      .order("sort_order", { ascending: true });

    const gp = initialProjects.map((proj) => ({
      ...proj,
      phases: (phases ?? []).filter((ph: any) => ph.project_id === proj.id) as GanttPhase[],
    }));

    setGanttProjects(gp);
    setLoading(false);
  };

  useEffect(() => {
    loadAllPhases();
  }, [initialProjects]);

  // 左右の縦スクロールを同期
  useEffect(() => {
    const labelEl = labelScrollRef.current;
    const timelineEl = scrollRef.current;
    if (!labelEl || !timelineEl) return;

    let syncing = false;
    const syncLabel = () => {
      if (syncing) return;
      syncing = true;
      labelEl.scrollTop = timelineEl.scrollTop;
      syncing = false;
    };
    const syncTimeline = () => {
      if (syncing) return;
      syncing = true;
      timelineEl.scrollTop = labelEl.scrollTop;
      syncing = false;
    };

    timelineEl.addEventListener("scroll", syncLabel);
    labelEl.addEventListener("scroll", syncTimeline);
    return () => {
      timelineEl.removeEventListener("scroll", syncLabel);
      labelEl.removeEventListener("scroll", syncTimeline);
    };
  }, [loading, ganttProjects]);

  // 今日の位置にスクロール
  useEffect(() => {
    if (!loading && scrollRef.current && ganttProjects.length > 0) {
      const range = calcRange(ganttProjects);
      const todayOffset = diffDays(range.start, new Date());
      const scrollTo = Math.max(0, todayOffset * DAY_WIDTH - 200);
      scrollRef.current.scrollLeft = scrollTo;
    }
  }, [loading, ganttProjects]);

  const handleUpdatePhase = async (phaseId: string, startDate: string, endDate: string) => {
    await supabase
      .from("phases")
      .update({ start_date: startDate, end_date: endDate } as never)
      .eq("id", phaseId);
    await loadAllPhases();
  };

  const startEditPhase = (phase: GanttPhase) => {
    setEditingPhaseId(phase.id);
    setEditForm({
      name: phase.name,
      assignee_id: phase.assignee_id ?? "",
      start_date: phase.start_date ?? "",
      end_date: phase.end_date ?? "",
      status: phase.status,
      traditional_hours: phase.traditional_hours?.toString() ?? "",
      ai_target_hours: phase.ai_target_hours?.toString() ?? "",
      actual_hours: phase.actual_hours?.toString() ?? "",
      depends_on_phase_id: phase.dependencies?.[0]?.depends_on_phase_id ?? "",
    });
  };

  const handleSavePhase = async () => {
    if (!editingPhaseId || !editForm) return;

    await supabase
      .from("phases")
      .update({
        name: editForm.name,
        assignee_id: editForm.assignee_id || null,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        status: editForm.status,
        traditional_hours: editForm.traditional_hours ? parseFloat(editForm.traditional_hours) : null,
        ai_target_hours: editForm.ai_target_hours ? parseFloat(editForm.ai_target_hours) : null,
        actual_hours: editForm.actual_hours ? parseFloat(editForm.actual_hours) : null,
      } as never)
      .eq("id", editingPhaseId);

    // 依存関係を更新
    await supabase.from("phase_dependencies").delete().eq("phase_id", editingPhaseId);
    if (editForm.depends_on_phase_id) {
      await supabase.from("phase_dependencies").insert({
        phase_id: editingPhaseId,
        depends_on_phase_id: editForm.depends_on_phase_id,
      } as never);
    }

    setEditingPhaseId(null);
    setEditForm(null);
    await loadAllPhases();
  };

  const cancelEditPhase = () => {
    setEditingPhaseId(null);
    setEditForm(null);
  };

  const startAddPhase = (projectId: string) => {
    setAddingForProjectId(projectId);
    setEditingPhaseId(null);
    setEditForm(null);
    setAddForm({
      name: "",
      assignee_id: "",
      start_date: "",
      end_date: "",
      status: "未着手",
      traditional_hours: "",
      ai_target_hours: "",
      actual_hours: "",
      depends_on_phase_id: "",
    });
  };

  const handleAddPhase = async () => {
    if (!addingForProjectId || !addForm || !addForm.name.trim()) return;

    const proj = ganttProjects.find((p) => p.id === addingForProjectId);
    const maxOrder = proj ? proj.phases.reduce((max, p) => Math.max(max, p.sort_order), 0) : 0;

    await supabase.from("phases").insert({
      project_id: addingForProjectId,
      name: addForm.name,
      assignee_id: addForm.assignee_id || null,
      start_date: addForm.start_date || null,
      end_date: addForm.end_date || null,
      status: addForm.status,
      sort_order: maxOrder + 1,
      traditional_hours: addForm.traditional_hours ? parseFloat(addForm.traditional_hours) : null,
      ai_target_hours: addForm.ai_target_hours ? parseFloat(addForm.ai_target_hours) : null,
      actual_hours: addForm.actual_hours ? parseFloat(addForm.actual_hours) : null,
    } as never);

    setAddingForProjectId(null);
    setAddForm(null);
    await loadAllPhases();
  };

  const cancelAddPhase = () => {
    setAddingForProjectId(null);
    setAddForm(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="py-8 text-center text-xs text-black/40">読み込み中...</div>;
  }

  const range = calcRange(ganttProjects);
  const totalDays = diffDays(range.start, range.end) + 1;
  const todayOffset = diffDays(range.start, new Date());

  // 行データを構築
  const rows: { type: "project" | "phase"; project: GanttProject; phase?: GanttPhase }[] = [];
  for (const proj of ganttProjects) {
    rows.push({ type: "project", project: proj });
    if (expandedIds.has(proj.id)) {
      for (const phase of proj.phases) {
        rows.push({ type: "phase", project: proj, phase });
      }
    }
  }

  const LABEL_WIDTH = 280;

  return (
    <div className="overflow-hidden rounded-md border border-black/5 bg-white" style={{ height: "calc(100vh - 140px)" }}>
      <div className="flex h-full">
        {/* 左ラベル列 */}
        <div className="flex-shrink-0 border-r border-black/10 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ width: LABEL_WIDTH }} ref={labelScrollRef}>
          {/* ヘッダー */}
          <div className="sticky top-0 z-20 bg-white border-b border-black/10 flex items-center px-3 text-xs font-medium text-black/50" style={{ height: HEADER_HEIGHT }}>
            施策 / フェーズ
          </div>
          {/* 行ラベル */}
          {rows.map((row, i) => {
            const isEditing = row.type === "phase" && row.phase && editingPhaseId === row.phase.id;

            return (
              <div key={row.phase?.id ?? row.project.id}>
                <div
                  className={cn(
                    "flex items-center border-b border-black/5 px-3",
                    row.type === "project" ? "group/row hover:bg-blue-50/70 cursor-pointer" : "pl-8 hover:bg-blue-50/50 cursor-pointer",
                    isEditing && "bg-blue-50/70"
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onClick={
                    row.type === "project"
                      ? () => toggleExpand(row.project.id)
                      : () => {
                          if (isEditing) cancelEditPhase();
                          else startEditPhase(row.phase!);
                        }
                  }
                >
                  {row.type === "project" ? (
                    <span className="flex items-center gap-1 text-sm font-medium text-black/80 min-w-0">
                      <span className="shrink-0">{expandedIds.has(row.project.id) ? <ChevronDown size={13} className="text-black/40" /> : <ChevronRight size={13} className="text-black/40" />}</span>
                      <span className="flex-1 truncate">{row.project.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!expandedIds.has(row.project.id)) toggleExpand(row.project.id);
                          startAddPhase(row.project.id);
                        }}
                        className="shrink-0 opacity-0 group-hover/row:opacity-100 rounded px-1 text-[11px] text-[#4a9eff] hover:bg-[#4a9eff]/10"
                        title="フェーズを追加"
                      >
                        +
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-black/60 min-w-0">
                      <span className="shrink-0">
                        <ProgressIcon value={row.phase!.status === "完了" ? "done" : row.phase!.status === "進行中" ? "active" : "paused"} size={13} />
                      </span>
                      <span className="truncate">
                        {row.phase!.name}
                        {row.phase!.assignee?.display_name && (
                          <span className="ml-1.5 text-black/40">({row.phase!.assignee.display_name})</span>
                        )}
                      </span>
                    </span>
                  )}
                </div>
                {isEditing && editForm && (
                  <>
                  <div className="fixed inset-0 z-20 bg-black/20" onClick={cancelEditPhase} />
                  <div
                    className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl border border-black/10 rounded-lg shadow-xl bg-white px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 text-xs font-semibold text-black/50">フェーズ編集</div>
                    <PhaseForm
                      form={editForm}
                      setForm={(fn) => setEditForm((prev) => prev ? fn(prev) : prev)}
                      members={members}
                      phases={row.project.phases.filter((p) => p.id !== row.phase!.id)}
                      onSave={handleSavePhase}
                      onCancel={cancelEditPhase}
                      isEdit
                    />
                  </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 右タイムライン */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: totalDays * DAY_WIDTH, minHeight: "100%" }}>
            <DateHeader start={range.start} totalDays={totalDays} />

            {/* 行 */}
            <div className="relative">
              {/* グリッド背景 */}
              {Array.from({ length: totalDays }, (_, i) => {
                const d = addDays(range.start, i);
                const dateStr = toDateStr(d);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday = dateStr === toDateStr(new Date());
                const holiday = isHoliday(dateStr);
                return (
                  <div
                    key={i}
                    className={cn(
                      "absolute top-0 bottom-0 border-r border-black/5",
                      holiday ? "bg-red-50/40" : isWeekend ? "bg-black/[0.02]" : "",
                      isToday && "bg-[#4a9eff]/5"
                    )}
                    style={{ left: i * DAY_WIDTH, width: DAY_WIDTH, height: rows.length * ROW_HEIGHT }}
                  />
                );
              })}

              {/* 今日の線 */}
              <div
                className="absolute top-0 w-px bg-[#4a9eff]/50 z-10"
                style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2, height: rows.length * ROW_HEIGHT }}
              />

              {/* バー */}
              {rows.map((row, i) => (
                <div
                  key={row.phase?.id ?? row.project.id}
                  className="relative border-b border-black/5"
                  style={{ height: ROW_HEIGHT }}
                >
                  {row.type === "phase" && row.phase && row.phase.start_date && row.phase.end_date && (
                    <GanttBar
                      phase={row.phase}
                      rangeStart={range.start}
                      onUpdate={handleUpdatePhase}
                    />
                  )}
                  {row.type === "phase" && row.phase && !row.phase.start_date && !row.phase.end_date && (
                    <EmptyPhaseRow
                      phaseId={row.phase.id}
                      rangeStart={range.start}
                      totalDays={totalDays}
                      onCreateDates={handleUpdatePhase}
                    />
                  )}
                  {row.type === "project" && (
                    // プロジェクト行：フェーズの範囲をまとめて薄いバーで表示
                    (() => {
                      const phasesWithDates = row.project.phases.filter((p) => p.start_date && p.end_date);
                      if (phasesWithDates.length === 0) return null;
                      const minStart = phasesWithDates.reduce((min, p) => {
                        const d = parseDate(p.start_date!);
                        return d < min ? d : min;
                      }, parseDate(phasesWithDates[0].start_date!));
                      const maxEnd = phasesWithDates.reduce((max, p) => {
                        const d = parseDate(p.end_date!);
                        return d > max ? d : max;
                      }, parseDate(phasesWithDates[0].end_date!));
                      const left = diffDays(range.start, minStart) * DAY_WIDTH;
                      const width = (diffDays(minStart, maxEnd) + 1) * DAY_WIDTH;
                      return (
                        <div
                          className="absolute top-2 rounded bg-black/10"
                          style={{ left, width, height: ROW_HEIGHT - 16 }}
                        />
                      );
                    })()
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 新規追加モーダル */}
      {addingForProjectId && addForm && (
        <>
          <div className="fixed inset-0 z-20 bg-black/20" onClick={cancelAddPhase} />
          <div
            className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl border border-black/10 rounded-lg shadow-xl bg-white px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-xs font-semibold text-black/50">フェーズ追加</div>
            <PhaseForm
              form={addForm}
              setForm={(fn) => setAddForm((prev) => prev ? fn(prev) : prev)}
              members={members}
              phases={ganttProjects.find((p) => p.id === addingForProjectId)?.phases ?? []}
              onSave={handleAddPhase}
              onCancel={cancelAddPhase}
            />
          </div>
        </>
      )}
    </div>
  );
}
