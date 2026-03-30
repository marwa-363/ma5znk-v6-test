export type UserRole = 'admin' | 'cashier' | 'accountant';

export interface UserPermissions {
  invoices: boolean;
  products: boolean;
  reports: boolean;
  treasury: boolean;
  view_dashboard: boolean;
  view_reports: boolean;
  edit_customers: boolean;
  add_products: boolean;
  edit_products: boolean;
  delete_products: boolean;
  create_invoices: boolean;
  edit_invoices: boolean;
  delete_invoices: boolean;
  access_settings: boolean;
  access_suppliers: boolean;
  access_treasury: boolean;
}

export interface UserProfile {
  id: string;
  uid?: string; // Alias for id
  name: string;
  displayName?: string; // Alias for name
  email: string;
  password?: string;
  role: UserRole;
  permissions: UserPermissions;
  companyId: string;
  currency?: 'EGP' | 'SAR';
  createdAt?: string;
  phoneNumber?: string;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Cheque {
  id: string;
  number: string;
  bank: string;
  amount: number;
  dueDate: string;
  type: 'incoming' | 'outgoing';
  status: 'pending' | 'cleared' | 'rejected';
  entityId: string;
  entityName: string;
  accountId: string;
  companyId: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id?: string;
  name: string;
  sku: string;
  barcode?: string;
  purchasePrice: number;
  sellingPrice: number; // Retail Price
  wholesalePrice: number;
  vipPrice: number;
  quantity: number;
  minStock: number;
  categoryId?: string;
  supplierId?: string;
  companyId: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  expiryDate?: string;
}

export interface Category {
  id?: string;
  name: string;
  description?: string;
  companyId: string;
}

export interface Account {
  id?: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  parentId?: string;
  balance: number;
  isSystem?: boolean;
  companyId: string;
}

export interface JournalEntryLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id?: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalEntryLine[];
  userId: string;
  companyId: string;
  createdAt: string;
}

export interface Transaction {
  id?: string;
  date: string;
  accountId: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string;
  invoiceId?: string;
  userId: string;
  companyId: string;
}

export type PriceType = 'retail' | 'wholesale' | 'vip';

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  priceType?: PriceType;
}

export interface Invoice {
  id?: string;
  number: string;
  type: 'sales' | 'purchase' | 'return';
  date: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  taxRate: number;
  tax: number;
  total: number;
  paidAmount: number;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'credit';
  status: 'paid' | 'partially_paid' | 'unpaid' | 'pending' | 'cancelled';
  dueDate?: string;
  notes?: string;
  userId: string;
  companyId: string;
  priceType?: PriceType;
}

export interface Customer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  totalPurchases: number;
  totalPaid: number;
  userId?: string;
  companyId: string;
}

export interface Payment {
  id?: string;
  date: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'other';
  notes?: string;
  userId: string;
  companyId: string;
  invoiceId?: string; // Optional: link to a specific invoice
}

export interface Supplier {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  balance: number;
  userId?: string;
  companyId: string;
}

export interface Expense {
  id?: string;
  date: string;
  amount: number;
  categoryId: string;
  accountId: string;
  description: string;
  userId: string;
  companyId: string;
  reference?: string;
}

export interface ReturnItem {
  productId: string;
  quantity: number;
  reason: string;
}

export interface Return {
  id?: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  type: 'sales_return' | 'purchase_return';
  items: ReturnItem[];
  totalAmount: number;
  createdAt: string;
  status: 'completed' | 'pending' | 'cancelled';
}

export interface TreasuryTransaction {
  id?: string;
  type: 'income' | 'expense' | 'transfer' | 'Cash In' | 'Cash Out' | 'Expense' | 'Supplier Payment' | 'Sales Invoice' | 'Purchase Invoice';
  source?: 'invoice' | 'purchase' | 'expense' | 'payment' | 'cheque';
  amount: number;
  date: string;
  description: string;
  accountId: string;
  referenceId?: string;
  category?: string;
  companyId?: string;
  userId?: string;
  createdAt?: string;
}

export interface AppSettings {
  id?: string;
  currency: 'EGP' | 'SAR';
  userId: string;
  storeName?: string;
  address?: string;
  phone?: string;
}
