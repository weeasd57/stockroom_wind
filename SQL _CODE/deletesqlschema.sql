
-- Views
drop view if exists public.posts_with_stats cascade;
drop view if exists public.comments_with_user_info cascade;

-- Triggers (guarded by table existence to avoid 42P01)
do $$ begin
  if to_regclass('public.likes') is not null then
    drop trigger if exists on_like_created on public.likes;
  end if;
end $$;

do $$ begin
  if to_regclass('public.comments') is not null then
    drop trigger if exists update_comments_updated_at on public.comments;
    drop trigger if exists update_comment_edited_at_trigger on public.comments;
    drop trigger if exists prevent_circular_comments_trigger on public.comments;
  end if;
end $$;

do $$ begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists update_profiles_updated_at on public.profiles;
  end if;
end $$;

do $$ begin
  if to_regclass('public.posts') is not null then
    drop trigger if exists update_posts_updated_at on public.posts;
  end if;
end $$;

do $$ begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;
  end if;
end $$;

-- Functions (drop by name+signature safely)
do $$
declare r record;
begin
  for r in
    select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any (array[
        'handle_new_user',
        'update_updated_at_column',
        'get_post_action_counts',
        'get_post_comment_count',
        'toggle_post_action',
        'get_user_post_action',
        'get_nested_comments',
        'update_comment_edited_at',
        'prevent_circular_comments',
        'handle_new_like'
      ])
  loop
    execute format('drop function if exists %I.%I(%s) cascade', r.nspname, r.proname, r.args);
  end loop;
end $$;

-- Tables (الأبناء قبل الآباء)
drop table if exists public.likes cascade;
drop table if exists public.notifications cascade;
drop table if exists public.comments cascade;
drop table if exists public.post_actions cascade;
drop table if exists public.user_followings cascade;
drop table if exists public.user_strategies cascade;
drop table if exists public.posts cascade;
drop table if exists public.profiles cascade;
drop table if exists public.price_check_usage cascade;

-- Also drop the auth trigger if it exists (outside public schema)
drop trigger if exists on_auth_user_created on auth.users;