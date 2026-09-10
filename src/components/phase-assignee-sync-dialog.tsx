"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PHASE_ROLE_LABEL,
  PHASE_ROLE_ORDER,
  type PhaseRole,
  type PhaseSyncCandidate,
} from "@/lib/phase-templates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  candidates: PhaseSyncCandidate[];
  nameOf: (id: string | null) => string;
  onConfirm: (targets: PhaseSyncCandidate[]) => Promise<void>;
};

export function PhaseAssigneeSyncDialog({
  open,
  onOpenChange,
  projectTitle,
  candidates,
  nameOf,
  onConfirm,
}: Props) {
  // null は「まだ触っていない」＝推奨のまま。対象が入れ替わったら選択もリセットする
  const [checked, setChecked] = useState<Set<string> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const key = candidates.map((c) => c.phaseId).join(",");
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setChecked(null);
  }

  // 既定は「前の担当者のまま／未割当」で完了していないフェーズ
  const recommended = useMemo(
    () => new Set(candidates.filter((c) => c.recommended).map((c) => c.phaseId)),
    [candidates]
  );
  const effective = checked ?? recommended;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev ?? recommended);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const byRole = PHASE_ROLE_ORDER.map((role) => ({
    role,
    items: candidates.filter((c) => c.role === role),
  })).filter((g) => g.items.length > 0);

  const selected = candidates.filter((c) => effective.has(c.phaseId));

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirm(selected);
    setSubmitting(false);
  };

  const allChecked = effective.size === candidates.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">フェーズの担当者も変更しますか？</DialogTitle>
          <DialogDescription>
            「{projectTitle}」の担当者を変えました。自動生成されるフェーズと同じ名前のフェーズが
            {candidates.length}件あります。追随させるものを選んでください。
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              setChecked(allChecked ? new Set() : new Set(candidates.map((c) => c.phaseId)))
            }
            className="text-xs text-primary-600 hover:underline"
          >
            {allChecked ? "すべて外す" : "すべて選ぶ"}
          </button>
        </div>

        <div className="space-y-4">
          {byRole.map(({ role, items }) => (
            <RoleGroup
              key={role}
              role={role}
              items={items}
              checked={effective}
              toggle={toggle}
              nameOf={nameOf}
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-black/5 pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            変更しない
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || selected.length === 0}>
            {selected.length}件を変更する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoleGroup({
  role,
  items,
  checked,
  toggle,
  nameOf,
}: {
  role: PhaseRole;
  items: PhaseSyncCandidate[];
  checked: Set<string>;
  toggle: (id: string) => void;
  nameOf: (id: string | null) => string;
}) {
  const next = items[0].nextAssigneeId;
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-black/60">
        {PHASE_ROLE_LABEL[role]}担当 → {nameOf(next)}
      </div>
      <ul className="divide-y divide-black/5 rounded-lg border border-black/5">
        {items.map((c) => (
          <li key={c.phaseId}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50",
                !c.recommended && "bg-amber-50/40"
              )}
            >
              <input
                type="checkbox"
                checked={checked.has(c.phaseId)}
                onChange={() => toggle(c.phaseId)}
                className="accent-primary-500"
              />
              <span className="flex-1 text-black/75">
                {c.phaseName}
                {c.phaseStatus === "完了" && (
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    完了
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-black/45">
                <span className={cn(!c.recommended && "font-medium text-amber-700")}>
                  {nameOf(c.currentAssigneeId)}
                </span>
                <ArrowRight size={12} className="text-black/25" />
                <span className="text-black/70">{nameOf(c.nextAssigneeId)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
