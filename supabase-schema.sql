-- ============================================================
--  ERP BUSINESS MANAGER — COMPLETE SUPABASE SCHEMA
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  ⚠️  WARNING: This will DELETE all existing data!
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- STEP 1: DROP EXISTING TABLES (Most dependent first)
-- ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.attendance           CASCADE;
DROP TABLE IF EXISTS public.employee_transactions CASCADE;
DROP TABLE IF EXISTS public.contact_employees    CASCADE;
DROP TABLE IF EXISTS public.invoice_items        CASCADE;
DROP TABLE IF EXISTS public.processing_orders    CASCADE;
DROP TABLE IF EXISTS public.payments             CASCADE;
DROP TABLE IF EXISTS public.checks               CASCADE;
DROP TABLE IF EXISTS public.invoices             CASCADE;
DROP TABLE IF EXISTS public.products             CASCADE;
DROP TABLE IF EXISTS public.contacts             CASCADE;
DROP TABLE IF EXISTS public.employees            CASCADE;
DROP TABLE IF EXISTS public.orders               CASCADE;
DROP TABLE IF EXISTS public.internal_accounts    CASCADE;


-- ──────────────────────────────────────────────────────────────
-- STEP 2: CREATE TABLES
-- ──────────────────────────────────────────────────────────────

-- 1. EMPLOYEES
CREATE TABLE public.employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  role                TEXT,
  salary              NUMERIC(12, 2) DEFAULT 0,
  phone               TEXT,
  whatsapp            TEXT,
  email               TEXT,
  dob                 DATE,
  address             TEXT,
  id_document_type    TEXT DEFAULT 'NID',
  id_document_number  TEXT,
  profile_image_url   TEXT,
  id_photo_urls       TEXT[] DEFAULT '{}',
  daily_allowance     NUMERIC(12, 2) DEFAULT 0,
  monthly_allowance   NUMERIC(12, 2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTENDANCE
CREATE TABLE public.attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present', -- 'present' | 'absent' | 'half'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, date)
);

-- 3. EMPLOYEE TRANSACTIONS (Salary, Advance, Bonus, Deduction)
CREATE TABLE public.employee_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- 'salary' | 'advance' | 'bonus' | 'deduction'
  amount      NUMERIC(12, 2) NOT NULL,
  date        DATE NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONTACTS (Customers, Suppliers, Processors)
CREATE TABLE public.contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL, -- 'customer' | 'supplier' | 'processor'
  customer_code TEXT,
  name        TEXT NOT NULL,
  shop_name   TEXT,
  phone       TEXT,
  whatsapp    TEXT,
  phone_numbers JSONB DEFAULT '[]', -- Array of { number, is_whatsapp, is_imo, is_telegram }
  email       TEXT,
  address     TEXT,
  photo_url   TEXT,
  bank_details JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CONTACT EMPLOYEES (Nested personnel under a contact)
CREATE TABLE public.contact_employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    TEXT DEFAULT 'Employee',
  phone       TEXT,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRODUCTS (Raw Materials + Finished Goods)
CREATE TABLE public.products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  sku                 TEXT,
  category            TEXT NOT NULL DEFAULT 'finished-goods', -- 'raw-materials' | 'finished-goods'
  price               NUMERIC(12, 2) DEFAULT 0,
  cost                NUMERIC(12, 2) DEFAULT 0,
  stock_quantity      NUMERIC(12, 3) DEFAULT 0,
  unit                TEXT DEFAULT 'pcs', -- 'pcs' | 'kg' | 'g' | 'ltr' | 'box'
  unit_value          NUMERIC(12, 2) DEFAULT 1,
  barcode             TEXT,
  is_tracked          BOOLEAN DEFAULT TRUE,
  low_stock_alert     BOOLEAN DEFAULT FALSE,
  minimum_stock       NUMERIC(12, 3) DEFAULT 0,
  use_for_processing  BOOLEAN DEFAULT FALSE,
  processing_price    NUMERIC(12, 2) DEFAULT 0,
  processing_price_auto NUMERIC(12, 2) DEFAULT 0,
  processing_price_manual NUMERIC(12, 2) DEFAULT 0,
  image_urls          TEXT[] DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INVOICES (Buy, Sell, Return)
CREATE TABLE public.invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 TEXT NOT NULL, -- 'buy' | 'sell' | 'return'
  contact_id           UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal             NUMERIC(12, 2) DEFAULT 0,
  discount             NUMERIC(12, 2) DEFAULT 0,
  total                NUMERIC(12, 2) DEFAULT 0,
  paid_amount          NUMERIC(12, 2) DEFAULT 0,
  due_amount           NUMERIC(12, 2) DEFAULT 0,
  payment_status       TEXT DEFAULT 'unpaid', -- 'paid' | 'partial' | 'unpaid'
  authorized_signature TEXT,
  received_by          TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 8. INVOICE ITEMS
CREATE TABLE public.invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity    NUMERIC(12, 3) NOT NULL DEFAULT 1,
  price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PAYMENTS (Standalone + Invoice-linked)
CREATE TABLE public.payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id             UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  contact_id             UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  type                   TEXT NOT NULL, -- 'in' | 'out'
  amount                 NUMERIC(12, 2) NOT NULL,
  method                 TEXT NOT NULL DEFAULT 'cash', -- 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'cheque'
  date                   DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method_details JSONB DEFAULT '{}',
  authorized_signature   TEXT,
  received_by            TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CHECKS (Cheque Finance Management)
CREATE TABLE public.checks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL, -- 'received' | 'issued'
  check_number  TEXT NOT NULL,
  bank_name     TEXT NOT NULL,
  amount        NUMERIC(12, 2) NOT NULL,
  issue_date    DATE,
  cash_date     DATE NOT NULL,
  alert_date    DATE,
  status        TEXT DEFAULT 'pending', -- 'pending' | 'cashed' | 'transferred' | 'bounced'
  partner_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Cheque Transfer Fields
  transfer_memo_no TEXT,
  transfer_date DATE,
  transfer_auth_signature TEXT,
  transfer_received_by TEXT,
  
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 10.5 INTERNAL ACCOUNTS (My Accounts & Wallets)
CREATE TABLE public.internal_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type  TEXT NOT NULL, -- 'bank' | 'wallet'
  provider_name TEXT NOT NULL, -- e.g., 'bikash', 'nagad', 'city bank'
  account_name  TEXT NOT NULL,
  account_number TEXT NOT NULL,
  branch        TEXT, -- Optional, mostly for banks
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PROCESSING ORDERS (Material Issued/Received to/from Processors)
CREATE TABLE public.processing_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL, -- 'issued' | 'received'
  memo_no       TEXT,
  processor_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity      NUMERIC(12, 3) NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  process_type  TEXT, -- 'auto' | 'manual'
  note          TEXT,
  photo_urls    TEXT[] DEFAULT '{}',
  authorized_signature TEXT,
  received_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ORDERS (Sales Orders & Purchase Orders)
CREATE TABLE public.orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no      TEXT NOT NULL UNIQUE,
  type          TEXT NOT NULL, -- 'sales' | 'purchase'
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name  TEXT,
  items         JSONB DEFAULT '[]', -- array of {product_id, product_name, quantity, unit, unit_price, subtotal}
  total         NUMERIC(12, 2) DEFAULT 0,
  status        TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'delivered' | 'cancelled'
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- STEP 3: INDEXES (for query performance)
-- ──────────────────────────────────────────────────────────────
CREATE INDEX idx_attendance_employee_id     ON public.attendance(employee_id);
CREATE INDEX idx_attendance_date            ON public.attendance(date);
CREATE INDEX idx_emp_transactions_emp_id    ON public.employee_transactions(employee_id);
CREATE INDEX idx_contacts_type              ON public.contacts(type);
CREATE INDEX idx_contact_employees_contact  ON public.contact_employees(contact_id);
CREATE INDEX idx_products_category          ON public.products(category);
CREATE INDEX idx_invoices_type              ON public.invoices(type);
CREATE INDEX idx_invoices_contact           ON public.invoices(contact_id);
CREATE INDEX idx_invoice_items_invoice      ON public.invoice_items(invoice_id);
CREATE INDEX idx_payments_type              ON public.payments(type);
CREATE INDEX idx_payments_invoice           ON public.payments(invoice_id);
CREATE INDEX idx_checks_status              ON public.checks(status);
CREATE INDEX idx_processing_orders_type     ON public.processing_orders(type);
CREATE INDEX idx_orders_type               ON public.orders(type);
CREATE INDEX idx_orders_status             ON public.orders(status);


-- ──────────────────────────────────────────────────────────────
-- STEP 4: ROW LEVEL SECURITY (RLS) — Enable & allow authenticated users
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders               ENABLE ROW LEVEL SECURITY;

-- Allow ALL operations for authenticated users (adjust per your security needs)
CREATE POLICY "Allow authenticated full access" ON public.employees            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.attendance           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.employee_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.contacts             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.contact_employees    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.products             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.invoices             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.invoice_items        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.payments             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.checks               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.internal_accounts    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.processing_orders    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.orders               FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────
-- STEP 5: STORAGE BUCKETS (Run separately if needed)
-- ──────────────────────────────────────────────────────────────
-- Go to: Supabase Dashboard → Storage → Create Buckets manually:
--   1. "employee-files"   (Public) — Employee profiles & ID documents
--   2. "product-files"   (Public) — Product images
--   3. "processing-files" (Public) — Material processing evidence photos
--
-- OR run these if you have Storage API access:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('employee-files', 'employee-files', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-files',  'product-files',  true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('processing-files', 'processing-files', true) ON CONFLICT DO NOTHING;

-- ✅ DONE! All tables created successfully.
-- ============================================================
