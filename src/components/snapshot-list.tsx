"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Trash2, Camera, Eye } from "lucide-react";

type SnapshotMeta = {
  id: string;
  snapshot_date: string;
  label: string | null;
  created_at: string;
};

export function SnapshotList({ initialSnapshots }: { initialSnapshots: SnapshotMeta[] }) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [taking, setTaking] = useState(false);
  const [label, setLabel] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const reload = async () => {
    const { data } = await supabase
      .from("snapshots")
      .select("id, snapshot_date, label, created_at")
      .order("snapshot_date", { ascending: false });
    if (data) setSnapshots(data);
  };

  const takeSnapshot = async () => {
    setTaking(true);

    // 全施策 + フェーズを取得
    const { data: projects } = await supabase
      .from("projects")
      .select(`
        *,
        director:members!projects_director_id_fkey(id, display_name, role),
        engineer:members!projects_engineer_id_fkey(id, display_name, role),
        designer:members!projects_designer_id_fkey(id, display_name, role)
      `)
      .order("priority", { ascending: true });

    const { data: phases } = await supabase
      .from("phases")
      .select(`
        *,
        assignee:members!phases_assignee_id_fkey(id, display_name, role),
        dependencies:phase_dependencies!phase_dependencies_phase_id_fkey(depends_on_phase_id)
      `)
      .order("sort_order", { ascending: true });

    const snapshotData = (projects ?? []).map((proj: any) => ({
      ...proj,
      phases: (phases ?? []).filter((ph: any) => ph.project_id === proj.id),
    }));

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    await supabase.from("snapshots").insert({
      snapshot_date: dateStr,
      label: label.trim() || `${dateStr} スナップショット`,
      data: snapshotData,
    } as never);

    setLabel("");
    setTaking(false);
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このスナップショットを削除しますか？")) return;
    await supabase.from("snapshots").delete().eq("id", id);
    await reload();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white">スナップショット</h2>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ラベル（任意）"
            className="h-7 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white/70 outline-none placeholder:text-white/30 w-48"
          />
          <button
            onClick={takeSnapshot}
            disabled={taking}
            className="flex items-center gap-1.5 rounded-md bg-[#4a9eff] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3a8eef] disabled:opacity-50 cursor-pointer"
          >
            <Camera size={13} />
            {taking ? "取得中..." : "スナップショットを撮る"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-[11px] font-medium text-black/60">
              <th className="px-3 py-2">日付</th>
              <th className="px-3 py-2">ラベル</th>
              <th className="w-40 px-3 py-2">作成日時</th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {snapshots.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-black/40">
                  スナップショットがありません
                </td>
              </tr>
            ) : (
              snapshots.map((snap) => (
                <tr
                  key={snap.id}
                  className="border-b border-black/5 transition-colors hover:bg-blue-50/70"
                >
                  <td className="px-3 py-2 text-sm text-foreground font-medium">
                    {snap.snapshot_date}
                  </td>
                  <td className="px-3 py-2 text-sm text-black/60">
                    {snap.label ?? "-"}
                  </td>
                  <td className="w-40 px-3 py-2 text-xs text-black/40">
                    {new Date(snap.created_at).toLocaleString("ja-JP")}
                  </td>
                  <td className="w-24 px-3 py-2">
                    <div className="flex gap-1 opacity-0 [tr:hover_&]:opacity-100 transition-opacity">
                      <button
                        onClick={() => router.push(`/snapshots/${snap.id}`)}
                        className="rounded px-1.5 py-0.5 text-[11px] text-[#4a9eff] hover:bg-[#4a9eff]/10"
                        title="閲覧"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(snap.id)}
                        className="rounded px-1.5 py-0.5 text-[11px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                        title="削除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
