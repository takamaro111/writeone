create extension if not exists "pgcrypto";

create type public.subscription_plan as enum ('Free', 'Premium', 'Pro');
create type public.subscription_status as enum ('active', 'trialing', 'inactive', 'canceled');
create type public.print_level as enum ('Opinion', 'Essay', 'Advanced', 'Master');
create type public.print_progress_status as enum ('locked', 'unlocked', 'completed');
create type public.submission_status as enum ('draft', 'submitted', 'reviewed', 'review_failed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  subscription_plan public.subscription_plan not null default 'Free',
  subscription_status public.subscription_status not null default 'active',
  is_admin boolean not null default false
);

create table if not exists public.prints (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  level public.print_level not null,
  title text not null,
  topic_jp text not null,
  topic_en text not null,
  word_count_min integer not null,
  word_count_max integer not null,
  structure jsonb not null default '[]',
  tips jsonb not null default '[]',
  pdf_url text,
  sort_order integer not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  print_id uuid not null references public.prints(id) on delete cascade,
  answer_text text not null,
  word_count integer not null default 0,
  status public.submission_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version integer not null default 1,
  total_score integer not null,
  grammar_score integer not null,
  vocabulary_score integer not null,
  logic_score integer not null,
  structure_score integer not null,
  consistency_score integer not null,
  eiken_level_estimate text,
  word_count_feedback text,
  good_points jsonb not null default '[]',
  improvement_points jsonb not null default '[]',
  sentence_corrections jsonb not null default '[]',
  corrected_sample text,
  next_advice text,
  raw_feedback jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  print_id uuid not null references public.prints(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, print_id)
);

create table if not exists public.user_print_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  print_id uuid not null references public.prints(id) on delete cascade,
  status public.print_progress_status not null default 'locked',
  best_score integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, print_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan public.subscription_plan not null default 'Free',
  status public.subscription_status not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  submission_id uuid references public.submissions(id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.prints enable row level security;
alter table public.submissions enable row level security;
alter table public.feedbacks enable row level security;
alter table public.favorites enable row level security;
alter table public.user_print_progress enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_usage_logs enable row level security;

create policy "profiles own select" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);

create policy "published prints readable" on public.prints for select using (is_published = true or public.is_admin());
create policy "admin manages prints" on public.prints for all using (public.is_admin()) with check (public.is_admin());

create policy "submissions own select" on public.submissions for select using (auth.uid() = user_id or public.is_admin());
create policy "submissions own insert" on public.submissions for insert with check (auth.uid() = user_id);
create policy "submissions own update" on public.submissions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "feedbacks own select" on public.feedbacks for select using (
  public.is_admin() or exists (
    select 1 from public.submissions s
    where s.id = feedbacks.submission_id and s.user_id = auth.uid()
  )
);
create policy "admin manages feedbacks" on public.feedbacks for all using (public.is_admin()) with check (public.is_admin());

create policy "favorites own" on public.favorites for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id);
create policy "progress own" on public.user_print_progress for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id);
create policy "subscriptions own select" on public.subscriptions for select using (auth.uid() = user_id or public.is_admin());
create policy "admin manages subscriptions" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
create policy "usage own select" on public.ai_usage_logs for select using (auth.uid() = user_id or public.is_admin());
create policy "admin manages usage" on public.ai_usage_logs for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', '山田太郎')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.prints (code, level, title, topic_jp, topic_en, word_count_min, word_count_max, structure, tips, pdf_url, sort_order)
values
('O-1', 'Opinion', '意見文（50〜80語）', '大学は卒業する必要があると思いますか？', 'Do you think it is necessary to graduate from university?', 50, 80, '["意見","理由"]', '["自分の意見を最初に書く","理由を1つ具体的に書く"]', '/pdf/O-1~O-100/O-1~O-100.pdf', 1),
('E-1', 'Essay', '短いエッセイ（150語程度）', 'オンライン授業は対面授業より効果的だと思いますか？', 'Do you think online classes are more effective than face-to-face classes?', 130, 170, '["導入","本論","結論"]', '["導入でテーマの背景を書く","本論で理由と具体例を書く"]', '/pdf/E-1~E-100/E-1~E-100.pdf', 1),
('A-1', 'Advanced', '英検準1級レベルのエッセイ（180〜200語）', '人工知能（AI）は人間の仕事を奪うよりも、新しい仕事を生み出すと思いますか？', 'Do you think artificial intelligence will create more jobs than it will eliminate?', 180, 200, '["意見","理由①","理由②","結論"]', '["意見を明確に述べる","理由を2つ挙げる"]', '/pdf/A-1~A-100/A-1~A-100.pdf', 1),
('M-1', 'Master', '英検1級レベルのエッセイ（250語程度）', '経済成長よりも環境保護を優先すべきだ。', 'Environmental protection should be given priority over economic growth.', 240, 260, '["導入","本論①","本論②","反対意見","結論"]', '["立場を明確にする","反対意見にも触れる"]', '/pdf/M-1~M-100/M-1~M-100.pdf', 1)
on conflict (code) do nothing;
