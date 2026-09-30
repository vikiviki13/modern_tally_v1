# IMPLEMENTATION ROADMAP: TallyPrime Modern Cloud Alternative
**Platform:** Modern Accounting & Enterprise Business Management System  
**Product Philosophy:** *"Hide accounting complexity without hiding accounting control."*  
**Architecture:** React 19 + TypeScript + Tailwind CSS v4 + Express + Gemini AI  
**Document:** Phased Engineering Execution Roadmap (v1.0.0)

---

## 1. Roadmap Overview & Strategic Horizon

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           ARCHITECTURE HORIZON                                │
├───────────────┬───────────────┬───────────────┬───────────────┬───────────────┤
│   PHASE 02    │   PHASE 03    │   PHASE 04    │   PHASE 05    │   PHASE 06    │
│ Double-Entry  │ Inventory &   │ Sales &       │ Banking,      │ GST &         │
│ Core & CoA    │ Warehouses    │ Purchases     │ Payments, BRS │ Compliance    │
├───────────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│   PHASE 07    │   PHASE 08    │   PHASE 09    │   PHASE 10    │   PHASE 11    │
│ Financial     │ Keyboard UX   │ Gemini AI     │ Migration,    │ Production    │
│ Reporting     │ & Alt+G Omni  │ Insights      │ RBAC, Audit   │ Verification  │
└───────────────┴───────────────┴───────────────┴───────────────┴───────────────┘
```

---

## 2. Phase-by-Phase Execution Plan

### PHASE 02: Core Accounting Engine & Double-Entry Foundation
**Focus:** Pure domain model, double-entry mathematical invariants, Chart of Accounts tree, and transactional persistence.
- **Key Deliverables:**
  - `src/types/accounting.ts`: Full TypeScript domain models for Ledgers, Groups, Vouchers, Journal Entries, Party Masters, and Currencies.
  - `src/core/math.ts`: Arbitrary-precision decimal and currency arithmetic engine (preventing IEEE 754 float drift).
  - `src/core/chartOfAccounts.ts`: Seeded 28 standard Indian & International accounting groups with multi-level parent-child tree hierarchy.
  - `src/core/journalEngine.ts`: Atomic voucher posting engine with $\sum \text{Debit} = \sum \text{Credit}$ validation, running balance recalculation, and sequence numbering.
  - `src/core/auditEngine.ts`: MCA-compliant immutable audit log recorder capturing every state mutation with timestamp and user ID.
  - State management store (Zustand or robust reactive context) with IndexedDB/LocalStorage persistence.
- **Definition of Done (DoD):**
  - Ledgers can be created and queried in sub-millisecond time.
  - Multi-line balanced journal entries post cleanly to General Ledger.
  - Attempting to post an unbalanced voucher throws an explicit invariant validation error.

---

### PHASE 03: Inventory & Multi-Warehouse Management
**Focus:** Stock item masters, units of measure, multi-godown allocation, batch/serial tracking, and real-time inventory valuation.
- **Key Deliverables:**
  - `src/types/inventory.ts`: Stock Item, Stock Group, Unit of Measure (Simple/Compound), Godown, Batch, Serial models.
  - `src/core/inventoryValuation.ts`: FIFO and Weighted Average cost calculation engine; automatic COGS ledger journal generator.
  - Stock Journal vouchers: Inter-warehouse transfers, physical stock adjustment, wastage/scrap recording.
  - Batch & Expiry tracking with near-expiry warning alerts.
- **Definition of Done (DoD):**
  - Item quantities update automatically across godowns upon purchase and sale.
  - Stock valuation report reflects accurate FIFO or Weighted Average inventory value.

---

### PHASE 04: Sales & Purchase Workflows
**Focus:** Invoicing, Purchase Bills, Quotations, Orders, Credit/Debit Notes, and Bill-by-Bill AR/AP tracking.
- **Key Deliverables:**
  - `src/components/vouchers/SalesInvoice.tsx`: High-speed sales invoicing with auto-calculated discounts, taxes, and freight.
  - `src/components/vouchers/PurchaseBill.tsx`: Vendor billing with PO matching, ITC classification, and TDS deduction.
  - Bill-wise Allocation System: `New Ref`, `Agst Ref`, `Advance`, and `On Account` settlement.
  - Receivables & Payables Aging schedules (0-30, 31-60, 61-90, 90+ days).
  - Professional Invoice Printing & PDF generator with UPI QR code and statutory declarations.
- **Definition of Done (DoD):**
  - Invoices generate appropriate double-entry debits to Debtors and credits to Sales and GST Duties & Taxes.
  - Customer outstanding balance matches unpaid bill-wise ledger balances.

---

### PHASE 05: Payments, Receipts, Treasury & Bank Reconciliation (BRS)
**Focus:** Multi-mode cash/bank settlements, contra fund transfers, cheque registers, and automated bank statement reconciliation.
- **Key Deliverables:**
  - Payment Voucher (`F5`) and Receipt Voucher (`F6`) interfaces with instant bill-by-bill knockoff popup.
  - Contra Voucher (`F4`) for cash-to-bank and bank-to-bank transfers.
  - Bank Reconciliation Statement (BRS) module:
    - MT940 / CSV bank statement upload and parser.
    - Automated transaction matcher (date $\pm 3$ days, amount, reference/UTR).
    - Unpresented cheques and unrealized receipts register.
  - Cheque register with clearing dates and bounced cheque reversal journal workflow.
- **Definition of Done (DoD):**
  - Bank book balance reconciles with passbook statement balance.
  - Payments against open invoices update outstanding aging in real time.

---

### PHASE 06: Statutory GST & Compliance Engine
**Focus:** Automated tax determination, GSTIN verification, Place of Supply engine, and official return formats (GSTR-1, GSTR-3B, GSTR-2B).
- **Key Deliverables:**
  - Real-time Place of Supply tax split: Intra-state (CGST + SGST) vs. Inter-state (IGST).
  - 15-character GSTIN Mod-36 checksum validator.
  - Reverse Charge Mechanism (RCM) handling with automated self-invoicing.
  - Statutory return generation:
    - **GSTR-1:** Tables 4 (B2B), 5 (B2CL), 7 (B2CS), 9B (CDNR), 12 (HSN Summary), 13 (Docs).
    - **GSTR-3B:** Inward and outward summary, ITC eligibility, tax liability settlement.
    - **GSTR-2B:** Statement reconciliation tool to flag missing vendor ITC.
- **Definition of Done (DoD):**
  - All invoices produce correct tax ledgers automatically without manual tax selection.
  - GSTR-1 and GSTR-3B summaries exportable in official JSON format.

---

### PHASE 07: Financial Reporting & Drill-Down Analytics
**Focus:** Executive dashboards, statutory balance sheets, profit & loss, trial balance, and interactive ledger drill-downs.
- **Key Deliverables:**
  - **Trial Balance:** Multi-tier collapsible tree with net debit/credit verification.
  - **Profit & Loss Account:** Trading Account (Gross Profit) and Net Profit with comparative period views.
  - **Balance Sheet:** Both Horizontal (T-Format traditional format) and Vertical (Schedule III Corporate format).
  - **Cash Flow Statement:** Operating, Investing, and Financing flows.
  - **Day Book & Cash Book:** Chronological transaction journal with quick filtering by voucher type, amount, or party.
  - Interactive drill-down: Click any figure in Balance Sheet $\to$ Group Summary $\to$ Ledger Account $\to$ Monthly Breakdown $\to$ Source Voucher.
- **Definition of Done (DoD):**
  - Financial statements balance to the penny.
  - Users can drill down from the Balance Sheet all the way to an individual line item in under 3 clicks.

---

### PHASE 08: Keyboard Navigation & Power-User Ergonomics
**Focus:** Keyboard-first efficiency matching Tally's speed while preserving modern web design aesthetics.
- **Key Deliverables:**
  - **Omni-Search "Go To" Bar (`Alt+G` / `Cmd+K`):** Jump to any report, ledger, voucher, or action from anywhere in $\le 2$ keystrokes.
  - Global Hotkey Manager: Intercept and map `F2` (Date), `F4` (Contra), `F5` (Payment), `F6` (Receipt), `F7` (Journal), `F8` (Sales), `F9` (Purchase), `Esc` (Back/Close).
  - Rapid Data Entry Grid: Enter-to-next-field navigation, Tab support, and automatic row creation.
  - `Alt+C` In-Flight Master Creation: Create new customer, vendor, or stock item without losing active voucher form state.
  - "Dense Accounting Mode" vs. "Spacious Modern Mode" UI toggle.
- **Definition of Done (DoD):**
  - An accountant can create and save a complete 5-line sales invoice using only the keyboard in under 20 seconds.

---

### PHASE 09: AI Intelligence & Gemini Automation
**Focus:** Embedded financial intelligence using `@google/genai` to augment accounting tasks.
- **Key Deliverables:**
  - **"Ask Books" Natural Language Query:** Convert plain English questions into live ledger analytics.
  - **Autonomous Anomaly Detection:** Scans vouchers for duplicate bill numbers, margin dips, abnormal expense spikes, or tax code mismatches.
  - **Smart Narration Assistant:** Generates formal, audit-ready accounting narrations automatically from line-item context.
  - **Predictive Cash Flow Forecasting:** 30/60/90-day cash position predictions based on historical customer settlement patterns.
- **Definition of Done (DoD):**
  - "Ask Books" answers complex multi-ledger questions accurately without hallucinating ledger figures.
  - Smart narration generates accurate, grammatically correct accounting narrations with one click.

---

### PHASE 10: Security, RBAC, Data Migration & Compliance Verification
**Focus:** Role-based permissions, period locking, Tally XML import, backup/restore, and statutory MCA audit verification.
- **Key Deliverables:**
  - Role-Based Access Control (Super Admin, CA/Auditor, Accountant, Sales, Inventory Clerk).
  - Period Lock & Freeze Date controls.
  - Data Migration Tool: Import Tally XML masters and Day Book transactions; CSV bulk import for ledgers and items.
  - Full company database export/backup to encrypted JSON and seamless restore.
  - Non-tamperable MCA audit trail verification screen.
- **Definition of Done (DoD):**
  - Users with "Sales" role cannot view P&L or purchase costs.
  - Tally XML import successfully recreates Chart of Accounts and historical vouchers.

---

## 3. Recommended Next Phase: PHASE 02

### Rationale:
Any modern accounting software will collapse if its foundation is weak. Building UI components or reports without a mathematically verified double-entry engine and Chart of Accounts results in rework and data corruption.

**Immediate Objectives for Phase 02:**
1. Establish the domain type system (`src/types/accounting.ts`) covering Ledgers, Groups, Vouchers, Entries, Currencies, and Parties.
2. Build the precise decimal math engine (`src/core/math.ts`) to eliminate floating-point errors.
3. Seed the standard 28-group Chart of Accounts hierarchy (`src/core/chartOfAccounts.ts`).
4. Implement the Double-Entry Journal Engine (`src/core/journalEngine.ts`) with balance validation, running balances, and immutable MCA audit logging.
5. Create the reactive state store and persistence layer with initial sample company data so all subsequent modules have verified ground truth.
