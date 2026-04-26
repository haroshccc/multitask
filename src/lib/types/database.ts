export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_day_notes: {
        Row: {
          body: string
          created_at: string
          date: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          date: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          date?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          added_at: string
          event_id: string
          id: string
          responded_at: string | null
          rsvp_status: Database["public"]["Enums"]["event_rsvp_status"]
          user_id: string
        }
        Insert: {
          added_at?: string
          event_id: string
          id?: string
          responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["event_rsvp_status"]
          user_id: string
        }
        Update: {
          added_at?: string
          event_id?: string
          id?: string
          responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["event_rsvp_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_calendars: {
        Row: {
          archive_expires_at: string | null
          archived_at: string | null
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          is_archived: boolean
          linked_task_list_id: string | null
          name: string
          organization_id: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          linked_task_list_id?: string | null
          name: string
          organization_id: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          linked_task_list_id?: string | null
          name?: string
          organization_id?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          calendar_id: string | null
          color: string | null
          created_at: string
          description: string | null
          ends_at: string
          google_event_ids: Json | null
          id: string
          location: string | null
          organization_id: string
          owner_id: string
          recurrence_ends_at: string | null
          recurrence_original_id: string | null
          recurrence_rule: string | null
          source_recording_id: string | null
          source_task_id: string | null
          source_thought_id: string | null
          starts_at: string
          tags: string[]
          title: string
          updated_at: string
          video_call_provider:
            | Database["public"]["Enums"]["video_call_provider"]
            | null
          video_call_url: string | null
        }
        Insert: {
          all_day?: boolean
          calendar_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          google_event_ids?: Json | null
          id?: string
          location?: string | null
          organization_id: string
          owner_id: string
          recurrence_ends_at?: string | null
          recurrence_original_id?: string | null
          recurrence_rule?: string | null
          source_recording_id?: string | null
          source_task_id?: string | null
          source_thought_id?: string | null
          starts_at: string
          tags?: string[]
          title: string
          updated_at?: string
          video_call_provider?:
            | Database["public"]["Enums"]["video_call_provider"]
            | null
          video_call_url?: string | null
        }
        Update: {
          all_day?: boolean
          calendar_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          google_event_ids?: Json | null
          id?: string
          location?: string | null
          organization_id?: string
          owner_id?: string
          recurrence_ends_at?: string | null
          recurrence_original_id?: string | null
          recurrence_rule?: string | null
          source_recording_id?: string | null
          source_task_id?: string | null
          source_thought_id?: string | null
          starts_at?: string
          tags?: string[]
          title?: string
          updated_at?: string
          video_call_provider?:
            | Database["public"]["Enums"]["video_call_provider"]
            | null
          video_call_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_recurrence_original_id_fkey"
            columns: ["recurrence_original_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_recording_fk"
            columns: ["source_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_task_fk"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_thought_fk"
            columns: ["source_thought_id"]
            isOneToOne: false
            referencedRelation: "thoughts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          organization_id: string | null
          payload: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          user_id: string
        }
        Update: {
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archive_expires_at: string | null
          archived_at: string | null
          billing_customer_id: string | null
          created_at: string
          created_by: string | null
          current_period_end: string | null
          id: string
          is_archived: boolean
          join_password_hash: string | null
          name: string
          plan: Database["public"]["Enums"]["billing_plan"]
          slug: string | null
          storage_bytes_limit: number
          storage_bytes_used: number
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          suggested_email_domain: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          archive_expires_at?: string | null
          archived_at?: string | null
          billing_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          id?: string
          is_archived?: boolean
          join_password_hash?: string | null
          name: string
          plan?: Database["public"]["Enums"]["billing_plan"]
          slug?: string | null
          storage_bytes_limit?: number
          storage_bytes_used?: number
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          suggested_email_domain?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          archive_expires_at?: string | null
          archived_at?: string | null
          billing_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          id?: string
          is_archived?: boolean
          join_password_hash?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["billing_plan"]
          slug?: string | null
          storage_bytes_limit?: number
          storage_bytes_used?: number
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          suggested_email_domain?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_time_entry_id: string | null
          avatar_url: string | null
          billing_customer_id: string | null
          created_at: string
          current_period_end: string | null
          default_hourly_rate_cents: number | null
          default_profit_percentage: number | null
          default_spare_mode:
            | Database["public"]["Enums"]["project_spare_mode"]
            | null
          default_spare_value: number | null
          display_color: string | null
          full_name: string | null
          google_meet_scope_granted: boolean
          google_mirror_calendar_id: string | null
          google_mirror_shared_at: string | null
          google_refresh_token_encrypted: string | null
          id: string
          is_super_admin: boolean
          plan: Database["public"]["Enums"]["billing_plan"]
          storage_bytes_limit: number | null
          storage_bytes_used: number
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          whatsapp_phone_e164: string | null
          whatsapp_verification_code: string | null
          whatsapp_verification_expires_at: string | null
          whatsapp_verified_at: string | null
        }
        Insert: {
          active_time_entry_id?: string | null
          avatar_url?: string | null
          billing_customer_id?: string | null
          created_at?: string
          current_period_end?: string | null
          default_hourly_rate_cents?: number | null
          default_profit_percentage?: number | null
          default_spare_mode?:
            | Database["public"]["Enums"]["project_spare_mode"]
            | null
          default_spare_value?: number | null
          display_color?: string | null
          full_name?: string | null
          google_meet_scope_granted?: boolean
          google_mirror_calendar_id?: string | null
          google_mirror_shared_at?: string | null
          google_refresh_token_encrypted?: string | null
          id: string
          is_super_admin?: boolean
          plan?: Database["public"]["Enums"]["billing_plan"]
          storage_bytes_limit?: number | null
          storage_bytes_used?: number
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp_phone_e164?: string | null
          whatsapp_verification_code?: string | null
          whatsapp_verification_expires_at?: string | null
          whatsapp_verified_at?: string | null
        }
        Update: {
          active_time_entry_id?: string | null
          avatar_url?: string | null
          billing_customer_id?: string | null
          created_at?: string
          current_period_end?: string | null
          default_hourly_rate_cents?: number | null
          default_profit_percentage?: number | null
          default_spare_mode?:
            | Database["public"]["Enums"]["project_spare_mode"]
            | null
          default_spare_value?: number | null
          display_color?: string | null
          full_name?: string | null
          google_meet_scope_granted?: boolean
          google_mirror_calendar_id?: string | null
          google_mirror_shared_at?: string | null
          google_refresh_token_encrypted?: string | null
          id?: string
          is_super_admin?: boolean
          plan?: Database["public"]["Enums"]["billing_plan"]
          storage_bytes_limit?: number | null
          storage_bytes_used?: number
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp_phone_e164?: string | null
          whatsapp_verification_code?: string | null
          whatsapp_verification_expires_at?: string | null
          whatsapp_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_time_entry_fk"
            columns: ["active_time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          label: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          label: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          label?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          is_default: boolean
          is_favorite: boolean
          name: string
          organization_id: string
          owner_id: string
          template_data: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_default?: boolean
          is_favorite?: boolean
          name: string
          organization_id: string
          owner_id: string
          template_data?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_default?: boolean
          is_favorite?: boolean
          name?: string
          organization_id?: string
          owner_id?: string
          template_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archive_expires_at: string | null
          archived_at: string | null
          color: string | null
          created_at: string
          currency: string
          description: string | null
          emoji: string | null
          hourly_rate_cents: number | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string
          owner_id: string
          pricing_mode: Database["public"]["Enums"]["project_pricing_mode"]
          profit_percentage: number | null
          search_tsv: unknown
          spare_mode: Database["public"]["Enums"]["project_spare_mode"] | null
          spare_value: number | null
          status: string
          tags: string[]
          total_price_cents: number | null
          updated_at: string
          vat_percentage: number | null
        }
        Insert: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          emoji?: string | null
          hourly_rate_cents?: number | null
          id?: string
          is_archived?: boolean
          name: string
          organization_id: string
          owner_id: string
          pricing_mode?: Database["public"]["Enums"]["project_pricing_mode"]
          profit_percentage?: number | null
          search_tsv?: unknown
          spare_mode?: Database["public"]["Enums"]["project_spare_mode"] | null
          spare_value?: number | null
          status?: string
          tags?: string[]
          total_price_cents?: number | null
          updated_at?: string
          vat_percentage?: number | null
        }
        Update: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          emoji?: string | null
          hourly_rate_cents?: number | null
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string
          owner_id?: string
          pricing_mode?: Database["public"]["Enums"]["project_pricing_mode"]
          profit_percentage?: number | null
          search_tsv?: unknown
          spare_mode?: Database["public"]["Enums"]["project_spare_mode"] | null
          spare_value?: number | null
          status?: string
          tags?: string[]
          total_price_cents?: number | null
          updated_at?: string
          vat_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_info: Json
          id: string
          last_seen_at: string
          onesignal_player_id: string | null
          platform: Database["public"]["Enums"]["push_platform"]
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json
          id?: string
          last_seen_at?: string
          onesignal_player_id?: string | null
          platform: Database["public"]["Enums"]["push_platform"]
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json
          id?: string
          last_seen_at?: string
          onesignal_player_id?: string | null
          platform?: Database["public"]["Enums"]["push_platform"]
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by_user_id: string | null
          created_at: string
          id: string
          organization_id: string
          owner_id: string
          project_id: string
          sort_order: number
          source_recording_id: string | null
          tags: string[]
          task_id: string | null
          text: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by_user_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          owner_id: string
          project_id: string
          sort_order?: number
          source_recording_id?: string | null
          tags?: string[]
          task_id?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by_user_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          owner_id?: string
          project_id?: string
          sort_order?: number
          source_recording_id?: string | null
          tags?: string[]
          task_id?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_source_recording_id_fkey"
            columns: ["source_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_speakers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          recording_id: string
          role: Database["public"]["Enums"]["speaker_role"] | null
          speaker_index: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          recording_id: string
          role?: Database["public"]["Enums"]["speaker_role"] | null
          speaker_index: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          recording_id?: string
          role?: Database["public"]["Enums"]["speaker_role"] | null
          speaker_index?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_speakers_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_tasks: {
        Row: {
          assigned_to_speaker_index: number | null
          confidence: number | null
          created_at: string
          extracted_text: string | null
          id: string
          recording_id: string
          task_id: string
        }
        Insert: {
          assigned_to_speaker_index?: number | null
          confidence?: number | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          recording_id: string
          task_id: string
        }
        Update: {
          assigned_to_speaker_index?: number | null
          confidence?: number | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          recording_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_tasks_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          archive_audio_at: string | null
          audio_archived: boolean
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          event_calendar_id: string | null
          id: string
          language: string
          mime_type: string
          organization_id: string
          owner_id: string
          project_id: string | null
          provider: string | null
          provider_job_id: string | null
          retention_days: number | null
          search_tsv: unknown
          size_bytes: number
          source: Database["public"]["Enums"]["recording_source"]
          speakers_count: number | null
          status: Database["public"]["Enums"]["recording_status"]
          storage_key: string
          storage_provider: Database["public"]["Enums"]["storage_provider"]
          multipart_upload_id: string | null
          summary: string | null
          tags: string[]
          task_list_id: string | null
          title: string | null
          transcript_json: Json | null
          transcript_text: string | null
          updated_at: string
        }
        Insert: {
          archive_audio_at?: string | null
          audio_archived?: boolean
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          event_calendar_id?: string | null
          id?: string
          language?: string
          mime_type?: string
          organization_id: string
          owner_id: string
          project_id?: string | null
          provider?: string | null
          provider_job_id?: string | null
          retention_days?: number | null
          search_tsv?: unknown
          size_bytes?: number
          source?: Database["public"]["Enums"]["recording_source"]
          speakers_count?: number | null
          status?: Database["public"]["Enums"]["recording_status"]
          storage_key: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          multipart_upload_id?: string | null
          summary?: string | null
          tags?: string[]
          task_list_id?: string | null
          title?: string | null
          transcript_json?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Update: {
          archive_audio_at?: string | null
          audio_archived?: boolean
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          event_calendar_id?: string | null
          id?: string
          language?: string
          mime_type?: string
          organization_id?: string
          owner_id?: string
          project_id?: string | null
          provider?: string | null
          provider_job_id?: string | null
          retention_days?: number | null
          search_tsv?: unknown
          size_bytes?: number
          source?: Database["public"]["Enums"]["recording_source"]
          speakers_count?: number | null
          status?: Database["public"]["Enums"]["recording_status"]
          storage_key?: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          multipart_upload_id?: string | null
          summary?: string | null
          tags?: string[]
          task_list_id?: string | null
          title?: string | null
          transcript_json?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_event_calendar_id_fkey"
            columns: ["event_calendar_id"]
            isOneToOne: false
            referencedRelation: "event_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_lists: {
        Row: {
          archive_expires_at: string | null
          archived_at: string | null
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name: string
          organization_id: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_list_assignments: {
        Row: {
          assigned_at: string
          list_id: string
          recording_id: string
          sort_order_in_list: number
        }
        Insert: {
          assigned_at?: string
          list_id: string
          recording_id: string
          sort_order_in_list?: number
        }
        Update: {
          assigned_at?: string
          list_id?: string
          recording_id?: string
          sort_order_in_list?: number
        }
        Relationships: [
          {
            foreignKeyName: "recording_list_assignments_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "recording_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_list_assignments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["share_entity_type"]
          granted_by: string | null
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["share_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["share_entity_type"]
          granted_by?: string | null
          id?: string
          organization_id: string
          permission?: Database["public"]["Enums"]["share_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["share_entity_type"]
          granted_by?: string | null
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["share_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json
          id: string
          ip_address: unknown
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["attachment_type"]
          created_at: string
          created_by: string | null
          event_id: string | null
          filename: string | null
          id: string
          mime_type: string | null
          organization_id: string
          recording_id: string | null
          size_bytes: number | null
          storage_key: string | null
          storage_provider: Database["public"]["Enums"]["storage_provider"] | null
          task_id: string
          thought_id: string | null
          url: string | null
        }
        Insert: {
          attachment_type: Database["public"]["Enums"]["attachment_type"]
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          organization_id: string
          recording_id?: string | null
          size_bytes?: number | null
          storage_key?: string | null
          storage_provider?: Database["public"]["Enums"]["storage_provider"] | null
          task_id: string
          thought_id?: string | null
          url?: string | null
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["attachment_type"]
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          recording_id?: string | null
          size_bytes?: number | null
          storage_key?: string | null
          storage_provider?: Database["public"]["Enums"]["storage_provider"] | null
          task_id?: string
          thought_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_recording_fk"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_thought_fk"
            columns: ["thought_id"]
            isOneToOne: false
            referencedRelation: "thoughts"
            referencedColumns: ["id"]
          },
        ]
      }
      task_custom_fields: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_visible: boolean
          options: Json | null
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_visible?: boolean
          options?: Json | null
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_visible?: boolean
          options?: Json | null
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_custom_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          lag_days: number
          relation: Database["public"]["Enums"]["dependency_relation"]
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          lag_days?: number
          relation?: Database["public"]["Enums"]["dependency_relation"]
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          lag_days?: number
          relation?: Database["public"]["Enums"]["dependency_relation"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lists: {
        Row: {
          archive_expires_at: string | null
          archived_at: string | null
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          is_archived: boolean
          is_pinned: boolean
          kind: Database["public"]["Enums"]["task_list_kind"]
          linked_event_calendar_id: string | null
          name: string
          organization_id: string
          owner_id: string
          project_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          kind?: Database["public"]["Enums"]["task_list_kind"]
          linked_event_calendar_id?: string | null
          name: string
          organization_id: string
          owner_id: string
          project_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          kind?: Database["public"]["Enums"]["task_list_kind"]
          linked_event_calendar_id?: string | null
          name?: string
          organization_id?: string
          owner_id?: string
          project_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_seconds: number
          approved_at: string | null
          approved_by_user_id: string | null
          approver_user_id: string | null
          assignee_user_id: string | null
          completed_at: string | null
          completion_submitted_at: string | null
          created_at: string
          custom_fields: Json
          description: string | null
          duration_minutes: number | null
          estimated_hours: number | null
          external_url: string | null
          google_event_ids: Json | null
          id: string
          is_event: boolean
          is_phase: boolean
          location: string | null
          notes: string | null
          organization_id: string
          owner_id: string
          parent_task_id: string | null
          recurrence_ends_at: string | null
          recurrence_original_id: string | null
          recurrence_rule: string | null
          requires_approval: boolean
          scheduled_at: string | null
          search_tsv: unknown
          sort_order: number
          source_question_id: string | null
          source_recording_id: string | null
          source_thought_id: string | null
          spare_hours: number | null
          status: string
          tags: string[]
          task_list_id: string | null
          title: string
          updated_at: string
          urgency: number
        }
        Insert: {
          actual_seconds?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          approver_user_id?: string | null
          assignee_user_id?: string | null
          completed_at?: string | null
          completion_submitted_at?: string | null
          created_at?: string
          custom_fields?: Json
          description?: string | null
          duration_minutes?: number | null
          estimated_hours?: number | null
          external_url?: string | null
          google_event_ids?: Json | null
          id?: string
          is_event?: boolean
          is_phase?: boolean
          location?: string | null
          notes?: string | null
          organization_id: string
          owner_id: string
          parent_task_id?: string | null
          recurrence_ends_at?: string | null
          recurrence_original_id?: string | null
          recurrence_rule?: string | null
          requires_approval?: boolean
          scheduled_at?: string | null
          search_tsv?: unknown
          sort_order?: number
          source_question_id?: string | null
          source_recording_id?: string | null
          source_thought_id?: string | null
          spare_hours?: number | null
          status?: string
          tags?: string[]
          task_list_id?: string | null
          title: string
          updated_at?: string
          urgency?: number
        }
        Update: {
          actual_seconds?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          approver_user_id?: string | null
          assignee_user_id?: string | null
          completed_at?: string | null
          completion_submitted_at?: string | null
          created_at?: string
          custom_fields?: Json
          description?: string | null
          duration_minutes?: number | null
          estimated_hours?: number | null
          external_url?: string | null
          google_event_ids?: Json | null
          id?: string
          is_event?: boolean
          is_phase?: boolean
          location?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          parent_task_id?: string | null
          recurrence_ends_at?: string | null
          recurrence_original_id?: string | null
          recurrence_rule?: string | null
          requires_approval?: boolean
          scheduled_at?: string | null
          search_tsv?: unknown
          sort_order?: number
          source_question_id?: string | null
          source_recording_id?: string | null
          source_thought_id?: string | null
          spare_hours?: number | null
          status?: string
          tags?: string[]
          task_list_id?: string | null
          title?: string
          updated_at?: string
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_original_id_fkey"
            columns: ["recurrence_original_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_question_fk"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_recording_fk"
            columns: ["source_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_thought_fk"
            columns: ["source_thought_id"]
            isOneToOne: false
            referencedRelation: "thoughts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      thought_list_assignments: {
        Row: {
          assigned_at: string
          list_id: string
          sort_order_in_list: number
          thought_id: string
        }
        Insert: {
          assigned_at?: string
          list_id: string
          sort_order_in_list?: number
          thought_id: string
        }
        Update: {
          assigned_at?: string
          list_id?: string
          sort_order_in_list?: number
          thought_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thought_list_assignments_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "thought_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thought_list_assignments_thought_id_fkey"
            columns: ["thought_id"]
            isOneToOne: false
            referencedRelation: "thoughts"
            referencedColumns: ["id"]
          },
        ]
      }
      thought_lists: {
        Row: {
          archive_expires_at: string | null
          archived_at: string | null
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name: string
          organization_id: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archive_expires_at?: string | null
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thought_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      thought_processings: {
        Row: {
          ai_suggested: boolean
          created_at: string
          created_by: string | null
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["thought_processing_target"]
          thought_id: string
        }
        Insert: {
          ai_suggested?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["thought_processing_target"]
          thought_id: string
        }
        Update: {
          ai_suggested?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["thought_processing_target"]
          thought_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thought_processings_thought_id_fkey"
            columns: ["thought_id"]
            isOneToOne: false
            referencedRelation: "thoughts"
            referencedColumns: ["id"]
          },
        ]
      }
      thoughts: {
        Row: {
          ai_generated_title: string | null
          ai_summary: string | null
          archive_expires_at: string | null
          archived_at: string | null
          created_at: string
          id: string
          organization_id: string
          owner_id: string
          processed_at: string | null
          recording_id: string | null
          search_tsv: unknown
          source: Database["public"]["Enums"]["thought_source"]
          status: Database["public"]["Enums"]["thought_status"]
          tags: string[]
          text_content: string | null
          updated_at: string
          whatsapp_message_id: string | null
        }
        Insert: {
          ai_generated_title?: string | null
          ai_summary?: string | null
          archive_expires_at?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          owner_id: string
          processed_at?: string | null
          recording_id?: string | null
          search_tsv?: unknown
          source: Database["public"]["Enums"]["thought_source"]
          status?: Database["public"]["Enums"]["thought_status"]
          tags?: string[]
          text_content?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          ai_generated_title?: string | null
          ai_summary?: string | null
          archive_expires_at?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          owner_id?: string
          processed_at?: string | null
          recording_id?: string | null
          search_tsv?: unknown
          source?: Database["public"]["Enums"]["thought_source"]
          status?: Database["public"]["Enums"]["thought_status"]
          tags?: string[]
          text_content?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thoughts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thoughts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_manual: boolean
          note: string | null
          organization_id: string
          started_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_manual?: boolean
          note?: string | null
          organization_id: string
          started_at: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_manual?: boolean
          note?: string | null
          organization_id?: string
          started_at?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          layout_desktop: Json
          layout_mobile: Json
          layout_tablet: Json
          scope_id: string
          screen_key: Database["public"]["Enums"]["dashboard_screen"]
          updated_at: string
          user_id: string
          widget_state: Json
        }
        Insert: {
          layout_desktop?: Json
          layout_mobile?: Json
          layout_tablet?: Json
          scope_id?: string
          screen_key: Database["public"]["Enums"]["dashboard_screen"]
          updated_at?: string
          user_id: string
          widget_state?: Json
        }
        Update: {
          layout_desktop?: Json
          layout_mobile?: Json
          layout_tablet?: Json
          scope_id?: string
          screen_key?: Database["public"]["Enums"]["dashboard_screen"]
          updated_at?: string
          user_id?: string
          widget_state?: Json
        }
        Relationships: []
      }
      user_list_visibility: {
        Row: {
          hidden_list_ids: string[]
          screen_key: Database["public"]["Enums"]["dashboard_screen"]
          updated_at: string
          user_id: string
        }
        Insert: {
          hidden_list_ids?: string[]
          screen_key: Database["public"]["Enums"]["dashboard_screen"]
          updated_at?: string
          user_id: string
        }
        Update: {
          hidden_list_ids?: string[]
          screen_key?: Database["public"]["Enums"]["dashboard_screen"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          email: boolean
          in_app: boolean
          push: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          push?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          push?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_saved_filters: {
        Row: {
          created_at: string
          filter_config: Json
          id: string
          is_default: boolean
          name: string
          screen_key: Database["public"]["Enums"]["dashboard_screen"]
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_config?: Json
          id?: string
          is_default?: boolean
          name: string
          screen_key: Database["public"]["Enums"]["dashboard_screen"]
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_config?: Json
          id?: string
          is_default?: boolean
          name?: string
          screen_key?: Database["public"]["Enums"]["dashboard_screen"]
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_task_statuses: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_builtin: boolean
          key: string
          kind: Database["public"]["Enums"]["task_status_kind"]
          label: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_builtin?: boolean
          key: string
          kind: Database["public"]["Enums"]["task_status_kind"]
          label: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_builtin?: boolean
          key?: string
          kind?: Database["public"]["Enums"]["task_status_kind"]
          label?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_inbound_log: {
        Row: {
          from_phone_e164: string | null
          id: string
          matched_user_id: string | null
          message_id: string | null
          message_type: string | null
          processing_error: string | null
          raw_payload: Json
          received_at: string
          thought_id: string | null
        }
        Insert: {
          from_phone_e164?: string | null
          id?: string
          matched_user_id?: string | null
          message_id?: string | null
          message_type?: string | null
          processing_error?: string | null
          raw_payload: Json
          received_at?: string
          thought_id?: string | null
        }
        Update: {
          from_phone_e164?: string | null
          id?: string
          matched_user_id?: string | null
          message_id?: string | null
          message_type?: string | null
          processing_error?: string | null
          raw_payload?: Json
          received_at?: string
          thought_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_log_thought_id_fkey"
            columns: ["thought_id"]
            isOneToOne: false
            referencedRelation: "thoughts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_use_feature: {
        Args: { p_feature: string; p_organization_id: string }
        Returns: boolean
      }
      create_organization_with_password: {
        Args: {
          p_join_password: string
          p_name: string
          p_suggested_email_domain?: string
        }
        Returns: {
          archive_expires_at: string | null
          archived_at: string | null
          billing_customer_id: string | null
          created_at: string
          created_by: string | null
          current_period_end: string | null
          id: string
          is_archived: boolean
          join_password_hash: string | null
          name: string
          plan: Database["public"]["Enums"]["billing_plan"]
          slug: string | null
          storage_bytes_limit: number
          storage_bytes_used: number
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          suggested_email_domain: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      duplicate_task_tree: {
        Args: {
          p_source_task_id: string
          p_target_list_id?: string
          p_target_parent_id?: string
        }
        Returns: string
      }
      reset_user_task_statuses: {
        Args: Record<string, never>
        Returns: undefined
      }
      find_organizations_by_email_domain: {
        Args: { p_email: string }
        Returns: {
          id: string
          name: string
          suggested_email_domain: string
        }[]
      }
      global_search: {
        Args: { p_limit?: number; p_organization_id: string; p_query: string }
        Returns: {
          entity_type: string
          id: string
          score: number
          snippet: string
          title: string
        }[]
      }
      join_organization_with_password: {
        Args: { p_join_password: string; p_organization_id: string }
        Returns: {
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      promote_self_to_super_admin_if_allowed: { Args: never; Returns: boolean }
      recalc_task_actual_seconds: {
        Args: { p_task: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_timer: {
        Args: { p_note?: string; p_task_id: string }
        Returns: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_manual: boolean
          note: string | null
          organization_id: string
          started_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stop_timer: {
        Args: never
        Returns: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_manual: boolean
          note: string | null
          organization_id: string
          started_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_has_share: {
        Args: {
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["share_entity_type"]
          p_user: string
        }
        Returns: boolean
      }
      user_is_org_member: {
        Args: { org_id: string; target_user: string }
        Returns: boolean
      }
      user_is_super_admin: { Args: { target_user: string }; Returns: boolean }
    }
    Enums: {
      attachment_type:
        | "recording"
        | "thought"
        | "event"
        | "file"
        | "image"
        | "link"
      billing_plan: "free" | "pro" | "enterprise"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "multiselect"
        | "stars"
        | "checkbox"
        | "url"
        | "file"
      dashboard_screen:
        | "home"
        | "tasks"
        | "calendar"
        | "gantt"
        | "recordings"
        | "thoughts"
        | "projects"
        | "pricing"
      dependency_relation:
        | "finish_to_start"
        | "start_to_start"
        | "finish_to_finish"
        | "start_to_finish"
      event_rsvp_status: "pending" | "accepted" | "declined" | "tentative"
      notification_type:
        | "task_assigned"
        | "task_approval_requested"
        | "task_approved"
        | "task_due_soon"
        | "event_invited"
        | "event_starting_soon"
        | "thought_received"
        | "recording_ready"
        | "project_over_budget"
        | "org_member_joined"
      organization_member_role: "owner" | "admin" | "member"
      project_pricing_mode: "fixed_price" | "hourly" | "quote"
      project_spare_mode: "percent" | "hours"
      push_platform: "web" | "ios" | "android"
      recording_source: "thought" | "call" | "meeting" | "other"
      recording_status:
        | "recording"
        | "uploaded"
        | "transcribing"
        | "extracting"
        | "ready"
        | "error"
      share_entity_type:
        | "task"
        | "task_list"
        | "recording"
        | "project"
        | "thought"
        | "event"
      share_permission: "read" | "write"
      speaker_role: "owner" | "contact" | "other"
      storage_provider: "supabase" | "r2"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      task_list_kind: "project" | "custom"
      task_status:
        | "todo"
        | "in_progress"
        | "pending_approval"
        | "done"
        | "cancelled"
      task_status_kind:
        | "backlog"
        | "active"
        | "waiting_approval"
        | "done"
        | "cancelled"
      thought_processing_target:
        | "task"
        | "event"
        | "project"
        | "recording"
        | "message"
      thought_source:
        | "app_text"
        | "app_audio"
        | "whatsapp_text"
        | "whatsapp_audio"
        | "whatsapp_image"
      thought_status: "unprocessed" | "processed" | "archived"
      video_call_provider: "meet" | "zoom" | "teams" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attachment_type: [
        "recording",
        "thought",
        "event",
        "file",
        "image",
        "link",
      ],
      billing_plan: ["free", "pro", "enterprise"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "select",
        "multiselect",
        "stars",
        "checkbox",
        "url",
        "file",
      ],
      dashboard_screen: [
        "home",
        "tasks",
        "calendar",
        "gantt",
        "recordings",
        "thoughts",
        "projects",
        "pricing",
      ],
      dependency_relation: [
        "finish_to_start",
        "start_to_start",
        "finish_to_finish",
        "start_to_finish",
      ],
      event_rsvp_status: ["pending", "accepted", "declined", "tentative"],
      notification_type: [
        "task_assigned",
        "task_approval_requested",
        "task_approved",
        "task_due_soon",
        "event_invited",
        "event_starting_soon",
        "thought_received",
        "recording_ready",
        "project_over_budget",
        "org_member_joined",
      ],
      organization_member_role: ["owner", "admin", "member"],
      project_pricing_mode: ["fixed_price", "hourly", "quote"],
      project_spare_mode: ["percent", "hours"],
      push_platform: ["web", "ios", "android"],
      recording_source: ["thought", "call", "meeting", "other"],
      recording_status: [
        "recording",
        "uploaded",
        "transcribing",
        "extracting",
        "ready",
        "error",
      ],
      share_entity_type: [
        "task",
        "task_list",
        "recording",
        "project",
        "thought",
        "event",
      ],
      share_permission: ["read", "write"],
      speaker_role: ["owner", "contact", "other"],
      storage_provider: ["supabase", "r2"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      task_list_kind: ["project", "custom"],
      task_status: [
        "todo",
        "in_progress",
        "pending_approval",
        "done",
        "cancelled",
      ],
      task_status_kind: [
        "backlog",
        "active",
        "waiting_approval",
        "done",
        "cancelled",
      ],
      thought_processing_target: [
        "task",
        "event",
        "project",
        "recording",
        "message",
      ],
      thought_source: [
        "app_text",
        "app_audio",
        "whatsapp_text",
        "whatsapp_audio",
        "whatsapp_image",
      ],
      thought_status: ["unprocessed", "processed", "archived"],
      video_call_provider: ["meet", "zoom", "teams", "other"],
    },
  },
} as const

