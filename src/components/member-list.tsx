"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MEMBER_ROLE_OPTIONS } from "@/lib/constants";
import type { Member } from "@/lib/types/models";

type MemberFormData = {
  display_name: string;
  role: string;
};

const EMPTY_FORM: MemberFormData = {
  display_name: "",
  role: "",
};

export function MemberList({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const reload = async () => {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("display_name");
    if (data) setMembers(data);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingMember(null);
    setDialogOpen(true);
  };

  const openEdit = (member: Member) => {
    setForm({
      display_name: member.display_name,
      role: member.role ?? "",
    });
    setEditingMember(member);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (editingMember) {
      await supabase
        .from("members")
        .update({
          display_name: form.display_name,
          role: form.role || null,
        } as never)
        .eq("id", editingMember.id);
    } else {
      await supabase.from("members").insert({
        display_name: form.display_name,
        role: form.role || null,
      } as never);
    }

    await reload();
    setSubmitting(false);
    setDialogOpen(false);
    setEditingMember(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このメンバーを削除しますか？施策の担当者欄は空欄になります。")) return;
    await supabase.from("members").delete().eq("id", id);
    await reload();
  };

  const roleStyle = (role: string | null) => {
    switch (role) {
      case "ディレクター":
        return "bg-cyan-50 text-cyan-600";
      case "エンジニア":
        return "bg-violet-50 text-violet-600";
      case "デザイナー":
        return "bg-pink-50 text-pink-600";
      default:
        return "bg-black/[0.03] text-black/60";
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white">メンバー管理</h2>
        <button
          onClick={openCreate}
          className="rounded-md bg-[#4a9eff] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3a8eef] cursor-pointer"
        >
          + メンバー追加
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-[11px] font-medium text-black/60">
              <th className="px-3 py-2">名前</th>
              <th className="w-28 px-3 py-2">役割</th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-xs text-black/60">
                  メンバーがまだいません
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-black/5 transition-colors hover:bg-blue-50/70"
                >
                  <td className="px-3 py-2 text-sm text-foreground">
                    {member.display_name}
                  </td>
                  <td className="w-28 px-3 py-2">
                    {member.role ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${roleStyle(member.role)}`}>
                        {member.role}
                      </span>
                    ) : (
                      <span className="text-xs text-black/40">-</span>
                    )}
                  </td>
                  <td className="w-24 px-3 py-2">
                    <div className="flex gap-0.5 opacity-0 [tr:hover_&]:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(member)} className="rounded px-1.5 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-black/60">編集</button>
                      <button onClick={() => handleDelete(member.id)} className="rounded px-1.5 py-0.5 text-[11px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">削除</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 追加・編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingMember ? "メンバーを編集" : "メンバーを追加"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60">
                名前 <span className="text-red-400">*</span>
              </label>
              <input
                value={form.display_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, display_name: e.target.value }))
                }
                placeholder="例: 中村"
                required
                className="h-8 w-full rounded-md border border-black/10 bg-white px-2.5 text-sm text-foreground outline-none placeholder:text-black/25 focus:border-[#4a9eff]/50 focus:ring-1 focus:ring-[#4a9eff]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60">役割</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, role: e.target.value }))
                }
                className="h-8 w-full rounded-md border border-black/10 bg-white px-2.5 text-sm text-foreground outline-none cursor-pointer focus:border-[#4a9eff]/50 focus:ring-1 focus:ring-[#4a9eff]/20"
              >
                <option value="">選択してください</option>
                {MEMBER_ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t border-black/5 pt-4">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs text-black/60 transition-colors hover:bg-black/5 hover:text-black/60 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-[#4a9eff] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3a8eef] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
