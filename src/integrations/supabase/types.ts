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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clinic_services: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          partner_clinic_id: string
          price: number
          service_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          partner_clinic_id: string
          price?: number
          service_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          partner_clinic_id?: string
          price?: number
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_services_partner_clinic_id_fkey"
            columns: ["partner_clinic_id"]
            isOneToOne: false
            referencedRelation: "partner_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          logo_url: string | null
          nome_fantasia: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          breed: string | null
          clinic_id: string | null
          content: Json
          created_at: string
          exam_date: string
          exam_price: number | null
          id: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          partner_clinic_id: string | null
          partner_vet_id: string | null
          patient_name: string
          performing_vet_id: string | null
          service_id: string | null
          species: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          breed?: string | null
          clinic_id?: string | null
          content?: Json
          created_at?: string
          exam_date?: string
          exam_price?: number | null
          id?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          partner_clinic_id?: string | null
          partner_vet_id?: string | null
          patient_name: string
          performing_vet_id?: string | null
          service_id?: string | null
          species?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          breed?: string | null
          clinic_id?: string | null
          content?: Json
          created_at?: string
          exam_date?: string
          exam_price?: number | null
          id?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          partner_clinic_id?: string | null
          partner_vet_id?: string | null
          patient_name?: string
          performing_vet_id?: string | null
          service_id?: string | null
          species?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_partner_clinic_id_fkey"
            columns: ["partner_clinic_id"]
            isOneToOne: false
            referencedRelation: "partner_clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_partner_vet_id_fkey"
            columns: ["partner_vet_id"]
            isOneToOne: false
            referencedRelation: "partner_veterinarians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_performing_vet_id_fkey"
            columns: ["performing_vet_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "clinic_services"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_clinics: {
        Row: {
          clinic_id: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          nome: string
          responsavel: string | null
          telefone: string | null
          updated_at: string
          user_id: string
          valor_exame: number
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          valor_exame?: number
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          valor_exame?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_clinics_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_veterinarians: {
        Row: {
          created_at: string
          id: string
          nome: string
          partner_clinic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          partner_clinic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          partner_clinic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_veterinarians_partner_clinic_id_fkey"
            columns: ["partner_clinic_id"]
            isOneToOne: false
            referencedRelation: "partner_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo: Database["public"]["Enums"]["user_role"]
          clinic_id: string | null
          created_at: string
          crmv: string | null
          especialidade: string | null
          id: string
          nome: string
          sexo: string | null
          signature_url: string | null
          telefone: string | null
          uf_crmv: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo?: Database["public"]["Enums"]["user_role"]
          clinic_id?: string | null
          created_at?: string
          crmv?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          sexo?: string | null
          signature_url?: string | null
          telefone?: string | null
          uf_crmv?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo?: Database["public"]["Enums"]["user_role"]
          clinic_id?: string | null
          created_at?: string
          crmv?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          sexo?: string | null
          signature_url?: string | null
          telefone?: string | null
          uf_crmv?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted: boolean | null
          cargo: Database["public"]["Enums"]["user_role"]
          clinic_id: string
          created_at: string
          email: string
          id: string
          invited_by: string | null
        }
        Insert: {
          accepted?: boolean | null
          cargo?: Database["public"]["Enums"]["user_role"]
          clinic_id: string
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
        }
        Update: {
          accepted?: boolean | null
          cargo?: Database["public"]["Enums"]["user_role"]
          clinic_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_clinic_id: { Args: never; Returns: string }
      current_user_is_gestor: { Args: never; Returns: boolean }
      get_default_service_price: {
        Args: { clinic_id: string }
        Returns: number
      }
    }
    Enums: {
      user_role: "super_admin" | "gestor" | "veterinario"
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
      user_role: ["super_admin", "gestor", "veterinario"],
    },
  },
} as const
