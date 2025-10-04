-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_comment_id uuid,
  content text NOT NULL CHECK (length(TRIM(BOTH FROM content)) > 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_edited boolean DEFAULT false,
  edited_at timestamp with time zone,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'mention'::text])),
  post_id uuid,
  comment_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id)
);
CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  subscription_id uuid,
  amount numeric NOT NULL,
  currency character varying DEFAULT 'USD'::character varying,
  paypal_transaction_id character varying,
  paypal_order_id character varying,
  paypal_capture_id character varying,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying]::text[])),
  transaction_type character varying NOT NULL DEFAULT 'payment'::character varying CHECK (transaction_type::text = ANY (ARRAY['payment'::character varying, 'refund'::character varying]::text[])),
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT payment_transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(id)
);
CREATE TABLE public.post_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action_type character varying NOT NULL CHECK (action_type::text = ANY (ARRAY['buy'::character varying, 'sell'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_actions_pkey PRIMARY KEY (id),
  CONSTRAINT post_actions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content character varying NOT NULL,
  image_url text,
  symbol character varying NOT NULL,
  company_name character varying NOT NULL,
  country character varying NOT NULL,
  exchange character varying NOT NULL,
  current_price numeric NOT NULL,
  target_price numeric NOT NULL,
  stop_loss_price numeric NOT NULL,
  strategy character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  target_reached boolean NOT NULL DEFAULT false,
  stop_loss_triggered boolean NOT NULL DEFAULT false,
  target_reached_date timestamp with time zone,
  stop_loss_triggered_date timestamp with time zone,
  last_price_check timestamp with time zone,
  closed boolean DEFAULT false,
  initial_price numeric,
  high_price numeric,
  target_high_price numeric,
  target_hit_time timestamp with time zone,
  postdateafterpricedate boolean NOT NULL DEFAULT false,
  postaftermarketclose boolean NOT NULL DEFAULT false,
  nodataavailable boolean NOT NULL DEFAULT false,
  status_message character varying NOT NULL,
  price_checks jsonb,
  closed_date timestamp with time zone,
  is_public boolean DEFAULT true,
  status character varying DEFAULT 'open'::character varying,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username character varying NOT NULL UNIQUE,
  full_name character varying NOT NULL,
  avatar_url text NOT NULL,
  bio character varying NOT NULL,
  website text,
  favorite_markets ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email character varying NOT NULL UNIQUE,
  last_sign_in timestamp with time zone,
  success_posts integer NOT NULL DEFAULT 0,
  loss_posts integer NOT NULL DEFAULT 0,
  background_url text NOT NULL,
  experience_score integer NOT NULL,
  followers integer NOT NULL,
  following integer NOT NULL,
  facebook_url text,
  telegram_url text CHECK (telegram_url IS NULL OR telegram_url ~ '^https?://'::text),
  youtube_url text CHECK (youtube_url IS NULL OR youtube_url ~ '^https?://'::text),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_events_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  display_name character varying NOT NULL,
  price numeric NOT NULL,
  currency character varying DEFAULT 'USD'::character varying,
  price_check_limit integer NOT NULL,
  post_creation_limit integer NOT NULL DEFAULT 100,
  features jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.telegram_bot_commands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  command character varying NOT NULL,
  description text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_bot_commands_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_bot_commands_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.telegram_bots(id)
);
CREATE TABLE public.telegram_bots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  bot_token text NOT NULL,
  bot_username character varying NOT NULL,
  bot_name character varying NOT NULL,
  is_active boolean DEFAULT true,
  webhook_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_bots_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_bots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.telegram_broadcast_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL,
  post_id uuid NOT NULL,
  include_price_update boolean DEFAULT false,
  custom_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_broadcast_posts_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_broadcast_posts_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.telegram_broadcasts(id),
  CONSTRAINT telegram_broadcast_posts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.telegram_broadcast_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL,
  subscriber_id uuid NOT NULL,
  recipient_type character varying DEFAULT 'follower'::character varying,
  status character varying DEFAULT 'pending'::character varying,
  sent_at timestamp with time zone,
  error_message text,
  telegram_message_id bigint,
  CONSTRAINT telegram_broadcast_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_broadcast_recipients_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.telegram_broadcasts(id),
  CONSTRAINT telegram_broadcast_recipients_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.telegram_subscribers(id)
);
CREATE TABLE public.telegram_broadcasts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  title character varying NOT NULL,
  message text,
  broadcast_type character varying NOT NULL,
  status character varying DEFAULT 'draft'::character varying,
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT telegram_broadcasts_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_broadcasts_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.telegram_bots(id),
  CONSTRAINT telegram_broadcasts_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.telegram_notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL,
  notification_type character varying NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_notification_settings_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.telegram_subscribers(id)
);
CREATE TABLE public.telegram_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  subscriber_id uuid NOT NULL,
  notification_type character varying NOT NULL,
  post_id uuid,
  broadcast_id uuid,
  telegram_message_id bigint,
  message_text text NOT NULL,
  status character varying DEFAULT 'sent'::character varying,
  sent_at timestamp with time zone DEFAULT now(),
  error_message text,
  CONSTRAINT telegram_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_notifications_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.telegram_bots(id),
  CONSTRAINT telegram_notifications_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.telegram_subscribers(id),
  CONSTRAINT telegram_notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT telegram_notifications_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.telegram_broadcasts(id)
);
CREATE TABLE public.telegram_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  telegram_user_id bigint NOT NULL,
  telegram_username character varying,
  telegram_first_name character varying,
  telegram_last_name character varying,
  platform_user_id uuid,
  is_subscribed boolean DEFAULT true,
  language_code character varying DEFAULT 'ar'::character varying,
  subscribed_at timestamp with time zone DEFAULT now(),
  last_interaction timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_subscribers_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_subscribers_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.telegram_bots(id),
  CONSTRAINT telegram_subscribers_platform_user_id_fkey FOREIGN KEY (platform_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_followings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_followings_pkey PRIMARY KEY (id),
  CONSTRAINT user_followings_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id),
  CONSTRAINT user_followings_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_strategies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  strategy_name character varying NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_strategies_pkey PRIMARY KEY (id),
  CONSTRAINT user_strategies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'pending'::character varying]::text[])),
  price_checks_used integer DEFAULT 0,
  posts_created integer DEFAULT 0,
  price_checks_reset_at timestamp with time zone DEFAULT (now() + '1 mon'::interval),
  posts_reset_at timestamp with time zone DEFAULT (now() + '1 mon'::interval),
  paypal_subscription_id character varying,
  paypal_order_id character varying,
  started_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_price_check_reset timestamp with time zone DEFAULT date_trunc('month'::text, now()),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id)
);