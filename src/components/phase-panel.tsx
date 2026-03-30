"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MemberSelect } from "@/components/member-select";
import { ProgressIcon } from "@/components/progress-icon";
import { PHASE_STATUS_OPTIONS } from "@/lib/constants";
import type { Member, Phase, PhaseFormData } from "@/lib/types/models";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ArrowRight } from "lucide-react";

// role: "director" | "designer" | "engineer" で施策の担当者を自動割り当て
const DEFAULT_PHASES: { name: string; role?: "director" | "designer" | "engineer" }[] = [
  { name: "要求定義", role: "director" },
  { name: "要件定義（デザイン）", role: "designer" },
  { name: "要件定義（システム）", role: "engineer" },
  { name: "システム設計", role: "engineer" },
  { name: "システム実装", role: "engineer" },
  { name: "テスト仕様書作成", role: "engineer" },
  { name: "テスト実施", role: "director" },
  { name: "テスト修正", role: "engineer" },
  { name: "公開", role: "engineer" },
];

const EMPTY_FORM: PhaseFormData = {
  name: "",
  assignee_id: "",
  start_date: "",
  end_date: "",
  status: "未着手",
  traditional_hours: "",
  ai_target_hours: "",
  actual_hours: "",
  depends_on_phase_id: "",
};

function phaseToForm(phase: Phase): PhaseFormData {
  return {
    name: phase.name,
    assignee_id: phase.assignee_id ?? "",
    start_date: phase.start_date ?? "",
    end_date: phase.end_date ?? "",
    status: phase.status,
    traditional_hours: phase.traditional_hours?.toString() ?? "",
    ai_target_hours: phase.ai_target_hours?.toString() ?? "",
    actual_hours: phase.actual_hours?.toString() ?? "",
    depends_on_phase_id: phase.dependencies?.[0]?.depends_on_phase_id ?? "",
  };
}

export function PhasePanel({
  projectId,
  members,
  directorId,
  designerId,
  engineerId,
}: {
  projectId: string;
  members: Member[];
  directorId?: string | null;
  designerId?: string | null;
  engineerId?: string | null;
}) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form, setForm] = useState<PhaseFormData>(EMPTY_FORM);
  const insertingRef = useRef(false);

  const supabase = createClient();

  const loadPhases = async () => {
    const { data } = await supabase
      .from("phases")
      .select(`
        *,
        assignee:members!phases_assignee_id_fkey(id, display_name, role),
        dependencies:phase_dependencies!phase_dependencies_phase_id_fkey(depends_on_phase_id)
      `)
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    if (data) setPhases(data as Phase[]);
    setLoading(false);
    return data;
  };

  useEffect(() => {
    insertingRef.current = false;
    loadPhases().then(async (data) => {
      if (data && data.length === 0 && !insertingRef.current) {
        insertingRef.current = true;
        const roleToId = {
          director: directorId ?? null,
          designer: designerId ?? null,
          engineer: engineerId ?? null,
        };
        const rows = DEFAULT_PHASES.map((phase, i) => ({
          project_id: projectId,
          name: phase.name,
          assignee_id: phase.role ? roleToId[phase.role] : null,
          sort_order: i + 1,
          status: "未着手",
        }));
        await supabase.from("phases").insert(rows as never[]);
        await loadPhases();
      }
    });
  }, [projectId]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;

    const maxOrder = phases.reduce((max, p) => Math.max(max, p.sort_order), 0);

    const { data } = await supabase
      .from("phases")
      .insert({
        project_id: projectId,
        name: form.name,
        assignee_id: form.assignee_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        sort_order: maxOrder + 1,
        traditional_hours: form.traditional_hours ? parseFloat(form.traditional_hours) : null,
        ai_target_hours: form.ai_target_hours ? parseFloat(form.ai_target_hours) : null,
        actual_hours: form.actual_hours ? parseFloat(form.actual_hours) : null,
      } as never)
      .select()
      .single();

    if (data && form.depends_on_phase_id) {
      const inserted = data as { id: string };
      await supabase.from("phase_dependencies").insert({
        phase_id: inserted.id,
        depends_on_phase_id: form.depends_on_phase_id,
      } as never);
    }

    setForm(EMPTY_FORM);
    setAddingNew(false);
    await loadPhases();
  };

  const handleUpdate = async () => {
    if (!editingId || !form.name.trim()) return;

    await supabase
      .from("phases")
      .update({
        name: form.name,
        assignee_id: form.assignee_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        traditional_hours: form.traditional_hours ? parseFloat(form.traditional_hours) : null,
        ai_target_hours: form.ai_target_hours ? parseFloat(form.ai_target_hours) : null,
        actual_hours: form.actual_hours ? parseFloat(form.actual_hours) : null,
      } as never)
      .eq("id", editingId);

    // 依存関係を更新（一旦削除して再作成）
    await supabase
      .from("phase_dependencies")
      .delete()
      .eq("phase_id", editingId);

    if (form.depends_on_phase_id) {
      await supabase.from("phase_dependencies").insert({
        phase_id: editingId,
        depends_on_phase_id: form.depends_on_phase_id,
      } as never);
    }

    setEditingId(null);
    setForm(EMPTY_FORM);
    await loadPhases();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("phases").delete().eq("id", id);
    await loadPhases();
  };

  const startEdit = (phase: Phase) => {
    setEditingId(phase.id);
    setAddingNew(false);
    setForm(phaseToForm(phase));
  };

  const startAdd = () => {
    setAddingNew(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const cancel = () => {
    setEditingId(null);
    setAddingNew(false);
    setForm(EMPTY_FORM);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "完了": return "done";
      case "進行中": return "active";
      default: return "paused";
    }
  };

  if (loading) {
    return <div className="px-4 py-3 text-xs text-black/30">読み込み中...</div>;
  }

  return (
    <div className="border-t border-black/5 bg-[#f8f8fc]">
      {/* フェーズ一覧 */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-black/50">フェーズ</span>
          <button
            onClick={startAdd}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-[#4a9eff] hover:bg-[#4a9eff]/10 cursor-pointer"
          >
            <Plus size={12} />
            追加
          </button>
        </div>

        {phases.length === 0 && !addingNew && (
          <p className="py-2 text-xs text-black/30">フェーズがありません</p>
        )}

        {/* フェーズリスト */}
        <div className="space-y-0.5">
          {phases.map((phase) => {
            const depPhase = phase.dependencies?.[0]
              ? phases.find((p) => p.id === phase.dependencies![0].depends_on_phase_id)
              : null;

            if (editingId === phase.id) {
              return (
                <PhaseForm
                  key={phase.id}
                  form={form}
                  setForm={setForm}
                  members={members}
                  phases={phases.filter((p) => p.id !== phase.id)}
                  onSave={handleUpdate}
                  onCancel={cancel}
                  isEdit
                />
              );
            }

            return (
              <div
                key={phase.id}
                className="group grid items-center rounded-md px-2 py-1.5 hover:bg-black/[0.03] cursor-pointer"
                style={{ gridTemplateColumns: "20px 1fr 120px 80px 180px 160px 24px" }}
                onClick={() => startEdit(phase)}
              >
                <ProgressIcon value={statusIcon(phase.status)} size={14} />
                <span className="min-w-0 truncate text-sm text-black/80">
                  {phase.name}
                </span>
                <span className="flex items-center gap-1 text-xs text-black/60">
                  {depPhase && (
                    <>
                      <ArrowRight size={11} />
                      {depPhase.name}
                    </>
                  )}
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(phase.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* 新規追加フォーム */}
        {addingNew && (
          <PhaseForm
            form={form}
            setForm={setForm}
            members={members}
            phases={phases}
            onSave={handleAdd}
            onCancel={cancel}
          />
        )}
      </div>
    </div>
  );
}

export function PhaseForm({
  form,
  setForm,
  members,
  phases,
  onSave,
  onCancel,
  isEdit,
}: {
  form: PhaseFormData;
  setForm: (fn: (prev: PhaseFormData) => PhaseFormData) => void;
  members: Member[];
  phases: Phase[];
  onSave: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const inputClass =
    "h-7 rounded border border-black/10 bg-white px-2 text-xs text-black/80 outline-none focus:border-[#4a9eff]/50 focus:ring-1 focus:ring-[#4a9eff]/20";
  const dateInputClass =
    cn(inputClass, "w-full cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer");

  return (
    <div className="rounded-md border border-black/10 bg-white p-3 my-1 space-y-3">
      {/* 行1: フェーズ名 + ステータス */}
      <div className="flex gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="フェーズ名（例: デザイン、フロント実装）"
          className={cn(inputClass, "flex-1")}
          autoFocus
        />
        <select
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          className={cn(inputClass, "w-24 cursor-pointer")}
        >
          {PHASE_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* 行2: 担当者 + 依存先 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-black/40">担当者</label>
          <MemberSelect
            value={form.assignee_id}
            onChange={(v) => setForm((prev) => ({ ...prev, assignee_id: v }))}
            members={members}
            placeholder="未選択"
          />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-black/40">依存先フェーズ</label>
          <select
            value={form.depends_on_phase_id}
            onChange={(e) => setForm((prev) => ({ ...prev, depends_on_phase_id: e.target.value }))}
            className={cn(inputClass, "w-full cursor-pointer")}
          >
            <option value="">なし</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 行3: 期間 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-black/40">開始日</label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((prev) => ({
              ...prev,
              start_date: e.target.value,
              end_date: prev.end_date || e.target.value,
            }))}
            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
            className={dateInputClass}
          />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-black/40">終了日</label>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
            className={dateInputClass}
          />
        </div>
      </div>

      {/* 行4: 工数 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-black/40">従来想定(h)</label>
          <input
            type="number"
            value={form.traditional_hours}
            onChange={(e) => setForm((prev) => ({ ...prev, traditional_hours: e.target.value }))}
            placeholder="-"
            className={cn(inputClass, "w-full")}
            min={0}
            step={0.5}
          />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-black/40">AI目標(h)</label>
          <input
            type="number"
            value={form.ai_target_hours}
            onChange={(e) => setForm((prev) => ({ ...prev, ai_target_hours: e.target.value }))}
            placeholder="-"
            className={cn(inputClass, "w-full")}
            min={0}
            step={0.5}
          />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-black/40">実績(h)</label>
          <input
            type="number"
            value={form.actual_hours}
            onChange={(e) => setForm((prev) => ({ ...prev, actual_hours: e.target.value }))}
            placeholder="-"
            className={cn(inputClass, "w-full")}
            min={0}
            step={0.5}
          />
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded px-2.5 py-1 text-xs text-black/40 hover:bg-black/5 cursor-pointer"
        >
          キャンセル
        </button>
        <button
          onClick={onSave}
          disabled={!form.name.trim()}
          className="rounded bg-[#4a9eff] px-3 py-1 text-xs font-medium text-white hover:bg-[#3a8eef] disabled:opacity-50 cursor-pointer"
        >
          {isEdit ? "更新" : "追加"}
        </button>
      </div>
    </div>
  );
}
