-- Generated SQL for public schema from Supabase JSON metadata
-- This script focuses on your application schema (public) only.
-- System schemas like auth, storage, realtime, etc. are not recreated here.
-- NOTE: View definitions (public.* where table_type = VIEW) are not generated from JSON; optional custom view SQL can be appended.
-- NOTE: Functions with problematic types (anyelement, unknown) are filtered out.

-- === ENUM TYPES (public) ===
CREATE TYPE public.broadcast_audience_enum AS ENUM ('all', 'premium_only', 'free_only');

CREATE TYPE public.post_type AS ENUM ('GENERAL', 'PURCHASE_RECOMMENDATION');

CREATE TYPE public.reaction_type AS ENUM ('LIKE', 'DISLIKE', 'BUY', 'SELL');

CREATE TYPE public.subscription_tier_enum AS ENUM ('free', 'premium');

-- === TABLES (public) ===

CREATE TABLE public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.admin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  admin_email text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  created_by uuid
);

CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.broker_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  broker_id uuid NOT NULL,
  subscription_id text,
  plan_type text DEFAULT 'monthly'::text,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD'::text,
  status text DEFAULT 'active'::text,
  started_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contact_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  subject text,
  telegram_user_id bigint,
  telegram_username text,
  status character varying DEFAULT 'open'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_message_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid,
  amount numeric NOT NULL,
  currency character varying DEFAULT 'USD'::character varying,
  paypal_transaction_id character varying,
  paypal_order_id character varying,
  paypal_capture_id character varying,
  status character varying DEFAULT 'pending'::character varying NOT NULL,
  transaction_type character varying DEFAULT 'payment'::character varying NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.paypal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  merchant_id text,
  account_type text DEFAULT 'personal'::text,
  country_code text DEFAULT 'US'::text,
  verification_status text DEFAULT 'pending'::text,
  verified_at timestamp with time zone,
  webhook_id text,
  webhook_url text,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  description text,
  target_reached boolean DEFAULT false NOT NULL,
  stop_loss_triggered boolean DEFAULT false NOT NULL,
  target_reached_date timestamp with time zone,
  stop_loss_triggered_date timestamp with time zone,
  last_price_check timestamp with time zone,
  closed boolean DEFAULT false,
  initial_price numeric,
  high_price numeric,
  target_high_price numeric,
  target_hit_time timestamp with time zone,
  postdateafterpricedate boolean DEFAULT false NOT NULL,
  postaftermarketclose boolean DEFAULT false NOT NULL,
  nodataavailable boolean DEFAULT false NOT NULL,
  status_message character varying NOT NULL,
  price_checks jsonb,
  closed_date timestamp with time zone,
  is_public boolean DEFAULT true,
  status character varying DEFAULT 'open'::character varying,
  is_premium_only boolean DEFAULT false
);

CREATE TABLE public.premium_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description text DEFAULT ''::text,
  features jsonb DEFAULT '[]'::jsonb,
  pricing jsonb DEFAULT '{"yearly": 0, "monthly": 0, "currency": "USD"}'::jsonb,
  stats jsonb DEFAULT '{"successRate": 0, "totalSubscribers": 0, "premiumSubscribers": 0, "averagePostsPerMonth": 0}'::jsonb,
  paypal_account text DEFAULT ''::text,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.price_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol character varying NOT NULL,
  exchange character varying,
  country character varying,
  checked_at timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  username character varying NOT NULL,
  full_name character varying NOT NULL,
  avatar_url text NOT NULL,
  bio character varying NOT NULL,
  website text,
  favorite_markets text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  email character varying NOT NULL,
  last_sign_in timestamp with time zone,
  success_posts integer DEFAULT 0 NOT NULL,
  loss_posts integer DEFAULT 0 NOT NULL,
  background_url text NOT NULL,
  experience_score integer NOT NULL,
  followers integer NOT NULL,
  following integer NOT NULL,
  facebook_url text,
  telegram_url text,
  youtube_url text,
  is_broker boolean DEFAULT false,
  paypal_email character varying,
  broker_plan_description text,
  broker_average_posts_info text,
  broker_price_plan_info text
);

CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name character varying NOT NULL,
  display_name character varying NOT NULL,
  price numeric NOT NULL,
  currency character varying DEFAULT 'USD'::character varying,
  price_check_limit integer NOT NULL,
  post_creation_limit integer DEFAULT 100 NOT NULL,
  features jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  can_create_premium_plans boolean DEFAULT false,
  show_ads boolean DEFAULT true
);

CREATE TABLE public.system_settings (
  id integer NOT NULL,
  settings jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.telegram_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bot_token text NOT NULL,
  bot_username character varying NOT NULL,
  bot_name character varying NOT NULL,
  is_active boolean DEFAULT true,
  webhook_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_followings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  strategy_name character varying NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  image_url text
);

CREATE TABLE public.webhook_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  webhook_id text NOT NULL,
  event_type text NOT NULL,
  event_id text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  paypal_data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  severity text DEFAULT 'info'::text,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone
);

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid REFERENCES public.posts(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id uuid REFERENCES public.comments(id),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_edited boolean DEFAULT false,
  edited_at timestamp with time zone
);

CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid REFERENCES public.contact_conversations(id) NOT NULL,
  sender character varying NOT NULL,
  body text NOT NULL,
  reply_to uuid,
  admin_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  post_id uuid REFERENCES public.posts(id),
  comment_id uuid REFERENCES public.comments(id),
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.post_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid REFERENCES public.posts(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.premium_post_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid REFERENCES public.posts(id) NOT NULL,
  viewer_id uuid NOT NULL,
  access_type character varying NOT NULL,
  viewed_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address inet,
  user_agent text
);

CREATE TABLE public.telegram_bot_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  bot_id uuid REFERENCES public.telegram_bots(id) NOT NULL,
  command character varying NOT NULL,
  description text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.telegram_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  bot_id uuid REFERENCES public.telegram_bots(id) NOT NULL,
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
  target_audience public.broadcast_audience_enum DEFAULT 'all'::broadcast_audience_enum
);

CREATE TABLE public.telegram_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  bot_id uuid REFERENCES public.telegram_bots(id) NOT NULL,
  telegram_user_id bigint NOT NULL,
  telegram_username character varying,
  telegram_first_name character varying,
  telegram_last_name character varying,
  platform_user_id uuid,
  is_subscribed boolean DEFAULT true,
  language_code character varying DEFAULT 'ar'::character varying,
  subscribed_at timestamp with time zone DEFAULT now(),
  last_interaction timestamp with time zone DEFAULT now(),
  subscription_tier public.subscription_tier_enum DEFAULT 'free'::subscription_tier_enum
);

CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) NOT NULL,
  status character varying DEFAULT 'active'::character varying NOT NULL,
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
  billing_period character varying DEFAULT 'monthly'::character varying
);

CREATE TABLE public.telegram_broadcast_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  broadcast_id uuid REFERENCES public.telegram_broadcasts(id) NOT NULL,
  post_id uuid REFERENCES public.posts(id) NOT NULL,
  include_price_update boolean DEFAULT false,
  custom_message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.telegram_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  broadcast_id uuid REFERENCES public.telegram_broadcasts(id) NOT NULL,
  subscriber_id uuid REFERENCES public.telegram_subscribers(id) NOT NULL,
  recipient_type character varying DEFAULT 'follower'::character varying,
  status character varying DEFAULT 'pending'::character varying,
  sent_at timestamp with time zone,
  error_message text,
  telegram_message_id bigint
);

CREATE TABLE public.telegram_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  subscriber_id uuid REFERENCES public.telegram_subscribers(id) NOT NULL,
  notification_type character varying NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.telegram_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  bot_id uuid REFERENCES public.telegram_bots(id) NOT NULL,
  subscriber_id uuid REFERENCES public.telegram_subscribers(id) NOT NULL,
  notification_type character varying NOT NULL,
  post_id uuid REFERENCES public.posts(id),
  broadcast_id uuid REFERENCES public.telegram_broadcasts(id),
  telegram_message_id bigint,
  message_text text NOT NULL,
  status character varying DEFAULT 'sent'::character varying,
  sent_at timestamp with time zone DEFAULT now(),
  error_message text,
  recipient_tier character varying
);

-- === INDEXES (public) ===
CREATE INDEX idx_admin_log_created ON public.admin_activity_log USING btree (created_at DESC);
CREATE INDEX idx_admin_log_email ON public.admin_activity_log USING btree (admin_email);
CREATE INDEX idx_admin_log_target ON public.admin_activity_log USING btree (target_user_id);
CREATE INDEX idx_admin_log_type ON public.admin_activity_log USING btree (action_type);
CREATE UNIQUE INDEX admin_credentials_admin_email_key ON public.admin_credentials USING btree (admin_email);
CREATE INDEX idx_admin_credentials_active ON public.admin_credentials USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_admin_credentials_email ON public.admin_credentials USING btree (admin_email);
CREATE UNIQUE INDEX broker_subscriptions_user_id_broker_id_status_key ON public.broker_subscriptions USING btree (user_id, broker_id, status);
CREATE INDEX idx_broker_subscriptions_broker_id ON public.broker_subscriptions USING btree (broker_id);
CREATE INDEX idx_broker_subscriptions_expires_at ON public.broker_subscriptions USING btree (expires_at);
CREATE INDEX idx_broker_subscriptions_status ON public.broker_subscriptions USING btree (status);
CREATE INDEX idx_broker_subscriptions_user_id ON public.broker_subscriptions USING btree (user_id);
CREATE INDEX idx_comments_created_at ON public.comments USING btree (created_at DESC);
CREATE INDEX idx_comments_created_at_brin ON public.comments USING brin (created_at);
CREATE INDEX idx_comments_parent_comment_id ON public.comments USING btree (parent_comment_id);
CREATE INDEX idx_comments_post ON public.comments USING btree (post_id);
CREATE INDEX idx_comments_post_id ON public.comments USING btree (post_id);
CREATE INDEX idx_comments_post_parent_created ON public.comments USING btree (post_id, parent_comment_id, created_at);
CREATE INDEX idx_comments_user_id ON public.comments USING btree (user_id);
CREATE INDEX idx_contact_conversations_last ON public.contact_conversations USING btree (last_message_at DESC);
CREATE INDEX idx_contact_conversations_user ON public.contact_conversations USING btree (user_id);
CREATE INDEX idx_contact_messages_conv ON public.contact_messages USING btree (conversation_id);
CREATE INDEX idx_contact_messages_created ON public.contact_messages USING btree (created_at);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_payment_transactions_paypal_order_id ON public.payment_transactions USING btree (paypal_order_id);
CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions USING btree (user_id);
CREATE UNIQUE INDEX payment_tx_capture_unique ON public.payment_transactions USING btree (paypal_capture_id) WHERE (paypal_capture_id IS NOT NULL);
CREATE UNIQUE INDEX payment_tx_order_unique ON public.payment_transactions USING btree (paypal_order_id) WHERE (paypal_order_id IS NOT NULL);
CREATE INDEX idx_paypal_accounts_email ON public.paypal_accounts USING btree (email);
CREATE INDEX idx_paypal_accounts_merchant_id ON public.paypal_accounts USING btree (merchant_id);
CREATE INDEX idx_paypal_accounts_user_id ON public.paypal_accounts USING btree (user_id);
CREATE INDEX idx_paypal_accounts_verification_status ON public.paypal_accounts USING btree (verification_status);
CREATE UNIQUE INDEX paypal_accounts_user_id_email_key ON public.paypal_accounts USING btree (user_id, email);
CREATE INDEX idx_post_actions_action_type ON public.post_actions USING btree (action_type);
CREATE INDEX idx_post_actions_created_at ON public.post_actions USING btree (created_at DESC);
CREATE INDEX idx_post_actions_post_id ON public.post_actions USING btree (post_id);
CREATE INDEX idx_post_actions_post_user_type ON public.post_actions USING btree (post_id, user_id, action_type);
CREATE INDEX idx_post_actions_user_id ON public.post_actions USING btree (user_id);
CREATE UNIQUE INDEX idx_post_actions_user_post ON public.post_actions USING btree (post_id, user_id);
CREATE UNIQUE INDEX post_actions_post_id_user_id_action_type_key ON public.post_actions USING btree (post_id, user_id, action_type);
CREATE INDEX idx_posts_active ON public.posts USING btree (created_at) WHERE (NOT closed);
CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at DESC);
CREATE INDEX idx_posts_is_premium_only ON public.posts USING btree (is_premium_only) WHERE (is_premium_only = true);
CREATE INDEX idx_posts_user_created_at ON public.posts USING btree (user_id, created_at DESC);
CREATE INDEX idx_posts_user_id ON public.posts USING btree (user_id);
CREATE INDEX idx_premium_plans_created_at ON public.premium_plans USING btree (created_at);
CREATE INDEX idx_premium_plans_is_active ON public.premium_plans USING btree (is_active);
CREATE INDEX idx_premium_plans_user_id ON public.premium_plans USING btree (user_id);
CREATE UNIQUE INDEX premium_plans_user_id_key ON public.premium_plans USING btree (user_id);
CREATE INDEX idx_premium_access_log_post_id ON public.premium_post_access_log USING btree (post_id);
CREATE INDEX idx_premium_access_log_viewed_at ON public.premium_post_access_log USING btree (viewed_at DESC);
CREATE INDEX idx_premium_access_log_viewer_id ON public.premium_post_access_log USING btree (viewer_id);
CREATE INDEX idx_price_check_logs_checked_at ON public.price_check_logs USING btree (checked_at);
CREATE INDEX idx_price_check_logs_user_id ON public.price_check_logs USING btree (user_id);
CREATE INDEX idx_profiles_created_at ON public.profiles USING btree (created_at DESC);
CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX idx_profiles_is_broker ON public.profiles USING btree (is_broker) WHERE (is_broker = true);
CREATE INDEX idx_profiles_paypal_email ON public.profiles USING btree (paypal_email) WHERE (paypal_email IS NOT NULL);
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);
CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);
CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);
CREATE INDEX idx_subscription_events_user_id_created_at ON public.subscription_events USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX subscription_plans_name_key ON public.subscription_plans USING btree (name);
CREATE UNIQUE INDEX telegram_bot_commands_bot_id_command_key ON public.telegram_bot_commands USING btree (bot_id, command);
CREATE INDEX idx_telegram_bots_active ON public.telegram_bots USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_telegram_bots_user_id ON public.telegram_bots USING btree (user_id);
CREATE UNIQUE INDEX telegram_bots_user_id_key ON public.telegram_bots USING btree (user_id);
CREATE UNIQUE INDEX telegram_broadcast_posts_broadcast_id_post_id_key ON public.telegram_broadcast_posts USING btree (broadcast_id, post_id);
CREATE UNIQUE INDEX telegram_broadcast_recipients_broadcast_id_subscriber_id_key ON public.telegram_broadcast_recipients USING btree (broadcast_id, subscriber_id);
CREATE INDEX idx_telegram_broadcasts_audience ON public.telegram_broadcasts USING btree (target_audience);
CREATE INDEX idx_telegram_broadcasts_bot_id ON public.telegram_broadcasts USING btree (bot_id);
CREATE INDEX idx_telegram_broadcasts_created_at ON public.telegram_broadcasts USING btree (created_at DESC);
CREATE INDEX idx_telegram_broadcasts_sender_id ON public.telegram_broadcasts USING btree (sender_id);
CREATE INDEX idx_telegram_broadcasts_status ON public.telegram_broadcasts USING btree (status);
CREATE UNIQUE INDEX telegram_notification_setting_subscriber_id_notification_ty_key ON public.telegram_notification_settings USING btree (subscriber_id, notification_type);
CREATE INDEX idx_telegram_notifications_bot_id ON public.telegram_notifications USING btree (bot_id);
CREATE INDEX idx_telegram_notifications_post_id ON public.telegram_notifications USING btree (post_id);
CREATE INDEX idx_telegram_notifications_recipient_tier ON public.telegram_notifications USING btree (recipient_tier);
CREATE INDEX idx_telegram_notifications_sent_at ON public.telegram_notifications USING btree (sent_at DESC);
CREATE INDEX idx_telegram_notifications_subscriber_id ON public.telegram_notifications USING btree (subscriber_id);
CREATE INDEX idx_telegram_subscribers_bot_id ON public.telegram_subscribers USING btree (bot_id);
CREATE INDEX idx_telegram_subscribers_platform_user_id ON public.telegram_subscribers USING btree (platform_user_id);
CREATE INDEX idx_telegram_subscribers_premium ON public.telegram_subscribers USING btree (bot_id, subscription_tier) WHERE ((subscription_tier = 'premium'::subscription_tier_enum) AND (is_subscribed = true));
CREATE INDEX idx_telegram_subscribers_subscribed ON public.telegram_subscribers USING btree (is_subscribed) WHERE (is_subscribed = true);
CREATE INDEX idx_telegram_subscribers_telegram_user_id ON public.telegram_subscribers USING btree (telegram_user_id);
CREATE INDEX idx_telegram_subscribers_tier ON public.telegram_subscribers USING btree (subscription_tier);
CREATE UNIQUE INDEX telegram_subscribers_bot_id_telegram_user_id_key ON public.telegram_subscribers USING btree (bot_id, telegram_user_id);
CREATE INDEX idx_user_followings_follower ON public.user_followings USING btree (follower_id);
CREATE INDEX idx_user_followings_follower_id ON public.user_followings USING btree (follower_id);
CREATE INDEX idx_user_followings_following_id ON public.user_followings USING btree (following_id);
CREATE UNIQUE INDEX idx_user_followings_unique ON public.user_followings USING btree (follower_id, following_id);
CREATE UNIQUE INDEX user_followings_follower_id_following_id_key ON public.user_followings USING btree (follower_id, following_id);
CREATE INDEX idx_user_strategies_created_at ON public.user_strategies USING btree (created_at DESC);
CREATE INDEX idx_user_strategies_user_id ON public.user_strategies USING btree (user_id);
CREATE INDEX idx_user_strategies_user_strategy ON public.user_strategies USING btree (user_id, strategy_name);
CREATE UNIQUE INDEX user_strategies_user_id_strategy_name_key ON public.user_strategies USING btree (user_id, strategy_name);
CREATE INDEX idx_user_subscriptions_billing_period ON public.user_subscriptions USING btree (billing_period);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions USING btree (status);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions USING btree (user_id);
CREATE UNIQUE INDEX uniq_active_subscription_per_user ON public.user_subscriptions USING btree (user_id) WHERE ((status)::text = 'active'::text);
CREATE UNIQUE INDEX user_subscriptions_active_unique ON public.user_subscriptions USING btree (user_id) WHERE ((status)::text = 'active'::text);
CREATE UNIQUE INDEX user_subscriptions_paypal_order_unique ON public.user_subscriptions USING btree (paypal_order_id);
CREATE INDEX idx_webhook_notifications_created_at ON public.webhook_notifications USING btree (created_at);
CREATE INDEX idx_webhook_notifications_event_type ON public.webhook_notifications USING btree (event_type);
CREATE INDEX idx_webhook_notifications_is_read ON public.webhook_notifications USING btree (is_read);
CREATE INDEX idx_webhook_notifications_user_id ON public.webhook_notifications USING btree (user_id);
CREATE UNIQUE INDEX unique_event_per_user ON public.webhook_notifications USING btree (user_id, event_id);
CREATE UNIQUE INDEX webhook_notifications_event_id_key ON public.webhook_notifications USING btree (event_id);

-- === DATABASE FUNCTIONS (public) ===

-- Function: add_column_if_not_exists
-- Arguments: p_table_name text, p_column_name text, p_data_type text, p_default_value text DEFAULT NULL::text
CREATE OR REPLACE FUNCTION public.add_column_if_not_exists(p_table_name text, p_column_name text, p_data_type text, p_default_value text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  column_exists BOOLEAN;
  alter_statement TEXT;
BEGIN
  -- التحقق مما إذا كان العمود موجودًا بالفعل
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = p_table_name
    AND column_name = p_column_name
    AND table_schema = 'public'
  ) INTO column_exists;
  
  -- إذا لم يكن العمود موجودًا، قم بإضافته
  IF NOT column_exists THEN
    alter_statement := 'ALTER TABLE ' || p_table_name || ' ADD COLUMN ' || p_column_name || ' ' || p_data_type;
    
    -- إضافة القيمة الافتراضية إذا تم تحديدها
    IF p_default_value IS NOT NULL THEN
      alter_statement := alter_statement || ' DEFAULT ' || p_default_value;
    END IF;
    
    EXECUTE alter_statement;
  END IF;
END;
$function$;



-- Function: admin_confirm_emails
CREATE OR REPLACE FUNCTION public.admin_confirm_emails()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count integer;
  result json;
BEGIN
  -- Update unconfirmed emails
  WITH updated AS (
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE email_confirmed_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  -- Return the result
  SELECT json_build_object(
    'confirmed_users', updated_count
  ) INTO result;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$function$;



-- Function: alter_profiles_updated_at_default
CREATE OR REPLACE FUNCTION public.alter_profiles_updated_at_default()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. Set default value for updated_at column to NOW()
  ALTER TABLE public.profiles 
  ALTER COLUMN updated_at SET DEFAULT NOW();
  
  -- 2. Update any existing NULL values to match created_at
  UPDATE public.profiles 
  SET updated_at = created_at 
  WHERE updated_at IS NULL;
  
  -- 3. Make updated_at column NOT NULL after fixing existing data
  ALTER TABLE public.profiles 
  ALTER COLUMN updated_at SET NOT NULL;
END;
$function$;



-- Function: bump_last_message_at
CREATE OR REPLACE FUNCTION public.bump_last_message_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE contact_conversations
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;



-- Function: calculate_subscription_expiry
-- Arguments: p_started_at timestamp with time zone, p_billing_period character varying
CREATE OR REPLACE FUNCTION public.calculate_subscription_expiry(p_started_at timestamp with time zone, p_billing_period character varying)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    CASE p_billing_period
        WHEN 'monthly' THEN
            RETURN p_started_at + INTERVAL '1 month';
        WHEN 'yearly' THEN
            RETURN p_started_at + INTERVAL '1 year';
        ELSE
            RETURN p_started_at + INTERVAL '1 month';
    END CASE;
END;
$function$;



-- Function: can_user_view_premium_post
-- Arguments: p_post_id uuid, p_user_id uuid
CREATE OR REPLACE FUNCTION public.can_user_view_premium_post(p_post_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_premium_only BOOLEAN;
  v_is_owner BOOLEAN;
  v_is_premium_subscriber BOOLEAN;
BEGIN
  -- Get post premium status and ownership
  SELECT 
    is_premium_only,
    (user_id = p_user_id)
  INTO v_is_premium_only, v_is_owner
  FROM posts
  WHERE id = p_post_id;
  
  -- If post not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If not premium post, everyone can view
  IF v_is_premium_only = FALSE THEN
    RETURN TRUE;
  END IF;
  
  -- If user is owner
  IF v_is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is premium subscriber
  SELECT EXISTS(
    SELECT 1 FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND sp.name = 'pro'
  ) INTO v_is_premium_subscriber;
  
  RETURN v_is_premium_subscriber;
END;
$function$;



-- Function: check_post_limit
-- Arguments: p_user_id uuid
CREATE OR REPLACE FUNCTION public.check_post_limit(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_limit INTEGER;
  v_used  INTEGER;
BEGIN
  -- Read only from user_subscriptions + subscription_plans
  SELECT 
    COALESCE(p.post_creation_limit, 100),
    COALESCE(s.posts_created, 0)
  INTO v_limit, v_used
  FROM user_subscriptions s
  LEFT JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active';

  -- If no active sub, fallback to free plan defaults
  IF v_limit IS NULL THEN
    SELECT COALESCE(post_creation_limit, 100)
    INTO v_limit
    FROM subscription_plans
    WHERE name = 'free'
    LIMIT 1;

    v_used := 0;
  END IF;

  RETURN v_used < v_limit;
END;
$function$;



-- Function: check_price_limit
-- Arguments: p_user_id uuid
CREATE OR REPLACE FUNCTION public.check_price_limit(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_limit INTEGER;
    v_used INTEGER;
BEGIN
    -- Get user's current plan limits and usage
    SELECT 
        COALESCE(p.price_check_limit, 50),
        COALESCE(s.price_checks_used, 0)
    INTO v_limit, v_used
    FROM user_subscriptions s
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id AND s.status = 'active';
    
    -- If no active subscription found, use free plan defaults
    IF v_limit IS NULL THEN
        v_limit := 50;  -- Free plan default
        v_used := 0;
    END IF;
    
    -- Return true if user can make more checks
    RETURN v_used < v_limit;
END;
$function$;



-- Function: close_completed_posts
CREATE OR REPLACE FUNCTION public.close_completed_posts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- إذا تم الوصول إلى الهدف أو كسر وقف الخسارة، قم بإغلاق المنشور
  IF NEW.target_reached = TRUE OR NEW.stop_loss_triggered = TRUE THEN
    NEW.closed = TRUE;
    
    -- تسجيل تاريخ الوصول إلى الهدف إذا لم يكن مسجلاً بالفعل
    IF NEW.target_reached = TRUE AND NEW.target_reached_date IS NULL THEN
      NEW.target_reached_date = NOW();
    END IF;
    
    -- تسجيل تاريخ كسر وقف الخسارة إذا لم يكن مسجلاً بالفعل
    IF NEW.stop_loss_triggered = TRUE AND NEW.stop_loss_triggered_date IS NULL THEN
      NEW.stop_loss_triggered_date = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;



-- Function: create_pro_subscription
-- Arguments: p_user_id uuid, p_paypal_order_id text
CREATE OR REPLACE FUNCTION public.create_pro_subscription(p_user_id uuid, p_paypal_order_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_pro_plan_id UUID;
    v_subscription_id UUID;
BEGIN
    -- Get Pro plan ID
    SELECT id INTO v_pro_plan_id
    FROM subscription_plans
    WHERE name = 'pro';
    
    IF v_pro_plan_id IS NULL THEN
        RAISE EXCEPTION 'Pro plan not found';
    END IF;
    
    -- Cancel existing active subscriptions
    UPDATE user_subscriptions
    SET status = 'cancelled', cancelled_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';
    
    -- Insert new pro subscription with explicit started_at = NOW()
    INSERT INTO user_subscriptions (
        user_id, 
        plan_id, 
        status, 
        paypal_order_id,
        price_checks_used, 
        posts_created, 
        started_at,           -- ✅ Explicit started_at
        expires_at
    ) VALUES (
        p_user_id, 
        v_pro_plan_id, 
        'active', 
        p_paypal_order_id,
        0, 
        0, 
        NOW(),                -- ✅ Current timestamp
        NOW() + INTERVAL '1 month'  -- Default monthly, will be updated by API
    )
    RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
END;
$function$;



-- Function: create_telegram_broadcast
-- Arguments: p_bot_id uuid, p_sender_id uuid, p_title character varying, p_message text, p_post_ids uuid[], p_recipient_ids uuid[], p_broadcast_type character varying DEFAULT 'post_selection'::character varying, p_target_audience broadcast_audience_enum DEFAULT 'all'::broadcast_audience_enum
CREATE OR REPLACE FUNCTION public.create_telegram_broadcast(p_bot_id uuid, p_sender_id uuid, p_title character varying, p_message text, p_post_ids uuid[], p_recipient_ids uuid[], p_broadcast_type character varying DEFAULT 'post_selection'::character varying, p_target_audience broadcast_audience_enum DEFAULT 'all'::broadcast_audience_enum)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_broadcast_id UUID;
    v_post_id UUID;
    v_recipient_id UUID;
BEGIN
    -- Create broadcast with target_audience
    INSERT INTO telegram_broadcasts (
        bot_id, sender_id, title, message, broadcast_type,
        total_recipients, status, target_audience
    ) VALUES (
        p_bot_id, p_sender_id, p_title, p_message, p_broadcast_type,
        array_length(p_recipient_ids, 1), 'draft', p_target_audience
    ) RETURNING id INTO v_broadcast_id;
    
    -- Add posts to broadcast
    FOREACH v_post_id IN ARRAY p_post_ids
    LOOP
        INSERT INTO telegram_broadcast_posts (broadcast_id, post_id)
        VALUES (v_broadcast_id, v_post_id);
    END LOOP;
    
    -- Add recipients to broadcast (already filtered by caller)
    FOREACH v_recipient_id IN ARRAY p_recipient_ids
    LOOP
        INSERT INTO telegram_broadcast_recipients (broadcast_id, subscriber_id)
        VALUES (v_broadcast_id, v_recipient_id);
    END LOOP;
    
    RETURN v_broadcast_id;
END;
$function$;



-- Function: create_webhook_notification
-- Arguments: p_user_id uuid, p_webhook_id text, p_event_type text, p_event_id text, p_title text, p_message text, p_paypal_data jsonb DEFAULT '{}'::jsonb, p_severity text DEFAULT 'info'::text
CREATE OR REPLACE FUNCTION public.create_webhook_notification(p_user_id uuid, p_webhook_id text, p_event_type text, p_event_id text, p_title text, p_message text, p_paypal_data jsonb DEFAULT '{}'::jsonb, p_severity text DEFAULT 'info'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO webhook_notifications (
    user_id,
    webhook_id,
    event_type,
    event_id,
    title,
    message,
    paypal_data,
    severity
  ) VALUES (
    p_user_id,
    p_webhook_id,
    p_event_type,
    p_event_id,
    p_title,
    p_message,
    p_paypal_data,
    p_severity
  )
  ON CONFLICT (user_id, event_id) DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    paypal_data = EXCLUDED.paypal_data,
    severity = EXCLUDED.severity
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$;



-- Function: decrement_followers_count
-- Arguments: profile_id uuid
CREATE OR REPLACE FUNCTION public.decrement_followers_count(profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE profiles
  SET followers = GREATEST(0, followers - 1)
  WHERE id = profile_id;
END;
$function$;



-- Function: decrement_following_count
-- Arguments: profile_id uuid
CREATE OR REPLACE FUNCTION public.decrement_following_count(profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE profiles
  SET following = GREATEST(0, following - 1)
  WHERE id = profile_id;
END;
$function$;



-- Function: delete_user_completely
-- Arguments: p_user_id uuid, p_admin_email text DEFAULT NULL::text
CREATE OR REPLACE FUNCTION public.delete_user_completely(p_user_id uuid, p_admin_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_deleted_data JSONB;
  v_profile_username TEXT;
  v_posts_count INT;
  v_comments_count INT;
  v_followings_count INT;
  v_followers_count INT;
  v_subscriptions_count INT;
  v_post_actions_count INT;
  v_telegram_subs_count INT;
  v_contact_convs_count INT;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', p_user_id
    );
  END IF;
  
  -- Get user info before deletion
  SELECT username INTO v_profile_username FROM profiles WHERE id = p_user_id;
  
  -- Count data to be deleted (for logging)
  SELECT COUNT(*) INTO v_posts_count FROM posts WHERE posts.user_id = p_user_id;
  SELECT COUNT(*) INTO v_comments_count FROM comments WHERE comments.user_id = p_user_id;
  SELECT COUNT(*) INTO v_followings_count FROM user_followings WHERE user_followings.follower_id = p_user_id;
  SELECT COUNT(*) INTO v_followers_count FROM user_followings WHERE user_followings.following_id = p_user_id;
  SELECT COUNT(*) INTO v_post_actions_count FROM post_actions WHERE post_actions.user_id = p_user_id;
  
  -- Check if telegram_subscribers exists (ignore if column doesn't match)
  BEGIN
    SELECT COUNT(*) INTO v_telegram_subs_count FROM telegram_subscribers WHERE telegram_subscribers.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_telegram_subs_count := 0;
    WHEN undefined_column THEN
      v_telegram_subs_count := 0;
  END;
  
  -- Check if contact_conversations exists (ignore if column doesn't match)
  BEGIN
    SELECT COUNT(*) INTO v_contact_convs_count FROM contact_conversations WHERE contact_conversations.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_contact_convs_count := 0;
    WHEN undefined_column THEN
      v_contact_convs_count := 0;
  END;
  
  v_subscriptions_count := 0;
  
  -- Start deletion cascade - Delete ALL user data
  
  -- 1. Delete all comments by this user
  DELETE FROM comments WHERE comments.user_id = p_user_id;
  
  -- 2. Delete all post actions (buy/sell votes) by this user
  DELETE FROM post_actions WHERE post_actions.user_id = p_user_id;
  
  -- 3. Delete all posts by this user (cascade will handle related tables)
  DELETE FROM posts WHERE posts.user_id = p_user_id;
  
  -- 4. Delete ALL followings relationships (both directions)
  -- Remove where this user follows others
  DELETE FROM user_followings WHERE user_followings.follower_id = p_user_id;
  -- Remove where others follow this user
  DELETE FROM user_followings WHERE user_followings.following_id = p_user_id;
  
  -- 5. Delete Telegram related data (if tables exist and columns match)
  BEGIN
    DELETE FROM telegram_subscribers WHERE telegram_subscribers.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  BEGIN
    DELETE FROM telegram_bots WHERE telegram_bots.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  BEGIN
    DELETE FROM telegram_broadcasts WHERE telegram_broadcasts.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  -- 6. Delete contact conversations (if table exists and columns match)
  BEGIN
    DELETE FROM contact_conversations WHERE contact_conversations.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  -- 7. Delete profile (this should be last before auth)
  DELETE FROM profiles WHERE id = p_user_id;
  
  -- 8. Delete from auth.users (Supabase auth table)
  DELETE FROM auth.users WHERE id = p_user_id;
  
  -- Build response JSON
  v_deleted_data := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'username', v_profile_username,
    'deleted_counts', jsonb_build_object(
      'posts', v_posts_count,
      'comments', v_comments_count,
      'followings', v_followings_count,
      'followers', v_followers_count,
      'subscriptions', v_subscriptions_count,
      'post_actions', v_post_actions_count,
      'telegram_subscriptions', v_telegram_subs_count,
      'contact_conversations', v_contact_convs_count
    ),
    'deleted_at', NOW()
  );
  
  -- Log admin activity if admin email provided
  IF p_admin_email IS NOT NULL THEN
    PERFORM log_admin_activity(
      p_admin_email,
      'delete_user',
      p_user_id,
      v_deleted_data,
      NULL,
      NULL
    );
  END IF;
  
  RETURN v_deleted_data;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', p_user_id
    );
END;
$function$;



-- Function: delete_users_bulk
-- Arguments: p_user_ids uuid[], p_admin_email text DEFAULT NULL::text
CREATE OR REPLACE FUNCTION public.delete_users_bulk(p_user_ids uuid[], p_admin_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_result JSONB;
  v_results JSONB[] := '{}';
  v_success_count INT := 0;
  v_failure_count INT := 0;
BEGIN
  -- Loop through each user
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Delete user
    v_result := delete_user_completely(v_user_id, p_admin_email);
    
    -- Count successes/failures
    IF (v_result->>'success')::boolean THEN
      v_success_count := v_success_count + 1;
    ELSE
      v_failure_count := v_failure_count + 1;
    END IF;
    
    -- Add to results array
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_requested', array_length(p_user_ids, 1),
    'successful_deletions', v_success_count,
    'failed_deletions', v_failure_count,
    'results', to_jsonb(v_results)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;



-- Function: expire_yearly_subscriptions
CREATE OR REPLACE FUNCTION public.expire_yearly_subscriptions()
 RETURNS TABLE(expired_count integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_expired_count INTEGER := 0;
BEGIN
    -- Update yearly subscriptions that have passed their expiry date
    UPDATE user_subscriptions
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'active'
    AND billing_period = 'yearly'
    AND expires_at <= NOW();
    
    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_expired_count;
END;
$function$;



-- Function: get_all_users_admin
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
 RETURNS TABLE(user_id uuid, username text, email text, avatar_url text, created_at timestamp with time zone, posts_count bigint, comments_count bigint, followers_count bigint, following_count bigint, subscription_plan text, is_active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    COALESCE(p.username, 'user_' || SUBSTRING(p.id::TEXT, 1, 8))::TEXT AS username,
    COALESCE(au.email, 'No email')::TEXT AS email,
    COALESCE(p.avatar_url, '')::TEXT AS avatar_url,
    p.created_at,
    COALESCE(posts_stats.count, 0) AS posts_count,
    COALESCE(comments_stats.count, 0) AS comments_count,
    COALESCE(followers_stats.count, 0) AS followers_count,
    COALESCE(following_stats.count, 0) AS following_count,
    'free'::TEXT AS subscription_plan,
    COALESCE(au.confirmed_at IS NOT NULL, false) AS is_active
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN (
    SELECT posts.user_id, COUNT(*) AS count 
    FROM posts 
    GROUP BY posts.user_id
  ) posts_stats ON posts_stats.user_id = p.id
  LEFT JOIN (
    SELECT comments.user_id, COUNT(*) AS count 
    FROM comments 
    GROUP BY comments.user_id
  ) comments_stats ON comments_stats.user_id = p.id
  LEFT JOIN (
    SELECT user_followings.following_id, COUNT(*) AS count 
    FROM user_followings 
    GROUP BY user_followings.following_id
  ) followers_stats ON followers_stats.following_id = p.id
  LEFT JOIN (
    SELECT user_followings.follower_id, COUNT(*) AS count 
    FROM user_followings 
    GROUP BY user_followings.follower_id
  ) following_stats ON following_stats.follower_id = p.id
  ORDER BY p.created_at DESC;
END;
$function$;



-- Function: get_broker_subscriber_count
-- Arguments: p_broker_id uuid
CREATE OR REPLACE FUNCTION public.get_broker_subscriber_count(p_broker_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM broker_subscriptions
    WHERE broker_id = p_broker_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$function$;



-- Function: get_conversation_messages
-- Arguments: conv_id uuid
CREATE OR REPLACE FUNCTION public.get_conversation_messages(conv_id uuid)
 RETURNS TABLE(id uuid, conversation_id uuid, sender character varying, body text, reply_to uuid, admin_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.conversation_id,
    cm.sender,
    cm.body,
    cm.reply_to,
    cm.admin_id,
    cm.created_at
  FROM contact_messages cm
  WHERE cm.conversation_id = conv_id
  ORDER BY cm.created_at ASC;
END;
$function$;



-- Function: get_follower_telegram_subscribers
-- Arguments: p_user_id uuid, p_bot_id uuid, p_premium_only boolean DEFAULT false
CREATE OR REPLACE FUNCTION public.get_follower_telegram_subscribers(p_user_id uuid, p_bot_id uuid, p_premium_only boolean DEFAULT false)
 RETURNS TABLE(subscriber_id uuid, telegram_user_id bigint, telegram_username character varying, telegram_first_name character varying, platform_user_id uuid, username character varying, full_name character varying, avatar_url text, subscription_tier subscription_tier_enum)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ts.id as subscriber_id,
    ts.telegram_user_id,
    ts.telegram_username,
    ts.telegram_first_name,
    ts.platform_user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    ts.subscription_tier
  FROM telegram_subscribers ts
  JOIN profiles p ON ts.platform_user_id = p.id
  WHERE ts.bot_id = p_bot_id
    AND ts.is_subscribed = TRUE
    AND (
      -- If premium_only is TRUE, only return premium subscribers
      (p_premium_only = FALSE) OR 
      (p_premium_only = TRUE AND ts.subscription_tier = 'premium')
    )
    AND EXISTS (
      SELECT 1 FROM user_followings uf
      WHERE uf.follower_id = ts.platform_user_id
      AND uf.following_id = p_user_id
    );
END;
$function$;



-- Function: get_monthly_price_check_count
-- Arguments: check_user_id uuid
CREATE OR REPLACE FUNCTION public.get_monthly_price_check_count(check_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER 
        FROM public.price_checks 
        WHERE user_id = check_user_id 
        AND created_at >= DATE_TRUNC('month', NOW())
    );
END;
$function$;



-- Function: get_nested_comments
-- Arguments: p_post_id uuid
CREATE OR REPLACE FUNCTION public.get_nested_comments(p_post_id uuid)
 RETURNS TABLE(comment_id uuid, user_id uuid, username character varying, full_name character varying, avatar_url text, content text, created_at timestamp with time zone, parent_comment_id uuid, level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    -- Base case: top-level comments
    SELECT 
      c.id,
      c.user_id,
      p.username,
      p.full_name,
      p.avatar_url,
      c.content,
      c.created_at,
      c.parent_comment_id,
      0 as level
    FROM comments c
    JOIN profiles p ON c.user_id = p.id
    WHERE c.post_id = p_post_id AND c.parent_comment_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child comments
    SELECT 
      c.id,
      c.user_id,
      p.username,
      p.full_name,
      p.avatar_url,
      c.content,
      c.created_at,
      c.parent_comment_id,
      ct.level + 1
    FROM comments c
    JOIN profiles p ON c.user_id = p.id
    JOIN comment_tree ct ON c.parent_comment_id = ct.comment_id
  )
  SELECT * FROM comment_tree
  ORDER BY level, created_at;
END;
$function$;



-- Function: get_post_action_counts
-- Arguments: post_uuid uuid
CREATE OR REPLACE FUNCTION public.get_post_action_counts(post_uuid uuid)
 RETURNS TABLE(buy_count bigint, sell_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN pa.action_type = 'buy' THEN 1 END) as buy_count,
    COUNT(CASE WHEN pa.action_type = 'sell' THEN 1 END) as sell_count
  FROM post_actions pa
  WHERE pa.post_id = post_uuid;
END;
$function$;



-- Function: get_post_comment_count
-- Arguments: post_uuid uuid
CREATE OR REPLACE FUNCTION public.get_post_comment_count(post_uuid uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*) 
    FROM comments 
    WHERE post_id = post_uuid
  );
END;
$function$;



-- Function: get_subscription_info
-- Arguments: p_user_id uuid
CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
  v_free_plan_id UUID;
  v_has_active BOOLEAN;
BEGIN
  -- Ensure free plan exists
  SELECT sp.id INTO v_free_plan_id
  FROM subscription_plans sp
  WHERE sp.name = 'free'
  LIMIT 1;

  IF v_free_plan_id IS NULL THEN
    RAISE EXCEPTION 'Free plan not found in subscription_plans table';
  END IF;

  -- Check if user already has an active subscription
  SELECT EXISTS (
    SELECT 1 FROM user_subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active'
  ) INTO v_has_active;

  -- Create free subscription if missing (no ON CONFLICT used)
  IF NOT v_has_active THEN
    INSERT INTO user_subscriptions (user_id, plan_id, status)
    SELECT p_user_id, v_free_plan_id, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM user_subscriptions s
      WHERE s.user_id = p_user_id AND s.status = 'active'
    );
  END IF;

  -- Build JSON result from latest active subscription
  SELECT json_build_object(
    'user_id', s.user_id,
    'plan_id', sp.id,
    'plan_name', sp.name,
    'plan_display_name', sp.display_name,
    'billing_period', s.billing_period,
    'price_check_limit', sp.price_check_limit,
    'price_checks_used', COALESCE(s.price_checks_used, 0),
    'post_creation_limit', sp.post_creation_limit,
    'posts_created', COALESCE(s.posts_created, 0),
    'subscription_status', s.status,
    'start_date', s.started_at,
    'end_date', s.expires_at,
    'can_create_premium_plans', (sp.name = 'pro'),
    'show_ads', (sp.name = 'free')
  ) INTO v_result
  FROM user_subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = p_user_id AND s.status = 'active'
  ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$function$;



-- Function: get_table_columns
-- Arguments: table_name text
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
 RETURNS TABLE(column_name text, data_type text, column_default text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.column_default::TEXT
  FROM 
    information_schema.columns c
  WHERE 
    c.table_name = table_name
    AND c.table_schema = 'public';
END;
$function$;



-- Function: get_user_post_action
-- Arguments: p_post_id uuid, p_user_id uuid
CREATE OR REPLACE FUNCTION public.get_user_post_action(p_post_id uuid, p_user_id uuid)
 RETURNS character varying
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    user_action VARCHAR(10);
BEGIN
    SELECT action_type INTO user_action
    FROM post_actions
    WHERE post_id = p_post_id AND user_id = p_user_id
    LIMIT 1;
    
    RETURN COALESCE(user_action, 'none');
END;
$function$;



-- Function: get_user_telegram_bot
-- Arguments: p_user_id uuid
CREATE OR REPLACE FUNCTION public.get_user_telegram_bot(p_user_id uuid)
 RETURNS TABLE(bot_id uuid, bot_token text, bot_username character varying, bot_name character varying, is_active boolean, subscriber_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    tb.id as bot_id,
    tb.bot_token,
    tb.bot_username,
    tb.bot_name,
    tb.is_active,
    COUNT(ts.id) as subscriber_count
  FROM telegram_bots tb
  LEFT JOIN telegram_subscribers ts ON tb.id = ts.bot_id AND ts.is_subscribed = TRUE
  WHERE tb.user_id = p_user_id
  GROUP BY tb.id, tb.bot_token, tb.bot_username, tb.bot_name, tb.is_active;
END;
$function$;



-- Function: handle_auth_sign_in
CREATE OR REPLACE FUNCTION public.handle_auth_sign_in()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles
  SET last_sign_in = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$function$;



-- Function: handle_new_comment
CREATE OR REPLACE FUNCTION public.handle_new_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  post_owner_id UUID;
BEGIN
  -- Get the post owner
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Only create notification if the comment is not from the post owner
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id, comment_id)
    VALUES (post_owner_id, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;



-- Function: handle_new_follower
CREATE OR REPLACE FUNCTION public.handle_new_follower()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Create notification for the user being followed
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  
  RETURN NEW;
END;
$function$;



-- Function: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    email,
    avatar_url,
    bio,
    background_url,
    favorite_markets,
    success_posts,
    loss_posts,
    experience_score,
    followers,
    following,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    '',
    '',
    '',
    ARRAY[]::text[],
    0,
    0,
    0,
    0,
    0,
    now(),
    now()
  );
  RETURN new;
END;
$function$;



-- Function: handle_user_sign_in
CREATE OR REPLACE FUNCTION public.handle_user_sign_in()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles
  SET last_sign_in = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;



-- Function: handle_user_update
CREATE OR REPLACE FUNCTION public.handle_user_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles
  SET 
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name),
    email = COALESCE(NEW.email, profiles.email),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', profiles.avatar_url),
    updated_at = now(),
    last_sign_in = NEW.last_sign_in_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;



-- Function: increment_followers_count
-- Arguments: profile_id uuid
CREATE OR REPLACE FUNCTION public.increment_followers_count(profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE profiles
  SET followers = followers + 1
  WHERE id = profile_id;
END;
$function$;



-- Function: increment_following_count
-- Arguments: profile_id uuid
CREATE OR REPLACE FUNCTION public.increment_following_count(profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE profiles
  SET following = following + 1
  WHERE id = profile_id;
END;
$function$;



-- Function: is_subscribed_to_broker
-- Arguments: p_user_id uuid, p_broker_id uuid
CREATE OR REPLACE FUNCTION public.is_subscribed_to_broker(p_user_id uuid, p_broker_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM broker_subscriptions
    WHERE user_id = p_user_id
      AND broker_id = p_broker_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$function$;



-- Function: is_user_pro
-- Arguments: check_user_id uuid
CREATE OR REPLACE FUNCTION public.is_user_pro(check_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.subscriptions 
        WHERE user_id = check_user_id 
        AND status = 'active' 
        AND tier = 'pro'
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$function$;



-- Function: log_admin_activity
-- Arguments: p_admin_email text, p_action_type text, p_target_user_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT NULL::jsonb, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text
CREATE OR REPLACE FUNCTION public.log_admin_activity(p_admin_email text, p_action_type text, p_target_user_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT NULL::jsonb, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_activity_log (
    admin_email,
    action_type,
    target_user_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_email,
    p_action_type,
    p_target_user_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;



-- Function: log_post_creation
-- Arguments: p_user_id uuid
CREATE OR REPLACE FUNCTION public.log_post_creation(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_can_create BOOLEAN;
    v_subscription_exists BOOLEAN;
    v_result JSON;
BEGIN
    -- Check if user can create the post
    SELECT check_post_limit(p_user_id) INTO v_can_create;
    
    IF NOT v_can_create THEN
        -- Return current subscription info even if check fails
        SELECT json_build_object(
            'success', FALSE,
            'posts_created', us.posts_created,
            'post_creation_limit', sp.post_creation_limit,
            'plan_name', sp.name
        ) INTO v_result
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = p_user_id AND us.status = 'active';
        
        RETURN COALESCE(v_result, '{"success": false, "posts_created": 0}'::JSON);
    END IF;
    
    -- Check if user has an active subscription
    SELECT EXISTS(
        SELECT 1 FROM user_subscriptions 
        WHERE user_id = p_user_id AND status = 'active'
    ) INTO v_subscription_exists;
    
    -- Increment the usage counter and return updated info with row lock
    IF v_subscription_exists THEN
        UPDATE user_subscriptions 
        SET 
            posts_created = COALESCE(posts_created, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id AND status = 'active'
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'posts_created', user_subscriptions.posts_created,
                'post_creation_limit', (SELECT post_creation_limit FROM subscription_plans WHERE id = user_subscriptions.plan_id),
                'plan_name', (SELECT name FROM subscription_plans WHERE id = user_subscriptions.plan_id)
            )
        ) INTO v_result;
    ELSE
        -- Create free subscription if none exists and return new data
        INSERT INTO user_subscriptions (user_id, plan_id, status, price_checks_used, posts_created)
        SELECT p_user_id, sp.id, 'active', 0, 1
        FROM subscription_plans sp
        WHERE sp.name = 'free'
        ON CONFLICT (user_id, status)
        DO UPDATE SET 
            posts_created = COALESCE(user_subscriptions.posts_created, 0) + 1,
            updated_at = NOW()
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'posts_created', user_subscriptions.posts_created,
                'post_creation_limit', (SELECT post_creation_limit FROM subscription_plans sp WHERE sp.name = 'free'),
                'plan_name', 'free'
            )
        ) INTO v_result;
    END IF;
    
    RETURN v_result;
END;
$function$;



-- Function: log_price_check
-- Arguments: p_user_id uuid, p_symbol character varying, p_exchange character varying DEFAULT NULL::character varying, p_country character varying DEFAULT NULL::character varying, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text
CREATE OR REPLACE FUNCTION public.log_price_check(p_user_id uuid, p_symbol character varying, p_exchange character varying DEFAULT NULL::character varying, p_country character varying DEFAULT NULL::character varying, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_can_check BOOLEAN;
    v_subscription_exists BOOLEAN;
    v_result JSON;
BEGIN
    -- Check if user can make the price check
    SELECT check_price_limit(p_user_id) INTO v_can_check;
    
    IF NOT v_can_check THEN
        -- Return current subscription info even if check fails
        SELECT json_build_object(
            'success', FALSE,
            'price_checks_used', us.price_checks_used,
            'price_check_limit', sp.price_check_limit,
            'plan_name', sp.name
        ) INTO v_result
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = p_user_id AND us.status = 'active';
        
        RETURN COALESCE(v_result, '{"success": false, "price_checks_used": 0}'::JSON);
    END IF;
    
    -- Check if user has an active subscription
    SELECT EXISTS(
        SELECT 1 FROM user_subscriptions 
        WHERE user_id = p_user_id AND status = 'active'
    ) INTO v_subscription_exists;
    
    -- If user has active subscription, increment the counter and return updated data
    IF v_subscription_exists THEN
        UPDATE user_subscriptions 
        SET 
            price_checks_used = COALESCE(price_checks_used, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id AND status = 'active'
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'price_checks_used', price_checks_used,
                'price_check_limit', (SELECT price_check_limit FROM subscription_plans WHERE id = plan_id),
                'plan_name', (SELECT name FROM subscription_plans WHERE id = plan_id)
            )
        ) INTO v_result;
    ELSE
        -- Create free subscription if none exists and return new data
        INSERT INTO user_subscriptions (user_id, plan_id, status, price_checks_used, posts_created)
        SELECT p_user_id, sp.id, 'active', 1, 0
        FROM subscription_plans sp
        WHERE sp.name = 'free'
        ON CONFLICT (user_id, status)
        DO UPDATE SET 
            price_checks_used = COALESCE(user_subscriptions.price_checks_used, 0) + 1,
            updated_at = NOW()
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'price_checks_used', user_subscriptions.price_checks_used,
                'price_check_limit', (SELECT price_check_limit FROM subscription_plans sp WHERE sp.name = 'free'),
                'plan_name', 'free'
            )
        ) INTO v_result;
    END IF;
    
    RETURN v_result;
END;
$function$;



-- Function: prevent_circular_comments
CREATE OR REPLACE FUNCTION public.prevent_circular_comments()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    parent_comment UUID;
    current_comment UUID;
BEGIN
    -- Check for circular references
    current_comment := NEW.id;
    parent_comment := NEW.parent_comment_id;
    
    WHILE parent_comment IS NOT NULL LOOP
        IF parent_comment = current_comment THEN
            RAISE EXCEPTION 'Circular reference detected in comments';
        END IF;
        
        SELECT c.parent_comment_id INTO parent_comment
        FROM comments c
        WHERE c.id = parent_comment;
    END LOOP;
    
    RETURN NEW;
END;
$function$;



-- Function: public_get_users_with_active_bots
-- Arguments: p_user_ids uuid[]
CREATE OR REPLACE FUNCTION public.public_get_users_with_active_bots(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, bot_username text, is_active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return query
  select tb.user_id, tb.bot_username::text as bot_username, tb.is_active
  from telegram_bots tb
  where tb.is_active = true
    and (p_user_ids is null or tb.user_id = any (p_user_ids));
end;
$function$;



-- Function: refresh_profile_stats
CREATE OR REPLACE FUNCTION public.refresh_profile_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW public.profile_stats;
  RETURN NULL;
END;
$function$;



-- Function: renew_monthly_subscriptions
CREATE OR REPLACE FUNCTION public.renew_monthly_subscriptions()
 RETURNS TABLE(renewed_count integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_renewed_count INTEGER := 0;
    v_subscription RECORD;
BEGIN
    -- Loop through active monthly subscriptions that are about to expire (within 1 day)
    FOR v_subscription IN
        SELECT id, user_id, plan_id, started_at, expires_at
        FROM user_subscriptions
        WHERE status = 'active'
        AND billing_period = 'monthly'
        AND expires_at <= NOW() + INTERVAL '1 day'
        AND expires_at > NOW()
    LOOP
        -- Extend the subscription by 1 month
        UPDATE user_subscriptions
        SET expires_at = expires_at + INTERVAL '1 month',
            price_checks_reset_at = NOW() + INTERVAL '1 month',
            posts_reset_at = NOW() + INTERVAL '1 month',
            price_checks_used = 0,
            posts_created = 0,
            updated_at = NOW()
        WHERE id = v_subscription.id;
        
        v_renewed_count := v_renewed_count + 1;
        
        RAISE NOTICE 'Renewed monthly subscription % for user %', v_subscription.id, v_subscription.user_id;
    END LOOP;
    
    RETURN QUERY SELECT v_renewed_count;
END;
$function$;



-- Function: reset_monthly_usage
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Reset price_checks_used and posts_created to 0 for all active subscriptions
  UPDATE user_subscriptions
  SET price_checks_used = 0,
      posts_created = 0,
      price_checks_reset_at = NOW() + INTERVAL '1 month',
      posts_reset_at = NOW() + INTERVAL '1 month'
  WHERE status = 'active';
END;
$function$;



-- Function: setup_schema
CREATE OR REPLACE FUNCTION public.setup_schema()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Enable UUID extension if not already enabled
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Posts table for storing trading posts
  CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    image_url TEXT,
    symbol TEXT,
    company_name TEXT,
    country TEXT,
    exchange TEXT,
    current_price DECIMAL(10, 2),
    target_price DECIMAL(10, 2),
    stop_loss_price DECIMAL(10, 2),
    strategy TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Create index on user_id for faster queries
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);

  -- Create index on created_at for faster sorting
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

  -- Drop the existing view if it exists
  DROP VIEW IF EXISTS post_details;

  -- Create a view that joins posts with user profiles for easier querying
  CREATE VIEW post_details AS
  SELECT 
    p.*,
    pr.username,
    pr.avatar_url AS user_avatar,
    pr.background_url AS user_background
  FROM 
    posts p
  JOIN 
    profiles pr ON p.user_id = pr.id;

  -- RLS Policies for posts table
  ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
  DROP POLICY IF EXISTS "Authenticated users can insert posts" ON posts;
  DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
  DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

  -- Anyone can read posts
  CREATE POLICY "Anyone can read posts"
    ON posts FOR SELECT
    USING (true);

  -- Only authenticated users can insert posts
  CREATE POLICY "Authenticated users can insert posts"
    ON posts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  -- Only post owners can update their posts
  CREATE POLICY "Users can update their own posts"
    ON posts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Only post owners can delete their posts
  CREATE POLICY "Users can delete their own posts"
    ON posts FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

  -- User strategies table to store trading strategies for each user
  CREATE TABLE IF NOT EXISTS user_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, strategy_name)
  );

  -- Create index on user_id for faster queries
  CREATE INDEX IF NOT EXISTS idx_user_strategies_user_id ON user_strategies(user_id);

  -- RLS Policies for user_strategies table
  ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can read their own strategies" ON user_strategies;
  DROP POLICY IF EXISTS "Authenticated users can insert strategies" ON user_strategies;
  DROP POLICY IF EXISTS "Users can update their own strategies" ON user_strategies;
  DROP POLICY IF EXISTS "Users can delete their own strategies" ON user_strategies;

  -- Users can read their own strategies
  CREATE POLICY "Users can read their own strategies"
    ON user_strategies FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  -- Authenticated users can insert strategies
  CREATE POLICY "Authenticated users can insert strategies"
    ON user_strategies FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  -- Users can update their own strategies
  CREATE POLICY "Users can update their own strategies"
    ON user_strategies FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Users can delete their own strategies
  CREATE POLICY "Users can delete their own strategies"
    ON user_strategies FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

  -- Add default strategies for all users
  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Swing Trading'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Swing Trading'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Day Trading'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Day Trading'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Position Trading'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Position Trading'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Scalping'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Scalping'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Trend Following'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Trend Following'
    );

END;
$function$;



-- Function: sync_subscriber_tier_from_subscription
-- Arguments: p_user_id uuid
CREATE OR REPLACE FUNCTION public.sync_subscriber_tier_from_subscription(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_premium BOOLEAN;
BEGIN
  -- Check if user has active pro subscription
  SELECT EXISTS(
    SELECT 1 FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND sp.name = 'pro'
  ) INTO v_is_premium;
  
  -- Update all telegram subscribers for this user
  UPDATE telegram_subscribers
  SET subscription_tier = CASE 
    WHEN v_is_premium THEN 'premium'::subscription_tier_enum
    ELSE 'free'::subscription_tier_enum
  END
  WHERE platform_user_id = p_user_id;
END;
$function$;



-- Function: toggle_post_action
-- Arguments: p_post_id uuid, p_user_id uuid, p_action_type character varying
CREATE OR REPLACE FUNCTION public.toggle_post_action(p_post_id uuid, p_user_id uuid, p_action_type character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    existing_action UUID;
BEGIN
    -- Check if action already exists
    SELECT id INTO existing_action
    FROM post_actions
    WHERE post_id = p_post_id AND user_id = p_user_id AND action_type = p_action_type;
    
    IF existing_action IS NOT NULL THEN
        -- Remove existing action
        DELETE FROM post_actions WHERE id = existing_action;
        RETURN FALSE; -- Action removed
    ELSE
        -- Remove opposite action if exists
        DELETE FROM post_actions 
        WHERE post_id = p_post_id AND user_id = p_user_id 
        AND action_type != p_action_type;
        
        -- Add new action
        INSERT INTO post_actions (post_id, user_id, action_type)
        VALUES (p_post_id, p_user_id, p_action_type);
        RETURN TRUE; -- Action added
    END IF;
END;
$function$;



-- Function: trigger_sync_telegram_subscriber_tier
CREATE OR REPLACE FUNCTION public.trigger_sync_telegram_subscriber_tier()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Sync for the affected user
  PERFORM sync_subscriber_tier_from_subscription(NEW.user_id);
  RETURN NEW;
END;
$function$;



-- Function: update_broker_subscriptions_updated_at
CREATE OR REPLACE FUNCTION public.update_broker_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;



-- Function: update_comment_edited_at
CREATE OR REPLACE FUNCTION public.update_comment_edited_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.edited_at = NOW();
        NEW.is_edited = TRUE;
    END IF;
    RETURN NEW;
END;
$function$;



-- Function: update_contact_conversation_timestamps
CREATE OR REPLACE FUNCTION public.update_contact_conversation_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  IF TG_OP = 'INSERT' THEN
    NEW.last_message_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;



-- Function: update_notification_read_at
CREATE OR REPLACE FUNCTION public.update_notification_read_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  ELSIF NEW.is_read = false THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$function$;



-- Function: update_paypal_accounts_updated_at
CREATE OR REPLACE FUNCTION public.update_paypal_accounts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;



-- Function: update_premium_plans_updated_at
CREATE OR REPLACE FUNCTION public.update_premium_plans_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;



-- Function: update_profile_followers
CREATE OR REPLACE FUNCTION public.update_profile_followers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update following count for the follower
    UPDATE public.profiles
    SET following = COALESCE(following, 0) + 1
    WHERE id = NEW.follower_id;
    
    -- Update followers count for the followed user
    UPDATE public.profiles
    SET followers = COALESCE(followers, 0) + 1
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update following count for the follower
    UPDATE public.profiles
    SET following = GREATEST(COALESCE(following, 0) - 1, 0)
    WHERE id = OLD.follower_id;
    
    -- Update followers count for the followed user
    UPDATE public.profiles
    SET followers = GREATEST(COALESCE(followers, 0) - 1, 0)
    WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$function$;



-- Function: update_profiles_updated_at
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;



-- Function: update_subscriber_last_interaction
CREATE OR REPLACE FUNCTION public.update_subscriber_last_interaction()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.last_interaction = NOW();
    RETURN NEW;
END;
$function$;



-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;



-- Function: upgrade_to_pro
-- Arguments: p_user_id uuid, p_paypal_order_id character varying
CREATE OR REPLACE FUNCTION public.upgrade_to_pro(p_user_id uuid, p_paypal_order_id character varying)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_subscription_id UUID;
    v_pro_plan_id UUID;
BEGIN
    -- Get pro plan id
    SELECT id INTO v_pro_plan_id FROM subscription_plans WHERE name = 'pro';
    
    -- Cancel existing subscription
    UPDATE user_subscriptions
    SET status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';
    
    -- Create new pro subscription
    INSERT INTO user_subscriptions (
        user_id, 
        plan_id, 
        status, 
        paypal_order_id,
        price_checks_used,
        price_checks_reset_at
    )
    VALUES (
        p_user_id, 
        v_pro_plan_id, 
        'active',
        p_paypal_order_id,
        0,
        NOW() + INTERVAL '1 month'
    )
    RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
END;
$function$;


-- === VIEWS (public) ===
CREATE OR REPLACE VIEW public.comments_with_user_info AS
SELECT
  c.id,
  c.post_id,
  c.user_id,
  c.parent_comment_id,
  c.content,
  c.created_at,
  c.updated_at,
  c.is_edited,
  c.edited_at,
  p.username,
  p.avatar_url,
  p.full_name
FROM public.comments AS c
LEFT JOIN public.profiles AS p
  ON p.id = c.user_id;
CREATE OR REPLACE VIEW public.free_telegram_subscribers AS
SELECT
  ts.id,
  ts.bot_id,
  ts.telegram_user_id,
  ts.telegram_username,
  ts.telegram_first_name,
  ts.telegram_last_name,
  ts.platform_user_id,
  ts.is_subscribed,
  ts.language_code,
  ts.subscribed_at,
  ts.last_interaction,
  ts.subscription_tier,
  pr.username,
  pr.full_name,
  pr.avatar_url
FROM public.telegram_subscribers AS ts
LEFT JOIN public.profiles AS pr
  ON pr.id = ts.platform_user_id
WHERE ts.subscription_tier = 'free'::public.subscription_tier_enum;
CREATE OR REPLACE VIEW public.posts_with_action_counts AS
SELECT
  p.*,
  COALESCE(a.buy_count, 0) AS buy_count,
  COALESCE(a.sell_count, 0) AS sell_count
FROM public.posts AS p
LEFT JOIN (
  SELECT
    post_id,
    COUNT(*) FILTER (WHERE action_type = 'BUY') AS buy_count,
    COUNT(*) FILTER (WHERE action_type = 'SELL') AS sell_count
  FROM public.post_actions
  GROUP BY post_id
) AS a
  ON a.post_id = p.id;
CREATE OR REPLACE VIEW public.posts_with_stats AS
SELECT
  p.*,
  COALESCE(a.buy_count, 0) AS buy_count,
  COALESCE(a.sell_count, 0) AS sell_count,
  COALESCE(c.comment_count, 0) AS comment_count
FROM public.posts AS p
LEFT JOIN (
  SELECT
    post_id,
    COUNT(*) FILTER (WHERE action_type = 'BUY') AS buy_count,
    COUNT(*) FILTER (WHERE action_type = 'SELL') AS sell_count
  FROM public.post_actions
  GROUP BY post_id
) AS a
  ON a.post_id = p.id
LEFT JOIN (
  SELECT
    post_id,
    COUNT(*) AS comment_count
  FROM public.comments
  GROUP BY post_id
) AS c
  ON c.post_id = p.id;
CREATE OR REPLACE VIEW public.premium_plans_with_stats AS
WITH post_stats AS (
  SELECT
    user_id,
    COUNT(*) AS total_posts,
    COUNT(*) FILTER (WHERE target_reached = true) AS successful_posts
  FROM public.posts
  GROUP BY user_id
),
telegram_stats AS (
  SELECT
    platform_user_id AS user_id,
    COUNT(*) AS total_telegram_subscribers,
    COUNT(*) FILTER (WHERE subscription_tier = 'premium'::public.subscription_tier_enum) AS premium_telegram_subscribers
  FROM public.telegram_subscribers
  GROUP BY platform_user_id
)
SELECT
  pp.id,
  pp.user_id,
  pp.description,
  pp.features,
  pp.pricing,
  pp.stats,
  pp.paypal_account,
  pp.is_active,
  pp.created_at,
  pp.updated_at,
  COALESCE(ps.total_posts, 0) AS total_posts,
  COALESCE(ps.successful_posts, 0) AS successful_posts,
  CASE
    WHEN ps.total_posts > 0 THEN ps.total_posts::numeric
    ELSE 0::numeric
  END AS avg_posts_per_month,
  CASE
    WHEN ps.total_posts > 0 THEN (ps.successful_posts::numeric * 100.0 / ps.total_posts::numeric)
    ELSE 0::numeric
  END AS calculated_success_rate,
  COALESCE(ts.total_telegram_subscribers, 0) AS total_telegram_subscribers,
  COALESCE(ts.premium_telegram_subscribers, 0) AS premium_telegram_subscribers
FROM public.premium_plans AS pp
LEFT JOIN post_stats AS ps
  ON ps.user_id = pp.user_id
LEFT JOIN telegram_stats AS ts
  ON ts.user_id = pp.user_id;
CREATE OR REPLACE VIEW public.premium_telegram_subscribers AS
SELECT
  ts.id,
  ts.bot_id,
  ts.telegram_user_id,
  ts.telegram_username,
  ts.telegram_first_name,
  ts.telegram_last_name,
  ts.platform_user_id,
  ts.is_subscribed,
  ts.language_code,
  ts.subscribed_at,
  ts.last_interaction,
  ts.subscription_tier,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  us.plan_id,
  sp.name AS plan_name
FROM public.telegram_subscribers AS ts
LEFT JOIN public.profiles AS pr
  ON pr.id = ts.platform_user_id
LEFT JOIN public.user_subscriptions AS us
  ON us.user_id = ts.platform_user_id
     AND us.status = 'active'
LEFT JOIN public.subscription_plans AS sp
  ON sp.id = us.plan_id
WHERE ts.subscription_tier = 'premium'::public.subscription_tier_enum;
CREATE OR REPLACE VIEW public.profile_details AS
WITH post_stats AS (
  SELECT
    user_id,
    COUNT(*) AS total_posts,
    COUNT(*) FILTER (WHERE target_reached = true) AS success_posts,
    COUNT(*) FILTER (WHERE target_reached = false AND stop_loss_triggered = true) AS loss_posts
  FROM public.posts
  GROUP BY user_id
)
SELECT
  p.id,
  p.username,
  p.full_name,
  p.bio,
  p.avatar_url,
  p.background_url,
  p.facebook_url,
  p.created_at,
  p.updated_at,
  p.experience_score,
  p.followers,
  p.following,
  COALESCE(s.total_posts, 0) AS total_posts,
  COALESCE(s.success_posts, 0) AS success_posts,
  COALESCE(s.loss_posts, 0) AS loss_posts
FROM public.profiles AS p
LEFT JOIN post_stats AS s
  ON s.user_id = p.id;
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  username,
  avatar_url
FROM public.profiles;
CREATE OR REPLACE VIEW public.subscription_stats AS
SELECT
  billing_period,
  COUNT(*) AS total_subscriptions,
  COUNT(*) FILTER (WHERE status = 'active') AS active_subscriptions,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_subscriptions,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_subscriptions
FROM public.user_subscriptions
GROUP BY billing_period;
CREATE OR REPLACE VIEW public.telegram_broadcasts_with_stats AS
SELECT
  b.id,
  b.bot_id,
  b.sender_id,
  b.title,
  b.message,
  b.broadcast_type,
  b.status,
  b.total_recipients,
  b.sent_count,
  b.failed_count,
  b.scheduled_at,
  b.sent_at,
  b.created_at,
  b.completed_at,
  b.target_audience,
  pr.username AS sender_username,
  pr.full_name AS sender_name,
  COALESCE(p.post_count, 0) AS post_count,
  COALESCE(r.recipient_count, 0) AS recipient_count
FROM public.telegram_broadcasts AS b
LEFT JOIN public.profiles AS pr
  ON pr.id = b.sender_id
LEFT JOIN (
  SELECT
    broadcast_id,
    COUNT(*) AS post_count
  FROM public.telegram_broadcast_posts
  GROUP BY broadcast_id
) AS p
  ON p.broadcast_id = b.id
LEFT JOIN (
  SELECT
    broadcast_id,
    COUNT(*) AS recipient_count
  FROM public.telegram_broadcast_recipients
  GROUP BY broadcast_id
) AS r
  ON r.broadcast_id = b.id;
CREATE OR REPLACE VIEW public.telegram_subscribers_with_subscription AS
SELECT
  ts.id,
  ts.bot_id,
  ts.telegram_user_id,
  ts.telegram_username,
  ts.telegram_first_name,
  ts.telegram_last_name,
  ts.platform_user_id,
  ts.is_subscribed,
  ts.language_code,
  ts.subscribed_at,
  ts.last_interaction,
  ts.subscription_tier,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  us.plan_id,
  sp.name AS plan_name,
  sp.display_name AS plan_display_name,
  us.status AS subscription_status,
  us.expires_at AS subscription_expires_at
FROM public.telegram_subscribers AS ts
LEFT JOIN public.profiles AS pr
  ON pr.id = ts.platform_user_id
LEFT JOIN public.user_subscriptions AS us
  ON us.user_id = ts.platform_user_id
     AND us.status = 'active'
LEFT JOIN public.subscription_plans AS sp
  ON sp.id = us.plan_id;

-- === VIEW GRANTS (public) ===
REVOKE ALL ON VIEW public.comments_with_user_info FROM anon;
GRANT SELECT ON VIEW public.comments_with_user_info TO authenticated;
GRANT SELECT ON VIEW public.comments_with_user_info TO service_role;
GRANT SELECT ON VIEW public.comments_with_user_info TO postgres;
REVOKE ALL ON VIEW public.free_telegram_subscribers FROM anon;
GRANT SELECT ON VIEW public.free_telegram_subscribers TO authenticated;
GRANT SELECT ON VIEW public.free_telegram_subscribers TO service_role;
GRANT SELECT ON VIEW public.free_telegram_subscribers TO postgres;
REVOKE ALL ON VIEW public.posts_with_action_counts FROM anon;
GRANT SELECT ON VIEW public.posts_with_action_counts TO authenticated;
GRANT SELECT ON VIEW public.posts_with_action_counts TO service_role;
GRANT SELECT ON VIEW public.posts_with_action_counts TO postgres;
REVOKE ALL ON VIEW public.posts_with_stats FROM anon;
GRANT SELECT ON VIEW public.posts_with_stats TO authenticated;
GRANT SELECT ON VIEW public.posts_with_stats TO service_role;
GRANT SELECT ON VIEW public.posts_with_stats TO postgres;
REVOKE ALL ON VIEW public.premium_plans_with_stats FROM anon;
GRANT SELECT ON VIEW public.premium_plans_with_stats TO authenticated;
GRANT SELECT ON VIEW public.premium_plans_with_stats TO service_role;
GRANT SELECT ON VIEW public.premium_plans_with_stats TO postgres;
REVOKE ALL ON VIEW public.premium_telegram_subscribers FROM anon;
GRANT SELECT ON VIEW public.premium_telegram_subscribers TO authenticated;
GRANT SELECT ON VIEW public.premium_telegram_subscribers TO service_role;
GRANT SELECT ON VIEW public.premium_telegram_subscribers TO postgres;
REVOKE ALL ON VIEW public.profile_details FROM anon;
GRANT SELECT ON VIEW public.profile_details TO authenticated;
GRANT SELECT ON VIEW public.profile_details TO service_role;
GRANT SELECT ON VIEW public.profile_details TO postgres;
REVOKE ALL ON VIEW public.profiles_public FROM anon;
GRANT SELECT ON VIEW public.profiles_public TO authenticated;
GRANT SELECT ON VIEW public.profiles_public TO service_role;
GRANT SELECT ON VIEW public.profiles_public TO postgres;
REVOKE ALL ON VIEW public.subscription_stats FROM anon;
GRANT SELECT ON VIEW public.subscription_stats TO authenticated;
GRANT SELECT ON VIEW public.subscription_stats TO service_role;
GRANT SELECT ON VIEW public.subscription_stats TO postgres;
REVOKE ALL ON VIEW public.telegram_broadcasts_with_stats FROM anon;
GRANT SELECT ON VIEW public.telegram_broadcasts_with_stats TO authenticated;
GRANT SELECT ON VIEW public.telegram_broadcasts_with_stats TO service_role;
GRANT SELECT ON VIEW public.telegram_broadcasts_with_stats TO postgres;
REVOKE ALL ON VIEW public.telegram_subscribers_with_subscription FROM anon;
GRANT SELECT ON VIEW public.telegram_subscribers_with_subscription TO authenticated;
GRANT SELECT ON VIEW public.telegram_subscribers_with_subscription TO service_role;
GRANT SELECT ON VIEW public.telegram_subscribers_with_subscription TO postgres;

-- === DATABASE TRIGGERS (public) ===

-- Triggers for table: broker_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_broker_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER trigger_broker_subscriptions_updated_at BEFORE UPDATE ON public.broker_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_broker_subscriptions_updated_at();
  END IF;
END $$;


-- Triggers for table: comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_circular_comments_trigger'
  ) THEN
    CREATE TRIGGER prevent_circular_comments_trigger BEFORE INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.prevent_circular_comments();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_circular_comments_trigger'
  ) THEN
    CREATE TRIGGER prevent_circular_comments_trigger BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.prevent_circular_comments();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_comment_edited_at_trigger'
  ) THEN
    CREATE TRIGGER update_comment_edited_at_trigger BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_comment_edited_at();
  END IF;
END $$;


-- Triggers for table: contact_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_contact_conversations'
  ) THEN
    CREATE TRIGGER trg_update_contact_conversations BEFORE UPDATE ON public.contact_conversations FOR EACH ROW EXECUTE FUNCTION public.update_contact_conversation_timestamps();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_contact_conversations'
  ) THEN
    CREATE TRIGGER trg_update_contact_conversations BEFORE INSERT ON public.contact_conversations FOR EACH ROW EXECUTE FUNCTION public.update_contact_conversation_timestamps();
  END IF;
END $$;


-- Triggers for table: contact_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bump_last_message_at'
  ) THEN
    CREATE TRIGGER trg_bump_last_message_at BEFORE INSERT ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.bump_last_message_at();
  END IF;
END $$;


-- Triggers for table: payment_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_transactions_updated_at'
  ) THEN
    CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- Triggers for table: paypal_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_paypal_accounts_updated_at'
  ) THEN
    CREATE TRIGGER trigger_paypal_accounts_updated_at BEFORE UPDATE ON public.paypal_accounts FOR EACH ROW EXECUTE FUNCTION public.update_paypal_accounts_updated_at();
  END IF;
END $$;


-- Triggers for table: premium_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_premium_plans_updated_at'
  ) THEN
    CREATE TRIGGER trigger_premium_plans_updated_at BEFORE UPDATE ON public.premium_plans FOR EACH ROW EXECUTE FUNCTION public.update_premium_plans_updated_at();
  END IF;
END $$;


-- Triggers for table: profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();
  END IF;
END $$;


-- Triggers for table: subscription_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscription_plans_updated_at'
  ) THEN
    CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- Triggers for table: telegram_bots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_telegram_bots_updated_at'
  ) THEN
    CREATE TRIGGER update_telegram_bots_updated_at BEFORE UPDATE ON public.telegram_bots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- Triggers for table: telegram_subscribers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_telegram_subscribers_last_interaction'
  ) THEN
    CREATE TRIGGER update_telegram_subscribers_last_interaction BEFORE UPDATE ON public.telegram_subscribers FOR EACH ROW EXECUTE FUNCTION public.update_subscriber_last_interaction();
  END IF;
END $$;


-- Triggers for table: user_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sync_telegram_tier_on_subscription_change'
  ) THEN
    CREATE TRIGGER sync_telegram_tier_on_subscription_change BEFORE INSERT ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_telegram_subscriber_tier();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sync_telegram_tier_on_subscription_change'
  ) THEN
    CREATE TRIGGER sync_telegram_tier_on_subscription_change BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_telegram_subscriber_tier();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- Triggers for table: webhook_notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notification_read_at'
  ) THEN
    CREATE TRIGGER trigger_notification_read_at BEFORE UPDATE ON public.webhook_notifications FOR EACH ROW EXECUTE FUNCTION public.update_notification_read_at();
  END IF;
END $$;


-- === ROW LEVEL SECURITY (RLS) POLICIES (public) ===
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_post_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_check_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_broadcast_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_followings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin logs insertable by service role" ON public.admin_activity_log FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Admin logs readable by authenticated users" ON public.admin_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin credentials readable by authenticated users" ON public.admin_credentials FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_logs_insert_authenticated ON public.admin_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY admin_logs_select_authenticated ON public.admin_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view their own subscriptions" ON public.broker_subscriptions FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Brokers can view their subscribers" ON public.broker_subscriptions FOR SELECT TO public USING ((auth.uid() = broker_id));
CREATE POLICY "Users can insert their own subscriptions" ON public.broker_subscriptions FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own subscriptions" ON public.broker_subscriptions FOR UPDATE TO public USING (((auth.uid() = user_id) OR (auth.uid() = broker_id)));
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT TO public USING (true);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own comments" ON public.comments FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY contact_conversations_select_own ON public.contact_conversations FOR SELECT TO public USING (((user_id = auth.uid()) OR ((user_id IS NULL) AND (email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text))));
CREATE POLICY contact_conversations_update_own ON public.contact_conversations FOR UPDATE TO public USING (((user_id = auth.uid()) OR ((user_id IS NULL) AND (email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text))));
CREATE POLICY contact_conversations_insert_own ON public.contact_conversations FOR INSERT TO public WITH CHECK (((user_id = auth.uid()) OR (user_id IS NULL)));
CREATE POLICY contact_messages_select_own ON public.contact_messages FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM contact_conversations c
  WHERE ((c.id = contact_messages.conversation_id) AND ((c.user_id = auth.uid()) OR ((c.user_id IS NULL) AND (c.email = (( SELECT users.email
           FROM auth.users
          WHERE (users.id = auth.uid())))::text)))))));
CREATE POLICY contact_messages_insert_own ON public.contact_messages FOR INSERT TO public WITH CHECK ((((sender)::text = 'user'::text) AND (EXISTS ( SELECT 1
   FROM contact_conversations c
  WHERE ((c.id = contact_messages.conversation_id) AND ((c.user_id = auth.uid()) OR ((c.user_id IS NULL) AND (c.email = (( SELECT users.email
           FROM auth.users
          WHERE (users.id = auth.uid())))::text))))))));
CREATE POLICY contact_messages_service_role_all ON public.contact_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Notifications readable by owner" ON public.notifications FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY "Owner can mark notifications read" ON public.notifications FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Service role can manage transactions" ON public.payment_transactions FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can insert own transactions" ON public.payment_transactions FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own transactions" ON public.payment_transactions FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own paypal accounts" ON public.paypal_accounts FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own paypal accounts" ON public.paypal_accounts FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own paypal accounts" ON public.paypal_accounts FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own PayPal accounts" ON public.paypal_accounts FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own paypal accounts" ON public.paypal_accounts FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own PayPal accounts" ON public.paypal_accounts FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own PayPal accounts" ON public.paypal_accounts FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Service can manage PayPal accounts" ON public.paypal_accounts FOR ALL TO public USING (true);
CREATE POLICY "Users can insert their own post actions" ON public.post_actions FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own post actions" ON public.post_actions FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Post actions are viewable by everyone" ON public.post_actions FOR SELECT TO public USING (true);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY allow_insert_own_posts ON public.posts FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Enable realtime for own posts" ON public.posts FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY premium_posts_visibility ON public.posts FOR SELECT TO public USING (((is_premium_only = false) OR (user_id = auth.uid()) OR ((is_premium_only = true) AND (EXISTS ( SELECT 1
   FROM (user_subscriptions us
     JOIN subscription_plans sp ON ((us.plan_id = sp.id)))
  WHERE ((us.user_id = auth.uid()) AND ((us.status)::text = 'active'::text) AND ((sp.name)::text = 'pro'::text)))))));
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT TO public USING (true);
CREATE POLICY "Users can delete their own premium plans" ON public.premium_plans FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Anyone can view active premium plans" ON public.premium_plans FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Users can view their own premium plans" ON public.premium_plans FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own premium plans" ON public.premium_plans FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own premium plans" ON public.premium_plans FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY users_insert_access_logs ON public.premium_post_access_log FOR INSERT TO public WITH CHECK ((viewer_id = auth.uid()));
CREATE POLICY users_view_own_access_logs ON public.premium_post_access_log FOR SELECT TO public USING ((viewer_id = auth.uid()));
CREATE POLICY post_owners_view_access_logs ON public.premium_post_access_log FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM posts p
  WHERE ((p.id = premium_post_access_log.post_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "Users can view own price checks" ON public.price_check_logs FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own price checks" ON public.price_check_logs FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile broker fields" ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY profiles_select_auth ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY subscription_events_select_own ON public.subscription_events FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY subscription_events_insert_own ON public.subscription_events FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Plans are viewable by all" ON public.subscription_plans FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their own bots" ON public.telegram_bots FOR ALL TO public USING ((auth.uid() = user_id));
CREATE POLICY "Bot owners can view their broadcast posts" ON public.telegram_broadcast_posts FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (telegram_broadcasts b
     JOIN telegram_bots tb ON ((tb.id = b.bot_id)))
  WHERE ((b.id = telegram_broadcast_posts.broadcast_id) AND (tb.user_id = auth.uid())))));
CREATE POLICY "Bot owners can view their broadcast recipients" ON public.telegram_broadcast_recipients FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (telegram_broadcasts b
     JOIN telegram_bots tb ON ((tb.id = b.bot_id)))
  WHERE ((b.id = telegram_broadcast_recipients.broadcast_id) AND (tb.user_id = auth.uid())))));
CREATE POLICY "Bot owners can update their broadcast recipients" ON public.telegram_broadcast_recipients FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM (telegram_broadcasts b
     JOIN telegram_bots tb ON ((tb.id = b.bot_id)))
  WHERE ((b.id = telegram_broadcast_recipients.broadcast_id) AND (tb.user_id = auth.uid())))));
CREATE POLICY "Users can manage their own broadcasts" ON public.telegram_broadcasts FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM telegram_bots
  WHERE ((telegram_bots.id = telegram_broadcasts.bot_id) AND (telegram_bots.user_id = auth.uid())))));
CREATE POLICY "Bot owners can view their notifications" ON public.telegram_notifications FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM telegram_bots tb
  WHERE ((tb.id = telegram_notifications.bot_id) AND (tb.user_id = auth.uid())))));
CREATE POLICY "Bot owners can insert notifications" ON public.telegram_notifications FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM telegram_bots tb
  WHERE ((tb.id = telegram_notifications.bot_id) AND (tb.user_id = auth.uid())))));
CREATE POLICY "Bot owners can view their subscribers" ON public.telegram_subscribers FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM telegram_bots
  WHERE ((telegram_bots.id = telegram_subscribers.bot_id) AND (telegram_bots.user_id = auth.uid())))));
CREATE POLICY "Bot owners can manage subscribers" ON public.telegram_subscribers FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM telegram_bots
  WHERE ((telegram_bots.id = telegram_subscribers.bot_id) AND (telegram_bots.user_id = auth.uid())))));
CREATE POLICY "Followings are viewable by everyone" ON public.user_followings FOR SELECT TO public USING (true);
CREATE POLICY "Users can follow others" ON public.user_followings FOR INSERT TO public WITH CHECK ((auth.uid() = follower_id));
CREATE POLICY "Users can unfollow others" ON public.user_followings FOR DELETE TO public USING ((auth.uid() = follower_id));
CREATE POLICY "Users can update own strategies" ON public.user_strategies FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own strategies" ON public.user_strategies FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own strategies" ON public.user_strategies FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own strategies" ON public.user_strategies FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own strategies" ON public.user_strategies FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own strategies" ON public.user_strategies FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Service role can manage subscriptions" ON public.user_subscriptions FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can update own subscriptions" ON public.user_subscriptions FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own subscriptions" ON public.user_subscriptions FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own notifications" ON public.webhook_notifications FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Service can insert notifications" ON public.webhook_notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON public.webhook_notifications FOR UPDATE TO public USING ((auth.uid() = user_id));

-- === DEFAULT RLS FOR TABLES WITHOUT POLICIES (public) ===
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY default_select_system_settings ON public.system_settings FOR SELECT TO authenticated USING (true);
ALTER TABLE public.telegram_bot_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY default_select_telegram_bot_commands ON public.telegram_bot_commands FOR SELECT TO authenticated USING (true);
ALTER TABLE public.telegram_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY default_select_telegram_notification_settings ON public.telegram_notification_settings FOR SELECT TO authenticated USING (true);

-- === GRANTS / PERMISSIONS (public) ===
GRANT SELECT ON TABLE public.admin_activity_log TO service_role;
GRANT TRIGGER ON TABLE public.admin_activity_log TO service_role;
GRANT REFERENCES ON TABLE public.admin_activity_log TO service_role;
GRANT TRUNCATE ON TABLE public.admin_activity_log TO service_role;
GRANT DELETE ON TABLE public.admin_activity_log TO service_role;
GRANT UPDATE ON TABLE public.admin_activity_log TO service_role;
GRANT INSERT ON TABLE public.admin_activity_log TO service_role;
GRANT TRIGGER ON TABLE public.admin_activity_log TO authenticated;
GRANT REFERENCES ON TABLE public.admin_activity_log TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_activity_log TO authenticated;
GRANT DELETE ON TABLE public.admin_activity_log TO authenticated;
GRANT UPDATE ON TABLE public.admin_activity_log TO authenticated;
GRANT SELECT ON TABLE public.admin_activity_log TO authenticated;
GRANT INSERT ON TABLE public.admin_activity_log TO authenticated;
GRANT TRIGGER ON TABLE public.admin_activity_log TO anon;
GRANT REFERENCES ON TABLE public.admin_activity_log TO anon;
GRANT TRUNCATE ON TABLE public.admin_activity_log TO anon;
GRANT DELETE ON TABLE public.admin_activity_log TO anon;
GRANT UPDATE ON TABLE public.admin_activity_log TO anon;
GRANT SELECT ON TABLE public.admin_activity_log TO anon;
GRANT INSERT ON TABLE public.admin_activity_log TO postgres;
GRANT SELECT ON TABLE public.admin_activity_log TO postgres;
GRANT UPDATE ON TABLE public.admin_activity_log TO postgres;
GRANT DELETE ON TABLE public.admin_activity_log TO postgres;
GRANT TRUNCATE ON TABLE public.admin_activity_log TO postgres;
GRANT REFERENCES ON TABLE public.admin_activity_log TO postgres;
GRANT TRIGGER ON TABLE public.admin_activity_log TO postgres;
GRANT INSERT ON TABLE public.admin_activity_log TO anon;
GRANT REFERENCES ON TABLE public.admin_credentials TO authenticated;
GRANT TRIGGER ON TABLE public.admin_credentials TO anon;
GRANT REFERENCES ON TABLE public.admin_credentials TO service_role;
GRANT TRUNCATE ON TABLE public.admin_credentials TO postgres;
GRANT DELETE ON TABLE public.admin_credentials TO postgres;
GRANT UPDATE ON TABLE public.admin_credentials TO postgres;
GRANT TRUNCATE ON TABLE public.admin_credentials TO service_role;
GRANT SELECT ON TABLE public.admin_credentials TO postgres;
GRANT INSERT ON TABLE public.admin_credentials TO service_role;
GRANT TRIGGER ON TABLE public.admin_credentials TO service_role;
GRANT TRIGGER ON TABLE public.admin_credentials TO postgres;
GRANT INSERT ON TABLE public.admin_credentials TO anon;
GRANT SELECT ON TABLE public.admin_credentials TO anon;
GRANT UPDATE ON TABLE public.admin_credentials TO anon;
GRANT DELETE ON TABLE public.admin_credentials TO anon;
GRANT TRUNCATE ON TABLE public.admin_credentials TO anon;
GRANT INSERT ON TABLE public.admin_credentials TO postgres;
GRANT DELETE ON TABLE public.admin_credentials TO service_role;
GRANT UPDATE ON TABLE public.admin_credentials TO service_role;
GRANT TRUNCATE ON TABLE public.admin_credentials TO authenticated;
GRANT DELETE ON TABLE public.admin_credentials TO authenticated;
GRANT UPDATE ON TABLE public.admin_credentials TO authenticated;
GRANT SELECT ON TABLE public.admin_credentials TO authenticated;
GRANT INSERT ON TABLE public.admin_credentials TO authenticated;
GRANT SELECT ON TABLE public.admin_credentials TO service_role;
GRANT REFERENCES ON TABLE public.admin_credentials TO anon;
GRANT REFERENCES ON TABLE public.admin_credentials TO postgres;
GRANT TRIGGER ON TABLE public.admin_credentials TO authenticated;
GRANT REFERENCES ON TABLE public.admin_logs TO postgres;
GRANT REFERENCES ON TABLE public.admin_logs TO service_role;
GRANT INSERT ON TABLE public.admin_logs TO anon;
GRANT SELECT ON TABLE public.admin_logs TO anon;
GRANT UPDATE ON TABLE public.admin_logs TO anon;
GRANT DELETE ON TABLE public.admin_logs TO anon;
GRANT TRUNCATE ON TABLE public.admin_logs TO anon;
GRANT TRIGGER ON TABLE public.admin_logs TO authenticated;
GRANT REFERENCES ON TABLE public.admin_logs TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_logs TO authenticated;
GRANT DELETE ON TABLE public.admin_logs TO authenticated;
GRANT UPDATE ON TABLE public.admin_logs TO authenticated;
GRANT SELECT ON TABLE public.admin_logs TO authenticated;
GRANT INSERT ON TABLE public.admin_logs TO authenticated;
GRANT REFERENCES ON TABLE public.admin_logs TO anon;
GRANT TRIGGER ON TABLE public.admin_logs TO service_role;
GRANT TRIGGER ON TABLE public.admin_logs TO anon;
GRANT INSERT ON TABLE public.admin_logs TO service_role;
GRANT INSERT ON TABLE public.admin_logs TO postgres;
GRANT SELECT ON TABLE public.admin_logs TO postgres;
GRANT UPDATE ON TABLE public.admin_logs TO postgres;
GRANT DELETE ON TABLE public.admin_logs TO postgres;
GRANT TRUNCATE ON TABLE public.admin_logs TO postgres;
GRANT TRIGGER ON TABLE public.admin_logs TO postgres;
GRANT SELECT ON TABLE public.admin_logs TO service_role;
GRANT UPDATE ON TABLE public.admin_logs TO service_role;
GRANT DELETE ON TABLE public.admin_logs TO service_role;
GRANT TRUNCATE ON TABLE public.admin_logs TO service_role;
GRANT DELETE ON TABLE public.broker_subscriptions TO anon;
GRANT UPDATE ON TABLE public.broker_subscriptions TO anon;
GRANT SELECT ON TABLE public.broker_subscriptions TO anon;
GRANT INSERT ON TABLE public.broker_subscriptions TO anon;
GRANT TRIGGER ON TABLE public.broker_subscriptions TO authenticated;
GRANT TRUNCATE ON TABLE public.broker_subscriptions TO service_role;
GRANT DELETE ON TABLE public.broker_subscriptions TO service_role;
GRANT INSERT ON TABLE public.broker_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.broker_subscriptions TO authenticated;
GRANT UPDATE ON TABLE public.broker_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.broker_subscriptions TO authenticated;
GRANT TRUNCATE ON TABLE public.broker_subscriptions TO authenticated;
GRANT INSERT ON TABLE public.broker_subscriptions TO postgres;
GRANT SELECT ON TABLE public.broker_subscriptions TO postgres;
GRANT UPDATE ON TABLE public.broker_subscriptions TO postgres;
GRANT DELETE ON TABLE public.broker_subscriptions TO postgres;
GRANT TRUNCATE ON TABLE public.broker_subscriptions TO postgres;
GRANT REFERENCES ON TABLE public.broker_subscriptions TO anon;
GRANT REFERENCES ON TABLE public.broker_subscriptions TO postgres;
GRANT TRIGGER ON TABLE public.broker_subscriptions TO postgres;
GRANT REFERENCES ON TABLE public.broker_subscriptions TO authenticated;
GRANT UPDATE ON TABLE public.broker_subscriptions TO service_role;
GRANT SELECT ON TABLE public.broker_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.broker_subscriptions TO service_role;
GRANT INSERT ON TABLE public.broker_subscriptions TO service_role;
GRANT REFERENCES ON TABLE public.broker_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.broker_subscriptions TO anon;
GRANT TRUNCATE ON TABLE public.broker_subscriptions TO anon;
GRANT DELETE ON TABLE public.comments TO authenticated;
GRANT INSERT ON TABLE public.comments TO postgres;
GRANT SELECT ON TABLE public.comments TO postgres;
GRANT UPDATE ON TABLE public.comments TO postgres;
GRANT DELETE ON TABLE public.comments TO postgres;
GRANT TRUNCATE ON TABLE public.comments TO postgres;
GRANT REFERENCES ON TABLE public.comments TO postgres;
GRANT TRIGGER ON TABLE public.comments TO postgres;
GRANT TRIGGER ON TABLE public.comments TO authenticated;
GRANT REFERENCES ON TABLE public.comments TO authenticated;
GRANT TRUNCATE ON TABLE public.comments TO authenticated;
GRANT UPDATE ON TABLE public.comments TO authenticated;
GRANT SELECT ON TABLE public.comments TO authenticated;
GRANT INSERT ON TABLE public.comments TO authenticated;
GRANT INSERT ON TABLE public.comments TO service_role;
GRANT SELECT ON TABLE public.comments TO service_role;
GRANT UPDATE ON TABLE public.comments TO service_role;
GRANT DELETE ON TABLE public.comments TO service_role;
GRANT TRUNCATE ON TABLE public.comments TO service_role;
GRANT REFERENCES ON TABLE public.comments TO service_role;
GRANT TRIGGER ON TABLE public.comments TO service_role;
GRANT INSERT ON TABLE public.comments TO anon;
GRANT SELECT ON TABLE public.comments TO anon;
GRANT UPDATE ON TABLE public.comments TO anon;
GRANT DELETE ON TABLE public.comments TO anon;
GRANT TRUNCATE ON TABLE public.comments TO anon;
GRANT REFERENCES ON TABLE public.comments TO anon;
GRANT TRIGGER ON TABLE public.comments TO anon;
GRANT UPDATE ON TABLE public.contact_conversations TO authenticated;
GRANT DELETE ON TABLE public.contact_conversations TO authenticated;
GRANT TRUNCATE ON TABLE public.contact_conversations TO authenticated;
GRANT DELETE ON TABLE public.contact_conversations TO service_role;
GRANT TRUNCATE ON TABLE public.contact_conversations TO service_role;
GRANT INSERT ON TABLE public.contact_conversations TO postgres;
GRANT SELECT ON TABLE public.contact_conversations TO postgres;
GRANT UPDATE ON TABLE public.contact_conversations TO postgres;
GRANT DELETE ON TABLE public.contact_conversations TO postgres;
GRANT TRUNCATE ON TABLE public.contact_conversations TO postgres;
GRANT REFERENCES ON TABLE public.contact_conversations TO postgres;
GRANT TRIGGER ON TABLE public.contact_conversations TO postgres;
GRANT REFERENCES ON TABLE public.contact_conversations TO service_role;
GRANT TRIGGER ON TABLE public.contact_conversations TO service_role;
GRANT REFERENCES ON TABLE public.contact_conversations TO authenticated;
GRANT TRIGGER ON TABLE public.contact_conversations TO anon;
GRANT INSERT ON TABLE public.contact_conversations TO service_role;
GRANT SELECT ON TABLE public.contact_conversations TO service_role;
GRANT UPDATE ON TABLE public.contact_conversations TO service_role;
GRANT TRIGGER ON TABLE public.contact_conversations TO authenticated;
GRANT INSERT ON TABLE public.contact_conversations TO anon;
GRANT SELECT ON TABLE public.contact_conversations TO anon;
GRANT UPDATE ON TABLE public.contact_conversations TO anon;
GRANT DELETE ON TABLE public.contact_conversations TO anon;
GRANT TRUNCATE ON TABLE public.contact_conversations TO anon;
GRANT REFERENCES ON TABLE public.contact_conversations TO anon;
GRANT INSERT ON TABLE public.contact_conversations TO authenticated;
GRANT SELECT ON TABLE public.contact_conversations TO authenticated;
GRANT REFERENCES ON TABLE public.contact_messages TO anon;
GRANT DELETE ON TABLE public.contact_messages TO anon;
GRANT UPDATE ON TABLE public.contact_messages TO anon;
GRANT INSERT ON TABLE public.contact_messages TO anon;
GRANT SELECT ON TABLE public.contact_messages TO anon;
GRANT INSERT ON TABLE public.contact_messages TO service_role;
GRANT SELECT ON TABLE public.contact_messages TO service_role;
GRANT UPDATE ON TABLE public.contact_messages TO service_role;
GRANT DELETE ON TABLE public.contact_messages TO service_role;
GRANT TRUNCATE ON TABLE public.contact_messages TO service_role;
GRANT REFERENCES ON TABLE public.contact_messages TO service_role;
GRANT TRIGGER ON TABLE public.contact_messages TO service_role;
GRANT INSERT ON TABLE public.contact_messages TO authenticated;
GRANT SELECT ON TABLE public.contact_messages TO authenticated;
GRANT UPDATE ON TABLE public.contact_messages TO authenticated;
GRANT DELETE ON TABLE public.contact_messages TO authenticated;
GRANT TRUNCATE ON TABLE public.contact_messages TO authenticated;
GRANT INSERT ON TABLE public.contact_messages TO postgres;
GRANT SELECT ON TABLE public.contact_messages TO postgres;
GRANT UPDATE ON TABLE public.contact_messages TO postgres;
GRANT DELETE ON TABLE public.contact_messages TO postgres;
GRANT TRUNCATE ON TABLE public.contact_messages TO postgres;
GRANT REFERENCES ON TABLE public.contact_messages TO postgres;
GRANT TRIGGER ON TABLE public.contact_messages TO postgres;
GRANT REFERENCES ON TABLE public.contact_messages TO authenticated;
GRANT TRIGGER ON TABLE public.contact_messages TO authenticated;
GRANT TRIGGER ON TABLE public.contact_messages TO anon;
GRANT TRUNCATE ON TABLE public.contact_messages TO anon;
GRANT SELECT ON TABLE public.notifications TO service_role;
GRANT INSERT ON TABLE public.notifications TO postgres;
GRANT SELECT ON TABLE public.notifications TO postgres;
GRANT UPDATE ON TABLE public.notifications TO postgres;
GRANT DELETE ON TABLE public.notifications TO postgres;
GRANT TRUNCATE ON TABLE public.notifications TO postgres;
GRANT REFERENCES ON TABLE public.notifications TO postgres;
GRANT TRIGGER ON TABLE public.notifications TO postgres;
GRANT INSERT ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE ON TABLE public.notifications TO authenticated;
GRANT DELETE ON TABLE public.notifications TO authenticated;
GRANT TRUNCATE ON TABLE public.notifications TO authenticated;
GRANT REFERENCES ON TABLE public.notifications TO authenticated;
GRANT TRIGGER ON TABLE public.notifications TO authenticated;
GRANT TRIGGER ON TABLE public.notifications TO service_role;
GRANT REFERENCES ON TABLE public.notifications TO service_role;
GRANT TRUNCATE ON TABLE public.notifications TO service_role;
GRANT DELETE ON TABLE public.notifications TO service_role;
GRANT UPDATE ON TABLE public.notifications TO service_role;
GRANT INSERT ON TABLE public.notifications TO service_role;
GRANT INSERT ON TABLE public.notifications TO anon;
GRANT SELECT ON TABLE public.notifications TO anon;
GRANT UPDATE ON TABLE public.notifications TO anon;
GRANT DELETE ON TABLE public.notifications TO anon;
GRANT TRUNCATE ON TABLE public.notifications TO anon;
GRANT REFERENCES ON TABLE public.notifications TO anon;
GRANT TRIGGER ON TABLE public.notifications TO anon;
GRANT DELETE ON TABLE public.payment_transactions TO service_role;
GRANT INSERT ON TABLE public.payment_transactions TO anon;
GRANT TRIGGER ON TABLE public.payment_transactions TO authenticated;
GRANT REFERENCES ON TABLE public.payment_transactions TO authenticated;
GRANT TRUNCATE ON TABLE public.payment_transactions TO authenticated;
GRANT DELETE ON TABLE public.payment_transactions TO authenticated;
GRANT UPDATE ON TABLE public.payment_transactions TO authenticated;
GRANT SELECT ON TABLE public.payment_transactions TO authenticated;
GRANT INSERT ON TABLE public.payment_transactions TO authenticated;
GRANT SELECT ON TABLE public.payment_transactions TO anon;
GRANT UPDATE ON TABLE public.payment_transactions TO anon;
GRANT DELETE ON TABLE public.payment_transactions TO anon;
GRANT TRUNCATE ON TABLE public.payment_transactions TO anon;
GRANT REFERENCES ON TABLE public.payment_transactions TO anon;
GRANT SELECT ON TABLE public.payment_transactions TO postgres;
GRANT TRIGGER ON TABLE public.payment_transactions TO anon;
GRANT INSERT ON TABLE public.payment_transactions TO postgres;
GRANT UPDATE ON TABLE public.payment_transactions TO postgres;
GRANT DELETE ON TABLE public.payment_transactions TO postgres;
GRANT TRUNCATE ON TABLE public.payment_transactions TO postgres;
GRANT REFERENCES ON TABLE public.payment_transactions TO postgres;
GRANT TRIGGER ON TABLE public.payment_transactions TO postgres;
GRANT TRIGGER ON TABLE public.payment_transactions TO service_role;
GRANT REFERENCES ON TABLE public.payment_transactions TO service_role;
GRANT TRUNCATE ON TABLE public.payment_transactions TO service_role;
GRANT UPDATE ON TABLE public.payment_transactions TO service_role;
GRANT SELECT ON TABLE public.payment_transactions TO service_role;
GRANT INSERT ON TABLE public.payment_transactions TO service_role;
GRANT TRIGGER ON TABLE public.paypal_accounts TO anon;
GRANT REFERENCES ON TABLE public.paypal_accounts TO anon;
GRANT TRUNCATE ON TABLE public.paypal_accounts TO anon;
GRANT DELETE ON TABLE public.paypal_accounts TO anon;
GRANT UPDATE ON TABLE public.paypal_accounts TO anon;
GRANT SELECT ON TABLE public.paypal_accounts TO anon;
GRANT INSERT ON TABLE public.paypal_accounts TO anon;
GRANT INSERT ON TABLE public.paypal_accounts TO authenticated;
GRANT TRIGGER ON TABLE public.paypal_accounts TO postgres;
GRANT REFERENCES ON TABLE public.paypal_accounts TO postgres;
GRANT TRUNCATE ON TABLE public.paypal_accounts TO postgres;
GRANT DELETE ON TABLE public.paypal_accounts TO postgres;
GRANT SELECT ON TABLE public.paypal_accounts TO authenticated;
GRANT UPDATE ON TABLE public.paypal_accounts TO authenticated;
GRANT UPDATE ON TABLE public.paypal_accounts TO postgres;
GRANT SELECT ON TABLE public.paypal_accounts TO postgres;
GRANT INSERT ON TABLE public.paypal_accounts TO postgres;
GRANT DELETE ON TABLE public.paypal_accounts TO authenticated;
GRANT TRUNCATE ON TABLE public.paypal_accounts TO authenticated;
GRANT TRIGGER ON TABLE public.paypal_accounts TO service_role;
GRANT REFERENCES ON TABLE public.paypal_accounts TO authenticated;
GRANT INSERT ON TABLE public.paypal_accounts TO service_role;
GRANT SELECT ON TABLE public.paypal_accounts TO service_role;
GRANT UPDATE ON TABLE public.paypal_accounts TO service_role;
GRANT DELETE ON TABLE public.paypal_accounts TO service_role;
GRANT TRUNCATE ON TABLE public.paypal_accounts TO service_role;
GRANT TRIGGER ON TABLE public.paypal_accounts TO authenticated;
GRANT REFERENCES ON TABLE public.paypal_accounts TO service_role;
GRANT REFERENCES ON TABLE public.post_actions TO service_role;
GRANT TRIGGER ON TABLE public.post_actions TO anon;
GRANT REFERENCES ON TABLE public.post_actions TO anon;
GRANT TRUNCATE ON TABLE public.post_actions TO anon;
GRANT DELETE ON TABLE public.post_actions TO anon;
GRANT UPDATE ON TABLE public.post_actions TO anon;
GRANT SELECT ON TABLE public.post_actions TO anon;
GRANT INSERT ON TABLE public.post_actions TO anon;
GRANT INSERT ON TABLE public.post_actions TO postgres;
GRANT SELECT ON TABLE public.post_actions TO postgres;
GRANT UPDATE ON TABLE public.post_actions TO postgres;
GRANT DELETE ON TABLE public.post_actions TO postgres;
GRANT TRUNCATE ON TABLE public.post_actions TO postgres;
GRANT REFERENCES ON TABLE public.post_actions TO postgres;
GRANT TRIGGER ON TABLE public.post_actions TO postgres;
GRANT TRIGGER ON TABLE public.post_actions TO authenticated;
GRANT REFERENCES ON TABLE public.post_actions TO authenticated;
GRANT TRUNCATE ON TABLE public.post_actions TO authenticated;
GRANT DELETE ON TABLE public.post_actions TO authenticated;
GRANT UPDATE ON TABLE public.post_actions TO authenticated;
GRANT SELECT ON TABLE public.post_actions TO authenticated;
GRANT INSERT ON TABLE public.post_actions TO authenticated;
GRANT INSERT ON TABLE public.post_actions TO service_role;
GRANT SELECT ON TABLE public.post_actions TO service_role;
GRANT UPDATE ON TABLE public.post_actions TO service_role;
GRANT DELETE ON TABLE public.post_actions TO service_role;
GRANT TRUNCATE ON TABLE public.post_actions TO service_role;
GRANT TRIGGER ON TABLE public.post_actions TO service_role;
GRANT TRIGGER ON TABLE public.posts TO anon;
GRANT INSERT ON TABLE public.posts TO service_role;
GRANT SELECT ON TABLE public.posts TO service_role;
GRANT SELECT ON TABLE public.posts TO authenticated;
GRANT INSERT ON TABLE public.posts TO authenticated;
GRANT UPDATE ON TABLE public.posts TO service_role;
GRANT DELETE ON TABLE public.posts TO service_role;
GRANT TRUNCATE ON TABLE public.posts TO service_role;
GRANT REFERENCES ON TABLE public.posts TO service_role;
GRANT TRIGGER ON TABLE public.posts TO service_role;
GRANT TRIGGER ON TABLE public.posts TO authenticated;
GRANT REFERENCES ON TABLE public.posts TO authenticated;
GRANT TRUNCATE ON TABLE public.posts TO authenticated;
GRANT DELETE ON TABLE public.posts TO authenticated;
GRANT UPDATE ON TABLE public.posts TO authenticated;
GRANT TRIGGER ON TABLE public.posts TO postgres;
GRANT REFERENCES ON TABLE public.posts TO postgres;
GRANT TRUNCATE ON TABLE public.posts TO postgres;
GRANT DELETE ON TABLE public.posts TO postgres;
GRANT UPDATE ON TABLE public.posts TO postgres;
GRANT SELECT ON TABLE public.posts TO postgres;
GRANT INSERT ON TABLE public.posts TO postgres;
GRANT INSERT ON TABLE public.posts TO anon;
GRANT SELECT ON TABLE public.posts TO anon;
GRANT UPDATE ON TABLE public.posts TO anon;
GRANT DELETE ON TABLE public.posts TO anon;
GRANT TRUNCATE ON TABLE public.posts TO anon;
GRANT REFERENCES ON TABLE public.posts TO anon;
GRANT DELETE ON TABLE public.premium_plans TO authenticated;
GRANT INSERT ON TABLE public.premium_plans TO postgres;
GRANT UPDATE ON TABLE public.premium_plans TO service_role;
GRANT SELECT ON TABLE public.premium_plans TO postgres;
GRANT UPDATE ON TABLE public.premium_plans TO postgres;
GRANT DELETE ON TABLE public.premium_plans TO postgres;
GRANT TRUNCATE ON TABLE public.premium_plans TO postgres;
GRANT REFERENCES ON TABLE public.premium_plans TO postgres;
GRANT TRIGGER ON TABLE public.premium_plans TO postgres;
GRANT REFERENCES ON TABLE public.premium_plans TO authenticated;
GRANT TRIGGER ON TABLE public.premium_plans TO authenticated;
GRANT DELETE ON TABLE public.premium_plans TO service_role;
GRANT TRUNCATE ON TABLE public.premium_plans TO service_role;
GRANT REFERENCES ON TABLE public.premium_plans TO service_role;
GRANT TRIGGER ON TABLE public.premium_plans TO service_role;
GRANT INSERT ON TABLE public.premium_plans TO service_role;
GRANT TRIGGER ON TABLE public.premium_plans TO anon;
GRANT SELECT ON TABLE public.premium_plans TO service_role;
GRANT REFERENCES ON TABLE public.premium_plans TO anon;
GRANT TRUNCATE ON TABLE public.premium_plans TO anon;
GRANT DELETE ON TABLE public.premium_plans TO anon;
GRANT UPDATE ON TABLE public.premium_plans TO anon;
GRANT SELECT ON TABLE public.premium_plans TO anon;
GRANT INSERT ON TABLE public.premium_plans TO anon;
GRANT INSERT ON TABLE public.premium_plans TO authenticated;
GRANT SELECT ON TABLE public.premium_plans TO authenticated;
GRANT UPDATE ON TABLE public.premium_plans TO authenticated;
GRANT TRUNCATE ON TABLE public.premium_plans TO authenticated;
GRANT SELECT ON TABLE public.premium_post_access_log TO authenticated;
GRANT SELECT ON TABLE public.premium_post_access_log TO anon;
GRANT UPDATE ON TABLE public.premium_post_access_log TO authenticated;
GRANT INSERT ON TABLE public.premium_post_access_log TO postgres;
GRANT INSERT ON TABLE public.premium_post_access_log TO anon;
GRANT REFERENCES ON TABLE public.premium_post_access_log TO anon;
GRANT TRIGGER ON TABLE public.premium_post_access_log TO postgres;
GRANT TRUNCATE ON TABLE public.premium_post_access_log TO postgres;
GRANT DELETE ON TABLE public.premium_post_access_log TO postgres;
GRANT INSERT ON TABLE public.premium_post_access_log TO service_role;
GRANT REFERENCES ON TABLE public.premium_post_access_log TO postgres;
GRANT DELETE ON TABLE public.premium_post_access_log TO authenticated;
GRANT UPDATE ON TABLE public.premium_post_access_log TO postgres;
GRANT TRIGGER ON TABLE public.premium_post_access_log TO anon;
GRANT SELECT ON TABLE public.premium_post_access_log TO postgres;
GRANT TRIGGER ON TABLE public.premium_post_access_log TO service_role;
GRANT REFERENCES ON TABLE public.premium_post_access_log TO service_role;
GRANT TRUNCATE ON TABLE public.premium_post_access_log TO service_role;
GRANT DELETE ON TABLE public.premium_post_access_log TO service_role;
GRANT UPDATE ON TABLE public.premium_post_access_log TO service_role;
GRANT SELECT ON TABLE public.premium_post_access_log TO service_role;
GRANT TRUNCATE ON TABLE public.premium_post_access_log TO anon;
GRANT DELETE ON TABLE public.premium_post_access_log TO anon;
GRANT INSERT ON TABLE public.premium_post_access_log TO authenticated;
GRANT TRUNCATE ON TABLE public.premium_post_access_log TO authenticated;
GRANT REFERENCES ON TABLE public.premium_post_access_log TO authenticated;
GRANT TRIGGER ON TABLE public.premium_post_access_log TO authenticated;
GRANT UPDATE ON TABLE public.premium_post_access_log TO anon;
GRANT TRUNCATE ON TABLE public.price_check_logs TO service_role;
GRANT TRIGGER ON TABLE public.price_check_logs TO service_role;
GRANT UPDATE ON TABLE public.price_check_logs TO anon;
GRANT DELETE ON TABLE public.price_check_logs TO anon;
GRANT SELECT ON TABLE public.price_check_logs TO anon;
GRANT INSERT ON TABLE public.price_check_logs TO anon;
GRANT TRUNCATE ON TABLE public.price_check_logs TO anon;
GRANT REFERENCES ON TABLE public.price_check_logs TO anon;
GRANT TRIGGER ON TABLE public.price_check_logs TO anon;
GRANT TRIGGER ON TABLE public.price_check_logs TO postgres;
GRANT REFERENCES ON TABLE public.price_check_logs TO postgres;
GRANT TRUNCATE ON TABLE public.price_check_logs TO postgres;
GRANT DELETE ON TABLE public.price_check_logs TO postgres;
GRANT UPDATE ON TABLE public.price_check_logs TO postgres;
GRANT SELECT ON TABLE public.price_check_logs TO postgres;
GRANT INSERT ON TABLE public.price_check_logs TO service_role;
GRANT SELECT ON TABLE public.price_check_logs TO service_role;
GRANT TRIGGER ON TABLE public.price_check_logs TO authenticated;
GRANT REFERENCES ON TABLE public.price_check_logs TO authenticated;
GRANT TRUNCATE ON TABLE public.price_check_logs TO authenticated;
GRANT DELETE ON TABLE public.price_check_logs TO authenticated;
GRANT INSERT ON TABLE public.price_check_logs TO postgres;
GRANT UPDATE ON TABLE public.price_check_logs TO authenticated;
GRANT SELECT ON TABLE public.price_check_logs TO authenticated;
GRANT INSERT ON TABLE public.price_check_logs TO authenticated;
GRANT UPDATE ON TABLE public.price_check_logs TO service_role;
GRANT DELETE ON TABLE public.price_check_logs TO service_role;
GRANT REFERENCES ON TABLE public.price_check_logs TO service_role;
GRANT REFERENCES ON TABLE public.profiles TO anon;
GRANT DELETE ON TABLE public.profiles TO service_role;
GRANT TRUNCATE ON TABLE public.profiles TO service_role;
GRANT TRIGGER ON TABLE public.profiles TO postgres;
GRANT REFERENCES ON TABLE public.profiles TO postgres;
GRANT TRIGGER ON TABLE public.profiles TO anon;
GRANT SELECT ON TABLE public.profiles TO service_role;
GRANT TRIGGER ON TABLE public.profiles TO service_role;
GRANT REFERENCES ON TABLE public.profiles TO service_role;
GRANT TRUNCATE ON TABLE public.profiles TO anon;
GRANT DELETE ON TABLE public.profiles TO anon;
GRANT INSERT ON TABLE public.profiles TO authenticated;
GRANT INSERT ON TABLE public.profiles TO postgres;
GRANT SELECT ON TABLE public.profiles TO postgres;
GRANT UPDATE ON TABLE public.profiles TO postgres;
GRANT DELETE ON TABLE public.profiles TO postgres;
GRANT TRUNCATE ON TABLE public.profiles TO postgres;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated;
GRANT DELETE ON TABLE public.profiles TO authenticated;
GRANT TRUNCATE ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO anon;
GRANT SELECT ON TABLE public.profiles TO anon;
GRANT INSERT ON TABLE public.profiles TO anon;
GRANT REFERENCES ON TABLE public.profiles TO authenticated;
GRANT TRIGGER ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO service_role;
GRANT INSERT ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.subscription_events TO anon;
GRANT INSERT ON TABLE public.subscription_events TO service_role;
GRANT SELECT ON TABLE public.subscription_events TO service_role;
GRANT UPDATE ON TABLE public.subscription_events TO service_role;
GRANT DELETE ON TABLE public.subscription_events TO service_role;
GRANT TRUNCATE ON TABLE public.subscription_events TO service_role;
GRANT TRUNCATE ON TABLE public.subscription_events TO authenticated;
GRANT DELETE ON TABLE public.subscription_events TO authenticated;
GRANT UPDATE ON TABLE public.subscription_events TO authenticated;
GRANT SELECT ON TABLE public.subscription_events TO authenticated;
GRANT INSERT ON TABLE public.subscription_events TO authenticated;
GRANT REFERENCES ON TABLE public.subscription_events TO service_role;
GRANT TRIGGER ON TABLE public.subscription_events TO anon;
GRANT REFERENCES ON TABLE public.subscription_events TO anon;
GRANT TRUNCATE ON TABLE public.subscription_events TO anon;
GRANT DELETE ON TABLE public.subscription_events TO anon;
GRANT UPDATE ON TABLE public.subscription_events TO anon;
GRANT TRIGGER ON TABLE public.subscription_events TO service_role;
GRANT INSERT ON TABLE public.subscription_events TO postgres;
GRANT SELECT ON TABLE public.subscription_events TO postgres;
GRANT UPDATE ON TABLE public.subscription_events TO postgres;
GRANT DELETE ON TABLE public.subscription_events TO postgres;
GRANT TRUNCATE ON TABLE public.subscription_events TO postgres;
GRANT REFERENCES ON TABLE public.subscription_events TO postgres;
GRANT TRIGGER ON TABLE public.subscription_events TO postgres;
GRANT INSERT ON TABLE public.subscription_events TO anon;
GRANT TRIGGER ON TABLE public.subscription_events TO authenticated;
GRANT REFERENCES ON TABLE public.subscription_events TO authenticated;
GRANT TRUNCATE ON TABLE public.subscription_plans TO authenticated;
GRANT TRUNCATE ON TABLE public.subscription_plans TO anon;
GRANT INSERT ON TABLE public.subscription_plans TO postgres;
GRANT SELECT ON TABLE public.subscription_plans TO postgres;
GRANT UPDATE ON TABLE public.subscription_plans TO postgres;
GRANT DELETE ON TABLE public.subscription_plans TO postgres;
GRANT TRUNCATE ON TABLE public.subscription_plans TO postgres;
GRANT DELETE ON TABLE public.subscription_plans TO anon;
GRANT UPDATE ON TABLE public.subscription_plans TO anon;
GRANT SELECT ON TABLE public.subscription_plans TO anon;
GRANT UPDATE ON TABLE public.subscription_plans TO service_role;
GRANT SELECT ON TABLE public.subscription_plans TO service_role;
GRANT INSERT ON TABLE public.subscription_plans TO service_role;
GRANT DELETE ON TABLE public.subscription_plans TO service_role;
GRANT TRUNCATE ON TABLE public.subscription_plans TO service_role;
GRANT REFERENCES ON TABLE public.subscription_plans TO service_role;
GRANT TRIGGER ON TABLE public.subscription_plans TO service_role;
GRANT INSERT ON TABLE public.subscription_plans TO anon;
GRANT INSERT ON TABLE public.subscription_plans TO authenticated;
GRANT TRIGGER ON TABLE public.subscription_plans TO postgres;
GRANT REFERENCES ON TABLE public.subscription_plans TO postgres;
GRANT DELETE ON TABLE public.subscription_plans TO authenticated;
GRANT UPDATE ON TABLE public.subscription_plans TO authenticated;
GRANT TRIGGER ON TABLE public.subscription_plans TO authenticated;
GRANT REFERENCES ON TABLE public.subscription_plans TO authenticated;
GRANT REFERENCES ON TABLE public.subscription_plans TO anon;
GRANT TRIGGER ON TABLE public.subscription_plans TO anon;
GRANT SELECT ON TABLE public.subscription_plans TO authenticated;
GRANT TRUNCATE ON TABLE public.system_settings TO postgres;
GRANT DELETE ON TABLE public.system_settings TO postgres;
GRANT UPDATE ON TABLE public.system_settings TO postgres;
GRANT SELECT ON TABLE public.system_settings TO postgres;
GRANT TRIGGER ON TABLE public.system_settings TO service_role;
GRANT TRUNCATE ON TABLE public.system_settings TO authenticated;
GRANT REFERENCES ON TABLE public.system_settings TO authenticated;
GRANT INSERT ON TABLE public.system_settings TO postgres;
GRANT REFERENCES ON TABLE public.system_settings TO service_role;
GRANT TRUNCATE ON TABLE public.system_settings TO service_role;
GRANT DELETE ON TABLE public.system_settings TO service_role;
GRANT UPDATE ON TABLE public.system_settings TO service_role;
GRANT SELECT ON TABLE public.system_settings TO service_role;
GRANT INSERT ON TABLE public.system_settings TO service_role;
GRANT TRIGGER ON TABLE public.system_settings TO authenticated;
GRANT INSERT ON TABLE public.system_settings TO authenticated;
GRANT SELECT ON TABLE public.system_settings TO authenticated;
GRANT UPDATE ON TABLE public.system_settings TO authenticated;
GRANT DELETE ON TABLE public.system_settings TO authenticated;
GRANT TRIGGER ON TABLE public.system_settings TO postgres;
GRANT TRIGGER ON TABLE public.system_settings TO anon;
GRANT REFERENCES ON TABLE public.system_settings TO postgres;
GRANT INSERT ON TABLE public.system_settings TO anon;
GRANT SELECT ON TABLE public.system_settings TO anon;
GRANT UPDATE ON TABLE public.system_settings TO anon;
GRANT DELETE ON TABLE public.system_settings TO anon;
GRANT TRUNCATE ON TABLE public.system_settings TO anon;
GRANT REFERENCES ON TABLE public.system_settings TO anon;
GRANT SELECT ON TABLE public.telegram_bot_commands TO postgres;
GRANT INSERT ON TABLE public.telegram_bot_commands TO authenticated;
GRANT SELECT ON TABLE public.telegram_bot_commands TO authenticated;
GRANT UPDATE ON TABLE public.telegram_bot_commands TO authenticated;
GRANT DELETE ON TABLE public.telegram_bot_commands TO authenticated;
GRANT TRIGGER ON TABLE public.telegram_bot_commands TO authenticated;
GRANT REFERENCES ON TABLE public.telegram_bot_commands TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_bot_commands TO authenticated;
GRANT TRIGGER ON TABLE public.telegram_bot_commands TO anon;
GRANT REFERENCES ON TABLE public.telegram_bot_commands TO anon;
GRANT TRUNCATE ON TABLE public.telegram_bot_commands TO anon;
GRANT DELETE ON TABLE public.telegram_bot_commands TO anon;
GRANT UPDATE ON TABLE public.telegram_bot_commands TO anon;
GRANT SELECT ON TABLE public.telegram_bot_commands TO anon;
GRANT INSERT ON TABLE public.telegram_bot_commands TO anon;
GRANT TRIGGER ON TABLE public.telegram_bot_commands TO service_role;
GRANT REFERENCES ON TABLE public.telegram_bot_commands TO service_role;
GRANT TRUNCATE ON TABLE public.telegram_bot_commands TO service_role;
GRANT DELETE ON TABLE public.telegram_bot_commands TO service_role;
GRANT UPDATE ON TABLE public.telegram_bot_commands TO service_role;
GRANT SELECT ON TABLE public.telegram_bot_commands TO service_role;
GRANT INSERT ON TABLE public.telegram_bot_commands TO service_role;
GRANT TRIGGER ON TABLE public.telegram_bot_commands TO postgres;
GRANT REFERENCES ON TABLE public.telegram_bot_commands TO postgres;
GRANT TRUNCATE ON TABLE public.telegram_bot_commands TO postgres;
GRANT DELETE ON TABLE public.telegram_bot_commands TO postgres;
GRANT UPDATE ON TABLE public.telegram_bot_commands TO postgres;
GRANT INSERT ON TABLE public.telegram_bot_commands TO postgres;
GRANT INSERT ON TABLE public.telegram_bots TO service_role;
GRANT INSERT ON TABLE public.telegram_bots TO postgres;
GRANT SELECT ON TABLE public.telegram_bots TO postgres;
GRANT UPDATE ON TABLE public.telegram_bots TO postgres;
GRANT DELETE ON TABLE public.telegram_bots TO postgres;
GRANT TRUNCATE ON TABLE public.telegram_bots TO postgres;
GRANT REFERENCES ON TABLE public.telegram_bots TO postgres;
GRANT TRIGGER ON TABLE public.telegram_bots TO postgres;
GRANT TRIGGER ON TABLE public.telegram_bots TO authenticated;
GRANT REFERENCES ON TABLE public.telegram_bots TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_bots TO authenticated;
GRANT DELETE ON TABLE public.telegram_bots TO authenticated;
GRANT UPDATE ON TABLE public.telegram_bots TO authenticated;
GRANT SELECT ON TABLE public.telegram_bots TO authenticated;
GRANT INSERT ON TABLE public.telegram_bots TO authenticated;
GRANT INSERT ON TABLE public.telegram_bots TO anon;
GRANT SELECT ON TABLE public.telegram_bots TO anon;
GRANT UPDATE ON TABLE public.telegram_bots TO anon;
GRANT DELETE ON TABLE public.telegram_bots TO anon;
GRANT TRUNCATE ON TABLE public.telegram_bots TO anon;
GRANT REFERENCES ON TABLE public.telegram_bots TO anon;
GRANT TRIGGER ON TABLE public.telegram_bots TO anon;
GRANT TRIGGER ON TABLE public.telegram_bots TO service_role;
GRANT REFERENCES ON TABLE public.telegram_bots TO service_role;
GRANT TRUNCATE ON TABLE public.telegram_bots TO service_role;
GRANT DELETE ON TABLE public.telegram_bots TO service_role;
GRANT UPDATE ON TABLE public.telegram_bots TO service_role;
GRANT SELECT ON TABLE public.telegram_bots TO service_role;
GRANT DELETE ON TABLE public.telegram_broadcast_posts TO anon;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_posts TO anon;
GRANT REFERENCES ON TABLE public.telegram_broadcast_posts TO anon;
GRANT TRIGGER ON TABLE public.telegram_broadcast_posts TO anon;
GRANT REFERENCES ON TABLE public.telegram_broadcast_posts TO service_role;
GRANT INSERT ON TABLE public.telegram_broadcast_posts TO service_role;
GRANT DELETE ON TABLE public.telegram_broadcast_posts TO service_role;
GRANT UPDATE ON TABLE public.telegram_broadcast_posts TO service_role;
GRANT SELECT ON TABLE public.telegram_broadcast_posts TO service_role;
GRANT TRIGGER ON TABLE public.telegram_broadcast_posts TO postgres;
GRANT REFERENCES ON TABLE public.telegram_broadcast_posts TO postgres;
GRANT TRIGGER ON TABLE public.telegram_broadcast_posts TO service_role;
GRANT INSERT ON TABLE public.telegram_broadcast_posts TO authenticated;
GRANT SELECT ON TABLE public.telegram_broadcast_posts TO authenticated;
GRANT UPDATE ON TABLE public.telegram_broadcast_posts TO authenticated;
GRANT DELETE ON TABLE public.telegram_broadcast_posts TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_posts TO authenticated;
GRANT REFERENCES ON TABLE public.telegram_broadcast_posts TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_posts TO postgres;
GRANT DELETE ON TABLE public.telegram_broadcast_posts TO postgres;
GRANT UPDATE ON TABLE public.telegram_broadcast_posts TO postgres;
GRANT SELECT ON TABLE public.telegram_broadcast_posts TO postgres;
GRANT INSERT ON TABLE public.telegram_broadcast_posts TO postgres;
GRANT TRIGGER ON TABLE public.telegram_broadcast_posts TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_posts TO service_role;
GRANT INSERT ON TABLE public.telegram_broadcast_posts TO anon;
GRANT SELECT ON TABLE public.telegram_broadcast_posts TO anon;
GRANT UPDATE ON TABLE public.telegram_broadcast_posts TO anon;
GRANT SELECT ON TABLE public.telegram_broadcast_recipients TO authenticated;
GRANT REFERENCES ON TABLE public.telegram_broadcast_recipients TO postgres;
GRANT TRIGGER ON TABLE public.telegram_broadcast_recipients TO postgres;
GRANT INSERT ON TABLE public.telegram_broadcast_recipients TO postgres;
GRANT INSERT ON TABLE public.telegram_broadcast_recipients TO anon;
GRANT SELECT ON TABLE public.telegram_broadcast_recipients TO anon;
GRANT UPDATE ON TABLE public.telegram_broadcast_recipients TO anon;
GRANT DELETE ON TABLE public.telegram_broadcast_recipients TO anon;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_recipients TO anon;
GRANT REFERENCES ON TABLE public.telegram_broadcast_recipients TO anon;
GRANT TRIGGER ON TABLE public.telegram_broadcast_recipients TO anon;
GRANT UPDATE ON TABLE public.telegram_broadcast_recipients TO service_role;
GRANT DELETE ON TABLE public.telegram_broadcast_recipients TO service_role;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_recipients TO service_role;
GRANT REFERENCES ON TABLE public.telegram_broadcast_recipients TO service_role;
GRANT TRIGGER ON TABLE public.telegram_broadcast_recipients TO service_role;
GRANT SELECT ON TABLE public.telegram_broadcast_recipients TO service_role;
GRANT INSERT ON TABLE public.telegram_broadcast_recipients TO service_role;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_recipients TO postgres;
GRANT DELETE ON TABLE public.telegram_broadcast_recipients TO postgres;
GRANT UPDATE ON TABLE public.telegram_broadcast_recipients TO postgres;
GRANT SELECT ON TABLE public.telegram_broadcast_recipients TO postgres;
GRANT TRIGGER ON TABLE public.telegram_broadcast_recipients TO authenticated;
GRANT REFERENCES ON TABLE public.telegram_broadcast_recipients TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_broadcast_recipients TO authenticated;
GRANT DELETE ON TABLE public.telegram_broadcast_recipients TO authenticated;
GRANT UPDATE ON TABLE public.telegram_broadcast_recipients TO authenticated;
GRANT INSERT ON TABLE public.telegram_broadcast_recipients TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_broadcasts TO postgres;
GRANT UPDATE ON TABLE public.telegram_broadcasts TO postgres;
GRANT SELECT ON TABLE public.telegram_broadcasts TO postgres;
GRANT REFERENCES ON TABLE public.telegram_broadcasts TO authenticated;
GRANT TRIGGER ON TABLE public.telegram_broadcasts TO authenticated;
GRANT INSERT ON TABLE public.telegram_broadcasts TO anon;
GRANT DELETE ON TABLE public.telegram_broadcasts TO postgres;
GRANT SELECT ON TABLE public.telegram_broadcasts TO service_role;
GRANT INSERT ON TABLE public.telegram_broadcasts TO postgres;
GRANT INSERT ON TABLE public.telegram_broadcasts TO service_role;
GRANT TRIGGER ON TABLE public.telegram_broadcasts TO anon;
GRANT REFERENCES ON TABLE public.telegram_broadcasts TO anon;
GRANT TRUNCATE ON TABLE public.telegram_broadcasts TO anon;
GRANT DELETE ON TABLE public.telegram_broadcasts TO anon;
GRANT UPDATE ON TABLE public.telegram_broadcasts TO anon;
GRANT SELECT ON TABLE public.telegram_broadcasts TO anon;
GRANT UPDATE ON TABLE public.telegram_broadcasts TO service_role;
GRANT DELETE ON TABLE public.telegram_broadcasts TO service_role;
GRANT TRUNCATE ON TABLE public.telegram_broadcasts TO service_role;
GRANT REFERENCES ON TABLE public.telegram_broadcasts TO service_role;
GRANT TRIGGER ON TABLE public.telegram_broadcasts TO service_role;
GRANT INSERT ON TABLE public.telegram_broadcasts TO authenticated;
GRANT SELECT ON TABLE public.telegram_broadcasts TO authenticated;
GRANT UPDATE ON TABLE public.telegram_broadcasts TO authenticated;
GRANT DELETE ON TABLE public.telegram_broadcasts TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_broadcasts TO authenticated;
GRANT TRIGGER ON TABLE public.telegram_broadcasts TO postgres;
GRANT REFERENCES ON TABLE public.telegram_broadcasts TO postgres;
GRANT REFERENCES ON TABLE public.telegram_notification_settings TO anon;
GRANT SELECT ON TABLE public.telegram_notification_settings TO authenticated;
GRANT INSERT ON TABLE public.telegram_notification_settings TO authenticated;
GRANT SELECT ON TABLE public.telegram_notification_settings TO anon;
GRANT UPDATE ON TABLE public.telegram_notification_settings TO anon;
GRANT DELETE ON TABLE public.telegram_notification_settings TO anon;
GRANT UPDATE ON TABLE public.telegram_notification_settings TO service_role;
GRANT REFERENCES ON TABLE public.telegram_notification_settings TO service_role;
GRANT TRUNCATE ON TABLE public.telegram_notification_settings TO service_role;
GRANT DELETE ON TABLE public.telegram_notification_settings TO service_role;
GRANT INSERT ON TABLE public.telegram_notification_settings TO service_role;
GRANT SELECT ON TABLE public.telegram_notification_settings TO service_role;
GRANT TRIGGER ON TABLE public.telegram_notification_settings TO service_role;
GRANT INSERT ON TABLE public.telegram_notification_settings TO anon;
GRANT UPDATE ON TABLE public.telegram_notification_settings TO postgres;
GRANT DELETE ON TABLE public.telegram_notification_settings TO postgres;
GRANT TRUNCATE ON TABLE public.telegram_notification_settings TO postgres;
GRANT REFERENCES ON TABLE public.telegram_notification_settings TO postgres;
GRANT TRIGGER ON TABLE public.telegram_notification_settings TO postgres;
GRANT TRIGGER ON TABLE public.telegram_notification_settings TO authenticated;
GRANT SELECT ON TABLE public.telegram_notification_settings TO postgres;
GRANT INSERT ON TABLE public.telegram_notification_settings TO postgres;
GRANT TRUNCATE ON TABLE public.telegram_notification_settings TO anon;
GRANT REFERENCES ON TABLE public.telegram_notification_settings TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_notification_settings TO authenticated;
GRANT DELETE ON TABLE public.telegram_notification_settings TO authenticated;
GRANT UPDATE ON TABLE public.telegram_notification_settings TO authenticated;
GRANT TRIGGER ON TABLE public.telegram_notification_settings TO anon;
GRANT TRIGGER ON TABLE public.telegram_notifications TO service_role;
GRANT TRIGGER ON TABLE public.telegram_notifications TO authenticated;
GRANT REFERENCES ON TABLE public.telegram_notifications TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_notifications TO authenticated;
GRANT DELETE ON TABLE public.telegram_notifications TO authenticated;
GRANT UPDATE ON TABLE public.telegram_notifications TO authenticated;
GRANT INSERT ON TABLE public.telegram_notifications TO authenticated;
GRANT SELECT ON TABLE public.telegram_notifications TO authenticated;
GRANT REFERENCES ON TABLE public.telegram_notifications TO postgres;
GRANT TRUNCATE ON TABLE public.telegram_notifications TO postgres;
GRANT TRIGGER ON TABLE public.telegram_notifications TO anon;
GRANT REFERENCES ON TABLE public.telegram_notifications TO service_role;
GRANT TRUNCATE ON TABLE public.telegram_notifications TO service_role;
GRANT DELETE ON TABLE public.telegram_notifications TO service_role;
GRANT UPDATE ON TABLE public.telegram_notifications TO service_role;
GRANT SELECT ON TABLE public.telegram_notifications TO service_role;
GRANT INSERT ON TABLE public.telegram_notifications TO service_role;
GRANT DELETE ON TABLE public.telegram_notifications TO postgres;
GRANT UPDATE ON TABLE public.telegram_notifications TO postgres;
GRANT SELECT ON TABLE public.telegram_notifications TO postgres;
GRANT INSERT ON TABLE public.telegram_notifications TO postgres;
GRANT TRIGGER ON TABLE public.telegram_notifications TO postgres;
GRANT INSERT ON TABLE public.telegram_notifications TO anon;
GRANT SELECT ON TABLE public.telegram_notifications TO anon;
GRANT UPDATE ON TABLE public.telegram_notifications TO anon;
GRANT DELETE ON TABLE public.telegram_notifications TO anon;
GRANT TRUNCATE ON TABLE public.telegram_notifications TO anon;
GRANT REFERENCES ON TABLE public.telegram_notifications TO anon;
GRANT INSERT ON TABLE public.telegram_subscribers TO postgres;
GRANT UPDATE ON TABLE public.telegram_subscribers TO anon;
GRANT DELETE ON TABLE public.telegram_subscribers TO anon;
GRANT TRIGGER ON TABLE public.telegram_subscribers TO service_role;
GRANT TRIGGER ON TABLE public.telegram_subscribers TO anon;
GRANT TRUNCATE ON TABLE public.telegram_subscribers TO anon;
GRANT REFERENCES ON TABLE public.telegram_subscribers TO anon;
GRANT INSERT ON TABLE public.telegram_subscribers TO service_role;
GRANT SELECT ON TABLE public.telegram_subscribers TO postgres;
GRANT UPDATE ON TABLE public.telegram_subscribers TO postgres;
GRANT REFERENCES ON TABLE public.telegram_subscribers TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_subscribers TO authenticated;
GRANT DELETE ON TABLE public.telegram_subscribers TO authenticated;
GRANT UPDATE ON TABLE public.telegram_subscribers TO authenticated;
GRANT DELETE ON TABLE public.telegram_subscribers TO postgres;
GRANT TRUNCATE ON TABLE public.telegram_subscribers TO postgres;
GRANT REFERENCES ON TABLE public.telegram_subscribers TO postgres;
GRANT TRIGGER ON TABLE public.telegram_subscribers TO postgres;
GRANT SELECT ON TABLE public.telegram_subscribers TO service_role;
GRANT UPDATE ON TABLE public.telegram_subscribers TO service_role;
GRANT DELETE ON TABLE public.telegram_subscribers TO service_role;
GRANT TRIGGER ON TABLE public.telegram_subscribers TO authenticated;
GRANT TRUNCATE ON TABLE public.telegram_subscribers TO service_role;
GRANT REFERENCES ON TABLE public.telegram_subscribers TO service_role;
GRANT SELECT ON TABLE public.telegram_subscribers TO authenticated;
GRANT INSERT ON TABLE public.telegram_subscribers TO authenticated;
GRANT INSERT ON TABLE public.telegram_subscribers TO anon;
GRANT SELECT ON TABLE public.telegram_subscribers TO anon;
GRANT SELECT ON TABLE public.user_followings TO anon;
GRANT INSERT ON TABLE public.user_followings TO anon;
GRANT INSERT ON TABLE public.user_followings TO postgres;
GRANT SELECT ON TABLE public.user_followings TO postgres;
GRANT TRIGGER ON TABLE public.user_followings TO service_role;
GRANT REFERENCES ON TABLE public.user_followings TO service_role;
GRANT TRUNCATE ON TABLE public.user_followings TO service_role;
GRANT DELETE ON TABLE public.user_followings TO service_role;
GRANT INSERT ON TABLE public.user_followings TO authenticated;
GRANT SELECT ON TABLE public.user_followings TO authenticated;
GRANT UPDATE ON TABLE public.user_followings TO authenticated;
GRANT DELETE ON TABLE public.user_followings TO authenticated;
GRANT TRUNCATE ON TABLE public.user_followings TO authenticated;
GRANT REFERENCES ON TABLE public.user_followings TO authenticated;
GRANT UPDATE ON TABLE public.user_followings TO service_role;
GRANT SELECT ON TABLE public.user_followings TO service_role;
GRANT INSERT ON TABLE public.user_followings TO service_role;
GRANT UPDATE ON TABLE public.user_followings TO postgres;
GRANT DELETE ON TABLE public.user_followings TO postgres;
GRANT TRIGGER ON TABLE public.user_followings TO postgres;
GRANT REFERENCES ON TABLE public.user_followings TO postgres;
GRANT TRUNCATE ON TABLE public.user_followings TO postgres;
GRANT TRIGGER ON TABLE public.user_followings TO authenticated;
GRANT TRIGGER ON TABLE public.user_followings TO anon;
GRANT REFERENCES ON TABLE public.user_followings TO anon;
GRANT TRUNCATE ON TABLE public.user_followings TO anon;
GRANT DELETE ON TABLE public.user_followings TO anon;
GRANT UPDATE ON TABLE public.user_followings TO anon;
GRANT INSERT ON TABLE public.user_strategies TO service_role;
GRANT TRIGGER ON TABLE public.user_strategies TO authenticated;
GRANT REFERENCES ON TABLE public.user_strategies TO authenticated;
GRANT TRUNCATE ON TABLE public.user_strategies TO authenticated;
GRANT DELETE ON TABLE public.user_strategies TO authenticated;
GRANT UPDATE ON TABLE public.user_strategies TO authenticated;
GRANT SELECT ON TABLE public.user_strategies TO authenticated;
GRANT INSERT ON TABLE public.user_strategies TO authenticated;
GRANT INSERT ON TABLE public.user_strategies TO postgres;
GRANT DELETE ON TABLE public.user_strategies TO anon;
GRANT UPDATE ON TABLE public.user_strategies TO anon;
GRANT SELECT ON TABLE public.user_strategies TO anon;
GRANT INSERT ON TABLE public.user_strategies TO anon;
GRANT TRUNCATE ON TABLE public.user_strategies TO anon;
GRANT REFERENCES ON TABLE public.user_strategies TO anon;
GRANT TRIGGER ON TABLE public.user_strategies TO anon;
GRANT TRIGGER ON TABLE public.user_strategies TO service_role;
GRANT REFERENCES ON TABLE public.user_strategies TO service_role;
GRANT TRUNCATE ON TABLE public.user_strategies TO service_role;
GRANT DELETE ON TABLE public.user_strategies TO service_role;
GRANT UPDATE ON TABLE public.user_strategies TO service_role;
GRANT SELECT ON TABLE public.user_strategies TO service_role;
GRANT DELETE ON TABLE public.user_strategies TO postgres;
GRANT TRUNCATE ON TABLE public.user_strategies TO postgres;
GRANT UPDATE ON TABLE public.user_strategies TO postgres;
GRANT SELECT ON TABLE public.user_strategies TO postgres;
GRANT REFERENCES ON TABLE public.user_strategies TO postgres;
GRANT TRIGGER ON TABLE public.user_strategies TO postgres;
GRANT SELECT ON TABLE public.user_subscriptions TO service_role;
GRANT UPDATE ON TABLE public.user_subscriptions TO service_role;
GRANT DELETE ON TABLE public.user_subscriptions TO service_role;
GRANT TRUNCATE ON TABLE public.user_subscriptions TO service_role;
GRANT INSERT ON TABLE public.user_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.user_subscriptions TO authenticated;
GRANT UPDATE ON TABLE public.user_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.user_subscriptions TO authenticated;
GRANT TRUNCATE ON TABLE public.user_subscriptions TO authenticated;
GRANT REFERENCES ON TABLE public.user_subscriptions TO authenticated;
GRANT TRIGGER ON TABLE public.user_subscriptions TO authenticated;
GRANT REFERENCES ON TABLE public.user_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.user_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.user_subscriptions TO postgres;
GRANT REFERENCES ON TABLE public.user_subscriptions TO postgres;
GRANT TRUNCATE ON TABLE public.user_subscriptions TO postgres;
GRANT DELETE ON TABLE public.user_subscriptions TO postgres;
GRANT UPDATE ON TABLE public.user_subscriptions TO postgres;
GRANT SELECT ON TABLE public.user_subscriptions TO postgres;
GRANT TRUNCATE ON TABLE public.user_subscriptions TO anon;
GRANT REFERENCES ON TABLE public.user_subscriptions TO anon;
GRANT TRIGGER ON TABLE public.user_subscriptions TO anon;
GRANT UPDATE ON TABLE public.user_subscriptions TO anon;
GRANT SELECT ON TABLE public.user_subscriptions TO anon;
GRANT INSERT ON TABLE public.user_subscriptions TO anon;
GRANT DELETE ON TABLE public.user_subscriptions TO anon;
GRANT INSERT ON TABLE public.user_subscriptions TO postgres;
GRANT INSERT ON TABLE public.user_subscriptions TO service_role;
GRANT DELETE ON TABLE public.webhook_notifications TO anon;
GRANT TRIGGER ON TABLE public.webhook_notifications TO anon;
GRANT REFERENCES ON TABLE public.webhook_notifications TO anon;
GRANT TRUNCATE ON TABLE public.webhook_notifications TO anon;
GRANT UPDATE ON TABLE public.webhook_notifications TO anon;
GRANT SELECT ON TABLE public.webhook_notifications TO anon;
GRANT INSERT ON TABLE public.webhook_notifications TO anon;
GRANT INSERT ON TABLE public.webhook_notifications TO service_role;
GRANT SELECT ON TABLE public.webhook_notifications TO service_role;
GRANT UPDATE ON TABLE public.webhook_notifications TO service_role;
GRANT DELETE ON TABLE public.webhook_notifications TO service_role;
GRANT TRUNCATE ON TABLE public.webhook_notifications TO service_role;
GRANT REFERENCES ON TABLE public.webhook_notifications TO service_role;
GRANT TRIGGER ON TABLE public.webhook_notifications TO service_role;
GRANT TRIGGER ON TABLE public.webhook_notifications TO authenticated;
GRANT REFERENCES ON TABLE public.webhook_notifications TO authenticated;
GRANT TRUNCATE ON TABLE public.webhook_notifications TO authenticated;
GRANT DELETE ON TABLE public.webhook_notifications TO authenticated;
GRANT UPDATE ON TABLE public.webhook_notifications TO authenticated;
GRANT SELECT ON TABLE public.webhook_notifications TO authenticated;
GRANT INSERT ON TABLE public.webhook_notifications TO authenticated;
GRANT TRIGGER ON TABLE public.webhook_notifications TO postgres;
GRANT REFERENCES ON TABLE public.webhook_notifications TO postgres;
GRANT TRUNCATE ON TABLE public.webhook_notifications TO postgres;
GRANT DELETE ON TABLE public.webhook_notifications TO postgres;
GRANT UPDATE ON TABLE public.webhook_notifications TO postgres;
GRANT SELECT ON TABLE public.webhook_notifications TO postgres;
GRANT INSERT ON TABLE public.webhook_notifications TO postgres;