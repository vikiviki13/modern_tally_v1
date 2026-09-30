# DATABASE DESIGN SPECIFICATION: PostgreSQL Financial Schema
**Platform:** Next-Gen Enterprise ERP & Accounting System  
**Engine:** PostgreSQL 16+  
**Target:** 3NF Normalized, Multi-Tenant, ACID-Compliant Accounting Database  
**Document:** Database Design & DDL Proposals (Phase 02 Deliverable)  
**Author:** Financial Systems Database Architect

---

## 1. Schema Conventions & Standards

1. **Precision & Types:**
   - **Monetary Amounts:** `NUMERIC(18, 2)` (Standard currency representation; max ₹ 9,999,999,999,999,999.99).
   - **Quantities & Unit Rates:** `NUMERIC(15, 4)` (Accommodates fractional weights, pharmaceutical volumes, high-precision exchange rates).
   - **Primary Keys:** `UUID` v7 (Time-ordered UUID) or standard `UUID DEFAULT gen_random_uuid()` for global uniqueness and replication safety.
   - **Timestamps:** `TIMESTAMPTZ` (UTC ISO-8601 timestamps only).
2. **Tenant Isolation:**
   - Every multi-tenant table includes `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`.
   - Composite unique constraints and foreign keys incorporate `tenant_id` to guarantee tenant isolation.
3. **Immutability of Financial Truth:**
   - Financial balances are **never** updated via `UPDATE ledger SET balance = ...`.
   - Running balances are queried by summing `journal_lines` or maintained as a disposable performance cache populated via read triggers.
   - Journal entries and lines are immutable once posted (`is_posted = true`).
4. **Referential Policies:**
   - Master data (Ledgers, Items, Parties) linked to posted transactions use `ON DELETE RESTRICT` to prevent orphan financial records.

---

## 2. Core PostgreSQL DDL Proposals

```sql
-- ============================================================================
-- EXTENSIONS & CUSTOM DOMAINS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE voucher_type_enum AS ENUM (
    'SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 
    'CONTRA', 'JOURNAL', 'DEBIT_NOTE', 'CREDIT_NOTE', 
    'STOCK_JOURNAL', 'PHYSICAL_STOCK'
);

CREATE TYPE entry_direction_enum AS ENUM ('DEBIT', 'CREDIT');

CREATE TYPE account_classification_enum AS ENUM (
    'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
);

CREATE TYPE party_type_enum AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

CREATE TYPE voucher_status_enum AS ENUM ('DRAFT', 'POSTED', 'VOID', 'REVERSED');

CREATE TYPE stock_movement_type_enum AS ENUM (
    'PURCHASE_RECEIPT', 'SALES_DELIVERY', 'INTERNAL_TRANSFER_IN', 
    'INTERNAL_TRANSFER_OUT', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT', 
    'SCRAP_WASTAGE', 'PRODUCTION_ISSUE', 'PRODUCTION_RECEIPT'
);

CREATE TYPE gst_treatment_enum AS ENUM (
    'REGULAR', 'COMPOSITION', 'CONSUMER', 'UNREGISTERED', 
    'OVERSEAS_EXPORT', 'SEZ_DEVELOPER', 'SEZ_UNIT', 'DEEMED_EXPORT'
);

-- ============================================================================
-- 1. TENANCY, USERS, ROLES & PERMISSIONS
-- ============================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    gstin VARCHAR(15) UNIQUE,
    pan VARCHAR(10),
    cin VARCHAR(21),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    state_code VARCHAR(2) NOT NULL,
    registered_address JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_roles_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE permissions (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'voucher:post', 'report:view_pl', 'ledger:create'
    module VARCHAR(32) NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(64) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================================
-- 2. FINANCIAL YEARS & ACCOUNTING PERIODS
-- ============================================================================
CREATE TABLE financial_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(16) NOT NULL, -- e.g. 'FY2026-27'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    CONSTRAINT uq_fy_tenant_dates UNIQUE (tenant_id, start_date, end_date),
    CONSTRAINT chk_fy_date_sequence CHECK (end_date > start_date)
);

CREATE TABLE accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    period_number INT NOT NULL, -- 1 to 12
    name VARCHAR(32) NOT NULL, -- e.g. 'April 2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id),
    CONSTRAINT uq_periods_tenant_year_num UNIQUE (tenant_id, financial_year_id, period_number),
    CONSTRAINT chk_period_dates CHECK (end_date >= start_date)
);

-- ============================================================================
-- 3. CHART OF ACCOUNTS & GENERAL LEDGERS
-- ============================================================================
CREATE TABLE account_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    parent_id UUID REFERENCES account_groups(id) ON DELETE RESTRICT,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(32),
    classification account_classification_enum NOT NULL,
    affects_gross_profit BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_groups_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    group_id UUID NOT NULL REFERENCES account_groups(id) ON DELETE RESTRICT,
    code VARCHAR(32),
    name VARCHAR(128) NOT NULL,
    alias VARCHAR(128),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    opening_balance_date DATE NOT NULL,
    opening_balance_type entry_direction_enum NOT NULL DEFAULT 'DEBIT',
    opening_balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    is_bill_wise BOOLEAN NOT NULL DEFAULT FALSE,
    is_cost_center_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_bank_account BOOLEAN NOT NULL DEFAULT FALSE,
    is_tax_account BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ledgers_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE party_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    ledger_id UUID NOT NULL UNIQUE REFERENCES ledgers(id) ON DELETE RESTRICT,
    party_type party_type_enum NOT NULL,
    gst_treatment gst_treatment_enum NOT NULL DEFAULT 'REGULAR',
    gstin VARCHAR(15),
    pan VARCHAR(10),
    msme_udyam_number VARCHAR(32),
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    contact_person VARCHAR(128),
    email VARCHAR(255),
    phone VARCHAR(32),
    billing_address JSONB NOT NULL,
    shipping_address JSONB,
    credit_limit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    credit_period_days INT NOT NULL DEFAULT 0,
    bank_account_number VARCHAR(34),
    bank_name VARCHAR(128),
    bank_ifsc VARCHAR(11),
    bank_branch VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. INVENTORY: UNITS, GODOWNS, PRODUCTS & BATCHES
-- ============================================================================
CREATE TABLE units_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(16) NOT NULL, -- e.g. 'PCS', 'BOX', 'KGS'
    name VARCHAR(64) NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    decimal_places INT NOT NULL DEFAULT 0 CHECK (decimal_places BETWEEN 0 AND 4),
    uqc_code VARCHAR(3), -- Standard GST Unit Quantity Code (e.g. 'NOS', 'KGS')
    is_compound BOOLEAN NOT NULL DEFAULT FALSE,
    base_unit_id UUID REFERENCES units_of_measure(id),
    conversion_multiplier NUMERIC(15, 4), -- e.g. 1 BOX = 24 PCS -> multiplier 24
    CONSTRAINT uq_uom_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    address JSONB,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_warehouses_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    hsn_sac_code VARCHAR(10) NOT NULL,
    uom_id UUID NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    purchase_rate NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    sales_rate NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    mrp NUMERIC(15, 4),
    sales_ledger_id UUID REFERENCES ledgers(id) ON DELETE RESTRICT,
    purchase_ledger_id UUID REFERENCES ledgers(id) ON DELETE RESTRICT,
    inventory_ledger_id UUID REFERENCES ledgers(id) ON DELETE RESTRICT,
    costing_method VARCHAR(16) NOT NULL DEFAULT 'FIFO', -- 'FIFO', 'WEIGHTED_AVG'
    reorder_level NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    is_batch_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    is_serial_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_tenant_sku UNIQUE (tenant_id, sku)
);

CREATE TABLE stock_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(64) NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_batches_tenant_product_batch UNIQUE (tenant_id, product_id, batch_number)
);

-- ============================================================================
-- 5. THE FINANCIAL TRANSACTION KERNEL: JOURNAL ENTRIES & LINES
-- ============================================================================
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    accounting_period_id UUID NOT NULL REFERENCES accounting_periods(id) ON DELETE RESTRICT,
    voucher_type voucher_type_enum NOT NULL,
    voucher_number VARCHAR(64) NOT NULL,
    entry_date DATE NOT NULL,
    posting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    narration TEXT,
    reference_number VARCHAR(64),
    reference_date DATE,
    source_document_id UUID, -- Polymorphic reference to sales_invoices.id, etc.
    source_document_type VARCHAR(32),
    status voucher_status_enum NOT NULL DEFAULT 'DRAFT',
    total_amount NUMERIC(18, 2) NOT NULL,
    is_system_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    posted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_journal_tenant_voucher UNIQUE (tenant_id, financial_year_id, voucher_type, voucher_number)
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
    line_number INT NOT NULL,
    entry_direction entry_direction_enum NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    narration VARCHAR(255),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    amount_foreign NUMERIC(18, 2),
    cost_center_id UUID,
    CONSTRAINT uq_lines_entry_line_num UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX idx_journal_lines_ledger_date 
ON journal_lines (tenant_id, ledger_id);

CREATE INDEX idx_journal_entries_date 
ON journal_entries (tenant_id, entry_date);

-- ============================================================================
-- 6. SALES INVOICES & CREDIT NOTES
-- ============================================================================
CREATE TABLE sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    journal_entry_id UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(64) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    customer_ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
    customer_gstin VARCHAR(15),
    place_of_supply_state_code VARCHAR(2) NOT NULL,
    is_interstate BOOLEAN NOT NULL,
    subtotal_amount NUMERIC(18, 2) NOT NULL,
    discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    cess_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    round_off_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(18, 2) NOT NULL,
    paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(18, 2) NOT NULL,
    status voucher_status_enum NOT NULL DEFAULT 'DRAFT',
    irn_hash VARCHAR(64), -- E-Invoice Invoice Reference Number
    irn_qr_code TEXT,
    eway_bill_number VARCHAR(16),
    terms_and_conditions TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_tenant_inv_num UNIQUE (tenant_id, financial_year_id, invoice_number)
);

CREATE TABLE sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    sales_invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES stock_batches(id) ON DELETE RESTRICT,
    hsn_sac_code VARCHAR(10) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit_rate NUMERIC(15, 4) NOT NULL CHECK (unit_rate >= 0),
    gross_amount NUMERIC(18, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(18, 2) NOT NULL,
    tax_rate_percent NUMERIC(5, 2) NOT NULL,
    cgst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    sgst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    igst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(18, 2) NOT NULL
);

-- ============================================================================
-- 7. PURCHASE BILLS & DEBIT NOTES
-- ============================================================================
CREATE TABLE purchase_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    journal_entry_id UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
    bill_number VARCHAR(64) NOT NULL,
    vendor_bill_number VARCHAR(64) NOT NULL,
    vendor_bill_date DATE NOT NULL,
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    supplier_ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
    supplier_gstin VARCHAR(15),
    is_reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    itc_eligibility VARCHAR(32) NOT NULL DEFAULT 'ELIGIBLE', -- 'ELIGIBLE', 'INELIGIBLE_17_5'
    subtotal_amount NUMERIC(18, 2) NOT NULL,
    taxable_amount NUMERIC(18, 2) NOT NULL,
    cgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    tds_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tds_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(18, 2) NOT NULL,
    paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(18, 2) NOT NULL,
    status voucher_status_enum NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_purchase_tenant_bill_num UNIQUE (tenant_id, financial_year_id, bill_number)
);

CREATE TABLE purchase_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    purchase_bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES stock_batches(id) ON DELETE RESTRICT,
    hsn_sac_code VARCHAR(10) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit_rate NUMERIC(15, 4) NOT NULL CHECK (unit_rate >= 0),
    taxable_amount NUMERIC(18, 2) NOT NULL,
    cgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(18, 2) NOT NULL
);

-- ============================================================================
-- 8. PAYMENTS, RECEIPTS & BILL-WISE ALLOCATIONS
-- ============================================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    journal_entry_id UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
    payment_number VARCHAR(64) NOT NULL,
    payment_date DATE NOT NULL,
    bank_cash_ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
    party_ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
    payment_mode VARCHAR(32) NOT NULL, -- 'NEFT', 'RTGS', 'CHEQUE', 'UPI', 'CASH'
    reference_number VARCHAR(64),
    total_amount NUMERIC(18, 2) NOT NULL CHECK (total_amount > 0),
    unallocated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    status voucher_status_enum NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payments_tenant_num UNIQUE (tenant_id, financial_year_id, payment_number)
);

CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    journal_entry_id UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(64) NOT NULL,
    receipt_date DATE NOT NULL,
    bank_cash_ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
    party_ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE RESTRICT,
    payment_mode VARCHAR(32) NOT NULL,
    reference_number VARCHAR(64),
    total_amount NUMERIC(18, 2) NOT NULL CHECK (total_amount > 0),
    unallocated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    status voucher_status_enum NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_receipts_tenant_num UNIQUE (tenant_id, financial_year_id, receipt_number)
);

CREATE TABLE bill_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    allocation_type VARCHAR(16) NOT NULL, -- 'AGAINST_REF', 'ADVANCE', 'ON_ACCOUNT'
    voucher_id UUID NOT NULL, -- Payment, Receipt, Sales Invoice, etc.
    voucher_type voucher_type_enum NOT NULL,
    target_document_id UUID, -- sales_invoices.id or purchase_bills.id
    target_document_type VARCHAR(32), -- 'SALES_INVOICE', 'PURCHASE_BILL'
    allocated_amount NUMERIC(18, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. PERPETUAL INVENTORY & STOCK MOVEMENTS
-- ============================================================================
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    movement_type stock_movement_type_enum NOT NULL,
    movement_date DATE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT,
    destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES stock_batches(id) ON DELETE RESTRICT,
    serial_number VARCHAR(64),
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 4) NOT NULL CHECK (unit_cost >= 0),
    total_cost NUMERIC(18, 2) NOT NULL,
    source_voucher_id UUID,
    source_voucher_type voucher_type_enum,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. BANKING, STATEMENTS & RECONCILIATION
-- ============================================================================
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    ledger_id UUID NOT NULL UNIQUE REFERENCES ledgers(id) ON DELETE RESTRICT,
    account_number VARCHAR(34) NOT NULL,
    account_type VARCHAR(32) NOT NULL, -- 'CURRENT', 'SAVINGS', 'OVERDRAFT'
    bank_name VARCHAR(128) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    branch_name VARCHAR(128),
    opening_reconciled_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    transaction_date DATE NOT NULL,
    value_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(64),
    entry_direction entry_direction_enum NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    closing_balance NUMERIC(18, 2),
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    reconciled_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. STATUTORY AUDIT LOG (MCA 2013 MANDATE - APPEND ONLY)
-- ============================================================================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    table_name VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(16) NOT NULL, -- 'INSERT', 'UPDATE', 'VOID', 'REVERSE'
    performed_by UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    old_state JSONB,
    new_state JSONB,
    diff JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Block UPDATE and DELETE on audit_logs at PostgreSQL engine level
CREATE OR REPLACE FUNCTION trg_block_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'MCA Compliance Violation: Audit logs are append-only and cannot be altered or removed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION trg_block_audit_tampering();

-- ============================================================================
-- 12. ATTACHMENTS & APPROVAL WORKFLOWS
-- ============================================================================
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    entity_type VARCHAR(64) NOT NULL, -- 'SALES_INVOICE', 'PURCHASE_BILL', 'PAYMENT'
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    voucher_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    comments TEXT,
    action_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. CONSTRAINTS & JOURNAL ATOMICITY TRIGGER
-- ============================================================================
-- A PostgreSQL trigger function validating that any POSTED journal entry 
-- strictly satisfies SUM(Debits) == SUM(Credits).
CREATE OR REPLACE FUNCTION trg_verify_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit NUMERIC(18, 2);
    v_total_credit NUMERIC(18, 2);
    v_line_count INT;
BEGIN
    -- Only evaluate when voucher status is changed to POSTED
    IF NEW.status = 'POSTED' THEN
        SELECT 
            COALESCE(SUM(CASE WHEN entry_direction = 'DEBIT' THEN amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN entry_direction = 'CREDIT' THEN amount ELSE 0 END), 0.00),
            COUNT(*)
        INTO v_total_debit, v_total_credit, v_line_count
        FROM journal_lines
        WHERE journal_entry_id = NEW.id;

        IF v_line_count < 2 THEN
            RAISE EXCEPTION 'Double-entry failure: Journal entry % requires at least 2 balanced lines.', NEW.id;
        END IF;

        IF v_total_debit <> v_total_credit THEN
            RAISE EXCEPTION 'Double-entry imbalance: Total debits (₹ %) do not equal total credits (₹ %) for entry %.', 
                v_total_debit, v_total_credit, NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_journal_balance_check
AFTER INSERT OR UPDATE OF status ON journal_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_verify_journal_balance();
```
