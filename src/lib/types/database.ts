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
          text_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          date: string
          organization_id: string
          text_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          date?: string
          organization_id?: string
          text_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_day_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          owner_id: string
          phone: string | null
          shared_with_org: boolean
          sort_order: number
          tax_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id: string
          owner_id?: string
          phone?: string | null
          shared_with_org?: boolean
          sort_order?: number
          tax_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          phone?: string | null
          shared_with_org?: boolean
          sort_order?: number
          tax_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefs: {
        Row: {
          anchor: string
          generated_at: string
          id: string
          input_token_count: number | null
          model: string | null
          organization_id: string
          output: Json
          output_token_count: number | null
          proposal_decisions: Json
          proposals: Json
          user_id: string
          view: string
        }
        Insert: {
          anchor: string
          generated_at?: string
          id?: string
          input_token_count?: number | null
          model?: string | null
          organization_id: string
          output: Json
          output_token_count?: number | null
          proposal_decisions?: Json
          proposals?: Json
          user_id: string
          view: string
        }
        Update: {
          anchor?: string
          generated_at?: string
          id?: string
          input_token_count?: number | null
          model?: string | null
          organization_id?: string
          output?: Json
          output_token_count?: number | null
          proposal_decisions?: Json
          proposals?: Json
          user_id?: string
          view?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_links: {
        Row: {
          created_at: string
          document_id: string
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
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
        Relationships: [
          {
            foreignKeyName: "event_calendars_linked_task_list_id_fkey"
            columns: ["linked_task_list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_calendars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
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
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "event_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      framework_block_occurrences: {
        Row: {
          block_id: string
          created_at: string
          framework_id: string
          id: string
          occ_date: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          block_id: string
          created_at?: string
          framework_id: string
          id?: string
          occ_date: string
          organization_id: string
          status: string
          updated_at?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          framework_id?: string
          id?: string
          occ_date?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_block_occurrences_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "framework_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_block_occurrences_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_block_occurrences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_blocks: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          day_of_week: number | null
          effective_from: string | null
          effective_to: string | null
          end_minute: number
          framework_id: string
          goal_min_streak_periods: number | null
          goal_period: string | null
          goal_started_on: string | null
          goal_target: number | null
          id: string
          month_anchor: string | null
          month_interval: number | null
          organization_id: string
          override_kind: string | null
          period_unit: string
          scope: string
          sort_order: number
          source_block_id: string | null
          specific_date: string | null
          start_minute: number
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_from?: string | null
          effective_to?: string | null
          end_minute?: number
          framework_id: string
          goal_min_streak_periods?: number | null
          goal_period?: string | null
          goal_started_on?: string | null
          goal_target?: number | null
          id?: string
          month_anchor?: string | null
          month_interval?: number | null
          organization_id: string
          override_kind?: string | null
          period_unit?: string
          scope?: string
          sort_order?: number
          source_block_id?: string | null
          specific_date?: string | null
          start_minute?: number
          title?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_from?: string | null
          effective_to?: string | null
          end_minute?: number
          framework_id?: string
          goal_min_streak_periods?: number | null
          goal_period?: string | null
          goal_started_on?: string | null
          goal_target?: number | null
          id?: string
          month_anchor?: string | null
          month_interval?: number | null
          organization_id?: string
          override_kind?: string | null
          period_unit?: string
          scope?: string
          sort_order?: number
          source_block_id?: string | null
          specific_date?: string | null
          start_minute?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_blocks_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_blocks_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "framework_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_day_labels: {
        Row: {
          color: string | null
          created_at: string
          day_of_week: number | null
          effective_from: string | null
          effective_to: string | null
          framework_id: string
          id: string
          label: string
          month_anchor: string | null
          month_interval: number | null
          organization_id: string
          period_unit: string
          scope: string
          specific_date: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_from?: string | null
          effective_to?: string | null
          framework_id: string
          id?: string
          label?: string
          month_anchor?: string | null
          month_interval?: number | null
          organization_id: string
          period_unit?: string
          scope?: string
          specific_date?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_from?: string | null
          effective_to?: string | null
          framework_id?: string
          id?: string
          label?: string
          month_anchor?: string | null
          month_interval?: number | null
          organization_id?: string
          period_unit?: string
          scope?: string
          specific_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_day_labels_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_day_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          framework_id: string
          id: string
          organization_id: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          framework_id: string
          id?: string
          organization_id: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          framework_id?: string
          id?: string
          organization_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "framework_history_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_shares: {
        Row: {
          created_at: string
          framework_id: string
          granted_by: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          framework_id: string
          granted_by?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          framework_id?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_shares_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_visibility: {
        Row: {
          framework_id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          framework_id: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          framework_id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_visibility_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      frameworks: {
        Row: {
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string
          owner_id: string
          run_end: string | null
          run_start: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name: string
          organization_id: string
          owner_id?: string
          run_end?: string | null
          run_start?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string
          owner_id?: string
          run_end?: string | null
          run_start?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frameworks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_baseline_tasks: {
        Row: {
          baseline_id: string
          duration_minutes: number | null
          id: string
          scheduled_at: string | null
          task_id: string
        }
        Insert: {
          baseline_id: string
          duration_minutes?: number | null
          id?: string
          scheduled_at?: string | null
          task_id: string
        }
        Update: {
          baseline_id?: string
          duration_minutes?: number | null
          id?: string
          scheduled_at?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_baseline_tasks_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "gantt_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gantt_baseline_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_baselines: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          organization_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_baselines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      household_staples: {
        Row: {
          category_id: string | null
          created_at: string
          default_quantity: number
          default_unit: string | null
          id: string
          is_active: boolean
          last_added_at: string | null
          name: string
          notes: string | null
          organization_id: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          default_quantity?: number
          default_unit?: string | null
          id?: string
          is_active?: boolean
          last_added_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          default_quantity?: number
          default_unit?: string | null
          id?: string
          is_active?: boolean
          last_added_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_staples_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ingredient_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_staples_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_units: {
        Row: {
          amount: number
          calories: number | null
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          id: string
          ingredient_id: string
          is_default: boolean
          organization_id: string
          protein_g: number | null
          sort_order: number
          unit_name: string
          updated_at: string
        }
        Insert: {
          amount?: number
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          ingredient_id: string
          is_default?: boolean
          organization_id: string
          protein_g?: number | null
          sort_order?: number
          unit_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          ingredient_id?: string
          is_default?: boolean
          organization_id?: string
          protein_g?: number | null
          sort_order?: number
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_units_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_complete: boolean
          name: string
          notes: string | null
          organization_id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          name: string
          notes?: string | null
          organization_id: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ingredient_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          meal_id: string
          organization_id: string
          quantity: number
          sort_order: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          meal_id: string
          organization_id: string
          quantity?: number
          sort_order?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          meal_id?: string
          organization_id?: string
          quantity?: number
          sort_order?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "ingredient_units"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_days: {
        Row: {
          created_at: string
          date: string
          id: string
          meal_id: string
          meal_time: string
          notes: string | null
          organization_id: string
          sort_order: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          meal_id: string
          meal_time: string
          notes?: string | null
          organization_id: string
          sort_order?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          meal_id?: string
          meal_time?: string
          notes?: string | null
          organization_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_days_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_days_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_shares: {
        Row: {
          can_edit: boolean
          created_at: string
          organization_id: string
          shared_with_user_id: string
          sharer_user_id: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          organization_id: string
          shared_with_user_id: string
          sharer_user_id: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          organization_id?: string
          shared_with_user_id?: string
          sharer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_template: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          meal_id: string
          meal_time: string
          notes: string | null
          organization_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          meal_id: string
          meal_time: string
          notes?: string | null
          organization_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          meal_id?: string
          meal_time?: string
          notes?: string | null
          organization_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_template_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_template_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          image_url: string | null
          meal_times: string[]
          name: string
          notes: string | null
          organization_id: string
          owner_id: string
          servings: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          meal_times?: string[]
          name: string
          notes?: string | null
          organization_id: string
          owner_id: string
          servings?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          meal_times?: string[]
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          servings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "meal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_task_links: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          organization_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          organization_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_task_links_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "project_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_task_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_name_snapshot: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_name_snapshot?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_name_snapshot?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_organization_id_fkey"
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
          finance_shared: boolean
          food_shared: boolean
          id: string
          is_archived: boolean
          join_password_hash: string | null
          name: string
          org_type: Database["public"]["Enums"]["organization_type"]
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
          finance_shared?: boolean
          food_shared?: boolean
          id?: string
          is_archived?: boolean
          join_password_hash?: string | null
          name: string
          org_type?: Database["public"]["Enums"]["organization_type"]
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
          finance_shared?: boolean
          food_shared?: boolean
          id?: string
          is_archived?: boolean
          join_password_hash?: string | null
          name?: string
          org_type?: Database["public"]["Enums"]["organization_type"]
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
      plan_decision_impacts: {
        Row: {
          affected_stage_task_id: string | null
          created_at: string
          decision_id: string
          id: string
          note: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          affected_stage_task_id?: string | null
          created_at?: string
          decision_id: string
          id?: string
          note?: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          affected_stage_task_id?: string | null
          created_at?: string
          decision_id?: string
          id?: string
          note?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_decision_impacts_affected_stage_task_id_fkey"
            columns: ["affected_stage_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_decision_impacts_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "plan_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_decision_impacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_decisions: {
        Row: {
          created_at: string
          decision: string
          id: string
          organization_id: string
          plan_id: string
          question: string
          sort_order: number
          stage_task_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision?: string
          id?: string
          organization_id: string
          plan_id: string
          question?: string
          sort_order?: number
          stage_task_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          organization_id?: string
          plan_id?: string
          question?: string
          sort_order?: number
          stage_task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_decisions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_decisions_stage_task_id_fkey"
            columns: ["stage_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_stage_impacts: {
        Row: {
          created_at: string
          id: string
          impact_level: number | null
          note: string
          organization_id: string
          plan_id: string
          source_stage_id: string
          target_stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact_level?: number | null
          note?: string
          organization_id: string
          plan_id: string
          source_stage_id: string
          target_stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          impact_level?: number | null
          note?: string
          organization_id?: string
          plan_id?: string
          source_stage_id?: string
          target_stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_stage_impacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_stage_impacts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_stage_impacts_source_stage_id_fkey"
            columns: ["source_stage_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_stage_impacts_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
          onboarding_done: boolean
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
          onboarding_done?: boolean
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
          onboarding_done?: boolean
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
      project_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          file_key: string | null
          file_size: number | null
          id: string
          kind: string
          mime: string | null
          name: string
          organization_id: string
          owner_id: string
          parent_id: string | null
          project_id: string
          sort_order: number
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          file_key?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          mime?: string | null
          name?: string
          organization_id: string
          owner_id?: string
          parent_id?: string | null
          project_id: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          file_key?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          mime?: string | null
          name?: string
          organization_id?: string
          owner_id?: string
          parent_id?: string | null
          project_id?: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          impact: string
          label: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          impact?: string
          label: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          impact?: string
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
      project_meetings: {
        Row: {
          all_day: boolean
          created_at: string
          custom_fields: Json
          event_id: string | null
          id: string
          location: string | null
          meeting_at: string | null
          notes: string | null
          organization_id: string
          owner_id: string
          project_id: string
          recording_id: string | null
          sort_order: number
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          custom_fields?: Json
          event_id?: string | null
          id?: string
          location?: string | null
          meeting_at?: string | null
          notes?: string | null
          organization_id: string
          owner_id: string
          project_id: string
          recording_id?: string | null
          sort_order?: number
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          custom_fields?: Json
          event_id?: string | null
          id?: string
          location?: string | null
          meeting_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          project_id?: string
          recording_id?: string | null
          sort_order?: number
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_meetings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_meetings_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payments: {
        Row: {
          amount_cents: number
          contact_id: string | null
          created_at: string
          currency: string
          custom_fields: Json
          demand_date: string | null
          direction: string
          due_date: string | null
          id: string
          notes: string | null
          organization_id: string
          owner_id: string
          paid_date: string | null
          project_id: string
          sort_order: number
          status: string
          terms_net_days: number | null
          title: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          contact_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json
          demand_date?: string | null
          direction?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          owner_id?: string
          paid_date?: string | null
          project_id: string
          sort_order?: number
          status?: string
          terms_net_days?: number | null
          title?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          contact_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json
          demand_date?: string | null
          direction?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          paid_date?: string | null
          project_id?: string
          sort_order?: number
          status?: string
          terms_net_days?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_project_id_fkey"
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
          column_labels: Json
          column_order: Json
          created_at: string
          currency: string
          description: string | null
          files_folder_url: string | null
          presentation_url: string | null
          emoji: string | null
          entity_column_labels: Json
          entity_column_order: Json
          entity_hidden_columns: Json
          hourly_rate_cents: number | null
          id: string
          is_archived: boolean
          is_active: boolean
          last_backup_at: string | null
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
          column_labels?: Json
          column_order?: Json
          created_at?: string
          currency?: string
          description?: string | null
          files_folder_url?: string | null
          presentation_url?: string | null
          emoji?: string | null
          entity_column_labels?: Json
          entity_column_order?: Json
          entity_hidden_columns?: Json
          hourly_rate_cents?: number | null
          id?: string
          is_archived?: boolean
          is_active?: boolean
          last_backup_at?: string | null
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
          column_labels?: Json
          column_order?: Json
          created_at?: string
          currency?: string
          description?: string | null
          files_folder_url?: string | null
          presentation_url?: string | null
          emoji?: string | null
          entity_column_labels?: Json
          entity_column_order?: Json
          entity_hidden_columns?: Json
          hourly_rate_cents?: number | null
          id?: string
          is_archived?: boolean
          is_active?: boolean
          last_backup_at?: string | null
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
          ai_output: Json | null
          ai_output_at: string | null
          ai_status: string | null
          archive_audio_at: string | null
          audio_archived: boolean
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          event_calendar_id: string | null
          free_text_qa: Json
          id: string
          language: string
          merged_into: string | null
          mime_type: string
          multipart_upload_id: string | null
          organization_id: string
          owner_id: string
          project_id: string | null
          provider: string | null
          provider_job_id: string | null
          retention_days: number | null
          search_tsv: unknown
          size_bytes: number
          source: Database["public"]["Enums"]["recording_source"]
          source_custom: string | null
          speakers_count: number | null
          status: Database["public"]["Enums"]["recording_status"]
          storage_key: string
          storage_provider: Database["public"]["Enums"]["storage_provider"]
          summary: string | null
          tags: string[]
          task_list_id: string | null
          title: string | null
          transcript_json: Json | null
          transcript_text: string | null
          updated_at: string
        }
        Insert: {
          ai_output?: Json | null
          ai_output_at?: string | null
          ai_status?: string | null
          archive_audio_at?: string | null
          audio_archived?: boolean
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          event_calendar_id?: string | null
          free_text_qa?: Json
          id?: string
          language?: string
          merged_into?: string | null
          mime_type?: string
          multipart_upload_id?: string | null
          organization_id: string
          owner_id: string
          project_id?: string | null
          provider?: string | null
          provider_job_id?: string | null
          retention_days?: number | null
          search_tsv?: unknown
          size_bytes?: number
          source?: Database["public"]["Enums"]["recording_source"]
          source_custom?: string | null
          speakers_count?: number | null
          status?: Database["public"]["Enums"]["recording_status"]
          storage_key: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          summary?: string | null
          tags?: string[]
          task_list_id?: string | null
          title?: string | null
          transcript_json?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Update: {
          ai_output?: Json | null
          ai_output_at?: string | null
          ai_status?: string | null
          archive_audio_at?: string | null
          audio_archived?: boolean
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          event_calendar_id?: string | null
          free_text_qa?: Json
          id?: string
          language?: string
          merged_into?: string | null
          mime_type?: string
          multipart_upload_id?: string | null
          organization_id?: string
          owner_id?: string
          project_id?: string | null
          provider?: string | null
          provider_job_id?: string | null
          retention_days?: number | null
          search_tsv?: unknown
          size_bytes?: number
          source?: Database["public"]["Enums"]["recording_source"]
          source_custom?: string | null
          speakers_count?: number | null
          status?: Database["public"]["Enums"]["recording_status"]
          storage_key?: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
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
            foreignKeyName: "recordings_event_calendar_id_fkey"
            columns: ["event_calendar_id"]
            isOneToOne: false
            referencedRelation: "event_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
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
      shopping_run_items: {
        Row: {
          carried_from_run_id: string | null
          category_id: string | null
          created_at: string
          id: string
          ingredient_id: string | null
          matched_from_receipt: boolean
          name: string
          notes: string | null
          organization_id: string
          quantity: number
          run_id: string
          sort_order: number
          source: string
          source_meals: string[]
          staple_id: string | null
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          carried_from_run_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          matched_from_receipt?: boolean
          name: string
          notes?: string | null
          organization_id: string
          quantity?: number
          run_id: string
          sort_order?: number
          source?: string
          source_meals?: string[]
          staple_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          carried_from_run_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          matched_from_receipt?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          run_id?: string
          sort_order?: number
          source?: string
          source_meals?: string[]
          staple_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_run_items_carried_from_run_id_fkey"
            columns: ["carried_from_run_id"]
            isOneToOne: false
            referencedRelation: "shopping_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_run_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ingredient_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_run_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_run_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "shopping_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_run_items_staple_id_fkey"
            columns: ["staple_id"]
            isOneToOne: false
            referencedRelation: "household_staples"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_runs: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          frozen_from_date: string
          frozen_to_date: string
          id: string
          included_user_ids: string[]
          organization_id: string
          receipt_storage_path: string | null
          status: string
          store_connection_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          frozen_from_date: string
          frozen_to_date: string
          id?: string
          included_user_ids?: string[]
          organization_id: string
          receipt_storage_path?: string | null
          status?: string
          store_connection_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          frozen_from_date?: string
          frozen_to_date?: string
          id?: string
          included_user_ids?: string[]
          organization_id?: string
          receipt_storage_path?: string | null
          status?: string
          store_connection_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_runs_store_connection_id_fkey"
            columns: ["store_connection_id"]
            isOneToOne: false
            referencedRelation: "store_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      store_connections: {
        Row: {
          base_url: string | null
          config: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          kind: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_connections_organization_id_fkey"
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
      task_assignees: {
        Row: {
          created_at: string
          created_by: string | null
          delegation_status: Database["public"]["Enums"]["delegation_status"]
          id: string
          organization_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delegation_status?: Database["public"]["Enums"]["delegation_status"]
          id?: string
          organization_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delegation_status?: Database["public"]["Enums"]["delegation_status"]
          id?: string
          organization_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
          storage_provider:
            | Database["public"]["Enums"]["storage_provider"]
            | null
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
          storage_provider?:
            | Database["public"]["Enums"]["storage_provider"]
            | null
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
          storage_provider?:
            | Database["public"]["Enums"]["storage_provider"]
            | null
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
          entity_type: Database["public"]["Enums"]["custom_field_entity"]
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
          entity_type?: Database["public"]["Enums"]["custom_field_entity"]
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
          entity_type?: Database["public"]["Enums"]["custom_field_entity"]
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
      task_edits: {
        Row: {
          changes: Json
          edited_at: string
          edited_by: string | null
          id: string
          org_id: string
          task_id: string
        }
        Insert: {
          changes: Json
          edited_at?: string
          edited_by?: string | null
          id?: string
          org_id: string
          task_id: string
        }
        Update: {
          changes?: Json
          edited_at?: string
          edited_by?: string | null
          id?: string
          org_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_edits_edited_by_profiles_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edits_task_id_fkey"
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
          calendar_display_mode: string
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
          parent_plan_id: string | null
          plan_end_date: string | null
          plan_general_goal: string | null
          plan_horizon: string | null
          plan_start_date: string | null
          project_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          archive_expires_at?: string | null
          archived_at?: string | null
          calendar_display_mode?: string
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
          parent_plan_id?: string | null
          plan_end_date?: string | null
          plan_general_goal?: string | null
          plan_horizon?: string | null
          plan_start_date?: string | null
          project_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archive_expires_at?: string | null
          archived_at?: string | null
          calendar_display_mode?: string
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
          parent_plan_id?: string | null
          plan_end_date?: string | null
          plan_general_goal?: string | null
          plan_horizon?: string | null
          plan_start_date?: string | null
          project_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_linked_event_calendar_id_fkey"
            columns: ["linked_event_calendar_id"]
            isOneToOne: false
            referencedRelation: "event_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_lists_parent_plan_id_fkey"
            columns: ["parent_plan_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
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
          accent_color: string | null
          actual_seconds: number
          approved_at: string | null
          approved_by_user_id: string | null
          approver_user_id: string | null
          assignee_user_id: string | null
          completed_at: string | null
          completed_occurrences: Json
          completion_submitted_at: string | null
          created_at: string
          custom_fields: Json
          deadline_at: string | null
          delegation_status:
            | Database["public"]["Enums"]["delegation_status"]
            | null
          description: string | null
          duration_minutes: number | null
          estimated_hours: number | null
          excluded_occurrences: Json
          external_url: string | null
          extra_occurrences: Json
          goal_deadline: string | null
          goal_min_streak_periods: number | null
          goal_period: string | null
          goal_started_on: string | null
          goal_target: number | null
          goal_track_time: boolean
          goal_type: string | null
          google_event_ids: Json | null
          id: string
          is_critical: boolean
          is_event: boolean
          is_phase: boolean
          location: string | null
          notes: string | null
          organization_id: string
          owner_id: string
          parent_task_id: string | null
          plan_quant_target: string | null
          plan_status: string | null
          plan_success_metric: string | null
          plan_time_range: string | null
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
          accent_color?: string | null
          actual_seconds?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          approver_user_id?: string | null
          assignee_user_id?: string | null
          completed_at?: string | null
          completed_occurrences?: Json
          completion_submitted_at?: string | null
          created_at?: string
          custom_fields?: Json
          deadline_at?: string | null
          delegation_status?:
            | Database["public"]["Enums"]["delegation_status"]
            | null
          description?: string | null
          duration_minutes?: number | null
          estimated_hours?: number | null
          excluded_occurrences?: Json
          external_url?: string | null
          extra_occurrences?: Json
          goal_deadline?: string | null
          goal_min_streak_periods?: number | null
          goal_period?: string | null
          goal_started_on?: string | null
          goal_target?: number | null
          goal_track_time?: boolean
          goal_type?: string | null
          google_event_ids?: Json | null
          id?: string
          is_critical?: boolean
          is_event?: boolean
          is_phase?: boolean
          location?: string | null
          notes?: string | null
          organization_id: string
          owner_id: string
          parent_task_id?: string | null
          plan_quant_target?: string | null
          plan_status?: string | null
          plan_success_metric?: string | null
          plan_time_range?: string | null
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
          accent_color?: string | null
          actual_seconds?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          approver_user_id?: string | null
          assignee_user_id?: string | null
          completed_at?: string | null
          completed_occurrences?: Json
          completion_submitted_at?: string | null
          created_at?: string
          custom_fields?: Json
          deadline_at?: string | null
          delegation_status?:
            | Database["public"]["Enums"]["delegation_status"]
            | null
          description?: string | null
          duration_minutes?: number | null
          estimated_hours?: number | null
          excluded_occurrences?: Json
          external_url?: string | null
          extra_occurrences?: Json
          goal_deadline?: string | null
          goal_min_streak_periods?: number | null
          goal_period?: string | null
          goal_started_on?: string | null
          goal_target?: number | null
          goal_track_time?: boolean
          goal_type?: string | null
          google_event_ids?: Json | null
          id?: string
          is_critical?: boolean
          is_event?: boolean
          is_phase?: boolean
          location?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          parent_task_id?: string | null
          plan_quant_target?: string | null
          plan_status?: string | null
          plan_success_metric?: string | null
          plan_time_range?: string | null
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
      user_thought_preferences: {
        Row: {
          auto_transcribe_recorded_thoughts: boolean
          created_at: string
          recording_ai_prompts: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_transcribe_recorded_thoughts?: boolean
          created_at?: string
          recording_ai_prompts?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_transcribe_recorded_thoughts?: boolean
          created_at?: string
          recording_ai_prompts?: Json
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
      _meal_image_org_id: { Args: { name: string }; Returns: string }
      accept_org_invite: { Args: { p_token: string }; Returns: Json }
      can_use_feature: {
        Args: { p_feature: string; p_organization_id: string }
        Returns: boolean
      }
      create_org_invite: {
        Args: {
          p_email: string
          p_org_id: string
          p_role?: Database["public"]["Enums"]["organization_member_role"]
        }
        Returns: Json
      }
      create_organization_with_password:
        | {
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
              finance_shared: boolean
              food_shared: boolean
              id: string
              is_archived: boolean
              join_password_hash: string | null
              name: string
              org_type: Database["public"]["Enums"]["organization_type"]
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
        | {
            Args: {
              p_join_password: string
              p_name: string
              p_org_type?: string
              p_suggested_email_domain?: string
            }
            Returns: Json
          }
      create_organization_with_type: {
        Args: {
          p_join_password?: string
          p_name: string
          p_org_type?: Database["public"]["Enums"]["organization_type"]
          p_suggested_email_domain?: string
        }
        Returns: Json
      }
      decline_org_invite: { Args: { p_token: string }; Returns: Json }
      delete_organization: { Args: { p_org_id: string }; Returns: undefined }
      duplicate_plan: {
        Args: {
          p_end?: string
          p_horizon?: string
          p_new_name?: string
          p_source_plan_id: string
          p_start?: string
        }
        Returns: string
      }
      duplicate_task_tree: {
        Args: {
          p_source_task_id: string
          p_target_list_id?: string
          p_target_parent_id?: string
        }
        Returns: string
      }
      find_organizations_by_email_domain: {
        Args: { p_email: string }
        Returns: {
          id: string
          name: string
          suggested_email_domain: string
        }[]
      }
      get_invite_by_token: { Args: { p_token: string }; Returns: Json }
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
      join_organization_by_name_and_password: {
        Args: { p_join_password: string; p_name: string }
        Returns: Json
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
      org_food_is_shared: { Args: { p_org_id: string }; Returns: boolean }
      promote_self_to_super_admin_if_allowed: { Args: never; Returns: boolean }
      recalc_task_actual_seconds: {
        Args: { p_task: string }
        Returns: undefined
      }
      remove_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      reset_user_task_statuses: { Args: never; Returns: undefined }
      seed_user_default_statuses: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_onboarding_done: {
        Args: { p_plan?: Database["public"]["Enums"]["billing_plan"] }
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
      update_org_member_role: {
        Args: {
          p_org_id: string
          p_role: Database["public"]["Enums"]["organization_member_role"]
          p_user_id: string
        }
        Returns: Json
      }
      user_can_access_document: {
        Args: { p_doc_id: string; p_uid: string }
        Returns: boolean
      }
      user_can_read_framework: {
        Args: { p_framework_id: string }
        Returns: boolean
      }
      user_has_share: {
        Args: {
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["share_entity_type"]
          p_user: string
        }
        Returns: boolean
      }
      user_is_event_participant: {
        Args: { p_event: string; p_user: string }
        Returns: boolean
      }
      user_is_org_member: {
        Args: { org_id: string; target_user: string }
        Returns: boolean
      }
      user_is_super_admin: { Args: { target_user: string }; Returns: boolean }
      user_owns_framework: {
        Args: { p_framework_id: string }
        Returns: boolean
      }
      user_sees_contact_via_project: {
        Args: { p_contact_id: string; p_uid: string }
        Returns: boolean
      }
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
      custom_field_entity: "task" | "meeting" | "payment" | "contact"
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
        | "time"
        | "location"
        | "person"
        | "tag"
      dashboard_screen:
        | "home"
        | "tasks"
        | "calendar"
        | "gantt"
        | "recordings"
        | "thoughts"
        | "projects"
        | "pricing"
        | "project_detail"
      delegation_status: "pending" | "accepted" | "rejected"
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
      organization_type: "business" | "family" | "personal"
      project_pricing_mode: "fixed_price" | "hourly" | "quote"
      project_spare_mode: "percent" | "hours"
      push_platform: "web" | "ios" | "android"
      recording_source:
        | "thought"
        | "call"
        | "meeting"
        | "other"
        | "recording"
        | "whatsapp"
        | "upload"
      recording_status:
        | "recording"
        | "uploaded"
        | "transcribing"
        | "extracting"
        | "ready"
        | "error"
        | "processing"
        | "processed"
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
      task_list_kind: "project" | "custom" | "plan"
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
      custom_field_entity: ["task", "meeting", "payment", "contact"],
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
        "time",
        "location",
        "person",
        "tag",
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
        "project_detail",
      ],
      delegation_status: ["pending", "accepted", "rejected"],
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
      organization_type: ["business", "family", "personal"],
      project_pricing_mode: ["fixed_price", "hourly", "quote"],
      project_spare_mode: ["percent", "hours"],
      push_platform: ["web", "ios", "android"],
      recording_source: [
        "thought",
        "call",
        "meeting",
        "other",
        "recording",
        "whatsapp",
        "upload",
      ],
      recording_status: [
        "recording",
        "uploaded",
        "transcribing",
        "extracting",
        "ready",
        "error",
        "processing",
        "processed",
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
      task_list_kind: ["project", "custom", "plan"],
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
