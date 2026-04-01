"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemberSelect } from "@/components/member-select";
import {
  GROUP_LV1_OPTIONS,
  getGroupLv2Options,
  getGroupLv3Options,
  STATUS_OPTIONS,
  PROGRESS_OPTIONS,
  SIZE_OPTIONS,
} from "@/lib/constants";
import type { Project, Member, ProjectFormData } from "@/lib/types/models";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  members: Member[];
  title: string;
  defaultValues?: Project;
};

const EMPTY_FORM: ProjectFormData = {
  title: "",
  group_lv1: "",
  group_lv2: "",
  group_lv3: "",
  priority: 0,
  target_date: "",
  target_date_tentative: false,
  director_id: "",
  engineer_id: "",
  designer_id: "",
  status: "未着手",
  progress: "paused",
  size: "",
  notes: "",
};

function FormField({
  label,
  required,
  tooltip,
  children,
}: {
  label: string;
  required?: boolean;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 leading-normal">
      <Label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {tooltip && <span className="ml-1 inline-flex cursor-help text-slate-400" data-tooltip={tooltip}>?</span>}
      </Label>
      {children}
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm transition-colors outline-none cursor-pointer focus:ring-2 focus:ring-primary-500/50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function ProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  members,
  title,
  defaultValues,
}: Props) {
  const [form, setForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (defaultValues) {
      setForm({
        title: defaultValues.title,
        group_lv1: defaultValues.group_lv1 ?? "",
        group_lv2: defaultValues.group_lv2 ?? "",
        group_lv3: defaultValues.group_lv3 ?? "",
        priority: defaultValues.priority,
        target_date: defaultValues.target_date ?? "",
        target_date_tentative: defaultValues.target_date_tentative ?? false,
        director_id: defaultValues.director_id ?? "",
        engineer_id: defaultValues.engineer_id ?? "",
        designer_id: defaultValues.designer_id ?? "",
        status: defaultValues.status,
        progress: defaultValues.progress,
        size: defaultValues.size ?? "",
        notes: defaultValues.notes ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [defaultValues, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(form);
    setSubmitting(false);
  };

  const update = (field: keyof ProjectFormData, value: string | number | null) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value ?? "" };
      // lv1 が変わったら lv2, lv3 をリセット
      if (field === "group_lv1") {
        next.group_lv2 = "";
        next.group_lv3 = "";
      }
      // lv2 が変わったら lv3 をリセット
      if (field === "group_lv2") {
        next.group_lv3 = "";
      }
      return next;
    });
  };

  const sizeOptions = [
    { value: "", label: "未設定" },
    ...SIZE_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
  ];
  const statusOptions = STATUS_OPTIONS.map((s) => ({ value: s, label: s }));
  const progressOptions = PROGRESS_OPTIONS.map((p) => ({
    value: p.value,
    label: `${p.label} ${p.value}`,
  }));
  const groupLv1Options = [
    { value: "", label: "選択してください" },
    ...GROUP_LV1_OPTIONS.map((g) => ({ value: g, label: g })),
  ];
  const groupLv2Options = [
    { value: "", label: "選択してください" },
    ...getGroupLv2Options(form.group_lv1).map((g) => ({
      value: g.value,
      label: g.value,
    })),
  ];
  const groupLv3Options = [
    { value: "", label: "選択してください" },
    ...getGroupLv3Options(form.group_lv2).map((g) => ({
      value: g.value,
      label: g.value,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* 基本情報 */}
          <FormSection title="基本情報">
            <FormField label="タイトル" required>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="施策名を入力"
                required
              />
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Lv.1">
                <NativeSelect
                  value={form.group_lv1}
                  onChange={(v) => update("group_lv1", v)}
                  options={groupLv1Options}
                />
              </FormField>
              <FormField label="Lv.2">
                <NativeSelect
                  value={form.group_lv2}
                  onChange={(v) => update("group_lv2", v)}
                  options={groupLv2Options}
                />
              </FormField>
              <FormField label="Lv.3">
                <NativeSelect
                  value={form.group_lv3}
                  onChange={(v) => update("group_lv3", v)}
                  options={groupLv3Options}
                />
              </FormField>
            </div>

            <FormField label="優先順">
              <Input
                type="number"
                value={form.priority}
                onChange={(e) =>
                  update("priority", parseInt(e.target.value) || 0)
                }
                min={0}
                className="w-24"
              />
            </FormField>

            <FormField label="公開目安">
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => update("target_date", e.target.value)}
                  className="w-48"
                />
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-500">
                  <input
                    type="checkbox"
                    checked={form.target_date_tentative}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        target_date_tentative: e.target.checked,
                      }))
                    }
                    className="cursor-pointer"
                  />
                  仮
                </label>
              </div>
            </FormField>
          </FormSection>

          {/* 担当者 */}
          <FormSection title="担当者">
            <div className="grid grid-cols-3 gap-3">
              <FormField label="ディレクター">
                <MemberSelect
                  value={form.director_id}
                  onChange={(v) => update("director_id", v)}
                  members={members}
                  preferredRole="ディレクター"
                />
              </FormField>
              <FormField label="デザイナー">
                <MemberSelect
                  value={form.designer_id}
                  onChange={(v) => update("designer_id", v)}
                  members={members}
                  preferredRole="デザイナー"
                />
              </FormField>
              <FormField label="エンジニア">
                <MemberSelect
                  value={form.engineer_id}
                  onChange={(v) => update("engineer_id", v)}
                  members={members}
                  preferredRole="エンジニア"
                />
              </FormField>
            </div>
          </FormSection>

          {/* ステータス */}
          <FormSection title="ステータス">
            <div className="grid grid-cols-3 gap-4">
              <FormField label="ステータス">
                <NativeSelect
                  value={form.status}
                  onChange={(v) => update("status", v)}
                  options={statusOptions}
                />
              </FormField>
              <FormField label="進行状況">
                <NativeSelect
                  value={form.progress}
                  onChange={(v) => update("progress", v)}
                  options={progressOptions}
                />
              </FormField>
              <FormField label="規模" tooltip="エンジニア対応見積工数。アウトプット量 = 規模 × 施策数 とし、アウトプット量の推移を確認するために使用する。">
                <NativeSelect
                  value={form.size}
                  onChange={(v) => update("size", v)}
                  options={sizeOptions}
                />
              </FormField>
            </div>
          </FormSection>

          {/* 備考 */}
          <FormField label="備考">
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="補足事項があれば入力"
              rows={3}
            />
          </FormField>

          {/* ボタン */}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
