-- 個人アクセストークン (Bearer 認証用)
-- Claude / CLI など、ブラウザCookieを持たないクライアントから /api/wbs/* を叩くために使う。
-- 生トークンは保存せず SHA256 ハッシュのみ保持する。

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_tokens_user_id_idx on public.api_tokens(user_id);
create index if not exists api_tokens_active_hash_idx
  on public.api_tokens(token_hash)
  where revoked_at is null;

alter table public.api_tokens enable row level security;

-- 自分のトークンだけ見える / 作れる / 失効できる
create policy "users select own api_tokens"
  on public.api_tokens for select
  using (auth.uid() = user_id);

create policy "users insert own api_tokens"
  on public.api_tokens for insert
  with check (auth.uid() = user_id);

create policy "users update own api_tokens"
  on public.api_tokens for update
  using (auth.uid() = user_id);
