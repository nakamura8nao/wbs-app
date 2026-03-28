"use client";

import type { Member } from "@/lib/types/models";

type Props = {
  value: string;
  onChange: (value: string) => void;
  members: Member[];
  placeholder?: string;
  preferredRole?: string;
};

export function MemberSelect({
  value,
  onChange,
  members,
  placeholder = "未選択",
  preferredRole,
}: Props) {
  // preferredRole に一致するメンバーを上に、それ以外を下に
  const sorted = preferredRole
    ? [
        ...members.filter((m) => m.role === preferredRole),
        ...members.filter((m) => m.role !== preferredRole),
      ]
    : members;

  const hasPreferred = preferredRole && members.some((m) => m.role === preferredRole);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    >
      <option value="">{placeholder}</option>
      {hasPreferred ? (
        <>
          <optgroup label={preferredRole}>
            {sorted
              .filter((m) => m.role === preferredRole)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
          </optgroup>
          <optgroup label="その他">
            {sorted
              .filter((m) => m.role !== preferredRole)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                  {m.role ? ` (${m.role})` : ""}
                </option>
              ))}
          </optgroup>
        </>
      ) : (
        sorted.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
            {m.role ? ` (${m.role})` : ""}
          </option>
        ))
      )}
    </select>
  );
}
