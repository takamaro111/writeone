alter type public.submission_status add value if not exists 'review_failed';

alter table public.feedbacks add column if not exists eiken_level_estimate text;
alter table public.feedbacks add column if not exists word_count_feedback text;
alter table public.feedbacks add column if not exists sentence_corrections jsonb not null default '[]';
alter table public.feedbacks add column if not exists raw_feedback jsonb;

create index if not exists feedbacks_submission_id_idx on public.feedbacks (submission_id);
create index if not exists submissions_user_created_idx on public.submissions (user_id, created_at desc);
create index if not exists ai_usage_logs_user_created_idx on public.ai_usage_logs (user_id, created_at desc);
