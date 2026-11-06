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
