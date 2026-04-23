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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          employee_id: string
          end_date: string
          id: string
          location: string | null
          start_date: string
          task_type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id: string
          end_date: string
          id?: string
          location?: string | null
          start_date: string
          task_type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          location?: string | null
          start_date?: string
          task_type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          bank_name: string
          company_id: string
          created_at: string
          holder_name: string | null
          iban: string
          id: string
          last_synced_at: string | null
          provider: string
          provider_account_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bank_name: string
          company_id: string
          created_at?: string
          holder_name?: string | null
          iban: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          provider_account_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bank_name?: string
          company_id?: string
          created_at?: string
          holder_name?: string | null
          iban?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          provider_account_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          company_id: string
          counterparty_iban: string | null
          counterparty_name: string | null
          created_at: string
          currency: string
          date: string
          description: string | null
          id: string
          match_confidence: number | null
          match_status: string
          matched_invoice_id: string | null
          reference: string | null
          transaction_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          bank_account_id: string
          company_id: string
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          date: string
          description?: string | null
          id?: string
          match_confidence?: number | null
          match_status?: string
          matched_invoice_id?: string | null
          reference?: string | null
          transaction_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          company_id?: string
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          id?: string
          match_confidence?: number | null
          match_status?: string
          matched_invoice_id?: string | null
          reference?: string | null
          transaction_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          category: string
          content: string
          cover_gradient: string
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          cover_gradient?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          cover_gradient?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          nip: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          nip?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          nip?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          city: string | null
          client_portal_email: string | null
          country_code: string
          created_at: string
          default_vat_rate: string
          email: string | null
          id: string
          invoice_pattern: string
          is_active: boolean
          ksef_token: string
          make_webhook_url: string | null
          name: string
          nip: string
          phone: string | null
          postal_code: string | null
          storage_path: string
          street: string | null
          tax_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          client_portal_email?: string | null
          country_code?: string
          created_at?: string
          default_vat_rate?: string
          email?: string | null
          id?: string
          invoice_pattern?: string
          is_active?: boolean
          ksef_token: string
          make_webhook_url?: string | null
          name: string
          nip: string
          phone?: string | null
          postal_code?: string | null
          storage_path?: string
          street?: string | null
          tax_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          client_portal_email?: string | null
          country_code?: string
          created_at?: string
          default_vat_rate?: string
          email?: string | null
          id?: string
          invoice_pattern?: string
          is_active?: boolean
          ksef_token?: string
          make_webhook_url?: string | null
          name?: string
          nip?: string
          phone?: string | null
          postal_code?: string | null
          storage_path?: string
          street?: string | null
          tax_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          invoice_count: number
          last_invoice_date: string | null
          name: string
          nip: string | null
          notes: string | null
          payment_reliability: string
          phone: string | null
          postal_code: string | null
          street: string | null
          total_cost: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          invoice_count?: number
          last_invoice_date?: string | null
          name: string
          nip?: string | null
          notes?: string | null
          payment_reliability?: string
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          total_cost?: number
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          invoice_count?: number
          last_invoice_date?: string | null
          name?: string
          nip?: string | null
          notes?: string | null
          payment_reliability?: string
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          total_cost?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          order_number: number | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          order_number?: number | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          order_number?: number | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          currency: string
          date: string
          description: string | null
          document_path: string | null
          id: string
          ocr_data: Json | null
          ocr_status: string
          project_id: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          category_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          document_path?: string | null
          id?: string
          ocr_data?: Json | null
          ocr_status?: string
          project_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          document_path?: string | null
          id?: string
          ocr_data?: Json | null
          ocr_status?: string
          project_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_activity_log: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          external_id: string | null
          id: string
          metadata: Json | null
          resource_type: string
          title: string
          url: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          resource_type: string
          title: string
          url?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          resource_type?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      google_workspace_credentials: {
        Row: {
          access_token: string | null
          company_id: string
          connected_by: string
          connected_email: string
          created_at: string
          id: string
          refresh_token: string
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          company_id: string
          connected_by: string
          connected_email: string
          created_at?: string
          id?: string
          refresh_token: string
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          company_id?: string
          connected_by?: string
          connected_email?: string
          created_at?: string
          id?: string
          refresh_token?: string
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_workspace_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_workspace_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          gross_amount: number
          id: string
          invoice_id: string
          name: string
          net_amount: number
          ordinal: number
          quantity: number
          unit: string | null
          unit_price_net: number
          vat_amount: number
          vat_rate: string | null
        }
        Insert: {
          created_at?: string
          gross_amount?: number
          id?: string
          invoice_id: string
          name?: string
          net_amount?: number
          ordinal?: number
          quantity?: number
          unit?: string | null
          unit_price_net?: number
          vat_amount?: number
          vat_rate?: string | null
        }
        Update: {
          created_at?: string
          gross_amount?: number
          id?: string
          invoice_id?: string
          name?: string
          net_amount?: number
          ordinal?: number
          quantity?: number
          unit?: string | null
          unit_price_net?: number
          vat_amount?: number
          vat_rate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          company_id: string
          id: string
          last_number: number
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          company_id: string
          id?: string
          last_number?: number
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string
          id?: string
          last_number?: number
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bookkeeper_note: string | null
          category: string | null
          company_id: string
          created_at: string
          date: string
          gross_amount: number
          id: string
          invoice_type: string
          ksef_number: string | null
          nip: string
          payment_due_date: string | null
          payment_status: string
          pdf_path: string | null
          project_id: string | null
          source: string
          status: string
          tags: string[] | null
          updated_at: string
          vendor: string
          xml_path: string | null
        }
        Insert: {
          bookkeeper_note?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          date: string
          gross_amount?: number
          id?: string
          invoice_type?: string
          ksef_number?: string | null
          nip: string
          payment_due_date?: string | null
          payment_status?: string
          pdf_path?: string | null
          project_id?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          vendor: string
          xml_path?: string | null
        }
        Update: {
          bookkeeper_note?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          date?: string
          gross_amount?: number
          id?: string
          invoice_type?: string
          ksef_number?: string | null
          nip?: string
          payment_due_date?: string | null
          payment_status?: string
          pdf_path?: string | null
          project_id?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          vendor?: string
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_alerts: {
        Row: {
          amount: number | null
          client_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          invoice_id: string | null
          is_read: boolean
          title: string
          type: string
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_read?: boolean
          title: string
          type?: string
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_alerts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          color: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          color?: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          color?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_declarations: {
        Row: {
          company_id: string
          created_at: string
          file_path: string | null
          id: string
          metadata: Json | null
          period_from: string
          period_to: string
          status: string
          type: string
          updated_at: string
          xml_content: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          metadata?: Json | null
          period_from: string
          period_to: string
          status?: string
          type: string
          updated_at?: string
          xml_content?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          metadata?: Json | null
          period_from?: string
          period_to?: string
          status?: string
          type?: string
          updated_at?: string
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_declarations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_declarations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          registration: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          registration?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          registration?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      companies_safe: {
        Row: {
          city: string | null
          client_portal_email: string | null
          country_code: string | null
          created_at: string | null
          default_vat_rate: string | null
          email: string | null
          id: string | null
          invoice_pattern: string | null
          is_active: boolean | null
          name: string | null
          nip: string | null
          phone: string | null
          postal_code: string | null
          storage_path: string | null
          street: string | null
          tax_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          client_portal_email?: string | null
          country_code?: string | null
          created_at?: string | null
          default_vat_rate?: string | null
          email?: string | null
          id?: string | null
          invoice_pattern?: string | null
          is_active?: boolean | null
          name?: string | null
          nip?: string | null
          phone?: string | null
          postal_code?: string | null
          storage_path?: string | null
          street?: string | null
          tax_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          client_portal_email?: string | null
          country_code?: string | null
          created_at?: string | null
          default_vat_rate?: string | null
          email?: string | null
          id?: string | null
          invoice_pattern?: string | null
          is_active?: boolean | null
          name?: string | null
          nip?: string | null
          phone?: string | null
          postal_code?: string | null
          storage_path?: string | null
          street?: string | null
          tax_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_company_role: {
        Args: { _company_id: string; _user_id: string }
        Returns: string
      }
      has_module_permission: {
        Args: { _company_id: string; _module: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner_or_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      sync_contacts_from_invoices: {
        Args: { _company_id: string }
        Returns: undefined
      }
      user_has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      company_role: "admin" | "księgowy" | "handlowiec"
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
      company_role: ["admin", "księgowy", "handlowiec"],
    },
  },
} as const
