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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          customer_id: string
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          line1: string
          line2: string | null
          postal: string | null
          region: string | null
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          customer_id: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          line1: string
          line2?: string | null
          postal?: string | null
          region?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          line1?: string
          line2?: string | null
          postal?: string | null
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      angle_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          product_id: string | null
          product_name: string | null
          result_urls: string[]
          source_url: string
          status: string
          toon_set_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          result_urls?: string[]
          source_url: string
          status?: string
          toon_set_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          result_urls?: string[]
          source_url?: string
          status?: string
          toon_set_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "angle_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_availability"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          abandoned_email_sent_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          session_token: string | null
          updated_at: string
        }
        Insert: {
          abandoned_email_sent_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          session_token?: string | null
          updated_at?: string
        }
        Update: {
          abandoned_email_sent_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          session_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cfdi_documents: {
        Row: {
          created_at: string
          id: string
          order_id: string
          pac_error: string | null
          pdf_url: string | null
          stamped_at: string | null
          status: Database["public"]["Enums"]["cfdi_status"]
          uuid_fiscal: string | null
          xml_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          pac_error?: string | null
          pdf_url?: string | null
          stamped_at?: string | null
          status?: Database["public"]["Enums"]["cfdi_status"]
          uuid_fiscal?: string | null
          xml_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          pac_error?: string | null
          pdf_url?: string | null
          stamped_at?: string | null
          status?: Database["public"]["Enums"]["cfdi_status"]
          uuid_fiscal?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cfdi_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          estado: string
          motivo: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          estado?: string
          motivo?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          estado?: string
          motivo?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          expires_at: string | null
          id: string
          max_uses: number | null
          min_subtotal_cents: number
          starts_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_cents?: number
          starts_at?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_cents?: number
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          location: string
          qty_on_hand: number
          qty_reserved: number
          reorder_level: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          location?: string
          qty_on_hand?: number
          qty_reserved?: number
          reorder_level?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          location?: string
          qty_on_hand?: number
          qty_reserved?: number
          reorder_level?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "variant_availability"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_fiscal_data: {
        Row: {
          cfdi_use: string
          created_at: string
          email: string
          fiscal_name: string
          fiscal_regime: string
          order_id: string
          postal_code: string
          rfc: string
        }
        Insert: {
          cfdi_use: string
          created_at?: string
          email: string
          fiscal_name: string
          fiscal_regime: string
          order_id: string
          postal_code: string
          rfc: string
        }
        Update: {
          cfdi_use?: string
          created_at?: string
          email?: string
          fiscal_name?: string
          fiscal_regime?: string
          order_id?: string
          postal_code?: string
          rfc?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_fiscal_data_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total_cents: number
          order_id: string
          product_name: string
          quantity: number
          sku: string
          unit_price_cents: number
          variant_id: string | null
          variant_label: string
        }
        Insert: {
          id?: string
          line_total_cents: number
          order_id: string
          product_name: string
          quantity: number
          sku: string
          unit_price_cents: number
          variant_id?: string | null
          variant_label: string
        }
        Update: {
          id?: string
          line_total_cents?: number
          order_id?: string
          product_name?: string
          quantity?: number
          sku?: string
          unit_price_cents?: number
          variant_id?: string | null
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_availability"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          carrier: string | null
          created_at: string
          currency: string
          customer_id: string | null
          delivered_at: string | null
          discount_cents: number
          email: string
          estimated_delivery: string | null
          expires_at: string | null
          fulfillment_stage: string
          id: string
          needs_invoice: boolean
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          reminder_sent_at: string | null
          review_request_sent_at: string | null
          review_token: string
          session_token: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cents: number
          shipping_label_url: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivered_at?: string | null
          discount_cents?: number
          email: string
          estimated_delivery?: string | null
          expires_at?: string | null
          fulfillment_stage?: string
          id?: string
          needs_invoice?: boolean
          order_number: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reminder_sent_at?: string | null
          review_request_sent_at?: string | null
          review_token?: string
          session_token?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          shipping_label_url?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivered_at?: string | null
          discount_cents?: number
          email?: string
          estimated_delivery?: string | null
          expires_at?: string | null
          fulfillment_stage?: string
          id?: string
          needs_invoice?: boolean
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reminder_sent_at?: string | null
          review_request_sent_at?: string | null
          review_token?: string
          session_token?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          shipping_label_url?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          clabe: string | null
          created_at: string
          expires_at: string | null
          id: string
          method: string | null
          order_id: string
          provider: string
          provider_charge_id: string | null
          reference: string | null
          status: string
          voucher_url: string | null
        }
        Insert: {
          amount_cents: number
          clabe?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          method?: string | null
          order_id: string
          provider?: string
          provider_charge_id?: string | null
          reference?: string | null
          status?: string
          voucher_url?: string | null
        }
        Update: {
          amount_cents?: number
          clabe?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          method?: string | null
          order_id?: string
          provider?: string
          provider_charge_id?: string | null
          reference?: string | null
          status?: string
          voucher_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          color: string | null
          id: string
          position: number
          product_id: string
          url: string
        }
        Insert: {
          alt?: string | null
          color?: string | null
          id?: string
          position?: number
          product_id: string
          url: string
        }
        Update: {
          alt?: string | null
          color?: string | null
          id?: string
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price_cents: number
          brand_id: string | null
          combo_group: string | null
          combo_min_qty: number | null
          combo_price_cents: number | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          made_to_order: boolean
          name: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          base_price_cents: number
          brand_id?: string | null
          combo_group?: string | null
          combo_min_qty?: number | null
          combo_price_cents?: number | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          made_to_order?: boolean
          name: string
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          brand_id?: string | null
          combo_group?: string | null
          combo_min_qty?: number | null
          combo_price_cents?: number | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          made_to_order?: boolean
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          identifier: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      restock_subscriptions: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_subscriptions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_availability"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "restock_subscriptions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          exchange_variant_id: string | null
          id: string
          order_item_id: string
          quantity: number
          return_id: string
        }
        Insert: {
          exchange_variant_id?: string | null
          id?: string
          order_item_id: string
          quantity: number
          return_id: string
        }
        Update: {
          exchange_variant_id?: string | null
          id?: string
          order_item_id?: string
          quantity?: number
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_exchange_variant_id_fkey"
            columns: ["exchange_variant_id"]
            isOneToOne: false
            referencedRelation: "variant_availability"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "return_items_exchange_variant_id_fkey"
            columns: ["exchange_variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          order_id: string
          reason: string | null
          status: Database["public"]["Enums"]["return_status"]
          stripe_refund_id: string | null
          type: Database["public"]["Enums"]["return_type"]
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          stripe_refund_id?: string | null
          type: Database["public"]["Enums"]["return_type"]
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          stripe_refund_id?: string | null
          type?: Database["public"]["Enums"]["return_type"]
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          customer_id: string | null
          fit_feedback: Database["public"]["Enums"]["fit_feedback"] | null
          id: string
          order_id: string | null
          product_id: string
          rating: number
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          fit_feedback?: Database["public"]["Enums"]["fit_feedback"] | null
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          fit_feedback?: Database["public"]["Enums"]["fit_feedback"] | null
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: string | null
          id: string
          order_id: string
          shipped_at: string | null
          status: string | null
          tracking_number: string | null
        }
        Insert: {
          carrier?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
        }
        Update: {
          carrier?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      variants: {
        Row: {
          barcode: string | null
          color: string
          created_at: string
          id: string
          price_cents: number | null
          product_id: string
          size_system: Database["public"]["Enums"]["size_system"]
          size_value: string
          sku: string
          status: Database["public"]["Enums"]["variant_status"]
          width: Database["public"]["Enums"]["width_type"]
        }
        Insert: {
          barcode?: string | null
          color: string
          created_at?: string
          id?: string
          price_cents?: number | null
          product_id: string
          size_system?: Database["public"]["Enums"]["size_system"]
          size_value: string
          sku: string
          status?: Database["public"]["Enums"]["variant_status"]
          width?: Database["public"]["Enums"]["width_type"]
        }
        Update: {
          barcode?: string | null
          color?: string
          created_at?: string
          id?: string
          price_cents?: number | null
          product_id?: string
          size_system?: Database["public"]["Enums"]["size_system"]
          size_value?: string
          sku?: string
          status?: Database["public"]["Enums"]["variant_status"]
          width?: Database["public"]["Enums"]["width_type"]
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_mensajes: {
        Row: {
          content: string
          created_at: string
          id: string
          phone: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phone: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phone?: string
          role?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          id: string
          variant_id: string
          wishlist_id: string
        }
        Insert: {
          id?: string
          variant_id: string
          wishlist_id: string
        }
        Update: {
          id?: string
          variant_id?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_availability"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "wishlist_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      variant_availability: {
        Row: {
          in_stock: boolean | null
          made_to_order: boolean | null
          product_id: string | null
          qty_available: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_max: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      commit_order: {
        Args: {
          p_amount_cents: number
          p_charge_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
        }
        Returns: undefined
      }
      commit_stock: {
        Args: { p_qty: number; p_variant_id: string }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_billing?: Json
          p_cart_id: string
          p_discount_code?: string
          p_email: string
          p_needs_invoice?: boolean
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_shipping?: Json
        }
        Returns: {
          discount_cents: number
          expires_at: string
          order_id: string
          order_number: string
          subtotal_cents: number
          tax_cents: number
          total_cents: number
        }[]
      }
      expire_pending_orders: { Args: never; Returns: number }
      expire_stale_angle_jobs: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      iva_of: { Args: { p_inclusive: number }; Returns: number }
      record_payment: {
        Args: {
          p_amount_cents: number
          p_clabe?: string
          p_expires_at?: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
          p_provider_charge_id: string
          p_reference?: string
          p_voucher_url?: string
        }
        Returns: undefined
      }
      release_stock: {
        Args: { p_qty: number; p_variant_id: string }
        Returns: undefined
      }
      reserve_stock: {
        Args: { p_qty: number; p_variant_id: string }
        Returns: boolean
      }
      restock: {
        Args: { p_qty: number; p_variant_id: string }
        Returns: undefined
      }
      set_order_amounts: {
        Args: { p_order_id: string; p_shipping_cents: number }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      cfdi_status: "pending" | "stamped" | "failed" | "cancelled"
      discount_type: "percent" | "fixed"
      fit_feedback: "runs_small" | "true_to_size" | "runs_large"
      order_status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded"
      payment_method: "card" | "oxxo" | "spei" | "aplazo"
      product_status: "draft" | "active" | "archived"
      return_status:
        | "requested"
        | "approved"
        | "received"
        | "completed"
        | "rejected"
      return_type: "refund" | "exchange"
      size_system: "US" | "EU" | "UK" | "MX"
      variant_status: "active" | "inactive"
      width_type: "narrow" | "medium" | "wide"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      cfdi_status: ["pending", "stamped", "failed", "cancelled"],
      discount_type: ["percent", "fixed"],
      fit_feedback: ["runs_small", "true_to_size", "runs_large"],
      order_status: ["pending", "paid", "fulfilled", "cancelled", "refunded"],
      payment_method: ["card", "oxxo", "spei", "aplazo"],
      product_status: ["draft", "active", "archived"],
      return_status: [
        "requested",
        "approved",
        "received",
        "completed",
        "rejected",
      ],
      return_type: ["refund", "exchange"],
      size_system: ["US", "EU", "UK", "MX"],
      variant_status: ["active", "inactive"],
      width_type: ["narrow", "medium", "wide"],
    },
  },
} as const
