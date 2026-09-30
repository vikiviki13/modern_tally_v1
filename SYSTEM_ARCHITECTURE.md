# SYSTEM ARCHITECTURE: Next-Generation Enterprise Accounting & ERP
**Platform:** Cloud-Native TallyPrime Alternative  
**Philosophy:** *"Hide accounting complexity without hiding accounting control."*  
**Architecture Pattern:** Clean / Hexagonal (Ports & Adapters) with Domain-Driven Design (DDD)  
**Document:** System Architecture Specification (Phase 02 Deliverable)  
**Author:** Senior ERP Architect & Technical Lead

---

## 1. Architectural Principles

1. **Accounting Domain Independence:**
   The accounting kernel (double-entry invariants, ledger balances, debit/credit mechanics, period closing) is pure domain logic with **zero dependencies on UI frameworks, HTTP transport, or database ORMs**. The domain engine can be instantiated and tested in isolation.
2. **Deterministic Financial Truth:**
   All financial numbers are calculated deterministically from atomic, balanced journal entries. No UI component or API route may arbitrarily "set" or "edit" a ledger balance.
3. **Dual Ergonomics (Hybrid Client):**
   - High-throughput keyboard-first layer (hotkeys, `Enter`-advance, tabular entry grids).
   - Modern, reactive executive dashboard layer with real-time charts and visual workflows.
4. **Tenant Isolation by Construction:**
   Multi-tenancy is enforced at the database level (PostgreSQL Row-Level Security) and context middleware level. No query can execute without an explicit, validated `tenant_id`.
5. **Append-Only Statutory Auditability:**
   To comply with the Ministry of Corporate Affairs (MCA) mandate, transactions are never silently updated or purged. All modifications produce immutable audit events and contra-reversals.

---

## 2. High-Level Modular Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     PRESENTATION TIER                                   │
│  ┌───────────────────────────────┬────────────────────────────┬─────────────────────┐  │
│  │     Keyboard Ergonomics       │     Modern Web Views       │   Executive BI &    │  │
│  │ (Hotkeys F2-F10, Alt+G Omni,  │ (Invoices, Bills, Banking, │  Financial Reports  │  │
│  │  Alt+C Modal, Fast Grid)      │  Vouchers, Godown Master)  │  (P&L, B/S, Drill)  │  │
│  └───────────────────────────────┴────────────────────────────┴─────────────────────┘  │
│                                  React 19 SPA + Tailwind CSS v4                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTPS / JSON / Idempotency-Key
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                      API GATEWAY                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Express 4 / Node.js Router  •  Rate Limiter  •  CORS  •  Tenant Context Injector │  │
│  │  JWT Auth & RBAC Guard  •  Idempotency Middleware  •  Request Validator (Zod)    │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION SERVICES LAYER                              │
│  ┌─────────────────┬──────────────────┬─────────────────┬───────────────────────────┐  │
│  │ Voucher Posting │ Bill-by-Bill AR/ │ BRS & Statement │ GST Return Aggregator     │  │
│  │ Service         │ AP Allocation    │ Reconciliation  │ & Verification            │  │
│  ├─────────────────┼──────────────────┼─────────────────┼───────────────────────────┤  │
│  │ Inventory Cost  │ MCA Audit Trail  │ Fiscal Year     │ AI Analytics & Narration  │  │
│  │ & Stock Service │ Recorder         │ Closing Service │ Service (Gemini API)      │  │
│  └─────────────────┴──────────────────┴─────────────────┴───────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE DOMAIN KERNELS                                    │
│  ┌───────────────────────────────────┬──────────────────────────────────────────────┐  │
│  │       ACCOUNTING DOMAIN           │               INVENTORY DOMAIN               │  │
│  │  • Double-Entry Invariant Guard   │  • Valuation (FIFO / Weighted Average)       │  │
│  │  • Chart of Accounts Tree Engine  │  • Multi-Godown Stock Ledger                 │  │
│  │  • Period Lock & Freeze Policy    │  • Batch, Expiry & Serial Tracking           │  │
│  │  • Precise Decimal Math           │  • Stock Movement & Variance Journal         │  │
│  ├───────────────────────────────────┼──────────────────────────────────────────────┤  │
│  │           TAX DOMAIN              │               REPORTING DOMAIN               │  │
│  │  • Place of Supply (Intra/Inter)  │  • Trial Balance & Ledger Engine             │  │
│  │  • GSTIN Mod-36 Checksum Engine   │  • Profit & Loss (Trading & Net)             │  │
│  │  • RCM & ITC Eligibility Classifier│ • Balance Sheet (Vertical & T-Format)       │  │
│  │  • TDS/TCS Threshold Evaluator    │  • Cash Flow & Aging Analysis                │  │
│  └───────────────────────────────────┴──────────────────────────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              INFRASTRUCTURE & PERSISTENCE                              │
│  ┌──────────────────────────────────────┬───────────────────────────────────────────┐  │
│  │       PostgreSQL 16 Relational DB    │            Background & Storage           │  │
│  │  • Row-Level Security (RLS)          │  • Async Job Runner (BullMQ / Pg-Boss)    │  │
│  │  • Read-Replica / Partitioned Books  │  • Object Storage (Attachments & Invoices)│  │
│  │  • MCA Tamper-Proof Audit Triggers   │  • Redis Cache (Ledger Summaries)         │  │
│  └──────────────────────────────────────┴───────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Breakdown

### 3.1 Frontend Subsystem (UI / UX Engine)
- **Framework:** React 19 SPA powered by Vite.
- **State Architecture:**
  - *Server State:* SWR / TanStack Query pattern for caching ledger balances and async data.
  - *Client State:* Lightweight reactive store (Zustand) for active voucher draft, multi-tab state, and keyboard focus.
  - *Offline Resilience:* Local storage of active draft to prevent data loss if a tab is accidentally closed.
- **Ergonomics & Keyboard Manager:**
  - Global capture-phase hotkey listener intercepting functional keys (`F2` through `F10`), `Alt+G` (Omni-search "Go To"), `Alt+C` (In-flight master creation), and `Enter` key focus advancement.
  - High-density data grid featuring auto-row addition, keyboard arrows, and instantaneous inline ledger lookups.

### 3.2 API Gateway & Middleware Subsystem
- **Runtime:** Express 4 on Node.js / TypeScript.
- **Core Middlewares:**
  1. `TenantContextMiddleware`: Extracts `X-Tenant-ID` or decodes JWT organization claim; sets the tenant context on database connections (`SET LOCAL app.current_tenant_id = '...'`).
  2. `AuthenticationMiddleware`: Verifies bearer tokens and establishes user identity.
  3. `AuthorizationGuard`: Enforces role-based permissions (`RBAC`) before request reaches application handlers.
  4. `IdempotencyMiddleware`: Uses `X-Idempotency-Key` header with a Redis/in-memory cache to guarantee that network retries never post duplicate invoices or payments.
  5. `AuditContextMiddleware`: Enriches incoming requests with IP address, user-agent, and actor ID for the MCA audit trail.

### 3.3 Application Services Layer (Use Cases)
- Coordinates business workflows across domains without containing domain rules itself:
  - `VoucherPostingService`: Receives a sales invoice, validates period lock, commands `AccountingDomain` to generate journal lines, commands `InventoryDomain` to deplete stock, commands `TaxDomain` to calculate GST, commits atomically in a single DB transaction, and records an MCA audit event.
  - `BankReconciliationService`: Ingests bank statements, normalizes transaction records, runs heuristic auto-matching, and posts clearing dates.
  - `FinancialReportService`: Queries ledger entries, executes hierarchical aggregation across Chart of Accounts, and formats Trial Balance, P&L, or Balance Sheet.

### 3.4 Accounting Domain Kernel
- **Pure TypeScript Engine:** No database imports.
- **Invariants Enforced:**
  - Double-entry balance: $\sum \text{Debits} \equiv \sum \text{Credits}$ to zero decimal tolerance.
  - Period validation: Cannot post to locked or closed financial periods.
  - Directional correctness: Asset/Expense increases via Debit; Liability/Equity/Revenue increases via Credit.
  - Account integrity: Vouchers can only be posted to "posting-level" ledgers, never directly to summary parent groups.

### 3.5 Tax Domain Kernel
- Encapsulates statutory tax rules:
  - GST Place of Supply calculation matrix (Intra-state vs Inter-state).
  - Reverse Charge Mechanism (RCM) eligibility and auto-journal liability creation.
  - Section 17(5) Input Tax Credit (ITC) restriction checks.
  - TDS deduction engine (Sections 194C, 194J, 194Q) with threshold tracking across fiscal years.

### 3.6 Inventory Domain Kernel
- **Perpetual Inventory Tracking:**
  - Every physical stock movement produces both a quantitative stock ledger entry and a financial double-entry journal ($\text{Debit Inventory Asset}, \text{Credit COGS / Purchase Offset}$).
  - Valuation models: FIFO (Queue-based cost depletion) and Weighted Average Costing (dynamic moving average).
  - Multi-warehouse (Godown) balance reconciliation and batch shelf-life monitoring.

### 3.7 Background Workers & Async Processing
- Offloads non-blocking workloads:
  - Heavy multi-year financial report exports (PDF, Excel).
  - GSTR-1 / GSTR-3B statutory return JSON compilation.
  - Automated recurring voucher generation (monthly rent, depreciation schedules).
  - Bank statement parsing and AI anomaly detection scans.

### 3.8 External Integrations Subsystem
- **Statutory Gateways:** GST Portal (GSP/ASP APIs), E-Way Bill API, E-Invoice NIC portal.
- **Banking Feeds:** Open Banking APIs, MT940 / OFX parsers.
- **AI Intelligence:** `@google/genai` interface for executive financial summarization, narration generation, and anomaly detection.
