This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## API トークン

CLI / Claude から `/api/wbs/*` を叩くための個人アクセストークン。

### 発行

1. WBS にブラウザでログイン → `/settings/tokens` を開く
2. 用途名 (例: `claude-mac`) を入れて [発行]
3. **表示された生トークンをコピー**（この画面でしか表示されない）

不要になったら同じ画面で [失効] を押す。

### 使い方

設定ファイルを保存して、`Authorization: Bearer` ヘッダで叩く。

```bash
mkdir -p ~/.config/wbs && chmod 700 ~/.config/wbs
cat > ~/.config/wbs/config <<EOF
WBS_API_BASE=https://<デプロイ先URL>   # 例: http://localhost:3000
WBS_TOKEN=wbs_<コピーした生トークン>
EOF
chmod 600 ~/.config/wbs/config
```

```bash
( set -a; . ~/.config/wbs/config; set +a; \
  curl -fsS -H "Authorization: Bearer $WBS_TOKEN" "$WBS_API_BASE/api/wbs/team" )
```

`401` が返ったらトークン失効。`/settings/tokens` で再発行する。
