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
      agent_channels: {
        Row: {
          agent_id: string
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          agent_id: string
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Update: {
          agent_id?: string
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_channels_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_channels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          description: string | null
          direct_link: string | null
          fallback_response: string | null
          greeting: string | null
          handoff_rules: Json
          id: string
          is_active: boolean
          knowledge_base_id: string | null
          language: Database["public"]["Enums"]["agent_language"]
          name: string
          personality: string | null
          provider: string | null
          provider_agent_id: string | null
          provider_error: string | null
          provider_llm_id: string | null
          provider_status: string
          system_instructions: string | null
          transfer_number: string | null
          updated_at: string
          working_hours: Json
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          description?: string | null
          direct_link?: string | null
          fallback_response?: string | null
          greeting?: string | null
          handoff_rules?: Json
          id?: string
          is_active?: boolean
          knowledge_base_id?: string | null
          language?: Database["public"]["Enums"]["agent_language"]
          name: string
          personality?: string | null
          provider?: string | null
          provider_agent_id?: string | null
          provider_error?: string | null
          provider_llm_id?: string | null
          provider_status?: string
          system_instructions?: string | null
          transfer_number?: string | null
          updated_at?: string
          working_hours?: Json
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          description?: string | null
          direct_link?: string | null
          fallback_response?: string | null
          greeting?: string | null
          handoff_rules?: Json
          id?: string
          is_active?: boolean
          knowledge_base_id?: string | null
          language?: Database["public"]["Enums"]["agent_language"]
          name?: string
          personality?: string | null
          provider?: string | null
          provider_agent_id?: string | null
          provider_error?: string | null
          provider_llm_id?: string | null
          provider_status?: string
          system_instructions?: string | null
          transfer_number?: string | null
          updated_at?: string
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_records: {
        Row: {
          amount_sar: number
          company_id: string
          created_at: string
          currency: string
          external_reference: string | null
          id: string
          issued_at: string
          paid_at: string | null
          provider: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount_sar?: number
          company_id: string
          created_at?: string
          currency?: string
          external_reference?: string | null
          id?: string
          issued_at?: string
          paid_at?: string | null
          provider?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount_sar?: number
          company_id?: string
          created_at?: string
          currency?: string
          external_reference?: string | null
          id?: string
          issued_at?: string
          paid_at?: string | null
          provider?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_summaries: {
        Row: {
          call_id: string
          company_id: string
          created_at: string
          id: string
          sentiment: string | null
          summary: string | null
          topics: Json
        }
        Insert: {
          call_id: string
          company_id: string
          created_at?: string
          id?: string
          sentiment?: string | null
          summary?: string | null
          topics?: Json
        }
        Update: {
          call_id?: string
          company_id?: string
          created_at?: string
          id?: string
          sentiment?: string | null
          summary?: string | null
          topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "call_summaries_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          company_id: string
          created_at: string
          id: string
          raw_text: string | null
          transcript: Json
        }
        Insert: {
          call_id: string
          company_id: string
          created_at?: string
          id?: string
          raw_text?: string | null
          transcript?: Json
        }
        Update: {
          call_id?: string
          company_id?: string
          created_at?: string
          id?: string
          raw_text?: string | null
          transcript?: Json
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          default_locale: string
          description: string | null
          id: string
          industry: string | null
          name: string
          onboarding_completed: boolean
          onboarding_step: number
          slug: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          voice_enabled: boolean
          website: string | null
          whatsapp_enabled: boolean
          working_hours: Json
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          default_locale?: string
          description?: string | null
          id?: string
          industry?: string | null
          name: string
          onboarding_completed?: boolean
          onboarding_step?: number
          slug?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          voice_enabled?: boolean
          website?: string | null
          whatsapp_enabled?: boolean
          working_hours?: Json
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          default_locale?: string
          description?: string | null
          id?: string
          industry?: string | null
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          slug?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          voice_enabled?: boolean
          website?: string | null
          whatsapp_enabled?: boolean
          working_hours?: Json
        }
        Relationships: []
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["company_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["company_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["company_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_email: string | null
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          admin_note: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          id: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string | null
          assigned_user_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          customer_id: string | null
          external_id: string | null
          id: string
          last_message_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          assigned_user_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          customer_id?: string | null
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          assigned_user_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          customer_id?: string | null
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          metadata: Json
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_bases: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_bases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          company_id: string
          content: string
          created_at: string
          document_id: string
          id: string
          metadata: Json
        }
        Insert: {
          chunk_index?: number
          company_id: string
          content: string
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json
        }
        Update: {
          chunk_index?: number
          company_id?: string
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          company_id: string
          content: string | null
          created_at: string
          id: string
          knowledge_base_id: string
          source_type: string
          source_url: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: string | null
          created_at?: string
          id?: string
          knowledge_base_id: string
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          knowledge_base_id?: string
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          conversation_id: string
          created_at: string
          external_id: string | null
          id: string
          metadata: Json
          sender: Database["public"]["Enums"]["sender_type"]
          sender_user_id: string | null
          status: string
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id: string
          conversation_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          sender: Database["public"]["Enums"]["sender_type"]
          sender_user_id?: string | null
          status?: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          conversation_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          sender?: Database["public"]["Enums"]["sender_type"]
          sender_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          agent_id: string | null
          company_id: string
          country: string
          created_at: string
          id: string
          is_active: boolean
          phone_number: string
          provider: string
          provider_status: Database["public"]["Enums"]["connection_status"]
          sip_status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          company_id: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number: string
          provider?: string
          provider_status?: Database["public"]["Enums"]["connection_status"]
          sip_status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          company_id?: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number?: string
          provider?: string
          provider_status?: Database["public"]["Enums"]["connection_status"]
          sip_status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: string
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_agents: number
          max_documents: number
          max_members: number
          max_phone_numbers: number
          name_ar: string
          name_en: string
          price_sar: number
          product: string
          sort_order: number
          tier: string
          updated_at: string
          voice_minutes: number
          whatsapp_messages: number
        }
        Insert: {
          billing_period?: string
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_agents?: number
          max_documents?: number
          max_members?: number
          max_phone_numbers?: number
          name_ar: string
          name_en: string
          price_sar?: number
          product?: string
          sort_order?: number
          tier?: string
          updated_at?: string
          voice_minutes?: number
          whatsapp_messages?: number
        }
        Update: {
          billing_period?: string
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_agents?: number
          max_documents?: number
          max_members?: number
          max_phone_numbers?: number
          name_ar?: string
          name_en?: string
          price_sar?: number
          product?: string
          sort_order?: number
          tier?: string
          updated_at?: string
          voice_minutes?: number
          whatsapp_messages?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_credentials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          provider: string
          reference_id: string | null
          scope: string
          secret_payload: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          provider: string
          reference_id?: string | null
          scope: string
          secret_payload?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          provider?: string
          reference_id?: string | null
          scope?: string
          secret_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          company_id: string
          created_at: string
          current_period_end: string
          current_period_start: string
          external_reference: string | null
          id: string
          payment_provider: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          company_id: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          external_reference?: string | null
          id?: string
          payment_provider?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          company_id?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          external_reference?: string | null
          id?: string
          payment_provider?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          company_id: string
          created_at: string
          id: string
          metric: string
          occurred_at: string
          quantity: number
          reference_id: string | null
          unit: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          metric: string
          occurred_at?: string
          quantity?: number
          reference_id?: string | null
          unit?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          metric?: string
          occurred_at?: string
          quantity?: number
          reference_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      voice_calls: {
        Row: {
          agent_id: string | null
          analysis: Json | null
          call_type: string | null
          company_id: string
          conversation_id: string | null
          created_at: string
          customer_id: string | null
          direction: string
          duration_seconds: number
          ended_at: string | null
          ended_reason: string | null
          from_number: string | null
          id: string
          phone_number_id: string | null
          provider: string | null
          provider_call_id: string | null
          recording_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"]
          synced_at: string | null
          to_number: string | null
          transcript: Json | null
          transferred: boolean
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          analysis?: Json | null
          call_type?: string | null
          company_id: string
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          ended_reason?: string | null
          from_number?: string | null
          id?: string
          phone_number_id?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          synced_at?: string | null
          to_number?: string | null
          transcript?: Json | null
          transferred?: boolean
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          analysis?: Json | null
          call_type?: string | null
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          ended_reason?: string | null
          from_number?: string | null
          id?: string
          phone_number_id?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          synced_at?: string | null
          to_number?: string | null
          transcript?: Json | null
          transferred?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          company_id: string | null
          created_at: string
          error: string | null
          event_type: string | null
          external_event_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          status: Database["public"]["Enums"]["webhook_status"]
        }
        Insert: {
          attempts?: number
          company_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Update: {
          attempts?: number
          company_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          agent_id: string | null
          business_account_id: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          phone_number: string | null
          phone_number_id: string | null
          provider: string
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
          verified_name: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          agent_id?: string | null
          business_account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          verified_name?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          agent_id?: string | null
          business_account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          verified_name?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invitation: { Args: { _token: string }; Returns: string }
      company_is_active: { Args: { _company_id: string }; Returns: boolean }
      company_limit: {
        Args: { _company_id: string; _key: string }
        Returns: number
      }
      company_usage_this_month: {
        Args: { _company_id: string; _metric: string }
        Returns: number
      }
      create_company_with_owner: {
        Args: { _payload: Json; _service?: string }
        Returns: string
      }
      has_company_role: {
        Args: {
          _company_id: string
          _roles: Database["public"]["Enums"]["company_role"][]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      my_company_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      agent_language: "ar" | "en"
      app_role: "super_admin" | "support"
      call_status:
        | "ringing"
        | "in_progress"
        | "completed"
        | "failed"
        | "transferred"
      channel_type: "voice" | "whatsapp"
      company_role: "owner" | "admin" | "agent" | "viewer"
      company_status: "active" | "suspended" | "pending"
      connection_status: "not_connected" | "testing" | "connected" | "error"
      conversation_status: "open" | "needs_human" | "human" | "closed"
      doc_status: "pending" | "processing" | "ready" | "failed"
      sender_type: "customer" | "ai" | "human" | "system"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
      webhook_status: "received" | "processing" | "processed" | "failed"
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
      agent_language: ["ar", "en"],
      app_role: ["super_admin", "support"],
      call_status: [
        "ringing",
        "in_progress",
        "completed",
        "failed",
        "transferred",
      ],
      channel_type: ["voice", "whatsapp"],
      company_role: ["owner", "admin", "agent", "viewer"],
      company_status: ["active", "suspended", "pending"],
      connection_status: ["not_connected", "testing", "connected", "error"],
      conversation_status: ["open", "needs_human", "human", "closed"],
      doc_status: ["pending", "processing", "ready", "failed"],
      sender_type: ["customer", "ai", "human", "system"],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
      webhook_status: ["received", "processing", "processed", "failed"],
    },
  },
} as const
