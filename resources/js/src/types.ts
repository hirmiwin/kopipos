export type Role = 'admin' | 'kasir';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_admin?: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  products_count?: number;
}

export interface Product {
  id: number;
  category_id: number | null;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  price: number;
  cost: number;
  stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  image_url: string | null;
  category?: Category | null;
  created_at: string;
  updated_at: string;
}

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'sale' | 'void';

export interface StockMovement {
  id: number;
  product_id: number;
  product?: { id: number; name: string; sku: string } | null;
  user_id: number;
  user?: { id: number; name: string } | null;
  type: StockMovementType;
  quantity: number;
  note: string | null;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number | null;
  product_name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'card' | 'qris' | 'transfer';

export interface Sale {
  id: number;
  invoice_number: string;
  user_id: number;
  cashier?: User | null;
  customer_name: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  change: number;
  payment_method: PaymentMethod;
  status: 'completed' | 'void';
  notes: string | null;
  items: SaleItem[];
  created_at: string;
}

export interface BrandSettings {
  store_name: string;
  logo_url: string | null;
}

export interface StoreSettings {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_email: string;
  receipt_header: string;
  receipt_footer: string;
  logo_url: string | null;
  currency: string;
  tax_enabled: boolean;
  tax_rate: number;
  receipt_width: '58' | '80';
  auto_print: boolean;
  print_method: 'browser' | 'serial';
  serial_baud_rate: number;
  low_stock_threshold: number;
  timezone: string;
}

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface ReceiptPayload {
  invoice_number: string;
  created_at: string;
  cashier: string;
  customer_name: string | null;
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  change: number;
  payment_method: string;
  settings: StoreSettings;
  escpos_base64: string;
}

export interface DashboardData {
  today_revenue: number;
  today_transactions: number;
  total_products: number;
  low_stock_products: number;
  recent_sales: Sale[];
  low_stock_list: Product[];
  weekly_revenue: Array<{ date: string; total: number }>;
}

export interface Paginated<T> {
  data: T[];
  links?: { first?: string | null; last?: string | null; prev?: string | null; next?: string | null };
  meta: {
    current_page: number;
    from?: number | null;
    last_page: number;
    path?: string;
    per_page: number;
    to?: number | null;
    total: number;
  };
}
