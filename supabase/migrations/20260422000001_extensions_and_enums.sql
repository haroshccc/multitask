-- =============================================================================
-- Multitask — 01. Extensions, domains and enums
-- =============================================================================

-- Extensions -------------------------------------------------------------------
create extension if not exists "pgcrypto";     -- gen_random_uuid, crypt
create extension if not exists "pg_trgm";      -- fuzzy text search
create extension if not exists "btree_gin";    -- gin indexes on scalars
create extension if not exists "unaccent";     -- normalize accents for search

-- Enums ------------------------------------------------------------------------

create type organization_member_role as enum ('owner', 'admin', 'member');

create type billing_plan as enum ('free', 'pro', 'enterprise');

create type subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete'
);

create type task_status as enum (
  'todo',
  'in_progress',
  'pending_approval',
  'done',
  'cancelled'
);

create type task_list_kind as enum ('project', 'custom');

create type dependency_relation as enum (
  'finish_to_start',
  'start_to_start',
  'finish_to_finish',
  'start_to_finish'
);

create type custom_field_type as enum (
  'text',
  'number',
  'date',
  'select',
  'multiselect',
  'stars',
  'checkbox',
  'url',
  'file'
);

create type project_pricing_mode as enum ('fixed_price', 'hourly', 'quote');

create type project_spare_mode as enum ('percent', 'hours');

create type event_rsvp_status as enum ('pending', 'accepted', 'declined', 'tentative');

create type recording_source as enum ('thought', 'call', 'meeting', 'other');

create type recording_status as enum (
  'uploaded',
  'transcribing',
  'extracting',
  'ready',
  'error'
);

create type speaker_role as enum ('owner', 'contact', 'other');

create type thought_source as enum (
  'app_text',
  'app_audio',
  'whatsapp_text',
  'whatsapp_audio',
  'whatsapp_image'
);

create type thought_status as enum ('unprocessed', 'processed', 'archived');

create type thought_processing_target as enum (
  'task',
  'event',
  'project',
  'recording',
  'message'
);

create type share_entity_type as enum (
  'task',
  'task_list',
  'recording',
  'project',
  'thought',
  'event'
);

create type share_permission as enum ('read', 'write');

create type notification_type as enum (
  'task_assigned',
  'task_approval_requested',
  'task_approved',
  'task_due_soon',
  'event_invited',
  'event_starting_soon',
  'thought_received',
  'recording_ready',
  'project_over_budget',
  'org_member_joined'
);

create type push_platform as enum ('web', 'ios', 'android');

create type dashboard_screen as enum (
  'home',
  'tasks',
  'calendar',
  'gantt',
  'recordings',
  'thoughts',
  'projects',
  'pricing'
);

create type video_call_provider as enum ('meet', 'zoom', 'teams', 'other');

create type attachment_type as enum ('recording', 'thought', 'event', 'file', 'image', 'link');
