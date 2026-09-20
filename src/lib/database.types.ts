export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'admin' | 'staff';
export type TabStatus = 'open' | 'closed' | 'cancelled';
export type ReferenceType = 'table' | 'customer';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          username: string | null;
          role: AppRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          username?: string | null;
          role?: AppRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          username?: string | null;
          role?: AppRole;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      bar_settings: {
        Row: {
          id: number;
          bar_name: string;
          identification: string | null;
          address: string | null;
          phone: string | null;
          currency: string;
          locale: string;
          timezone: string;
          receipt_prefix: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: number;
          bar_name: string;
          identification?: string | null;
          address?: string | null;
          phone?: string | null;
          currency?: string;
          locale?: string;
          timezone?: string;
          receipt_prefix?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bar_name?: string;
          identification?: string | null;
          address?: string | null;
          phone?: string | null;
          currency?: string;
          locale?: string;
          timezone?: string;
          receipt_prefix?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          sku: string | null;
          name: string;
          current_price: number;
          stock_quantity: number;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku?: string | null;
          name: string;
          current_price: number;
          stock_quantity?: number;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          sku?: string | null;
          name?: string;
          current_price?: number;
          stock_quantity?: number;
          is_active?: boolean;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tabs: {
        Row: {
          id: string;
          reference_type: ReferenceType;
          reference_label: string;
          status: TabStatus;
          opened_at: string;
          opened_by: string;
          closed_at: string | null;
          closed_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          open_request_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_type: ReferenceType;
          reference_label: string;
          status?: TabStatus;
          opened_at?: string;
          opened_by: string;
          closed_at?: string | null;
          closed_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          open_request_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: TabStatus;
          closed_at?: string | null;
          closed_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tab_items: {
        Row: {
          id: string;
          tab_id: string;
          product_id: string;
          quantity: number;
          product_name_snapshot: string;
          sku_snapshot: string | null;
          unit_price_snapshot: number;
          line_total: number;
          created_by: string;
          created_at: string;
          updated_by: string;
          updated_at: string;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          add_request_id: string;
        };
        Insert: {
          id?: string;
          tab_id: string;
          product_id: string;
          quantity: number;
          product_name_snapshot: string;
          sku_snapshot?: string | null;
          unit_price_snapshot: number;
          created_by: string;
          created_at?: string;
          updated_by: string;
          updated_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          add_request_id: string;
        };
        Update: {
          quantity?: number;
          updated_by?: string;
          updated_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Relationships: [];
      };
      tab_payments: {
        Row: {
          id: string;
          tab_id: string;
          amount: number;
          payer_name: string | null;
          request_id: string;
          actor_id: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: number;
          request_id: string;
          product_id: string;
          tab_id: string | null;
          tab_item_id: string | null;
          movement_type: string;
          stock_delta: number;
          stock_after: number;
          item_quantity_before: number | null;
          item_quantity_after: number | null;
          reason: string | null;
          actor_id: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          request_id: string;
          product_id: string;
          tab_id?: string | null;
          tab_item_id?: string | null;
          movement_type: string;
          stock_delta: number;
          stock_after: number;
          item_quantity_before?: number | null;
          item_quantity_after?: number | null;
          reason?: string | null;
          actor_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          receipt_number: number;
          receipt_code: string;
          tab_id: string;
          reference_type_snapshot: ReferenceType;
          reference_label_snapshot: string;
          bar_name_snapshot: string;
          bar_identification_snapshot: string | null;
          bar_address_snapshot: string | null;
          bar_phone_snapshot: string | null;
          issued_at: string;
          issued_by: string;
          total: number;
          currency: string;
          close_request_id: string;
        };
        Insert: {
          id?: string;
          receipt_number: number;
          receipt_code: string;
          tab_id: string;
          reference_type_snapshot: ReferenceType;
          reference_label_snapshot: string;
          bar_name_snapshot: string;
          bar_identification_snapshot?: string | null;
          bar_address_snapshot?: string | null;
          bar_phone_snapshot?: string | null;
          issued_at?: string;
          issued_by: string;
          total: number;
          currency?: string;
          close_request_id: string;
        };
        Update: never;
        Relationships: [];
      };
      receipt_items: {
        Row: {
          id: number;
          receipt_id: string;
          source_tab_item_id: string;
          product_id: string | null;
          product_name_snapshot: string;
          sku_snapshot: string | null;
          unit_price_snapshot: number;
          quantity: number;
          line_total: number;
        };
        Insert: {
          id?: number;
          receipt_id: string;
          source_tab_item_id: string;
          product_id?: string | null;
          product_name_snapshot: string;
          sku_snapshot?: string | null;
          unit_price_snapshot: number;
          quantity: number;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      open_tabs_summary: {
        Row: {
          id: string | null;
          reference_type: ReferenceType | null;
          reference_label: string | null;
          status: TabStatus | null;
          opened_at: string | null;
          opened_by: string | null;
          total: number | null;
          item_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_login_email: {
        Args: { p_username: string };
        Returns: string | null;
      };
      open_tab: {
        Args: {
          p_reference_type: ReferenceType;
          p_reference_label: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      create_product: {
        Args: {
          p_sku: string | null;
          p_name: string;
          p_price: number;
          p_opening_stock: number;
          p_request_id: string;
        };
        Returns: Json;
      };
      update_product: {
        Args: {
          p_product_id: string;
          p_sku: string | null;
          p_name: string;
          p_price: number;
          p_is_active: boolean;
        };
        Returns: Json;
      };
      set_stock: {
        Args: {
          p_product_id: string;
          p_counted_quantity: number;
          p_reason: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      add_consumption: {
        Args: {
          p_tab_id: string;
          p_product_id: string;
          p_quantity: number;
          p_request_id: string;
        };
        Returns: Json;
      };
      set_tab_item_quantity: {
        Args: { p_item_id: string; p_new_quantity: number; p_request_id: string };
        Returns: Json;
      };
      void_tab_item: {
        Args: { p_item_id: string; p_request_id: string };
        Returns: Json;
      };
      cancel_empty_tab: {
        Args: { p_tab_id: string; p_request_id: string };
        Returns: Json;
      };
      close_tab: {
        Args: { p_tab_id: string; p_request_id: string };
        Returns: Json;
      };
      add_tab_payment: {
        Args: {
          p_tab_id: string;
          p_amount: number;
          p_payer_name: string | null;
          p_request_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: AppRole;
      tab_status: TabStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type BarSettings = Database['public']['Tables']['bar_settings']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Tab = Database['public']['Tables']['tabs']['Row'];
export type TabItem = Database['public']['Tables']['tab_items']['Row'];
export type TabPayment = Database['public']['Tables']['tab_payments']['Row'];
export type OpenTabSummary = Database['public']['Views']['open_tabs_summary']['Row'];
export type Receipt = Database['public']['Tables']['receipts']['Row'];
export type ReceiptItem = Database['public']['Tables']['receipt_items']['Row'];
