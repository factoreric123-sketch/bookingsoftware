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
