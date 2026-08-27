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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      achievement_rewards: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_advertisers: {
        Row: {
          adtraction_advertiser_id: string | null
          base_url: string | null
          commission_rate: number | null
          cookie_days: number | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          pin_domain: string | null
          product_feed_format: string
          product_feed_url: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          adtraction_advertiser_id?: string | null
          base_url?: string | null
          commission_rate?: number | null
          cookie_days?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          pin_domain?: string | null
          product_feed_format?: string
          product_feed_url?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          adtraction_advertiser_id?: string | null
          base_url?: string | null
          commission_rate?: number | null
          cookie_days?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          pin_domain?: string | null
          product_feed_format?: string
          product_feed_url?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          advertiser: string
          banner_id: string | null
          created_at: string
          href: string
          id: string
          ip_hash: string | null
          path: string | null
          product_id: string | null
          referer: string | null
          section_title: string | null
          session_id: string | null
          slug: string | null
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          advertiser: string
          banner_id?: string | null
          created_at?: string
          href: string
          id?: string
          ip_hash?: string | null
          path?: string | null
          product_id?: string | null
          referer?: string | null
          section_title?: string | null
          session_id?: string | null
          slug?: string | null
          source: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          advertiser?: string
          banner_id?: string | null
          created_at?: string
          href?: string
          id?: string
          ip_hash?: string | null
          path?: string | null
          product_id?: string | null
          referer?: string | null
          section_title?: string | null
          session_id?: string | null
          slug?: string | null
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_impressions: {
        Row: {
          advertiser: string
          created_at: string
          id: string
          path: string | null
          product_id: string | null
          referer: string | null
          section_title: string | null
          session_id: string | null
          slug: string | null
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          advertiser: string
          created_at?: string
          id?: string
          path?: string | null
          product_id?: string | null
          referer?: string | null
          section_title?: string | null
          session_id?: string | null
          slug?: string | null
          source: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          advertiser?: string
          created_at?: string
          id?: string
          path?: string | null
          product_id?: string | null
          referer?: string | null
          section_title?: string | null
          session_id?: string | null
          slug?: string | null
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_link_tests: {
        Row: {
          adtraction_registered_at: string | null
          affiliate_url: string
          id: string
          notes: string | null
          product_id: string | null
          registered_correctly: boolean | null
          tested_at: string
          tested_by: string | null
        }
        Insert: {
          adtraction_registered_at?: string | null
          affiliate_url: string
          id?: string
          notes?: string | null
          product_id?: string | null
          registered_correctly?: boolean | null
          tested_at?: string
          tested_by?: string | null
        }
        Update: {
          adtraction_registered_at?: string | null
          affiliate_url?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          registered_correctly?: boolean | null
          tested_at?: string
          tested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_link_tests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "affiliate_products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_products: {
        Row: {
          advertiser_id: string | null
          affiliate_url: string | null
          category: string | null
          created_at: string
          currency: string
          description: string | null
          description_md: string | null
          external_id: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          in_stock: boolean | null
          is_active: boolean
          last_scraped_at: string | null
          name: string
          price: string | null
          price_original: number | null
          product_url: string | null
          short_description: string | null
          slug: string | null
          specs: Json
          updated_at: string
        }
        Insert: {
          advertiser_id?: string | null
          affiliate_url?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          description_md?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          in_stock?: boolean | null
          is_active?: boolean
          last_scraped_at?: string | null
          name: string
          price?: string | null
          price_original?: number | null
          product_url?: string | null
          short_description?: string | null
          slug?: string | null
          specs?: Json
          updated_at?: string
        }
        Update: {
          advertiser_id?: string | null
          affiliate_url?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          description_md?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          in_stock?: boolean | null
          is_active?: boolean
          last_scraped_at?: string | null
          name?: string
          price?: string | null
          price_original?: number | null
          product_url?: string | null
          short_description?: string | null
          slug?: string | null
          specs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_products_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertiser_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_products_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "affiliate_advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_products_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "affiliate_advertisers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agda_chat_logs: {
        Row: {
          answer: string | null
          completed_at: string | null
          completion_tokens: number | null
          context_snapshot: Json
          created_at: string
          error: string | null
          id: string
          model: string | null
          prompt_tokens: number | null
          question: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          answer?: string | null
          completed_at?: string | null
          completion_tokens?: number | null
          context_snapshot?: Json
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          question: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          answer?: string | null
          completed_at?: string | null
          completion_tokens?: number | null
          context_snapshot?: Json
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          question?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      backup_exports: {
        Row: {
          created_at: string
          error_message: string | null
          expires_at: string | null
          file_path: string | null
          file_size_bytes: number | null
          generated_at: string | null
          id: string
          includes_photos: boolean
          includes_reports: boolean
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          generated_at?: string | null
          id?: string
          includes_photos?: boolean
          includes_reports?: boolean
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          generated_at?: string | null
          id?: string
          includes_photos?: boolean
          includes_reports?: boolean
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          content: string
          created_at: string
          display_name: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          display_name?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          display_name?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          category: string | null
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          feature_image_url: string | null
          glossary_ids: string[] | null
          id: string
          is_published: boolean
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          published_at: string | null
          reading_time_minutes: number | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
          word_count: number | null
        }
        Insert: {
          author_id: string
          category?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          feature_image_url?: string | null
          glossary_ids?: string[] | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
          word_count?: number | null
        }
        Update: {
          author_id?: string
          category?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          feature_image_url?: string | null
          glossary_ids?: string[] | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number
          word_count?: number | null
        }
        Relationships: []
      }
      breeding_pairs: {
        Row: {
          created_at: string
          end_date: string | null
          flock_id: string | null
          goal: string | null
          hen_ids: string[]
          id: string
          name: string
          notes: string | null
          rooster_id: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          flock_id?: string | null
          goal?: string | null
          hen_ids?: string[]
          id?: string
          name: string
          notes?: string | null
          rooster_id?: string | null
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          flock_id?: string | null
          goal?: string | null
          hen_ids?: string[]
          id?: string
          name?: string
          notes?: string | null
          rooster_id?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeding_pairs_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_pairs_rooster_id_fkey"
            columns: ["rooster_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_completions: {
        Row: {
          chore_id: string
          completed_date: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          chore_id: string
          completed_date?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          chore_id?: string
          completed_date?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_completions_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "daily_chores"
            referencedColumns: ["id"]
          },
        ]
      }
      click_events: {
        Row: {
          created_at: string
          element_id: string | null
          element_text: string | null
          event_name: string
          id: string
          metadata: Json | null
          path: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          element_id?: string | null
          element_text?: string | null
          event_name: string
          id?: string
          metadata?: Json | null
          path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          element_id?: string | null
          element_text?: string | null
          event_name?: string
          id?: string
          metadata?: Json | null
          path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_error_logs: {
        Row: {
          build_time: string | null
          client_ts: string | null
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          notified: boolean
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          build_time?: string | null
          client_ts?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message: string
          notified?: boolean
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          build_time?: string | null
          client_ts?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          notified?: boolean
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_moderation_log: {
        Row: {
          action: string
          created_at: string
          id: string
          moderator_id: string
          moderator_name: string | null
          reason: string | null
          snapshot: Json | null
          target_id: string
          target_type: string
          target_user_id: string | null
          target_user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderator_id: string
          moderator_name?: string | null
          reason?: string | null
          snapshot?: Json | null
          target_id: string
          target_type: string
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderator_id?: string
          moderator_name?: string | null
          reason?: string | null
          snapshot?: Json | null
          target_id?: string
          target_type?: string
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          category: string
          contact_info: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          is_sold: boolean
          location: string | null
          price: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          contact_info?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          is_sold?: boolean
          location?: string | null
          price?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          contact_info?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          is_sold?: boolean
          location?: string | null
          price?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reaction_type?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          reason: string
          reported_by: string
          status: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reason: string
          reported_by: string
          status?: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string
          reported_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_settings: {
        Row: {
          city: string | null
          coop_name: string | null
          created_at: string
          hen_count: number | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          postal_code: string | null
          region: string | null
          settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          coop_name?: string | null
          created_at?: string
          hen_count?: number | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          postal_code?: string | null
          region?: string | null
          settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          coop_name?: string | null
          created_at?: string
          hen_count?: number | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          postal_code?: string | null
          region?: string | null
          settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_ai_tip: {
        Row: {
          created_at: string
          date: string
          id: string
          season: string
          source: string | null
          tip_text: string
          version: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          season: string
          source?: string | null
          tip_text: string
          version?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          season?: string
          source?: string | null
          tip_text?: string
          version?: number | null
        }
        Relationships: []
      }
      daily_chores: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          next_due_at: string | null
          recurrence: string | null
          reminder_enabled: boolean | null
          reminder_hours_before: number | null
          sort_order: number | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          next_due_at?: string | null
          recurrence?: string | null
          reminder_enabled?: boolean | null
          reminder_hours_before?: number | null
          sort_order?: number | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          next_due_at?: string | null
          recurrence?: string | null
          reminder_enabled?: boolean | null
          reminder_hours_before?: number | null
          sort_order?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      egg_goals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          period: string
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          period?: string
          target_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          period?: string
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      egg_logs: {
        Row: {
          client_id: string | null
          count: number
          created_at: string
          date: string
          flock_id: string | null
          hen_id: string | null
          id: string
          notes: string | null
          user_id: string
          weather: Json | null
        }
        Insert: {
          client_id?: string | null
          count?: number
          created_at?: string
          date: string
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          notes?: string | null
          user_id: string
          weather?: Json | null
        }
        Update: {
          client_id?: string | null
          count?: number
          created_at?: string
          date?: string
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          notes?: string | null
          user_id?: string
          weather?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "egg_logs_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_logs_hen_id_fkey"
            columns: ["hen_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_booking_events: {
        Row: {
          actor: string
          booking_id: string
          created_at: string
          event_type: string
          id: string
          listing_id: string | null
          metadata: Json | null
          new_status: string | null
          old_status: string | null
          seller_user_id: string | null
        }
        Insert: {
          actor?: string
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          listing_id?: string | null
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          seller_user_id?: string | null
        }
        Update: {
          actor?: string
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          listing_id?: string | null
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          seller_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_booking_tokens: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_booking_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "public_egg_sale_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_notification_queue: {
        Row: {
          attempts: number
          booking_id: string | null
          created_at: string
          data: Json
          deliver_after: string
          delivered_at: string | null
          destination: string | null
          error_message: string | null
          id: string
          kind: string
          listing_id: string | null
          state: string
          unique_key: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          booking_id?: string | null
          created_at?: string
          data?: Json
          deliver_after?: string
          delivered_at?: string | null
          destination?: string | null
          error_message?: string | null
          id?: string
          kind: string
          listing_id?: string | null
          state?: string
          unique_key: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          booking_id?: string | null
          created_at?: string
          data?: Json
          deliver_after?: string
          delivered_at?: string | null
          destination?: string | null
          error_message?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          state?: string
          unique_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_notification_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_sale_notification_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_pickup_slots: {
        Row: {
          created_at: string
          current_bookings: number
          ends_at: string
          id: string
          is_active: boolean
          label: string | null
          listing_id: string
          max_bookings: number
          seller_user_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_bookings?: number
          ends_at: string
          id?: string
          is_active?: boolean
          label?: string | null
          listing_id: string
          max_bookings?: number
          seller_user_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_bookings?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          listing_id?: string
          max_bookings?: number
          seller_user_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_pickup_slots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_review_tokens: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          listing_id: string
          seller_user_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          listing_id: string
          seller_user_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          seller_user_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_review_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "public_egg_sale_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_sale_review_tokens_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          customer_name: string
          id: string
          is_published: boolean
          listing_id: string
          rating: number
          seller_user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          customer_name: string
          id?: string
          is_published?: boolean
          listing_id: string
          rating: number
          seller_user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          is_published?: boolean
          listing_id?: string
          rating?: number
          seller_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "public_egg_sale_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_sale_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_subscriptions: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          consecutive_failures: number
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          frequency: string
          id: string
          last_booking_id: string | null
          last_error: string | null
          listing_id: string
          next_run_at: string
          notes: string | null
          packs: number
          paused_until: string | null
          pickup_slot_id: string | null
          preferred_weekday: number | null
          seller_user_id: string
          skip_next: boolean
          status: string
          total_bookings: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          consecutive_failures?: number
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          frequency: string
          id?: string
          last_booking_id?: string | null
          last_error?: string | null
          listing_id: string
          next_run_at?: string
          notes?: string | null
          packs?: number
          paused_until?: string | null
          pickup_slot_id?: string | null
          preferred_weekday?: number | null
          seller_user_id: string
          skip_next?: boolean
          status?: string
          total_bookings?: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          consecutive_failures?: number
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          frequency?: string
          id?: string
          last_booking_id?: string | null
          last_error?: string | null
          listing_id?: string
          next_run_at?: string
          notes?: string | null
          packs?: number
          paused_until?: string | null
          pickup_slot_id?: string | null
          preferred_weekday?: number | null
          seller_user_id?: string
          skip_next?: boolean
          status?: string
          total_bookings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_subscriptions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_sale_subscriptions_pickup_slot_id_fkey"
            columns: ["pickup_slot_id"]
            isOneToOne: false
            referencedRelation: "egg_sale_pickup_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sale_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          snapshot?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      egg_sale_waitlist: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          expired_at: string | null
          id: string
          listing_id: string
          notified_at: string | null
          offer_expires_at: string | null
          offer_token: string | null
          offered_packs: number | null
          pack_size: number | null
          packs_wanted: number
          seller_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          expired_at?: string | null
          id?: string
          listing_id: string
          notified_at?: string | null
          offer_expires_at?: string | null
          offer_token?: string | null
          offered_packs?: number | null
          pack_size?: number | null
          packs_wanted?: number
          seller_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          expired_at?: string | null
          id?: string
          listing_id?: string
          notified_at?: string | null
          offer_expires_at?: string | null
          offer_token?: string | null
          offered_packs?: number | null
          pack_size?: number | null
          packs_wanted?: number
          seller_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "egg_sale_waitlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_sales: {
        Row: {
          amount: number
          created_at: string
          customer: string
          eggs: number
          id: string
          note: string | null
          paid: boolean
          sale_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer: string
          eggs?: number
          id?: string
          note?: string | null
          paid?: boolean
          sale_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer?: string
          eggs?: number
          id?: string
          note?: string | null
          paid?: boolean
          sale_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      farm_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          farm_id: string
          id: string
          invited_by: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          farm_id: string
          id?: string
          invited_by: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          farm_id?: string
          id?: string
          invited_by?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_invitations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "coop_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_members: {
        Row: {
          farm_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          farm_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          farm_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_members_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "coop_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_records: {
        Row: {
          affiliate_product_id: string | null
          amount_kg: number | null
          brand: string | null
          cost: number | null
          created_at: string
          date: string
          feed_category: string | null
          feed_type: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          affiliate_product_id?: string | null
          amount_kg?: number | null
          brand?: string | null
          cost?: number | null
          created_at?: string
          date: string
          feed_category?: string | null
          feed_type?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          affiliate_product_id?: string | null
          amount_kg?: number | null
          brand?: string | null
          cost?: number | null
          created_at?: string
          date?: string
          feed_category?: string | null
          feed_type?: string | null
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_reply: string | null
          admin_reply_at: string | null
          created_at: string
          id: string
          message: string
          status: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          created_at?: string
          id?: string
          message: string
          status?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          created_at?: string
          id?: string
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      flocks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          created_at: string
          download_count: number
          error_message: string | null
          farm_id: string
          file_path: string | null
          file_size_bytes: number | null
          generated_at: string | null
          id: string
          period_end: string
          period_start: string
          report_type: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          error_message?: string | null
          farm_id: string
          file_path?: string | null
          file_size_bytes?: number | null
          generated_at?: string | null
          id?: string
          period_end: string
          period_start: string
          report_type: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          error_message?: string | null
          farm_id?: string
          file_path?: string | null
          file_size_bytes?: number | null
          generated_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          report_type?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "coop_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      hatch_sessions: {
        Row: {
          actual_hatch_date: string | null
          breeding_pair_id: string | null
          chicks_survived_7d: number | null
          created_at: string
          eggs_fertile: number | null
          eggs_hatched: number | null
          eggs_set: number
          expected_hatch_date: string | null
          flock_id: string | null
          humidity_avg: number | null
          id: string
          incubator_type: string | null
          name: string
          notes: string | null
          set_date: string
          status: string
          temperature_avg: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_hatch_date?: string | null
          breeding_pair_id?: string | null
          chicks_survived_7d?: number | null
          created_at?: string
          eggs_fertile?: number | null
          eggs_hatched?: number | null
          eggs_set: number
          expected_hatch_date?: string | null
          flock_id?: string | null
          humidity_avg?: number | null
          id?: string
          incubator_type?: string | null
          name: string
          notes?: string | null
          set_date: string
          status?: string
          temperature_avg?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_hatch_date?: string | null
          breeding_pair_id?: string | null
          chicks_survived_7d?: number | null
          created_at?: string
          eggs_fertile?: number | null
          eggs_hatched?: number | null
          eggs_set?: number
          expected_hatch_date?: string | null
          flock_id?: string | null
          humidity_avg?: number | null
          id?: string
          incubator_type?: string | null
          name?: string
          notes?: string | null
          set_date?: string
          status?: string
          temperature_avg?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hatch_sessions_breeding_pair_id_fkey"
            columns: ["breeding_pair_id"]
            isOneToOne: false
            referencedRelation: "breeding_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hatch_sessions_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
        ]
      }
      hatchings: {
        Row: {
          created_at: string
          egg_count: number
          expected_hatch_date: string | null
          hatched_count: number | null
          id: string
          notes: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          egg_count?: number
          expected_hatch_date?: string | null
          hatched_count?: number | null
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          egg_count?: number
          expected_hatch_date?: string | null
          hatched_count?: number | null
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_events: {
        Row: {
          created_at: string
          description: string | null
          egg_safe_from: string | null
          event_date: string
          event_type: string
          flock_id: string | null
          hen_id: string | null
          id: string
          karens_end_notified: boolean
          meat_safe_from: string | null
          photo_url: string | null
          resolved: boolean
          resolved_at: string | null
          title: string
          treatment: string | null
          updated_at: string
          user_id: string
          withdrawal_egg_days: number | null
          withdrawal_meat_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          egg_safe_from?: string | null
          event_date?: string
          event_type: string
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          karens_end_notified?: boolean
          meat_safe_from?: string | null
          photo_url?: string | null
          resolved?: boolean
          resolved_at?: string | null
          title: string
          treatment?: string | null
          updated_at?: string
          user_id: string
          withdrawal_egg_days?: number | null
          withdrawal_meat_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          egg_safe_from?: string | null
          event_date?: string
          event_type?: string
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          karens_end_notified?: boolean
          meat_safe_from?: string | null
          photo_url?: string | null
          resolved?: boolean
          resolved_at?: string | null
          title?: string
          treatment?: string | null
          updated_at?: string
          user_id?: string
          withdrawal_egg_days?: number | null
          withdrawal_meat_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_events_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_hen_id_fkey"
            columns: ["hen_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      health_logs: {
        Row: {
          created_at: string
          date: string
          description: string | null
          hen_id: string | null
          id: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          hen_id?: string | null
          id?: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          hen_id?: string | null
          id?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_logs_hen_id_fkey"
            columns: ["hen_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      health_schedules: {
        Row: {
          care_type: string
          created_at: string
          default_withdrawal_egg_days: number | null
          flock_id: string | null
          hen_id: string | null
          id: string
          interval_days: number
          is_active: boolean
          last_done_date: string | null
          last_reminded_due: string | null
          next_due_date: string
          notes: string | null
          reminder_days_before: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          care_type: string
          created_at?: string
          default_withdrawal_egg_days?: number | null
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          interval_days: number
          is_active?: boolean
          last_done_date?: string | null
          last_reminded_due?: string | null
          next_due_date: string
          notes?: string | null
          reminder_days_before?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          care_type?: string
          created_at?: string
          default_withdrawal_egg_days?: number | null
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          interval_days?: number
          is_active?: boolean
          last_done_date?: string | null
          last_reminded_due?: string | null
          next_due_date?: string
          notes?: string | null
          reminder_days_before?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_schedules_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_schedules_hen_id_fkey"
            columns: ["hen_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      hen_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string | null
          hen_id: string
          id: string
          photo_url: string
          taken_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path?: string | null
          hen_id: string
          id?: string
          photo_url: string
          taken_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string | null
          hen_id?: string
          id?: string
          photo_url?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hen_photos_hen_id_fkey"
            columns: ["hen_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      hens: {
        Row: {
          birth_date: string | null
          bloodline: string | null
          breed: string | null
          color: string | null
          created_at: string
          death_cause: string | null
          death_date: string | null
          father_id: string | null
          father_name: string | null
          flock_id: string | null
          hatch_session_id: string | null
          hen_type: string
          id: string
          image_url: string | null
          is_active: boolean
          mother_id: string | null
          mother_name: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          bloodline?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          death_cause?: string | null
          death_date?: string | null
          father_id?: string | null
          father_name?: string | null
          flock_id?: string | null
          hatch_session_id?: string | null
          hen_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          mother_id?: string | null
          mother_name?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          bloodline?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          death_cause?: string | null
          death_date?: string | null
          father_id?: string | null
          father_name?: string | null
          flock_id?: string | null
          hatch_session_id?: string | null
          hen_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          mother_id?: string | null
          mother_name?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hens_hatch_session"
            columns: ["hatch_session_id"]
            isOneToOne: false
            referencedRelation: "hatch_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hens_father_id_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hens_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hens_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          current_quantity: number
          id: string
          low_threshold: number | null
          name: string
          notes: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          current_quantity?: number
          id?: string
          low_threshold?: number | null
          name: string
          notes?: string | null
          unit: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          current_quantity?: number
          id?: string
          low_threshold?: number | null
          name?: string
          notes?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          quantity: number
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity: number
          transaction_date?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity?: number
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_emails_sent: {
        Row: {
          email_key: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          email_key: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          email_key?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      link_glossary: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          rel: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          rel?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          rel?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      marketplace_alerts: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          last_notified_at: string | null
          region: string | null
          search_term: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          last_notified_at?: string | null
          region?: string | null
          search_term?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          last_notified_at?: string | null
          region?: string | null
          search_term?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          city: string | null
          condition: string | null
          created_at: string
          currency: string
          description: string
          expires_at: string
          id: string
          image_urls: string[]
          is_giveaway: boolean
          postal_code: string | null
          price: number | null
          region: string | null
          reminded_at: string | null
          search_vector: unknown
          slug: string
          sold_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          category: string
          city?: string | null
          condition?: string | null
          created_at?: string
          currency?: string
          description: string
          expires_at?: string
          id?: string
          image_urls?: string[]
          is_giveaway?: boolean
          postal_code?: string | null
          price?: number | null
          region?: string | null
          reminded_at?: string | null
          search_vector?: unknown
          slug: string
          sold_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          category?: string
          city?: string | null
          condition?: string | null
          created_at?: string
          currency?: string
          description?: string
          expires_at?: string
          id?: string
          image_urls?: string[]
          is_giveaway?: boolean
          postal_code?: string | null
          price?: number | null
          region?: string | null
          reminded_at?: string | null
          search_vector?: unknown
          slug?: string
          sold_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      marketplace_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          listing_id: string
          read_at: string | null
          recipient_user_id: string
          sender_user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          listing_id: string
          read_at?: string | null
          recipient_user_id: string
          sender_user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          listing_id?: string
          read_at?: string | null
          recipient_user_id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reports: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          reason: string
          reported_by: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          reason: string
          reported_by: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          reason?: string
          reported_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          title: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          title: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          title?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pitch_leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          location: string | null
          packs: string | null
          phone: string | null
          pitch: string | null
          price: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          packs?: string | null
          phone?: string | null
          pitch?: string | null
          price?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          packs?: string | null
          phone?: string | null
          pitch?: string | null
          price?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country_code: string | null
          created_at: string
          currency_code: string | null
          display_name: string | null
          email: string | null
          id: string
          is_lifetime_premium: boolean
          language_code: string | null
          locale: string | null
          measurement_system: string | null
          postal_code: string | null
          preferences: Json
          premium_expires_at: string | null
          referral_code: string | null
          referred_by: string | null
          stripe_customer_id: string | null
          subscription_status: string
          temperature_unit: string | null
          terms_accepted_at: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_lifetime_premium?: boolean
          language_code?: string | null
          locale?: string | null
          measurement_system?: string | null
          postal_code?: string | null
          preferences?: Json
          premium_expires_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          temperature_unit?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_lifetime_premium?: boolean
          language_code?: string | null
          locale?: string | null
          measurement_system?: string | null
          postal_code?: string | null
          preferences?: Json
          premium_expires_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          temperature_unit?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_egg_alert_sends: {
        Row: {
          alert_id: string
          email: string
          id: string
          listing_id: string
          ort_slug: string | null
          sent_at: string
        }
        Insert: {
          alert_id: string
          email: string
          id?: string
          listing_id: string
          ort_slug?: string | null
          sent_at?: string
        }
        Update: {
          alert_id?: string
          email?: string
          id?: string
          listing_id?: string
          ort_slug?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_egg_alert_sends_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "public_egg_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_egg_alert_sends_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      public_egg_alerts: {
        Row: {
          created_at: string
          email: string
          id: string
          last_notified_at: string | null
          ort_name: string | null
          ort_slug: string | null
          source: string | null
          unsubscribe_token: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          verified: boolean
          verified_at: string | null
          verify_token: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_notified_at?: string | null
          ort_name?: string | null
          ort_slug?: string | null
          source?: string | null
          unsubscribe_token?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          verified?: boolean
          verified_at?: string | null
          verify_token?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_notified_at?: string | null
          ort_name?: string | null
          ort_slug?: string | null
          source?: string | null
          unsubscribe_token?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          verified?: boolean
          verified_at?: string | null
          verify_token?: string
        }
        Relationships: []
      }
      public_egg_sale_bookings: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_email: string | null
          customer_message: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          listing_id: string
          no_show_at: string | null
          packed_at: string | null
          packs: number
          paid_at: string | null
          payment_reminder_count: number
          payment_reminder_last_sent_at: string | null
          payment_status: string
          picked_up_at: string | null
          pickup_person_name: string | null
          pickup_person_phone: string | null
          pickup_reminder_sent_at: string | null
          pickup_slot_id: string | null
          refunded_at: string | null
          review_request_sent_at: string | null
          seller_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_message?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          listing_id: string
          no_show_at?: string | null
          packed_at?: string | null
          packs?: number
          paid_at?: string | null
          payment_reminder_count?: number
          payment_reminder_last_sent_at?: string | null
          payment_status?: string
          picked_up_at?: string | null
          pickup_person_name?: string | null
          pickup_person_phone?: string | null
          pickup_reminder_sent_at?: string | null
          pickup_slot_id?: string | null
          refunded_at?: string | null
          review_request_sent_at?: string | null
          seller_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_message?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          listing_id?: string
          no_show_at?: string | null
          packed_at?: string | null
          packs?: number
          paid_at?: string | null
          payment_reminder_count?: number
          payment_reminder_last_sent_at?: string | null
          payment_status?: string
          picked_up_at?: string | null
          pickup_person_name?: string | null
          pickup_person_phone?: string | null
          pickup_reminder_sent_at?: string | null
          pickup_slot_id?: string | null
          refunded_at?: string | null
          review_request_sent_at?: string | null
          seller_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_egg_sale_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_egg_sale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_egg_sale_bookings_pickup_slot_id_fkey"
            columns: ["pickup_slot_id"]
            isOneToOne: false
            referencedRelation: "egg_sale_pickup_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      public_egg_sale_listings: {
        Row: {
          auto_publish: boolean
          contact_info: string | null
          contact_phone: string | null
          created_at: string
          description: string
          eggs_per_pack: number
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          latitude: number | null
          listing_kind: string
          location: string | null
          longitude: number | null
          manage_token: string | null
          owner_email: string | null
          p12_price: number | null
          p30_price: number | null
          p6_price: number | null
          packs_available: number
          pickup_info: string | null
          price_per_pack: number
          price_tiers: Json
          regular_customer_threshold: number
          reko_enabled: boolean
          reko_group_name: string | null
          reko_next_pickup_at: string | null
          reko_pickup_location: string | null
          reko_recurring_biweekly: boolean
          reko_reminder_sent_for: string | null
          reserved_packs: number
          sections: Json
          slug: string
          sold_out_manually: boolean
          stock_packs: number
          stock_source: string
          submitted_ip: string | null
          swish_message: string | null
          swish_name: string | null
          swish_number: string | null
          theme: Json
          title: string
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          auto_publish?: boolean
          contact_info?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          eggs_per_pack?: number
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          listing_kind?: string
          location?: string | null
          longitude?: number | null
          manage_token?: string | null
          owner_email?: string | null
          p12_price?: number | null
          p30_price?: number | null
          p6_price?: number | null
          packs_available?: number
          pickup_info?: string | null
          price_per_pack?: number
          price_tiers?: Json
          regular_customer_threshold?: number
          reko_enabled?: boolean
          reko_group_name?: string | null
          reko_next_pickup_at?: string | null
          reko_pickup_location?: string | null
          reko_recurring_biweekly?: boolean
          reko_reminder_sent_for?: string | null
          reserved_packs?: number
          sections?: Json
          slug: string
          sold_out_manually?: boolean
          stock_packs?: number
          stock_source?: string
          submitted_ip?: string | null
          swish_message?: string | null
          swish_name?: string | null
          swish_number?: string | null
          theme?: Json
          title?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          auto_publish?: boolean
          contact_info?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          eggs_per_pack?: number
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          listing_kind?: string
          location?: string | null
          longitude?: number | null
          manage_token?: string | null
          owner_email?: string | null
          p12_price?: number | null
          p30_price?: number | null
          p6_price?: number | null
          packs_available?: number
          pickup_info?: string | null
          price_per_pack?: number
          price_tiers?: Json
          regular_customer_threshold?: number
          reko_enabled?: boolean
          reko_group_name?: string | null
          reko_next_pickup_at?: string | null
          reko_pickup_location?: string | null
          reko_recurring_biweekly?: boolean
          reko_reminder_sent_for?: string | null
          reserved_packs?: number
          sections?: Json
          slug?: string
          sold_out_manually?: boolean
          stock_packs?: number
          stock_source?: string
          submitted_ip?: string | null
          swish_message?: string | null
          swish_name?: string | null
          swish_number?: string | null
          theme?: Json
          title?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          function_name: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          function_name: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          function_name?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          redeemed_at: string | null
          referred_user_id: string
          referrer_user_id: string
          rewarded: boolean
          rewarded_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          redeemed_at?: string | null
          referred_user_id: string
          referrer_user_id: string
          rewarded?: boolean
          rewarded_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          redeemed_at?: string | null
          referred_user_id?: string
          referrer_user_id?: string
          rewarded?: boolean
          rewarded_at?: string | null
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          created_at: string
          enabled: boolean | null
          evening_reminder: boolean | null
          evening_time: string | null
          id: string
          morning_reminder: boolean | null
          morning_time: string | null
          settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          evening_reminder?: boolean | null
          evening_time?: string | null
          id?: string
          morning_reminder?: boolean | null
          morning_time?: string | null
          settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          evening_reminder?: boolean | null
          evening_time?: string | null
          id?: string
          morning_reminder?: boolean | null
          morning_time?: string | null
          settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          farm_id: string | null
          flock_id: string | null
          hen_id: string | null
          id: string
          notes: string | null
          recurrence: string
          reminder_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          farm_id?: string | null
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          notes?: string | null
          recurrence?: string
          reminder_type?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          farm_id?: string | null
          flock_id?: string | null
          hen_id?: string | null
          id?: string
          notes?: string | null
          recurrence?: string
          reminder_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_hen_id_fkey"
            columns: ["hen_id"]
            isOneToOne: false
            referencedRelation: "hens"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          business_type: string | null
          city: string | null
          created_at: string
          created_by: string | null
          do_not_contact: boolean
          found_at: string
          id: string
          last_contacted_at: string | null
          name: string
          notes: string | null
          public_email: string | null
          public_phone: string | null
          region: string | null
          relevance_score: number
          social_urls: Json
          source_description: string | null
          source_title: string | null
          source_url: string | null
          status: string
          updated_at: string
          website: string | null
          website_domain: string | null
        }
        Insert: {
          business_type?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          do_not_contact?: boolean
          found_at?: string
          id?: string
          last_contacted_at?: string | null
          name: string
          notes?: string | null
          public_email?: string | null
          public_phone?: string | null
          region?: string | null
          relevance_score?: number
          social_urls?: Json
          source_description?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          website_domain?: string | null
        }
        Update: {
          business_type?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          do_not_contact?: boolean
          found_at?: string
          id?: string
          last_contacted_at?: string | null
          name?: string
          notes?: string | null
          public_email?: string | null
          public_phone?: string | null
          region?: string | null
          relevance_score?: number
          social_urls?: Json
          source_description?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          website_domain?: string | null
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          product_id: string | null
          result: Json | null
          source_url: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          product_id?: string | null
          result?: Json | null
          source_url?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          product_id?: string | null
          result?: Json | null
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "affiliate_products"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_breeds: {
        Row: {
          adult_weight_hen_kg: number | null
          adult_weight_rooster_kg: number | null
          ai_model_used: string | null
          authoritative_sources: Json | null
          avg_eggs_per_year: number | null
          beginner_friendly: boolean | null
          breed_group: string | null
          broody_tendency: string | null
          cold_hardy: boolean | null
          conservation_status: string | null
          content: string | null
          created_at: string
          egg_color: string | null
          egg_size: string | null
          faq: Json | null
          generation_status: string
          id: string
          is_swedish_landrace: boolean | null
          key_facts: Json | null
          last_generated_at: string | null
          medical_disclaimer: string | null
          medically_reviewed_by: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          name_alt: string[] | null
          name_latin: string | null
          noise_level: string | null
          og_image_url: string | null
          origin_country: string | null
          published: boolean
          reviewed_at: string | null
          slug: string
          space_requirement_m2_per_hen: number | null
          summary: string | null
          temperament: string | null
          updated_at: string
        }
        Insert: {
          adult_weight_hen_kg?: number | null
          adult_weight_rooster_kg?: number | null
          ai_model_used?: string | null
          authoritative_sources?: Json | null
          avg_eggs_per_year?: number | null
          beginner_friendly?: boolean | null
          breed_group?: string | null
          broody_tendency?: string | null
          cold_hardy?: boolean | null
          conservation_status?: string | null
          content?: string | null
          created_at?: string
          egg_color?: string | null
          egg_size?: string | null
          faq?: Json | null
          generation_status?: string
          id?: string
          is_swedish_landrace?: boolean | null
          key_facts?: Json | null
          last_generated_at?: string | null
          medical_disclaimer?: string | null
          medically_reviewed_by?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          name_alt?: string[] | null
          name_latin?: string | null
          noise_level?: string | null
          og_image_url?: string | null
          origin_country?: string | null
          published?: boolean
          reviewed_at?: string | null
          slug: string
          space_requirement_m2_per_hen?: number | null
          summary?: string | null
          temperament?: string | null
          updated_at?: string
        }
        Update: {
          adult_weight_hen_kg?: number | null
          adult_weight_rooster_kg?: number | null
          ai_model_used?: string | null
          authoritative_sources?: Json | null
          avg_eggs_per_year?: number | null
          beginner_friendly?: boolean | null
          breed_group?: string | null
          broody_tendency?: string | null
          cold_hardy?: boolean | null
          conservation_status?: string | null
          content?: string | null
          created_at?: string
          egg_color?: string | null
          egg_size?: string | null
          faq?: Json | null
          generation_status?: string
          id?: string
          is_swedish_landrace?: boolean | null
          key_facts?: Json | null
          last_generated_at?: string | null
          medical_disclaimer?: string | null
          medically_reviewed_by?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          name_alt?: string[] | null
          name_latin?: string | null
          noise_level?: string | null
          og_image_url?: string | null
          origin_country?: string | null
          published?: boolean
          reviewed_at?: string | null
          slug?: string
          space_requirement_m2_per_hen?: number | null
          summary?: string | null
          temperament?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_care_topics: {
        Row: {
          ai_model_used: string | null
          authoritative_sources: Json | null
          category: string
          content: string | null
          cost_estimate_sek: string | null
          created_at: string
          difficulty_level: string | null
          faq: Json | null
          generation_status: string
          howto_steps: Json | null
          id: string
          intent: string | null
          key_facts: Json | null
          last_generated_at: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_url: string | null
          published: boolean
          required_materials: Json | null
          slug: string
          summary: string | null
          time_required: string | null
          updated_at: string
        }
        Insert: {
          ai_model_used?: string | null
          authoritative_sources?: Json | null
          category: string
          content?: string | null
          cost_estimate_sek?: string | null
          created_at?: string
          difficulty_level?: string | null
          faq?: Json | null
          generation_status?: string
          howto_steps?: Json | null
          id?: string
          intent?: string | null
          key_facts?: Json | null
          last_generated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image_url?: string | null
          published?: boolean
          required_materials?: Json | null
          slug: string
          summary?: string | null
          time_required?: string | null
          updated_at?: string
        }
        Update: {
          ai_model_used?: string | null
          authoritative_sources?: Json | null
          category?: string
          content?: string | null
          cost_estimate_sek?: string | null
          created_at?: string
          difficulty_level?: string | null
          faq?: Json | null
          generation_status?: string
          howto_steps?: Json | null
          id?: string
          intent?: string | null
          key_facts?: Json | null
          last_generated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image_url?: string | null
          published?: boolean
          required_materials?: Json | null
          slug?: string
          summary?: string | null
          time_required?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_indexing_queue: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          generation_status: string
          id: string
          processed_at: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          entity_id: string
          entity_type: string
          generation_status?: string
          id?: string
          processed_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          generation_status?: string
          id?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      seo_months: {
        Row: {
          ai_model_used: string | null
          common_problems_this_month: Json | null
          content: string | null
          created_at: string
          daylight_considerations: string | null
          egg_production_expectation: string | null
          faq: Json | null
          generation_status: string
          id: string
          key_facts: Json | null
          last_generated_at: string | null
          meta_description: string | null
          meta_title: string | null
          month_number: number
          name: string
          og_image_url: string | null
          published: boolean
          slug: string
          summary: string | null
          temperature_considerations: string | null
          typical_tasks: Json | null
          updated_at: string
        }
        Insert: {
          ai_model_used?: string | null
          common_problems_this_month?: Json | null
          content?: string | null
          created_at?: string
          daylight_considerations?: string | null
          egg_production_expectation?: string | null
          faq?: Json | null
          generation_status?: string
          id?: string
          key_facts?: Json | null
          last_generated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          month_number: number
          name: string
          og_image_url?: string | null
          published?: boolean
          slug: string
          summary?: string | null
          temperature_considerations?: string | null
          typical_tasks?: Json | null
          updated_at?: string
        }
        Update: {
          ai_model_used?: string | null
          common_problems_this_month?: Json | null
          content?: string | null
          created_at?: string
          daylight_considerations?: string | null
          egg_production_expectation?: string | null
          faq?: Json | null
          generation_status?: string
          id?: string
          key_facts?: Json | null
          last_generated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          month_number?: number
          name?: string
          og_image_url?: string | null
          published?: boolean
          slug?: string
          summary?: string | null
          temperature_considerations?: string | null
          typical_tasks?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_problem_breeds: {
        Row: {
          breed_id: string
          generation_status: string
          id: string
          note: string | null
          problem_id: string
        }
        Insert: {
          breed_id: string
          generation_status?: string
          id?: string
          note?: string | null
          problem_id: string
        }
        Update: {
          breed_id?: string
          generation_status?: string
          id?: string
          note?: string | null
          problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_problem_breeds_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "seo_breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_problem_breeds_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "seo_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_problems: {
        Row: {
          ai_model_used: string | null
          authoritative_sources: Json | null
          category: string
          causes: Json | null
          content: string | null
          created_at: string
          diagnosis_steps: Json | null
          faq: Json | null
          generation_status: string
          id: string
          is_notifiable: boolean | null
          is_zoonotic: boolean | null
          key_facts: Json | null
          last_generated_at: string | null
          medical_disclaimer: string | null
          medically_reviewed_by: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          name_alt: string[] | null
          og_image_url: string | null
          prevention_steps: Json | null
          published: boolean
          reviewed_at: string | null
          severity: string | null
          slug: string
          summary: string | null
          symptoms: Json | null
          treatment_overview: string | null
          updated_at: string
          when_to_call_vet: string | null
        }
        Insert: {
          ai_model_used?: string | null
          authoritative_sources?: Json | null
          category: string
          causes?: Json | null
          content?: string | null
          created_at?: string
          diagnosis_steps?: Json | null
          faq?: Json | null
          generation_status?: string
          id?: string
          is_notifiable?: boolean | null
          is_zoonotic?: boolean | null
          key_facts?: Json | null
          last_generated_at?: string | null
          medical_disclaimer?: string | null
          medically_reviewed_by?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          name_alt?: string[] | null
          og_image_url?: string | null
          prevention_steps?: Json | null
          published?: boolean
          reviewed_at?: string | null
          severity?: string | null
          slug: string
          summary?: string | null
          symptoms?: Json | null
          treatment_overview?: string | null
          updated_at?: string
          when_to_call_vet?: string | null
        }
        Update: {
          ai_model_used?: string | null
          authoritative_sources?: Json | null
          category?: string
          causes?: Json | null
          content?: string | null
          created_at?: string
          diagnosis_steps?: Json | null
          faq?: Json | null
          generation_status?: string
          id?: string
          is_notifiable?: boolean | null
          is_zoonotic?: boolean | null
          key_facts?: Json | null
          last_generated_at?: string | null
          medical_disclaimer?: string | null
          medically_reviewed_by?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          name_alt?: string[] | null
          og_image_url?: string | null
          prevention_steps?: Json | null
          published?: boolean
          reviewed_at?: string | null
          severity?: string | null
          slug?: string
          summary?: string | null
          symptoms?: Json | null
          treatment_overview?: string | null
          updated_at?: string
          when_to_call_vet?: string | null
        }
        Relationships: []
      }
      seo_settings: {
        Row: {
          created_at: string
          default_ai_model: string
          default_medical_disclaimer: string | null
          editorial_org_name: string
          generation_status: string
          id: string
          last_sitemap_ping_at: string | null
          llms_txt_enabled: boolean
          public_routes_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_ai_model?: string
          default_medical_disclaimer?: string | null
          editorial_org_name?: string
          generation_status?: string
          id?: string
          last_sitemap_ping_at?: string | null
          llms_txt_enabled?: boolean
          public_routes_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_ai_model?: string
          default_medical_disclaimer?: string | null
          editorial_org_name?: string
          generation_status?: string
          id?: string
          last_sitemap_ping_at?: string | null
          llms_txt_enabled?: boolean
          public_routes_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      shop_orders: {
        Row: {
          admin_note: string | null
          amount_total_ore: number
          completed_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_ore: number
          fulfillment_status: string
          id: string
          items: Json
          order_number: string | null
          paid_at: string | null
          payment_intent_id: string | null
          public_token: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_ore: number
          status: string
          stock_applied: boolean
          stripe_session_id: string | null
          subtotal_ore: number
          tracking_number: string | null
          tracking_url: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          amount_total_ore?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_ore?: number
          fulfillment_status?: string
          id?: string
          items?: Json
          order_number?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          public_token?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_ore?: number
          status?: string
          stock_applied?: boolean
          stripe_session_id?: string | null
          subtotal_ore?: number
          tracking_number?: string | null
          tracking_url?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          amount_total_ore?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_ore?: number
          fulfillment_status?: string
          id?: string
          items?: Json
          order_number?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          public_token?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_ore?: number
          status?: string
          stock_applied?: boolean
          stripe_session_id?: string | null
          subtotal_ore?: number
          tracking_number?: string | null
          tracking_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shop_product_variants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          options: Json
          price_override_ore: number | null
          product_id: string
          sku: string | null
          sort_order: number
          stock: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          options?: Json
          price_override_ore?: number | null
          product_id: string
          sku?: string | null
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          options?: Json
          price_override_ore?: number | null
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          active: boolean
          badge: string | null
          category: string | null
          created_at: string
          description: string
          emoji: string
          featured: boolean
          features: string[]
          id: string
          image_url: string | null
          images: string[]
          is_example: boolean
          long_description: string | null
          name: string
          price_ore: number
          shipping_days_max: number | null
          shipping_days_min: number | null
          slug: string
          sort_order: number
          specifications: Json
          stock: number | null
          updated_at: string
          vat_rate: number
        }
        Insert: {
          active?: boolean
          badge?: string | null
          category?: string | null
          created_at?: string
          description?: string
          emoji?: string
          featured?: boolean
          features?: string[]
          id?: string
          image_url?: string | null
          images?: string[]
          is_example?: boolean
          long_description?: string | null
          name: string
          price_ore: number
          shipping_days_max?: number | null
          shipping_days_min?: number | null
          slug: string
          sort_order?: number
          specifications?: Json
          stock?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          active?: boolean
          badge?: string | null
          category?: string | null
          created_at?: string
          description?: string
          emoji?: string
          featured?: boolean
          features?: string[]
          id?: string
          image_url?: string | null
          images?: string[]
          is_example?: boolean
          long_description?: string | null
          name?: string
          price_ore?: number
          shipping_days_max?: number | null
          shipping_days_min?: number | null
          slug?: string
          sort_order?: number
          specifications?: Json
          stock?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      shop_withdrawal_requests: {
        Row: {
          admin_note: string | null
          confirmation_code: string
          created_at: string
          customer_email: string
          customer_message: string | null
          id: string
          order_id: string
          order_number: string
          receipt_method: string
          requested_at: string
          requested_items: Json
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          confirmation_code: string
          created_at?: string
          customer_email: string
          customer_message?: string | null
          id?: string
          order_id: string
          order_number: string
          receipt_method: string
          requested_at?: string
          requested_items: Json
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          confirmation_code?: string
          created_at?: string
          customer_email?: string
          customer_message?: string | null
          id?: string
          order_id?: string
          order_number?: string
          receipt_method?: string
          requested_at?: string
          requested_items?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_withdrawal_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weather_advice_cache: {
        Row: {
          cache_date: string
          city_name: string | null
          created_at: string
          history_insight: string | null
          id: string
          latitude: number | null
          longitude: number | null
          model: string | null
          production_forecast: string | null
          summary: string | null
          today_advice: string | null
          updated_at: string
          user_id: string
          weather_snapshot: Json | null
          week_advice: string | null
        }
        Insert: {
          cache_date?: string
          city_name?: string | null
          created_at?: string
          history_insight?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          model?: string | null
          production_forecast?: string | null
          summary?: string | null
          today_advice?: string | null
          updated_at?: string
          user_id: string
          weather_snapshot?: Json | null
          week_advice?: string | null
        }
        Update: {
          cache_date?: string
          city_name?: string | null
          created_at?: string
          history_insight?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          model?: string | null
          production_forecast?: string | null
          summary?: string | null
          today_advice?: string | null
          updated_at?: string
          user_id?: string
          weather_snapshot?: Json | null
          week_advice?: string | null
        }
        Relationships: []
      }
      weather_alert_preferences: {
        Row: {
          city_name: string | null
          cold_threshold_c: number
          created_at: string
          enabled: boolean
          heat_threshold_c: number
          id: string
          latitude: number | null
          longitude: number | null
          notify_email: boolean
          notify_in_app: boolean
          rain_threshold_mm: number
          updated_at: string
          user_id: string
          wind_threshold_ms: number
        }
        Insert: {
          city_name?: string | null
          cold_threshold_c?: number
          created_at?: string
          enabled?: boolean
          heat_threshold_c?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          notify_email?: boolean
          notify_in_app?: boolean
          rain_threshold_mm?: number
          updated_at?: string
          user_id: string
          wind_threshold_ms?: number
        }
        Update: {
          city_name?: string | null
          cold_threshold_c?: number
          created_at?: string
          enabled?: boolean
          heat_threshold_c?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          notify_email?: boolean
          notify_in_app?: boolean
          rain_threshold_mm?: number
          updated_at?: string
          user_id?: string
          wind_threshold_ms?: number
        }
        Relationships: []
      }
      weather_alerts_sent: {
        Row: {
          alert_date: string
          alert_type: string
          created_at: string
          details: Json | null
          forecast_date: string
          id: string
          user_id: string
        }
        Insert: {
          alert_date: string
          alert_type: string
          created_at?: string
          details?: Json | null
          forecast_date: string
          id?: string
          user_id: string
        }
        Update: {
          alert_date?: string
          alert_type?: string
          created_at?: string
          details?: Json | null
          forecast_date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      advertiser_config: {
        Row: {
          adtraction_advertiser_id: string | null
          base_tracking_url: string | null
          base_url: string | null
          commission_rate: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          partner_id: string | null
          pin_domain: string | null
          slug: string | null
        }
        Insert: {
          adtraction_advertiser_id?: string | null
          base_tracking_url?: never
          base_url?: string | null
          commission_rate?: number | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          partner_id?: never
          pin_domain?: string | null
          slug?: string | null
        }
        Update: {
          adtraction_advertiser_id?: string | null
          base_tracking_url?: never
          base_url?: string | null
          commission_rate?: number | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          partner_id?: never
          pin_domain?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      affiliate_advertisers_public: {
        Row: {
          adtraction_advertiser_id: string | null
          base_url: string | null
          commission_rate: number | null
          cookie_days: number | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pin_domain: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          adtraction_advertiser_id?: string | null
          base_url?: string | null
          commission_rate?: number | null
          cookie_days?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pin_domain?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          adtraction_advertiser_id?: string | null
          base_url?: string | null
          commission_rate?: number | null
          cookie_days?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pin_domain?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_waitlist_offer: { Args: { p_token: string }; Returns: Json }
      build_affiliate_url: {
        Args: { p_advertiser_id: string; p_product_url: string }
        Returns: string
      }
      cancel_booking_by_token: { Args: { p_token: string }; Returns: Json }
      cancel_egg_subscription: {
        Args: { p_reason?: string; p_subscription_id: string }
        Returns: Json
      }
      cancel_order_by_token: { Args: { p_token: string }; Returns: Json }
      check_rate_limit: {
        Args: {
          _function_name: string
          _max_requests: number
          _user_id: string
          _window_minutes?: number
        }
        Returns: boolean
      }
      claim_due_egg_subscriptions: {
        Args: { p_limit?: number }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          consecutive_failures: number
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          frequency: string
          id: string
          last_booking_id: string | null
          last_error: string | null
          listing_id: string
          next_run_at: string
          notes: string | null
          packs: number
          paused_until: string | null
          pickup_slot_id: string | null
          preferred_weekday: number | null
          seller_user_id: string
          skip_next: boolean
          status: string
          total_bookings: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "egg_sale_subscriptions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_egg_notifications: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          booking_id: string | null
          created_at: string
          data: Json
          deliver_after: string
          delivered_at: string | null
          destination: string | null
          error_message: string | null
          id: string
          kind: string
          listing_id: string | null
          state: string
          unique_key: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "egg_sale_notification_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_client_error_logs: { Args: never; Returns: undefined }
      complete_egg_notification: {
        Args: { p_error?: string; p_id: string }
        Returns: undefined
      }
      complete_egg_subscription_run: {
        Args: {
          p_booking_id?: string
          p_error?: string
          p_id: string
          p_next_run_at?: string
          p_ok: boolean
        }
        Returns: undefined
      }
      confirm_public_egg_alert: { Args: { p_token: string }; Returns: Json }
      count_user_backups_today: { Args: { _uid: string }; Returns: number }
      count_user_reports_today: { Args: { _uid: string }; Returns: number }
      create_next_waitlist_offer: {
        Args: { p_listing_id: string; p_packs?: number }
        Returns: Json
      }
      deactivate_expired_simple_listings: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_marketplace_listings: { Args: never; Returns: undefined }
      get_affiliate_article_profile: {
        Args: { p_slug: string }
        Returns: {
          article_count: number
          max_blocks: number
          percentile: number
          rank_30d: number
          tier: string
          unique_visitors_30d: number
          views_30d: number
        }[]
      }
      get_booking_by_token: { Args: { p_token: string }; Returns: Json }
      get_egg_sale_listing_stats: {
        Args: { p_days?: number; p_listing_id: string }
        Returns: Json
      }
      get_farm_member_display_names: {
        Args: { _uid: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      get_farm_user_ids: { Args: { _uid: string }; Returns: string[] }
      get_flock_benchmark: {
        Args: never
        Returns: {
          national_avg_eggs_per_hen: number
          sample_flocks: number
          user_eggs_per_hen: number
          user_percentile: number
        }[]
      }
      get_hen_ancestors: {
        Args: { _generations?: number; _hen_id: string }
        Returns: {
          birth_date: string
          breed: string
          color: string
          depth: number
          father_id: string
          hen_type: string
          id: string
          image_url: string
          mother_id: string
          name: string
          relation: string
        }[]
      }
      get_order_by_token: { Args: { p_token: string }; Returns: Json }
      get_public_egg_sale_reserved_packs: {
        Args: { p_listing_id: string }
        Returns: number
      }
      get_public_egg_sale_social_proof: {
        Args: { p_listing_id: string }
        Returns: {
          bookings_today: number
          last_booked_at: string
        }[]
      }
      get_shop_settings: { Args: never; Returns: Json }
      get_user_farm_ids: { Args: { _uid: string }; Returns: string[] }
      get_waitlist_offer: { Args: { p_token: string }; Returns: Json }
      grant_premium_days: {
        Args: { _days: number; _user_id: string }
        Returns: undefined
      }
      grant_referral_reward_for_referred: {
        Args: { _referred_user_id: string }
        Returns: boolean
      }
      has_farm_role_for_owner: {
        Args: { _owner_uid: string; _required_role?: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_marketplace_view: {
        Args: { _slug: string }
        Returns: undefined
      }
      is_verified_egg_seller: { Args: { _seller_id: string }; Returns: boolean }
      list_pickup_slots_by_token: { Args: { p_token: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pause_egg_subscription: {
        Args: { p_paused_until?: string; p_subscription_id: string }
        Returns: Json
      }
      process_referral: {
        Args: { _new_user_id: string; _referral_code: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      request_public_egg_alert: {
        Args: {
          p_email: string
          p_ort_name?: string
          p_ort_slug?: string
          p_source?: string
          p_utm_campaign?: string
          p_utm_medium?: string
          p_utm_source?: string
        }
        Returns: Json
      }
      reschedule_order_by_token: {
        Args: { p_new_slot_id: string; p_token: string }
        Returns: Json
      }
      resume_egg_subscription: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      seo_public_routes_enabled: { Args: never; Returns: boolean }
      set_lifetime_premium: {
        Args: { _is_lifetime: boolean; _user_id: string }
        Returns: undefined
      }
      shop_admin_update_order_fulfillment: {
        Args: {
          p_admin_note?: string
          p_fulfillment_status: string
          p_order_id: string
          p_tracking_number?: string
          p_tracking_url?: string
        }
        Returns: Json
      }
      shop_finalize_paid_order: {
        Args: {
          p_amount_total_ore: number
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_discount_ore?: number
          p_order_id: string
          p_payment_intent_id?: string
          p_shipping_address?: Json
        }
        Returns: Json
      }
      shop_launch_checklist: { Args: never; Returns: Json }
      shop_public_enabled: { Args: never; Returns: boolean }
      shop_variant_order_usage: {
        Args: { p_variant_id: string }
        Returns: number
      }
      sync_profile_from_auth: { Args: never; Returns: undefined }
      transition_egg_booking_status: {
        Args: { p_booking_id: string; p_new_status: string; p_note?: string }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      unsubscribe_public_egg_alert: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
