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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_allowed_services: {
        Row: {
          ai_settings_id: string
          business_id: string
          created_at: string
          id: string
          row_version: number
          service_id: string
          updated_at: string
        }
        Insert: {
          ai_settings_id: string
          business_id: string
          created_at?: string
          id?: string
          row_version?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          ai_settings_id?: string
          business_id?: string
          created_at?: string
          id?: string
          row_version?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_allowed_services_business_id_ai_settings_id_fkey"
            columns: ["business_id", "ai_settings_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_settings"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "ai_allowed_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_allowed_services_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      ai_assistant_settings: {
        Row: {
          after_hours_behavior: string
          assistant_name: string
          business_id: string
          created_at: string
          disclosure_enabled: boolean
          escalation_conditions: Json
          greeting: string
          id: string
          language_code: string
          location_id: string
          recording_consent_text: string
          recording_enabled: boolean
          recording_retention_days: number
          row_version: number
          sandbox_enabled: boolean
          sms_enabled: boolean
          transfer_phone_e164: string | null
          updated_at: string
          voice_enabled: boolean
          voice_identifier: string | null
        }
        Insert: {
          after_hours_behavior?: string
          assistant_name?: string
          business_id: string
          created_at?: string
          disclosure_enabled?: boolean
          escalation_conditions?: Json
          greeting?: string
          id?: string
          language_code?: string
          location_id: string
          recording_consent_text?: string
          recording_enabled?: boolean
          recording_retention_days?: number
          row_version?: number
          sandbox_enabled?: boolean
          sms_enabled?: boolean
          transfer_phone_e164?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_identifier?: string | null
        }
        Update: {
          after_hours_behavior?: string
          assistant_name?: string
          business_id?: string
          created_at?: string
          disclosure_enabled?: boolean
          escalation_conditions?: Json
          greeting?: string
          id?: string
          language_code?: string
          location_id?: string
          recording_consent_text?: string
          recording_enabled?: boolean
          recording_retention_days?: number
          row_version?: number
          sandbox_enabled?: boolean
          sms_enabled?: boolean
          transfer_phone_e164?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_settings_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      ai_knowledge_items: {
        Row: {
          active: boolean
          ai_settings_id: string
          answer: string
          business_id: string
          created_at: string
          id: string
          question: string
          row_version: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_settings_id: string
          answer: string
          business_id: string
          created_at?: string
          id?: string
          question: string
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_settings_id?: string
          answer?: string
          business_id?: string
          created_at?: string
          id?: string
          question?: string
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_items_business_id_ai_settings_id_fkey"
            columns: ["business_id", "ai_settings_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_settings"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "ai_knowledge_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_addons: {
        Row: {
          additional_duration_minutes: number
          addon_name: string
          appointment_id: string
          business_id: string
          created_at: string
          id: string
          line_total_minor: number
          quantity: number
          service_addon_id: string
          unit_price_minor: number
        }
        Insert: {
          additional_duration_minutes?: number
          addon_name: string
          appointment_id: string
          business_id: string
          created_at?: string
          id?: string
          line_total_minor: number
          quantity?: number
          service_addon_id: string
          unit_price_minor: number
        }
        Update: {
          additional_duration_minutes?: number
          addon_name?: string
          appointment_id?: string
          business_id?: string
          created_at?: string
          id?: string
          line_total_minor?: number
          quantity?: number
          service_addon_id?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_addons_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "appointment_addons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_addons_business_id_service_addon_id_fkey"
            columns: ["business_id", "service_addon_id"]
            isOneToOne: false
            referencedRelation: "service_addons"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      appointment_holds: {
        Row: {
          business_id: string
          checkout_reference: string | null
          consumed_appointment_id: string | null
          created_at: string
          expires_at: string
          id: string
          price_snapshot: Json
          request_fingerprint: string
          row_version: number
          seat_count: number
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          checkout_reference?: string | null
          consumed_appointment_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          price_snapshot: Json
          request_fingerprint: string
          row_version?: number
          seat_count?: number
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          checkout_reference?: string | null
          consumed_appointment_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          price_snapshot?: Json
          request_fingerprint?: string
          row_version?: number
          seat_count?: number
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_holds_business_id_consumed_appointment_id_fkey"
            columns: ["business_id", "consumed_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "appointment_holds_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_holds_business_id_session_id_fkey"
            columns: ["business_id", "session_id"]
            isOneToOne: false
            referencedRelation: "booking_sessions"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          business_id: string
          created_at: string
          duration_minutes: number
          id: string
          line_total_minor: number
          quantity: number
          sequence: number
          service_id: string
          service_name: string
          unit_price_minor: number
        }
        Insert: {
          appointment_id: string
          business_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          line_total_minor: number
          quantity?: number
          sequence: number
          service_id: string
          service_name: string
          unit_price_minor: number
        }
        Update: {
          appointment_id?: string
          business_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          line_total_minor?: number
          quantity?: number
          sequence?: number
          service_id?: string
          service_name?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "appointment_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      appointment_status_history: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          appointment_id: string
          business_id: string
          created_at: string
          from_status: string | null
          id: string
          reason: string
          to_status: string
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          appointment_id: string
          business_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string
          to_status: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          appointment_id?: string
          business_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "appointment_status_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_due_now_minor: number
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          currency: string
          customer_address: Json | null
          customer_id: string
          customer_notes: string
          discount_minor: number
          id: string
          is_sandbox: boolean
          payment_status: string
          row_version: number
          seat_count: number
          session_id: string
          source: string
          status: string
          subtotal_minor: number
          tax_minor: number
          tip_minor: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          amount_due_now_minor?: number
          business_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          customer_address?: Json | null
          customer_id: string
          customer_notes?: string
          discount_minor?: number
          id?: string
          is_sandbox?: boolean
          payment_status?: string
          row_version?: number
          seat_count?: number
          session_id: string
          source: string
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          tip_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Update: {
          amount_due_now_minor?: number
          business_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          customer_address?: Json | null
          customer_id?: string
          customer_notes?: string
          discount_minor?: number
          id?: string
          is_sandbox?: boolean
          payment_status?: string
          row_version?: number
          seat_count?: number
          session_id?: string
          source?: string
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          tip_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_business_id_session_id_fkey"
            columns: ["business_id", "session_id"]
            isOneToOne: false
            referencedRelation: "booking_sessions"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          business_id: string
          created_at: string
          created_by_user_id: string | null
          ends_at: string
          id: string
          location_id: string | null
          reason: string
          released_at: string | null
          row_version: number
          staff_id: string | null
          staff_time_off_id: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by_user_id?: string | null
          ends_at: string
          id?: string
          location_id?: string | null
          reason?: string
          released_at?: string | null
          row_version?: number
          staff_id?: string | null
          staff_time_off_id?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by_user_id?: string | null
          ends_at?: string
          id?: string
          location_id?: string | null
          reason?: string
          released_at?: string | null
          row_version?: number
          staff_id?: string | null
          staff_time_off_id?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "blocked_times_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "blocked_times_business_id_staff_time_off_id_fkey"
            columns: ["business_id", "staff_time_off_id"]
            isOneToOne: false
            referencedRelation: "staff_time_off"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      booking_pages: {
        Row: {
          accent_color: string
          background_color: string
          business_id: string
          cancellation_policy: string
          cover_asset_id: string | null
          created_at: string
          description: string
          id: string
          instructions: string
          location_id: string
          logo_asset_id: string | null
          published_at: string | null
          required_customer_fields: Json
          row_version: number
          slug: string
          staff_selection_enabled: boolean
          status: string
          terms_text: string
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          business_id: string
          cancellation_policy?: string
          cover_asset_id?: string | null
          created_at?: string
          description?: string
          id?: string
          instructions?: string
          location_id: string
          logo_asset_id?: string | null
          published_at?: string | null
          required_customer_fields?: Json
          row_version?: number
          slug: string
          staff_selection_enabled?: boolean
          status?: string
          terms_text?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          business_id?: string
          cancellation_policy?: string
          cover_asset_id?: string | null
          created_at?: string
          description?: string
          id?: string
          instructions?: string
          location_id?: string
          logo_asset_id?: string | null
          published_at?: string | null
          required_customer_fields?: Json
          row_version?: number
          slug?: string
          staff_selection_enabled?: boolean
          status?: string
          terms_text?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_pages_business_id_cover_asset_id_fkey"
            columns: ["business_id", "cover_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "booking_pages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_pages_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "booking_pages_business_id_logo_asset_id_fkey"
            columns: ["business_id", "logo_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      booking_sessions: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          business_id: string
          capacity: number
          created_at: string
          delivery_mode: string
          ends_at: string
          id: string
          location_id: string
          meeting_url: string | null
          primary_service_id: string
          recurrence_rule_id: string | null
          row_version: number
          session_type: string
          staff_id: string
          starts_at: string
          state: string
          timezone: string
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id: string
          capacity?: number
          created_at?: string
          delivery_mode: string
          ends_at: string
          id?: string
          location_id: string
          meeting_url?: string | null
          primary_service_id: string
          recurrence_rule_id?: string | null
          row_version?: number
          session_type: string
          staff_id: string
          starts_at: string
          state?: string
          timezone: string
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id?: string
          capacity?: number
          created_at?: string
          delivery_mode?: string
          ends_at?: string
          id?: string
          location_id?: string
          meeting_url?: string | null
          primary_service_id?: string
          recurrence_rule_id?: string | null
          row_version?: number
          session_type?: string
          staff_id?: string
          starts_at?: string
          state?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_sessions_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "booking_sessions_business_id_primary_service_id_fkey"
            columns: ["business_id", "primary_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "booking_sessions_business_id_recurrence_rule_id_fkey"
            columns: ["business_id", "recurrence_rule_id"]
            isOneToOne: false
            referencedRelation: "recurrence_rules"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "booking_sessions_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      business_hours: {
        Row: {
          active: boolean
          business_id: string
          closes_at: string
          created_at: string
          id: string
          iso_weekday: number
          location_id: string
          opens_at: string
          row_version: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          closes_at: string
          created_at?: string
          id?: string
          iso_weekday: number
          location_id: string
          opens_at: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          closes_at?: string
          created_at?: string
          id?: string
          iso_weekday?: number
          location_id?: string
          opens_at?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      business_members: {
        Row: {
          active: boolean
          all_locations: boolean
          business_id: string
          can_manage_automations: boolean
          can_manage_billing: boolean
          can_manage_customers: boolean
          can_manage_forms: boolean
          can_manage_messages: boolean
          can_manage_services: boolean
          can_manage_staff: boolean
          can_view_analytics: boolean
          created_at: string
          id: string
          role: string
          row_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          all_locations?: boolean
          business_id: string
          can_manage_automations?: boolean
          can_manage_billing?: boolean
          can_manage_customers?: boolean
          can_manage_forms?: boolean
          can_manage_messages?: boolean
          can_manage_services?: boolean
          can_manage_staff?: boolean
          can_view_analytics?: boolean
          created_at?: string
          id?: string
          role: string
          row_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          all_locations?: boolean
          business_id?: string
          can_manage_automations?: boolean
          can_manage_billing?: boolean
          can_manage_customers?: boolean
          can_manage_forms?: boolean
          can_manage_messages?: boolean
          can_manage_services?: boolean
          can_manage_staff?: boolean
          can_view_analytics?: boolean
          created_at?: string
          id?: string
          role?: string
          row_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          allow_guest_booking: boolean
          allow_staff_selection: boolean
          booking_instructions: string
          business_id: string
          cancellation_notice_minutes: number
          cancellation_policy: string
          created_at: string
          customer_fields: Json
          form_retention_days: number
          id: string
          manual_approval_required: boolean
          maximum_advance_days: number
          maximum_appointments_per_day: number | null
          message_retention_days: number
          minimum_notice_minutes: number
          recording_retention_days: number
          reschedule_notice_minutes: number
          row_version: number
          slot_interval_minutes: number
          updated_at: string
        }
        Insert: {
          allow_guest_booking?: boolean
          allow_staff_selection?: boolean
          booking_instructions?: string
          business_id: string
          cancellation_notice_minutes?: number
          cancellation_policy?: string
          created_at?: string
          customer_fields?: Json
          form_retention_days?: number
          id?: string
          manual_approval_required?: boolean
          maximum_advance_days?: number
          maximum_appointments_per_day?: number | null
          message_retention_days?: number
          minimum_notice_minutes?: number
          recording_retention_days?: number
          reschedule_notice_minutes?: number
          row_version?: number
          slot_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          allow_guest_booking?: boolean
          allow_staff_selection?: boolean
          booking_instructions?: string
          business_id?: string
          cancellation_notice_minutes?: number
          cancellation_policy?: string
          created_at?: string
          customer_fields?: Json
          form_retention_days?: number
          id?: string
          manual_approval_required?: boolean
          maximum_advance_days?: number
          maximum_appointments_per_day?: number | null
          message_retention_days?: number
          minimum_notice_minutes?: number
          recording_retention_days?: number
          reschedule_notice_minutes?: number
          row_version?: number
          slot_interval_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          accent_color: string
          archived_at: string | null
          cover_asset_id: string | null
          created_at: string
          currency: string
          default_location_id: string | null
          description: string
          email: string | null
          id: string
          industry: string
          is_demo: boolean
          logo_asset_id: string | null
          name: string
          onboarding_step: number
          organization_id: string
          phone_e164: string | null
          published_at: string | null
          row_version: number
          setup_completed_at: string | null
          slug: string
          status: string
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          accent_color?: string
          archived_at?: string | null
          cover_asset_id?: string | null
          created_at?: string
          currency?: string
          default_location_id?: string | null
          description?: string
          email?: string | null
          id?: string
          industry?: string
          is_demo?: boolean
          logo_asset_id?: string | null
          name: string
          onboarding_step?: number
          organization_id: string
          phone_e164?: string | null
          published_at?: string | null
          row_version?: number
          setup_completed_at?: string | null
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          accent_color?: string
          archived_at?: string | null
          cover_asset_id?: string | null
          created_at?: string
          currency?: string
          default_location_id?: string | null
          description?: string
          email?: string | null
          id?: string
          industry?: string
          is_demo?: boolean
          logo_asset_id?: string | null
          name?: string
          onboarding_step?: number
          organization_id?: string
          phone_e164?: string | null
          published_at?: string | null
          row_version?: number
          setup_completed_at?: string | null
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_cover_asset_fk"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_default_location_fk"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_logo_asset_fk"
            columns: ["logo_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_calendars: {
        Row: {
          active: boolean
          business_id: string
          connection_id: string
          created_at: string
          external_calendar_id: string
          id: string
          name: string
          row_version: number
          timezone: string
          updated_at: string
          use_for_availability: boolean
          write_appointments: boolean
        }
        Insert: {
          active?: boolean
          business_id: string
          connection_id: string
          created_at?: string
          external_calendar_id: string
          id?: string
          name: string
          row_version?: number
          timezone: string
          updated_at?: string
          use_for_availability?: boolean
          write_appointments?: boolean
        }
        Update: {
          active?: boolean
          business_id?: string
          connection_id?: string
          created_at?: string
          external_calendar_id?: string
          id?: string
          name?: string
          row_version?: number
          timezone?: string
          updated_at?: string
          use_for_availability?: boolean
          write_appointments?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendar_calendars_business_id_connection_id_fkey"
            columns: ["business_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calendar_calendars_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          business_id: string
          created_at: string
          external_account_email: string | null
          id: string
          integration_id: string
          last_error: string | null
          last_sync_at: string | null
          location_id: string
          provider: string
          row_version: number
          scopes: string[]
          staff_id: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          external_account_email?: string | null
          id?: string
          integration_id: string
          last_error?: string | null
          last_sync_at?: string | null
          location_id: string
          provider: string
          row_version?: number
          scopes?: string[]
          staff_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          external_account_email?: string | null
          id?: string
          integration_id?: string
          last_error?: string | null
          last_sync_at?: string | null
          location_id?: string
          provider?: string
          row_version?: number
          scopes?: string[]
          staff_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_connections_business_id_integration_id_fkey"
            columns: ["business_id", "integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calendar_connections_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calendar_connections_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          business_id: string
          busy: boolean
          calendar_id: string
          cancelled: boolean
          conflicts_with_booking: boolean
          created_at: string
          ends_at: string
          external_etag: string | null
          external_event_id: string
          external_updated_at: string | null
          id: string
          origin: string
          row_version: number
          session_id: string | null
          starts_at: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          busy?: boolean
          calendar_id: string
          cancelled?: boolean
          conflicts_with_booking?: boolean
          created_at?: string
          ends_at: string
          external_etag?: string | null
          external_event_id: string
          external_updated_at?: string | null
          id?: string
          origin: string
          row_version?: number
          session_id?: string | null
          starts_at: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          busy?: boolean
          calendar_id?: string
          cancelled?: boolean
          conflicts_with_booking?: boolean
          created_at?: string
          ends_at?: string
          external_etag?: string | null
          external_event_id?: string
          external_updated_at?: string | null
          id?: string
          origin?: string
          row_version?: number
          session_id?: string | null
          starts_at?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_business_id_calendar_id_fkey"
            columns: ["business_id", "calendar_id"]
            isOneToOne: false
            referencedRelation: "calendar_calendars"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calendar_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_business_id_session_id_fkey"
            columns: ["business_id", "session_id"]
            isOneToOne: false
            referencedRelation: "booking_sessions"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      calendar_sync_runs: {
        Row: {
          business_id: string
          completed_at: string | null
          connection_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          records_read: number
          records_written: number
          row_version: number
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          connection_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          records_read?: number
          records_written?: number
          row_version?: number
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          records_read?: number
          records_written?: number
          row_version?: number
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_runs_business_id_connection_id_fkey"
            columns: ["business_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calendar_sync_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          appointment_id: string | null
          business_id: string
          called_e164: string
          caller_e164: string
          created_at: string
          customer_id: string | null
          direction: string
          duration_seconds: number
          ended_at: string | null
          id: string
          integration_id: string | null
          is_sandbox: boolean
          outcome: string | null
          phone_number_id: string | null
          provider_call_id: string | null
          recording_asset_id: string | null
          recording_consent_id: string | null
          recording_delete_after: string | null
          row_version: number
          started_at: string
          status: string
          summary: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          appointment_id?: string | null
          business_id: string
          called_e164: string
          caller_e164: string
          created_at?: string
          customer_id?: string | null
          direction: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          integration_id?: string | null
          is_sandbox?: boolean
          outcome?: string | null
          phone_number_id?: string | null
          provider_call_id?: string | null
          recording_asset_id?: string | null
          recording_consent_id?: string | null
          recording_delete_after?: string | null
          row_version?: number
          started_at: string
          status: string
          summary?: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          appointment_id?: string | null
          business_id?: string
          called_e164?: string
          caller_e164?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          integration_id?: string | null
          is_sandbox?: boolean
          outcome?: string | null
          phone_number_id?: string | null
          provider_call_id?: string | null
          recording_asset_id?: string | null
          recording_consent_id?: string | null
          recording_delete_after?: string | null
          row_version?: number
          started_at?: string
          status?: string
          summary?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calls_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calls_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_business_id_integration_id_fkey"
            columns: ["business_id", "integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calls_business_id_phone_number_id_fkey"
            columns: ["business_id", "phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calls_business_id_recording_asset_id_fkey"
            columns: ["business_id", "recording_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "calls_business_id_recording_consent_id_fkey"
            columns: ["business_id", "recording_consent_id"]
            isOneToOne: false
            referencedRelation: "customer_consents"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          assigned_staff_id: string | null
          business_id: string
          channel: string
          created_at: string
          customer_id: string
          id: string
          last_message_at: string | null
          location_id: string | null
          phone_number_id: string | null
          row_version: number
          staff_takeover_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          assigned_staff_id?: string | null
          business_id: string
          channel: string
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string | null
          location_id?: string | null
          phone_number_id?: string | null
          row_version?: number
          staff_takeover_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          assigned_staff_id?: string | null
          business_id?: string
          channel?: string
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string | null
          location_id?: string | null
          phone_number_id?: string | null
          row_version?: number
          staff_takeover_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_assigned_staff_id_fkey"
            columns: ["business_id", "assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "conversations_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "conversations_business_id_phone_number_id_fkey"
            columns: ["business_id", "phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          appointment_id: string
          business_id: string
          coupon_id: string
          created_at: string
          customer_id: string
          discount_minor: number
          id: string
        }
        Insert: {
          appointment_id: string
          business_id: string
          coupon_id: string
          created_at?: string
          customer_id: string
          discount_minor: number
          id?: string
        }
        Update: {
          appointment_id?: string
          business_id?: string
          coupon_id?: string
          created_at?: string
          customer_id?: string
          discount_minor?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "coupon_redemptions_business_id_coupon_id_fkey"
            columns: ["business_id", "coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "coupon_redemptions_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "coupon_redemptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          business_id: string
          code: string
          created_at: string
          currency: string | null
          discount_type: string
          id: string
          maximum_redemptions: number | null
          row_version: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          active?: boolean
          business_id: string
          code: string
          created_at?: string
          currency?: string | null
          discount_type: string
          id?: string
          maximum_redemptions?: number | null
          row_version?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          active?: boolean
          business_id?: string
          code?: string
          created_at?: string
          currency?: string | null
          discount_type?: string
          id?: string
          maximum_redemptions?: number | null
          row_version?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string
          custom_field_id: string
          customer_id: string | null
          id: string
          row_version: number
          updated_at: string
          value: Json
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string
          custom_field_id: string
          customer_id?: string | null
          id?: string
          row_version?: number
          updated_at?: string
          value: Json
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          custom_field_id?: string
          customer_id?: string | null
          id?: string
          row_version?: number
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_appointment_fk"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "custom_field_values_business_id_custom_field_id_fkey"
            columns: ["business_id", "custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "custom_field_values_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "custom_field_values_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          entity_type: string
          field_key: string
          id: string
          label: string
          options: Json
          required: boolean
          row_version: number
          sort_order: number
          updated_at: string
          value_type: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          entity_type: string
          field_key: string
          id?: string
          label: string
          options?: Json
          required?: boolean
          row_version?: number
          sort_order?: number
          updated_at?: string
          value_type: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          entity_type?: string
          field_key?: string
          id?: string
          label?: string
          options?: Json
          required?: boolean
          row_version?: number
          sort_order?: number
          updated_at?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consents: {
        Row: {
          business_id: string
          channel: string
          created_at: string
          customer_id: string
          decision: string
          disclosure_text: string
          disclosure_version: string
          evidence_reference: string | null
          id: string
          purpose: string
          recorded_at: string
          source: string
        }
        Insert: {
          business_id: string
          channel: string
          created_at?: string
          customer_id: string
          decision: string
          disclosure_text: string
          disclosure_version: string
          evidence_reference?: string | null
          id?: string
          purpose: string
          recorded_at?: string
          source: string
        }
        Update: {
          business_id?: string
          channel?: string
          created_at?: string
          customer_id?: string
          decision?: string
          disclosure_text?: string
          disclosure_version?: string
          evidence_reference?: string | null
          id?: string
          purpose?: string
          recorded_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_consents_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "customer_consents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_group_members: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          group_id: string
          id: string
          row_version: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          group_id: string
          id?: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          group_id?: string
          id?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_group_members_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "customer_group_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_group_members_business_id_group_id_fkey"
            columns: ["business_id", "group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      customer_groups: {
        Row: {
          business_id: string
          created_at: string
          description: string
          id: string
          name: string
          row_version: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_user_id: string | null
          body: string
          business_id: string
          created_at: string
          customer_id: string
          id: string
          visibility: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          visibility?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "customer_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_assignments: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          row_version: number
          tag_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          row_version?: number
          tag_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          row_version?: number
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_business_id_tag_id_fkey"
            columns: ["business_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          business_id: string
          color: string
          created_at: string
          id: string
          name: string
          row_version: number
          updated_at: string
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_users: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          row_version: number
          updated_at: string
          user_id: string
          verified_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          row_version?: number
          updated_at?: string
          user_id: string
          verified_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          row_version?: number
          updated_at?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_users_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "customer_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          archived_at: string | null
          business_id: string
          city: string | null
          company_name: string | null
          country_code: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          merged_into_customer_id: string | null
          normalized_email: string | null
          phone_e164: string | null
          postal_code: string | null
          region: string | null
          row_version: number
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          business_id: string
          city?: string | null
          company_name?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          merged_into_customer_id?: string | null
          normalized_email?: string | null
          phone_e164?: string | null
          postal_code?: string | null
          region?: string | null
          row_version?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          business_id?: string
          city?: string | null
          company_name?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          merged_into_customer_id?: string | null
          normalized_email?: string | null
          phone_e164?: string | null
          postal_code?: string | null
          region?: string | null
          row_version?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_business_id_merged_into_customer_id_fkey"
            columns: ["business_id", "merged_into_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      form_fields: {
        Row: {
          business_id: string
          created_at: string
          customer_mapping: string | null
          field_key: string
          field_type: string
          form_version_id: string
          help_text: string
          id: string
          label: string
          options: Json
          placeholder: string
          required: boolean
          row_version: number
          sort_order: number
          updated_at: string
          validation: Json
          visibility_rule: Json | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_mapping?: string | null
          field_key: string
          field_type: string
          form_version_id: string
          help_text?: string
          id?: string
          label: string
          options?: Json
          placeholder?: string
          required?: boolean
          row_version?: number
          sort_order: number
          updated_at?: string
          validation?: Json
          visibility_rule?: Json | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_mapping?: string | null
          field_key?: string
          field_type?: string
          form_version_id?: string
          help_text?: string
          id?: string
          label?: string
          options?: Json
          placeholder?: string
          required?: boolean
          row_version?: number
          sort_order?: number
          updated_at?: string
          validation?: Json
          visibility_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_business_id_form_version_id_fkey"
            columns: ["business_id", "form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      form_service_links: {
        Row: {
          business_id: string
          created_at: string
          form_id: string
          id: string
          purpose: string
          row_version: number
          service_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          form_id: string
          id?: string
          purpose: string
          row_version?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          form_id?: string
          id?: string
          purpose?: string
          row_version?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_service_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_service_links_business_id_form_id_fkey"
            columns: ["business_id", "form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "form_service_links_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      form_submission_answers: {
        Row: {
          business_id: string
          created_at: string
          form_field_id: string
          id: string
          submission_id: string
          value: Json
        }
        Insert: {
          business_id: string
          created_at?: string
          form_field_id: string
          id?: string
          submission_id: string
          value: Json
        }
        Update: {
          business_id?: string
          created_at?: string
          form_field_id?: string
          id?: string
          submission_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_answers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submission_answers_business_id_form_field_id_fkey"
            columns: ["business_id", "form_field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "form_submission_answers_business_id_submission_id_fkey"
            columns: ["business_id", "submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          form_id: string
          form_version_id: string
          id: string
          idempotency_key: string
          source: string
          spam_status: string
          submitted_at: string
          submitter_subject_hash: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          form_id: string
          form_version_id: string
          id?: string
          idempotency_key: string
          source?: string
          spam_status?: string
          submitted_at?: string
          submitter_subject_hash?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          form_id?: string
          form_version_id?: string
          id?: string
          idempotency_key?: string
          source?: string
          spam_status?: string
          submitted_at?: string
          submitter_subject_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "form_submissions_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "form_submissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_business_id_form_id_fkey"
            columns: ["business_id", "form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "form_submissions_business_id_form_version_id_fkey"
            columns: ["business_id", "form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      form_versions: {
        Row: {
          business_id: string
          created_at: string
          created_by_user_id: string | null
          form_id: string
          id: string
          published_at: string | null
          version_number: number
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by_user_id?: string | null
          form_id: string
          id?: string
          published_at?: string | null
          version_number: number
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by_user_id?: string | null
          form_id?: string
          id?: string
          published_at?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_business_id_form_id_fkey"
            columns: ["business_id", "form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      forms: {
        Row: {
          accent_color: string
          active_version_id: string | null
          business_id: string
          create_customer: boolean
          created_at: string
          description: string
          id: string
          lead_tag_id: string | null
          location_id: string | null
          logo_asset_id: string | null
          name: string
          row_version: number
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          active_version_id?: string | null
          business_id: string
          create_customer?: boolean
          created_at?: string
          description?: string
          id?: string
          lead_tag_id?: string | null
          location_id?: string | null
          logo_asset_id?: string | null
          name: string
          row_version?: number
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          active_version_id?: string | null
          business_id?: string
          create_customer?: boolean
          created_at?: string
          description?: string
          id?: string
          lead_tag_id?: string | null
          location_id?: string | null
          logo_asset_id?: string | null
          name?: string
          row_version?: number
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_active_version_fk"
            columns: ["business_id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "forms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_business_id_lead_tag_id_fkey"
            columns: ["business_id", "lead_tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "forms_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "forms_business_id_logo_asset_id_fkey"
            columns: ["business_id", "logo_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      integrations: {
        Row: {
          business_id: string
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          external_account_id: string | null
          id: string
          is_sandbox: boolean
          last_error_code: string | null
          last_error_message: string | null
          last_verified_at: string | null
          location_id: string | null
          provider: string
          public_config: Json
          row_version: number
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          external_account_id?: string | null
          id?: string
          is_sandbox?: boolean
          last_error_code?: string | null
          last_error_message?: string | null
          last_verified_at?: string | null
          location_id?: string | null
          provider: string
          public_config?: Json
          row_version?: number
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          external_account_id?: string | null
          id?: string
          is_sandbox?: boolean
          last_error_code?: string | null
          last_error_message?: string | null
          last_verified_at?: string | null
          location_id?: string | null
          provider?: string
          public_config?: Json
          row_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          business_id: string
          created_at: string
          description: string
          discount_minor: number
          id: string
          invoice_id: string
          line_total_minor: number
          quantity: number
          row_version: number
          service_id: string | null
          sort_order: number
          tax_rate_bps: number
          unit_price_minor: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description: string
          discount_minor?: number
          id?: string
          invoice_id: string
          line_total_minor: number
          quantity?: number
          row_version?: number
          service_id?: string | null
          sort_order?: number
          tax_rate_bps?: number
          unit_price_minor: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string
          discount_minor?: number
          id?: string
          invoice_id?: string
          line_total_minor?: number
          quantity?: number
          row_version?: number
          service_id?: string | null
          sort_order?: number
          tax_rate_bps?: number
          unit_price_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_business_id_invoice_id_fkey"
            columns: ["business_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "invoice_items_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string
          created_by_user_id: string | null
          currency: string
          customer_id: string
          discount_minor: number
          due_date: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          notes: string
          paid_minor: number
          provider_invoice_id: string | null
          row_version: number
          status: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          customer_id: string
          discount_minor?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          notes?: string
          paid_minor?: number
          provider_invoice_id?: string | null
          row_version?: number
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          customer_id?: string
          discount_minor?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          notes?: string
          paid_minor?: number
          provider_invoice_id?: string | null
          row_version?: number
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "invoices_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address_line1: string
          address_line2: string | null
          archived_at: string | null
          business_id: string
          city: string
          country_code: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone_e164: string | null
          postal_code: string
          region: string
          row_version: number
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_line1?: string
          address_line2?: string | null
          archived_at?: string | null
          business_id: string
          city?: string
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone_e164?: string | null
          postal_code?: string
          region?: string
          row_version?: number
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_line1?: string
          address_line2?: string | null
          archived_at?: string | null
          business_id?: string
          city?: string
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone_e164?: string | null
          postal_code?: string
          region?: string
          row_version?: number
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      member_invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_user_id: string | null
          location_ids: string[]
          permissions: Json
          revoked_at: string | null
          role: string
          row_version: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by_user_id?: string | null
          location_ids?: string[]
          permissions?: Json
          revoked_at?: string | null
          role: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string | null
          location_ids?: string[]
          permissions?: Json
          revoked_at?: string | null
          role?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      member_locations: {
        Row: {
          business_id: string
          business_member_id: string
          created_at: string
          id: string
          location_id: string
          row_version: number
          updated_at: string
        }
        Insert: {
          business_id: string
          business_member_id: string
          created_at?: string
          id?: string
          location_id: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          business_member_id?: string
          created_at?: string
          id?: string
          location_id?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_locations_business_id_business_member_id_fkey"
            columns: ["business_id", "business_member_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "member_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_locations_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          asset_id: string
          business_id: string
          created_at: string
          id: string
          message_id: string
        }
        Insert: {
          asset_id: string
          business_id: string
          created_at?: string
          id?: string
          message_id: string
        }
        Update: {
          asset_id?: string
          business_id?: string
          created_at?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_business_id_asset_id_fkey"
            columns: ["business_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "message_attachments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_business_id_message_id_fkey"
            columns: ["business_id", "message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          business_id: string
          channel: string
          created_at: string
          id: string
          name: string
          purpose: string
          row_version: number
          subject: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          business_id: string
          channel: string
          created_at?: string
          id?: string
          name: string
          purpose: string
          row_version?: number
          subject?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          business_id?: string
          channel?: string
          created_at?: string
          id?: string
          name?: string
          purpose?: string
          row_version?: number
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          business_id: string
          channel: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          from_address: string
          id: string
          idempotency_key: string
          integration_id: string | null
          is_sandbox: boolean
          provider_error_code: string | null
          provider_error_message: string | null
          provider_message_id: string | null
          received_at: string | null
          row_version: number
          segment_count: number
          sent_at: string | null
          status: string
          to_address: string
          updated_at: string
        }
        Insert: {
          body?: string
          business_id: string
          channel: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          from_address: string
          id?: string
          idempotency_key: string
          integration_id?: string | null
          is_sandbox?: boolean
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_message_id?: string | null
          received_at?: string | null
          row_version?: number
          segment_count?: number
          sent_at?: string | null
          status?: string
          to_address: string
          updated_at?: string
        }
        Update: {
          body?: string
          business_id?: string
          channel?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          from_address?: string
          id?: string
          idempotency_key?: string
          integration_id?: string | null
          is_sandbox?: boolean
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_message_id?: string | null
          received_at?: string | null
          row_version?: number
          segment_count?: number
          sent_at?: string | null
          status?: string
          to_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_business_id_conversation_id_fkey"
            columns: ["business_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_business_id_integration_id_fkey"
            columns: ["business_id", "integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          organization_id: string
          role: string
          row_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role: string
          row_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          row_version?: number
          updated_at?: string
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
          archived_at: string | null
          billing_email: string | null
          created_at: string
          default_currency: string
          id: string
          name: string
          row_version: number
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          billing_email?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          name: string
          row_version?: number
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          billing_email?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          name?: string
          row_version?: number
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount_minor: number
          business_id: string
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount_minor: number
          business_id: string
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount_minor?: number
          business_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_business_id_invoice_id_fkey"
            columns: ["business_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payment_allocations_business_id_payment_id_fkey"
            columns: ["business_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          appointment_id: string | null
          business_id: string
          created_at: string
          currency: string
          customer_id: string
          id: string
          idempotency_key: string
          integration_id: string | null
          is_sandbox: boolean
          method: string
          paid_at: string | null
          provider: string
          provider_charge_id: string | null
          provider_payment_id: string | null
          recorded_by_user_id: string | null
          refunded_minor: number
          row_version: number
          status: string
          stripe_connect_account_id: string | null
          updated_at: string
        }
        Insert: {
          amount_minor: number
          appointment_id?: string | null
          business_id: string
          created_at?: string
          currency: string
          customer_id: string
          id?: string
          idempotency_key: string
          integration_id?: string | null
          is_sandbox?: boolean
          method: string
          paid_at?: string | null
          provider: string
          provider_charge_id?: string | null
          provider_payment_id?: string | null
          recorded_by_user_id?: string | null
          refunded_minor?: number
          row_version?: number
          status?: string
          stripe_connect_account_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          idempotency_key?: string
          integration_id?: string | null
          is_sandbox?: boolean
          method?: string
          paid_at?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_payment_id?: string | null
          recorded_by_user_id?: string | null
          refunded_minor?: number
          row_version?: number
          status?: string
          stripe_connect_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_appointment_id_fkey"
            columns: ["business_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payments_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_integration_id_fkey"
            columns: ["business_id", "integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payments_business_id_stripe_connect_account_id_fkey"
            columns: ["business_id", "stripe_connect_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connect_accounts"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          business_id: string
          created_at: string
          id: string
          integration_id: string
          location_id: string | null
          phone_e164: string
          provider_phone_id: string | null
          registration_status: string
          row_version: number
          sms_enabled: boolean
          status: string
          updated_at: string
          voice_enabled: boolean
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          integration_id: string
          location_id?: string | null
          phone_e164: string
          provider_phone_id?: string | null
          registration_status?: string
          row_version?: number
          sms_enabled?: boolean
          status?: string
          updated_at?: string
          voice_enabled?: boolean
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          integration_id?: string
          location_id?: string | null
          phone_e164?: string
          provider_phone_id?: string | null
          registration_status?: string
          row_version?: number
          sms_enabled?: boolean
          status?: string
          updated_at?: string
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_business_id_integration_id_fkey"
            columns: ["business_id", "integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "phone_numbers_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          last_active_business_id: string | null
          locale: string
          preferred_timezone: string
          row_version: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          last_active_business_id?: string | null
          locale?: string
          preferred_timezone?: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          last_active_business_id?: string | null
          locale?: string
          preferred_timezone?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_active_business_fk"
            columns: ["last_active_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_rules: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          day_of_month: number | null
          ends_on: string | null
          frequency: string
          id: string
          interval_count: number
          iso_weekdays: number[]
          local_start_time: string
          location_id: string
          occurrence_limit: number | null
          row_version: number
          service_id: string
          staff_id: string
          starts_on: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          day_of_month?: number | null
          ends_on?: string | null
          frequency: string
          id?: string
          interval_count?: number
          iso_weekdays?: number[]
          local_start_time: string
          location_id: string
          occurrence_limit?: number | null
          row_version?: number
          service_id: string
          staff_id: string
          starts_on: string
          timezone: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          day_of_month?: number | null
          ends_on?: string | null
          frequency?: string
          id?: string
          interval_count?: number
          iso_weekdays?: number[]
          local_start_time?: string
          location_id?: string
          occurrence_limit?: number | null
          row_version?: number
          service_id?: string
          staff_id?: string
          starts_on?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_rules_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "recurrence_rules_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "recurrence_rules_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_minor: number
          business_id: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          payment_id: string
          provider_refund_id: string | null
          reason: string
          requested_by_user_id: string | null
          row_version: number
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          business_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          payment_id: string
          provider_refund_id?: string | null
          reason?: string
          requested_by_user_id?: string | null
          row_version?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          business_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          payment_id?: string
          provider_refund_id?: string | null
          reason?: string
          requested_by_user_id?: string | null
          row_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_business_id_payment_id_fkey"
            columns: ["business_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      resource_reservations: {
        Row: {
          active: boolean
          blocked_time_id: string | null
          business_id: string
          created_at: string
          ends_at: string
          id: string
          occupied_range: unknown
          row_version: number
          session_id: string | null
          staff_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          blocked_time_id?: string | null
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          occupied_range?: unknown
          row_version?: number
          session_id?: string | null
          staff_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          blocked_time_id?: string | null
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          occupied_range?: unknown
          row_version?: number
          session_id?: string | null
          staff_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_reservations_business_id_blocked_time_id_fkey"
            columns: ["business_id", "blocked_time_id"]
            isOneToOne: false
            referencedRelation: "blocked_times"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "resource_reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_reservations_business_id_session_id_fkey"
            columns: ["business_id", "session_id"]
            isOneToOne: false
            referencedRelation: "booking_sessions"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "resource_reservations_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      service_addons: {
        Row: {
          active: boolean
          additional_duration_minutes: number
          business_id: string
          created_at: string
          description: string
          id: string
          maximum_quantity: number
          name: string
          price_minor: number
          row_version: number
          service_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          additional_duration_minutes?: number
          business_id: string
          created_at?: string
          description?: string
          id?: string
          maximum_quantity?: number
          name: string
          price_minor?: number
          row_version?: number
          service_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          additional_duration_minutes?: number
          business_id?: string
          created_at?: string
          description?: string
          id?: string
          maximum_quantity?: number
          name?: string
          price_minor?: number
          row_version?: number
          service_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_addons_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          name: string
          row_version: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          name: string
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_locations: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          duration_override_minutes: number | null
          id: string
          location_id: string
          price_override_minor: number | null
          row_version: number
          service_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          duration_override_minutes?: number | null
          id?: string
          location_id: string
          price_override_minor?: number | null
          row_version?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          duration_override_minutes?: number | null
          id?: string
          location_id?: string
          price_override_minor?: number | null
          row_version?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_locations_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "service_locations_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          appointment_type: string
          archived_at: string | null
          buffer_after_minutes: number
          buffer_before_minutes: number
          business_id: string
          capacity: number
          category_id: string | null
          color: string
          created_at: string
          currency: string
          delivery_mode: string
          deposit_type: string | null
          deposit_value: number | null
          description: string
          duration_minutes: number
          id: string
          name: string
          payment_requirement: string
          price_minor: number
          row_version: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          appointment_type?: string
          archived_at?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id: string
          capacity?: number
          category_id?: string | null
          color?: string
          created_at?: string
          currency?: string
          delivery_mode?: string
          deposit_type?: string | null
          deposit_value?: number | null
          description?: string
          duration_minutes: number
          id?: string
          name: string
          payment_requirement?: string
          price_minor?: number
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          appointment_type?: string
          archived_at?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id?: string
          capacity?: number
          category_id?: string | null
          color?: string
          created_at?: string
          currency?: string
          delivery_mode?: string
          deposit_type?: string | null
          deposit_value?: number | null
          description?: string
          duration_minutes?: number
          id?: string
          name?: string
          payment_requirement?: string
          price_minor?: number
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_category_id_fkey"
            columns: ["business_id", "category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_availability: {
        Row: {
          active: boolean
          business_id: string
          closes_at: string
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          iso_weekday: number
          location_id: string
          opens_at: string
          row_version: number
          staff_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          closes_at: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          iso_weekday: number
          location_id: string
          opens_at: string
          row_version?: number
          staff_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          closes_at?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          iso_weekday?: number
          location_id?: string
          opens_at?: string
          row_version?: number
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_availability_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "staff_availability_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      staff_locations: {
        Row: {
          business_id: string
          created_at: string
          id: string
          location_id: string
          row_version: number
          staff_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          location_id: string
          row_version?: number
          staff_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          location_id?: string
          row_version?: number
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_locations_business_id_location_id_fkey"
            columns: ["business_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "staff_locations_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          active: boolean
          archived_at: string | null
          avatar_asset_id: string | null
          bio: string
          bookable: boolean
          buffer_after_minutes: number
          buffer_before_minutes: number
          business_id: string
          color: string
          created_at: string
          display_name: string
          email: string | null
          id: string
          phone_e164: string | null
          row_version: number
          updated_at: string
          user_id: string | null
          weekly_capacity_minutes: number
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          avatar_asset_id?: string | null
          bio?: string
          bookable?: boolean
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id: string
          color?: string
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          phone_e164?: string | null
          row_version?: number
          updated_at?: string
          user_id?: string | null
          weekly_capacity_minutes?: number
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          avatar_asset_id?: string | null
          bio?: string
          bookable?: boolean
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id?: string
          color?: string
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          phone_e164?: string | null
          row_version?: number
          updated_at?: string
          user_id?: string | null
          weekly_capacity_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_business_id_avatar_asset_id_fkey"
            columns: ["business_id", "avatar_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_assets"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "staff_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          row_version: number
          service_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          row_version?: number
          service_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          row_version?: number
          service_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_business_id_service_id_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "staff_services_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      staff_time_off: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string
          requested_by_user_id: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          row_version: number
          staff_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string
          requested_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          row_version?: number
          staff_id: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string
          requested_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          row_version?: number
          staff_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_off_business_id_staff_id_fkey"
            columns: ["business_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      storage_assets: {
        Row: {
          bucket_name: string
          business_id: string
          created_at: string
          deleted_at: string | null
          id: string
          mime_type: string
          object_path: string
          original_filename: string
          row_version: number
          scan_status: string
          size_bytes: number
          updated_at: string
          uploaded_by_user_id: string | null
          visibility: string
        }
        Insert: {
          bucket_name: string
          business_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mime_type: string
          object_path: string
          original_filename: string
          row_version?: number
          scan_status?: string
          size_bytes: number
          updated_at?: string
          uploaded_by_user_id?: string | null
          visibility?: string
        }
        Update: {
          bucket_name?: string
          business_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mime_type?: string
          object_path?: string
          original_filename?: string
          row_version?: number
          scan_status?: string
          size_bytes?: number
          updated_at?: string
          uploaded_by_user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_accounts: {
        Row: {
          business_id: string
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          id: string
          last_verified_at: string | null
          onboarding_status: string
          payouts_enabled: boolean
          row_version: number
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          last_verified_at?: string | null
          onboarding_status?: string
          payouts_enabled?: boolean
          row_version?: number
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          last_verified_at?: string | null
          onboarding_status?: string
          payouts_enabled?: boolean
          row_version?: number
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
