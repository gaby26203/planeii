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
      access_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_email: string | null
          target_user_id: string | null
          trip_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
          trip_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
          trip_id?: string | null
        }
        Relationships: []
      }
      account_defaults: {
        Row: {
          cost_presets: Json
          created_at: string
          extra_presets: Json
          id: string
          payment_method_fees: Json
          refund_rules: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_presets?: Json
          created_at?: string
          extra_presets?: Json
          id?: string
          payment_method_fees?: Json
          refund_rules?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_presets?: Json
          created_at?: string
          extra_presets?: Json
          id?: string
          payment_method_fees?: Json
          refund_rules?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_application_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          application_id: string
          created_at: string
          from_value: string | null
          id: string
          kind: string
          to_value: string | null
          trip_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          application_id: string
          created_at?: string
          from_value?: string | null
          id?: string
          kind: string
          to_value?: string | null
          trip_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          application_id?: string
          created_at?: string
          from_value?: string | null
          id?: string
          kind?: string
          to_value?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "trip_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_application_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_application_notes: {
        Row: {
          application_id: string
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          trip_id: string
        }
        Insert: {
          application_id: string
          author_id?: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          trip_id: string
        }
        Update: {
          application_id?: string
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "trip_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_application_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_applications: {
        Row: {
          answers: Json
          consent_accepted: boolean
          consent_text: string | null
          contacted_by: string | null
          created_at: string
          duplicate_of: string | null
          email: string
          enrollee_id: string | null
          form_snapshot: Json
          full_name: string
          id: string
          page_slug: string | null
          referrer: string | null
          status: string
          trip_id: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string
        }
        Insert: {
          answers?: Json
          consent_accepted?: boolean
          consent_text?: string | null
          contacted_by?: string | null
          created_at?: string
          duplicate_of?: string | null
          email: string
          enrollee_id?: string | null
          form_snapshot?: Json
          full_name: string
          id?: string
          page_slug?: string | null
          referrer?: string | null
          status?: string
          trip_id: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp: string
        }
        Update: {
          answers?: Json
          consent_accepted?: boolean
          consent_text?: string | null
          contacted_by?: string | null
          created_at?: string
          duplicate_of?: string | null
          email?: string
          enrollee_id?: string | null
          form_snapshot?: Json
          full_name?: string
          id?: string
          page_slug?: string | null
          referrer?: string | null
          status?: string
          trip_id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_applications_contacted_by_fkey"
            columns: ["contacted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_applications_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "trip_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_applications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_documents: {
        Row: {
          created_at: string
          created_by: string
          file_name: string | null
          id: string
          is_pinned: boolean
          kind: string
          mime_type: string | null
          short_description: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          trip_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          file_name?: string | null
          id?: string
          is_pinned?: boolean
          kind: string
          mime_type?: string | null
          short_description?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          trip_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string | null
          id?: string
          is_pinned?: boolean
          kind?: string
          mime_type?: string | null
          short_description?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          permissions: Json | null
          role: Database["public"]["Enums"]["trip_member_role"]
          status: string
          token: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          permissions?: Json | null
          role: Database["public"]["Enums"]["trip_member_role"]
          status?: string
          token: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["trip_member_role"]
          status?: string
          token?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          permissions: Json | null
          role: Database["public"]["Enums"]["trip_member_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json | null
          role: Database["public"]["Enums"]["trip_member_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["trip_member_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_notes: {
        Row: {
          content: Json
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean
          short_description: string | null
          sort_order: number
          status: string
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean
          short_description?: string | null
          sort_order?: number
          status?: string
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean
          short_description?: string | null
          sort_order?: number
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_page_backups: {
        Row: {
          created_at: string
          document: Json
          id: string
          reason: string
          source: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          document: Json
          id?: string
          reason: string
          source: string
          trip_id: string
        }
        Update: {
          created_at?: string
          document?: Json
          id?: string
          reason?: string
          source?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_page_backups_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_page_drafts: {
        Row: {
          created_at: string
          document: Json
          id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: Json
          id?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: Json
          id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_page_drafts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_page_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          event: string
          id: string
          referrer: string | null
          target: string | null
          trip_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          event: string
          id?: string
          referrer?: string | null
          target?: string | null
          trip_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          referrer?: string | null
          target?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_page_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_page_preview_snapshots: {
        Row: {
          created_at: string
          document: Json
          expires_at: string
          id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document: Json
          expires_at?: string
          id?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: Json
          expires_at?: string
          id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_page_preview_snapshots_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_page_versions: {
        Row: {
          document: Json
          id: string
          published_at: string
          published_by: string
          trip_id: string
        }
        Insert: {
          document: Json
          id?: string
          published_at?: string
          published_by: string
          trip_id: string
        }
        Update: {
          document?: Json
          id?: string
          published_at?: string
          published_by?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_page_versions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_pages: {
        Row: {
          document: Json
          id: string
          owner_id: string
          published_at: string
          slug: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          document: Json
          id?: string
          owner_id?: string
          published_at?: string
          slug: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          document?: Json
          id?: string
          owner_id?: string
          published_at?: string
          slug?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_pages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_todos: {
        Row: {
          assigned_to: string | null
          content: Json
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          is_pinned: boolean
          short_description: string | null
          sort_order: number
          start_date: string | null
          status: string
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          content?: Json
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          is_pinned?: boolean
          short_description?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          content?: Json
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          is_pinned?: boolean
          short_description?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_todos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          data: Json
          destination: string | null
          end_date: string | null
          id: string
          name: string
          owner_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          destination?: string | null
          end_date?: string | null
          id?: string
          name: string
          owner_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          destination?: string | null
          end_date?: string | null
          id?: string
          name?: string
          owner_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner"
      trip_member_role: "organizadora" | "tour_leader"
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
    Enums: {
      app_role: ["owner"],
      trip_member_role: ["organizadora", "tour_leader"],
    },
  },
} as const
