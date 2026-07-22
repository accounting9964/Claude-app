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
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_transactions: {
        Row: {
          amount: number
          amount_paid: number
          case_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          is_paid: boolean
          kind: Database["public"]["Enums"]["txn_kind"]
          last_synced_at: string | null
          memo: string | null
          qbo_doc_id: string | null
          qbo_doc_number: string | null
          qbo_sync_token: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          case_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_paid?: boolean
          kind: Database["public"]["Enums"]["txn_kind"]
          last_synced_at?: string | null
          memo?: string | null
          qbo_doc_id?: string | null
          qbo_doc_number?: string | null
          qbo_sync_token?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          case_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_paid?: boolean
          kind?: Database["public"]["Enums"]["txn_kind"]
          last_synced_at?: string | null
          memo?: string | null
          qbo_doc_id?: string | null
          qbo_doc_number?: string | null
          qbo_sync_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_transactions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          atac_from_seller_received_at: string | null
          atac_to_buyer_provided_at: string | null
          attention_note: string | null
          buyer_id: string | null
          case_number: string | null
          created_at: string
          created_by: string | null
          gdrive_folder_id: string | null
          gdrive_folder_url: string | null
          has_buyer_in_mind: boolean
          id: string
          in_inventory: boolean
          in_possession: boolean
          is_mb: boolean
          is_purchased: boolean
          is_sold: boolean
          is_trade_in: boolean
          listed_on_marketplace: boolean
          needs_attention: boolean
          notes: string | null
          purchase_amount_1: number | null
          purchase_amount_2: number | null
          purchase_amount_3: number | null
          purchase_date: string | null
          purchase_price: number | null
          purchase_tax_amount: number | null
          purchase_tax_code: string | null
          purchase_tax_code_1: string | null
          purchase_tax_code_2: string | null
          purchase_tax_code_3: string | null
          purchase_total: number | null
          qbo_bill_deleted_at: string | null
          qbo_bill_doc_number: string | null
          qbo_bill_id: string | null
          qbo_bill_synced_at: string | null
          qbo_invoice_deleted_at: string | null
          qbo_invoice_doc_number: string | null
          qbo_invoice_id: string | null
          qbo_invoice_synced_at: string | null
          sale_amount_1: number | null
          sale_amount_2: number | null
          sale_date: string | null
          sale_is_final: boolean
          sale_price: number | null
          sale_tax_amount: number | null
          sale_tax_code: string | null
          sale_total: number | null
          seller_id: string | null
          shipped_overseas: boolean
          shipping_status: string | null
          status: Database["public"]["Enums"]["case_status"]
          title_from_seller_received_at: string | null
          title_to_buyer_provided_at: string | null
          trade_in_lessee_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          atac_from_seller_received_at?: string | null
          atac_to_buyer_provided_at?: string | null
          attention_note?: string | null
          buyer_id?: string | null
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          gdrive_folder_id?: string | null
          gdrive_folder_url?: string | null
          has_buyer_in_mind?: boolean
          id?: string
          in_inventory?: boolean
          in_possession?: boolean
          is_mb?: boolean
          is_purchased?: boolean
          is_sold?: boolean
          is_trade_in?: boolean
          listed_on_marketplace?: boolean
          needs_attention?: boolean
          notes?: string | null
          purchase_amount_1?: number | null
          purchase_amount_2?: number | null
          purchase_amount_3?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_tax_amount?: number | null
          purchase_tax_code?: string | null
          purchase_tax_code_1?: string | null
          purchase_tax_code_2?: string | null
          purchase_tax_code_3?: string | null
          purchase_total?: number | null
          qbo_bill_deleted_at?: string | null
          qbo_bill_doc_number?: string | null
          qbo_bill_id?: string | null
          qbo_bill_synced_at?: string | null
          qbo_invoice_deleted_at?: string | null
          qbo_invoice_doc_number?: string | null
          qbo_invoice_id?: string | null
          qbo_invoice_synced_at?: string | null
          sale_amount_1?: number | null
          sale_amount_2?: number | null
          sale_date?: string | null
          sale_is_final?: boolean
          sale_price?: number | null
          sale_tax_amount?: number | null
          sale_tax_code?: string | null
          sale_total?: number | null
          seller_id?: string | null
          shipped_overseas?: boolean
          shipping_status?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title_from_seller_received_at?: string | null
          title_to_buyer_provided_at?: string | null
          trade_in_lessee_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          atac_from_seller_received_at?: string | null
          atac_to_buyer_provided_at?: string | null
          attention_note?: string | null
          buyer_id?: string | null
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          gdrive_folder_id?: string | null
          gdrive_folder_url?: string | null
          has_buyer_in_mind?: boolean
          id?: string
          in_inventory?: boolean
          in_possession?: boolean
          is_mb?: boolean
          is_purchased?: boolean
          is_sold?: boolean
          is_trade_in?: boolean
          listed_on_marketplace?: boolean
          needs_attention?: boolean
          notes?: string | null
          purchase_amount_1?: number | null
          purchase_amount_2?: number | null
          purchase_amount_3?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_tax_amount?: number | null
          purchase_tax_code?: string | null
          purchase_tax_code_1?: string | null
          purchase_tax_code_2?: string | null
          purchase_tax_code_3?: string | null
          purchase_total?: number | null
          qbo_bill_deleted_at?: string | null
          qbo_bill_doc_number?: string | null
          qbo_bill_id?: string | null
          qbo_bill_synced_at?: string | null
          qbo_invoice_deleted_at?: string | null
          qbo_invoice_doc_number?: string | null
          qbo_invoice_id?: string | null
          qbo_invoice_synced_at?: string | null
          sale_amount_1?: number | null
          sale_amount_2?: number | null
          sale_date?: string | null
          sale_is_final?: boolean
          sale_price?: number | null
          sale_tax_amount?: number | null
          sale_tax_code?: string | null
          sale_total?: number | null
          seller_id?: string | null
          shipped_overseas?: boolean
          shipping_status?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title_from_seller_received_at?: string | null
          title_to_buyer_provided_at?: string | null
          trade_in_lessee_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_trade_in_lessee_id_fkey"
            columns: ["trade_in_lessee_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          display_name: string
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["contact_kind"]
          notes: string | null
          phone: string | null
          postal_code: string | null
          qbo_customer_id: string | null
          qbo_sync_token: string | null
          qbo_vendor_id: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["contact_kind"]
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          qbo_customer_id?: string | null
          qbo_sync_token?: string | null
          qbo_vendor_id?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["contact_kind"]
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          qbo_customer_id?: string | null
          qbo_sync_token?: string | null
          qbo_vendor_id?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qbo_tokens: {
        Row: {
          access_token: string
          access_token_expires_at: string
          created_at: string
          environment: string
          realm_id: string
          refresh_token: string
          refresh_token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          created_at?: string
          environment?: string
          realm_id: string
          refresh_token: string
          refresh_token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          created_at?: string
          environment?: string
          realm_id?: string
          refresh_token?: string
          refresh_token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_makes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      vehicle_models: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          make_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          make_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          make_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "vehicle_makes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          make: string | null
          mileage: number | null
          model: string | null
          notes: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          stock_number: string | null
          trim: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_number?: string | null
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_number?: string | null
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_case_name: { Args: { vehicle_id: string }; Returns: string }
    }
    Enums: {
      case_status: "draft" | "purchased" | "listed" | "sold" | "closed"
      contact_kind: "seller" | "buyer" | "both" | "lessee"
      document_kind:
        | "registration"
        | "bill_from_seller"
        | "invoice_to_buyer"
        | "lien_release"
        | "other"
      txn_kind: "bill" | "invoice"
      vehicle_status: "in_stock" | "pending" | "sold"
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
      case_status: ["draft", "purchased", "listed", "sold", "closed"],
      contact_kind: ["seller", "buyer", "both", "lessee"],
      document_kind: [
        "registration",
        "bill_from_seller",
        "invoice_to_buyer",
        "lien_release",
        "other",
      ],
      txn_kind: ["bill", "invoice"],
      vehicle_status: ["in_stock", "pending", "sold"],
    },
  },
} as const
