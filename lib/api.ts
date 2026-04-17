/**
 * lib/api.ts
 * ─────────────────────────────────────────────────────
 * Central Django REST API layer for BRASSFLOW ERP.
 * Hooks into the Single Unified Endpoint at /api 
 * ─────────────────────────────────────────────────────
 */

const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const BASE_URL = rawBaseUrl && rawBaseUrl !== ''
  ? rawBaseUrl.replace(/\/$/, '')
  : 'http://127.0.0.1:8000';

// ─── Generic Fetch Wrapper for Unified API ───────────────────────────────────

async function unifiedApiCall<T = any>(
  model: string,
  action: 'list' | 'retrieve' | 'create' | 'update' | 'delete' | 'bulk_delete' | 'balances' | 'due' | 'stats',
  id?: string,
  data?: Record<string, any> | FormData
): Promise<T> {
  const url = `${BASE_URL}/api/`; // Trailing slash যোগ করা হয়েছে
  
  // NOTE: If using FormData, we'd normally parse it or upload directly. 
  // For now, we'll convert simple FormData to JSON for the backend, or rely on cloudinary for image uploads prior to calling this.
  let jsonPayload = data;
  if (data instanceof FormData) {
      jsonPayload = Object.fromEntries(data.entries());
  }

  const payload = {
    model,
    action,
    id,
    data: jsonPayload
  };

  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };

  const res = await fetch(url, options);

  if (!res.ok) {
    let errMsg = `API Error ${res.status} at ${url}: ${res.statusText}`;
    try {
      const body = await res.json();
      errMsg = body?.error || body?.detail || body?.message || JSON.stringify(body) || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── API OBJECT ──────────────────────────────────────────────────────────────

export const api = {

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
  getDashboardStats: () => unifiedApiCall('product', 'stats'), // Model doesn't matter for custom 'stats' action

  // ─── EMPLOYEES ─────────────────────────────────────────────────────────────
  getEmployees: (params?: any) => unifiedApiCall('employee', 'list', undefined, params),
  getEmployee: (id: string) => unifiedApiCall('employee', 'retrieve', id),
  createEmployee: (data: any) => unifiedApiCall('employee', 'create', undefined, data),
  updateEmployee: (id: string, data: any) => unifiedApiCall('employee', 'update', id, data),
  deleteEmployee: (id: string) => unifiedApiCall('employee', 'delete', id),

  // ─── ATTENDANCE ────────────────────────────────────────────────────────────
  getAttendance: (params?: any) => unifiedApiCall('attendance', 'list', undefined, params),
  markAttendance: (data: Record<string, any>) => unifiedApiCall('attendance', 'create', undefined, data),
  bulkMarkAttendance: (data: Record<string, any>[]) => Promise.all(data.map(d => unifiedApiCall('attendance', 'create', undefined, d))),
  deleteAttendance: (id: string) => unifiedApiCall('attendance', 'delete', id),

  // ─── EMPLOYEE TRANSACTIONS ─────────────────────────────────────────────────
  getEmployeeTransactions: (params?: any) => unifiedApiCall('employee_transaction', 'list', undefined, { ...params, employee: params?.employee_id }),
  createEmployeeTransaction: (data: Record<string, any>) => unifiedApiCall('employee_transaction', 'create', undefined, data),
  bulkCreateEmployeeTransactions: (data: Record<string, any>[]) => Promise.all(data.map(d => unifiedApiCall('employee_transaction', 'create', undefined, d))),
  deleteEmployeeTransaction: (id: string) => unifiedApiCall('employee_transaction', 'delete', id),

  // ─── CONTACTS ──────────────────────────────────────────────────────────────
  getContacts: (params?: any) => unifiedApiCall('contact', 'list', undefined, params),
  getContact: (id: string) => unifiedApiCall('contact', 'retrieve', id),
  createContact: (data: any) => unifiedApiCall('contact', 'create', undefined, data),
  updateContact: (id: string, data: any) => unifiedApiCall('contact', 'update', id, data),
  deleteContact: (id: string) => unifiedApiCall('contact', 'delete', id),

  // ─── CONTACT EMPLOYEES ─────────────────────────────────────────────────────
  getContactEmployees: (contactId: string) => unifiedApiCall('contact_employee', 'list', undefined, { contact: contactId }),
  createContactEmployee: (data: any) => unifiedApiCall('contact_employee', 'create', undefined, data),
  deleteContactEmployee: (id: string) => unifiedApiCall('contact_employee', 'delete', id),
  deleteContactEmployeesBulk: (contactId: string) => unifiedApiCall('contact_employee', 'bulk_delete', undefined, { contact: contactId }),

  // ─── PRODUCTS ──────────────────────────────────────────────────────────────
  getProducts: (params?: any) => unifiedApiCall('product', 'list', undefined, params),
  getProduct: (id: string) => unifiedApiCall('product', 'retrieve', id),
  createProduct: (data: any) => unifiedApiCall('product', 'create', undefined, data),
  updateProduct: (id: string, data: any) => unifiedApiCall('product', 'update', id, data),
  deleteProduct: (id: string) => unifiedApiCall('product', 'delete', id),
  getStockHistory: (params?: any) => unifiedApiCall('stock_history', 'list', undefined, params),
  createStockHistory: (data: any) => unifiedApiCall('stock_history', 'create', undefined, data),

  // ─── INVOICES ──────────────────────────────────────────────────────────────
  getInvoices: (params?: any) => unifiedApiCall('invoice', 'list', undefined, params),
  getInvoice: (id: string) => unifiedApiCall('invoice', 'retrieve', id),
  createInvoice: (data: Record<string, any>) => unifiedApiCall('invoice', 'create', undefined, data),
  updateInvoice: (id: string, data: Record<string, any>) => unifiedApiCall('invoice', 'update', id, data),
  deleteInvoice: (id: string) => unifiedApiCall('invoice', 'delete', id),

  // ─── INVOICE ITEMS ─────────────────────────────────────────────────────────
  getInvoiceItems: (invoiceId: string) => unifiedApiCall('invoice_item', 'list', undefined, { invoice: invoiceId }),
  createInvoiceItems: (data: Record<string, any>[]) => Promise.all(data.map(d => unifiedApiCall('invoice_item', 'create', undefined, d))),

  // ─── PAYMENTS ──────────────────────────────────────────────────────────────
  getPayments: (params?: any) => unifiedApiCall('payment', 'list', undefined, params),
  getPayment: (id: string) => unifiedApiCall('payment', 'retrieve', id),
  createPayment: (data: Record<string, any>) => unifiedApiCall('payment', 'create', undefined, data),
  deletePayment: (id: string) => unifiedApiCall('payment', 'delete', id),

  // ─── CHECKS (Cheques) ──────────────────────────────────────────────────────
  getChecks: (params?: any) => unifiedApiCall('check', 'list', undefined, params),
  getCheck: (id: string) => unifiedApiCall('check', 'retrieve', id),
  createCheck: (data: Record<string, any>) => unifiedApiCall('check', 'create', undefined, data),
  updateCheck: (id: string, data: Record<string, any>) => unifiedApiCall('check', 'update', id, data),
  deleteCheck: (id: string) => unifiedApiCall('check', 'delete', id),

  // ─── INTERNAL ACCOUNTS ─────────────────────────────────────────────────────
  getInternalAccounts: (params?: any) => unifiedApiCall('internal_account', 'list', undefined, params),
  createInternalAccount: (data: Record<string, any>) => unifiedApiCall('internal_account', 'create', undefined, data),
  deleteInternalAccount: (id: string) => unifiedApiCall('internal_account', 'delete', id),

  // ─── DAILY EXPENSES ───────────────────────────────────────────────────────
  getDailyExpenses: (params?: any) => unifiedApiCall('daily_expense', 'list', undefined, params),
  createDailyExpense: (data: Record<string, any>) => unifiedApiCall('daily_expense', 'create', undefined, data),
  updateDailyExpense: (id: string, data: Record<string, any>) => unifiedApiCall('daily_expense', 'update', id, data),
  deleteDailyExpense: (id: string) => unifiedApiCall('daily_expense', 'delete', id),

  // ─── ADD MONEY ────────────────────────────────────────────────────────────
  getAddMoney: (params?: any) => unifiedApiCall('add_money', 'list', undefined, params),
  createAddMoney: (data: Record<string, any>) => unifiedApiCall('add_money', 'create', undefined, data),
  updateAddMoney: (id: string, data: Record<string, any>) => unifiedApiCall('add_money', 'update', id, data),
  deleteAddMoney: (id: string) => unifiedApiCall('add_money', 'delete', id),

  // ─── PROCESSING ORDERS ─────────────────────────────────────────────────────
  getProcessingOrders: (params?: any) => unifiedApiCall('processing_order', 'list', undefined, params),
  getProcessingBalances: () => unifiedApiCall('processing_order', 'balances'),
  createProcessingOrder: (data: any) => unifiedApiCall('processing_order', 'create', undefined, data),
  updateProcessingOrder: (id: string, data: Record<string, any>) => unifiedApiCall('processing_order', 'update', id, data),
  deleteProcessingOrder: (id: string) => unifiedApiCall('processing_order', 'delete', id),

  // ─── ORDERS ────────────────────────────────────────────────────────────────
  getOrders: (params?: any) => unifiedApiCall('order', 'list', undefined, params),
  getOrder: (id: string) => unifiedApiCall('order', 'retrieve', id),
  createOrder: (data: Record<string, any>) => unifiedApiCall('order', 'create', undefined, data),
  updateOrder: (id: string, data: Record<string, any>) => unifiedApiCall('order', 'update', id, data),
  deleteOrder: (id: string) => unifiedApiCall('order', 'delete', id),

  // Generic delete
  deleteRecord: (resource: string, id: string) => {
    let model = resource;
    if (model.endsWith('s')) model = model.slice(0, -1);
    if (model === 'contact-employee') model = 'contact_employee';
    if (model === 'employee-transaction') model = 'employee_transaction';
    if (model === 'invoice-item') model = 'invoice_item';
    if (model === 'internal-account') model = 'internal_account';
    if (model === 'processing-order') model = 'processing_order';
    return unifiedApiCall(model, 'delete', id);
  },

  // ─── FILE UPLOAD (নতুন যোগ করা হলো) ───────────────────────────────────────
  uploadFile: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/api/upload/`, { // Trailing slash
      method: 'POST',
      // Note: Do NOT set 'Content-Type': 'application/json' here.
      // The browser automatically sets it to 'multipart/form-data' with the correct boundary.
      body: formData
    });

    if (!res.ok) {
      throw new Error('Image upload failed');
    }
    const data = await res.json();
    return data.url; // Returns the full URL from the Django server
  }
};

export default api;