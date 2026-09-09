"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  InvestmentProgram,
  InvestmentProgramFormData,
} from "@/lib/types/models";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InvestmentProgramFormData) => Promise<void>;
  title: string;
  defaultValues?: InvestmentProgram;
};

const EMPTY_FORM: InvestmentProgramFormData = {
  name: "",
  goal: "",
  target_period: "",
};

export function InvestmentProgramDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  defaultValues,
}: Props) {
  const [form, setForm] = useState<InvestmentProgramFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (defaultValues) {
      setForm({
        name: defaultValues.name,
        goal: defaultValues.goal ?? "",
        target_period: defaultValues.target_period ?? "",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              プロジェクト名<span className="ml-0.5 text-red-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="例: イエタテアプリ / 管理画面とLINEの連携"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              成功条件（目的）
              <span
                className="ml-1 inline-flex cursor-help text-slate-400"
                data-tooltip="どんなことが達成されたらこのプロジェクトが成功と言えるか。投資ビューの見出しに常に表示される。"
                data-tooltip-align="start"
              >
                ?
              </span>
            </Label>
            <Textarea
              value={form.goal}
              onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
              placeholder="例: アプリ経由の来店予約が月100件を超え、カウンター送客の3割を占める"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              大まかな期日
              <span
                className="ml-1 inline-flex cursor-help text-slate-400"
                data-tooltip="日付まで決めきらないので自由記述。例: 2026年下期 / 2026Q4 / 2026-12"
                data-tooltip-align="start"
              >
                ?
              </span>
            </Label>
            <Input
              value={form.target_period}
              onChange={(e) =>
                setForm((p) => ({ ...p, target_period: e.target.value }))
              }
              placeholder="例: 2026年下期"
              className="w-64"
            />
          </div>

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
