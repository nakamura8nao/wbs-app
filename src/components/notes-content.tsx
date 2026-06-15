// 備考テキストを表示用にレンダリング（リスト・詳細ページ共通）
// - マークダウン形式リンク [表示名](https://...) → 表示名のリンク
// - 素の URL (http/https) → URL そのままのリンク
const notesTokenPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
const notesLinkClasses = "text-[#4a9eff] underline underline-offset-2 hover:text-[#3a8eef] break-all";

export function NotesContent({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const m of text.matchAll(notesTokenPattern)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) nodes.push(text.slice(lastIndex, idx));
    const href = m[2] ?? m[3];
    const label = m[1] ?? m[3];
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={notesLinkClasses}
      >
        {label}
      </a>
    );
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}
