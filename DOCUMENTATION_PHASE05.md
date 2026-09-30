# PHASE 05 — COMPANY MANAGEMENT AND FINANCIAL CONFIGURATION
## Technical Completion & Verification Report

**Platform:** LedgerPulse ERP (TallyPrime Modern Cloud Replacement)  
**Philosophy:** *"Hide accounting complexity without hiding accounting control."*  
**Date:** September 30, 2026  
**Status:** **APPROVED & FULLY VERIFIED (12/12 Automated Invariant Tests Passing)**

---

## Executive Summary

Phase 05 establishes company lifecycle management, statutory entity provisioning, and deep multi-tenant financial configuration for LedgerPulse ERP. Built on the strict multi-tenant isolation model designed in Phase 02 and authenticated in Phase 04, this phase guarantees that every company operates within an airtight data boundary with independent financial years, accounting rules, tax profiles, and master charts of accounts.

---

## 1. Company Creation Specifications

Users can provision companies either through the 4-step **Guided Onboarding Wizard** or the REST API (`POST /api/companies`).

### Captured Parameters:
1. **Business Identity**:
   - `name`: Trade / Business name (minimum 2 characters).
   - `legalName`: Registered corporate name (e.g. `Tata Consultancy Services Limited`).
   - `businessType`: `PVT_LTD`, `PUBLIC_LTD`, `LLP`, `PARTNERSHIP`, `SOLE_PROPRIETORSHIP`, `TRUST`, `OTHER`.
   - `industry`: Industry classification (e.g., *Information Technology & Software*, *Manufacturing*, *Retail*).
2. **Statutory Jurisdiction & Addresses**:
   - `country`: Base country (default: `India`).
   - `state` & `stateCode`: Two-digit statutory state code (e.g., `27` for Maharashtra, `24` for Gujarat, `29` for Karnataka) required for Place of Supply tax determination.
   - `address`: Detailed street, commercial hub, city, and 6-digit postal pincode.
   - `gstin`: 15-character Goods and Services Tax Identification Number.
   - `pan`: 10-character Permanent Account Number, automatically derived from characters 3–12 of the GSTIN if omitted.
3. **Financial Calendar & Currency**:
   - `currency`: Base currency (`INR`, `USD`, `EUR`, `GBP`) with symbol (`₹`), decimal scale (`2`), and locale formatting (`en-IN`).
   - `financialYearStart`: Financial year inception date (`YYYY-MM-DD`, typically April 1 in India).
   - `financialYearEnd`: Financial year termination date (`YYYY-MM-DD`, typically March 31 in India).
   - `booksBeginningDate`: Operational opening date (`>= financialYearStart`).

---

## 2. Deep Financial Configuration Engine

The financial engine enables granular configuration across four accounting domains:

### A. Accounting Preferences (`AccountingPreferences`)
- **`inventoryValuation`**: `PERPETUAL_FIFO`, `PERPETUAL_WEIGHTED_AVG`, or `PERIODIC`.
- **`billWiseTracking`**: Enforces invoice-by-invoice outstanding reconciliation for debtors and creditors.
- **`preventNegativeCash`**: Blocks any cash voucher posting that would drive the physical cash balance below zero (statutory red flag).
- **`enforceCreditLimit`**: Warns or halts order processing if customer balance exceeds sanctioned credit limits.
- **`multiCurrency`**: Activates multi-currency forex exchange rate logging.

### B. Inventory Preferences (`InventoryPreferences`)
- **`multiGodown`**: Enables warehouse and godown-level stock transfers and batch tracking.
- **`batchTracking`**: Tracks manufacturing dates, expiry dates, and batch lot numbers.
- **`orderProcessing`**: Links Purchase Orders (PO) to Goods Receipt Notes (GRN) and Sales Orders (SO) to Delivery Challans.
- **`separateDiscountCol`**: Formats invoice lines with explicit discount percentages before GST calculation.

### C. Tax Preferences (`TaxPreferences`)
- **`gstRegistrationType`**: `REGULAR`, `COMPOSITION`, `SEZ_UNIT`, `OVERSEAS`, `UNREGISTERED`.
- **`eInvoicingApplicable`**: Mandates Rule 48(4) IRN generation and signed QR code embedding for B2B transactions.
- **`eWayBillApplicable`**: Triggers E-Way Bill requirement checks for consignments exceeding ₹50,000 threshold.
- **`rcmApplicable`**: Tracks Reverse Charge Mechanism tax liabilities for unregistered procurement.
- **`defaultGstRate`**: Standard tax rate fallback (default: 18%).

### D. Invoicing Preferences (`InvoicingPreferences`)
- **`voucherNumbering`**: `AUTO_SEQUENTIAL` or `MANUAL`.
- **`prefix` / `suffix`**: Configurable serial patterns (e.g., `INV/{FY}/0001`).
- **`startingNumber`**: Starting counter for newly provisioned financial years.
- **`defaultCreditDays`**: Commercial payment terms (default: 30 days).
- **`termsAndConditions`**: Standard printed boilerplate for commercial invoices.

---

## 3. Strict Company Data Isolation Architecture

To ensure zero cross-tenant contamination, LedgerPulse ERP applies a zero-trust multi-tenant isolation invariant:

1. **Explicit `tenantId` Foreign Key Partitioning**:
   Every ledger, journal entry, inventory movement, and transaction is strictly partitioned by `tenantId`.
2. **Repository-Level Filtering**:
   All database queries explicitly append `WHERE tenantId = :activeTenantId`.
3. **Audit Verification Engine (`/api/companies/:id/isolation-audit`)**:
   Provides programmatic confirmation that queries executed under Company A return exactly 0 records belonging to Company B, C, or any foreign tenant.
4. **Session Tenant Context**:
   When a user switches company (`POST /api/auth/switch-tenant`), their JWT session is re-anchored to the target tenant, guaranteeing that all subsequent API calls are bound to that company's partition.

---

## 4. Guided Onboarding Experience

The onboarding experience (`CompanyOnboardingWizard.tsx`) implements progressive disclosure across 4 coherent steps:
- **Step 1: Entity Identity**: Captures trade name, legal entity name, corporate structure, and industry.
- **Step 2: Statutory & Jurisdiction**: Handles state selection, address, GSTIN formatting, and PAN derivation.
- **Step 3: Financial Calendar & Base Currency**: Configures financial year start/end, books inception date, and currency symbol.
- **Step 4: Accounting & Invoicing Preferences**: Sets inventory valuation method, bill-wise tracking, credit days, and e-invoicing defaults.

---

## 5. Automated Test Suite & Validation Results

The Phase 05 test suite (`tests/company.test.ts`) verifies 12 core invariant tests:

```bash
======================================================
 RUNNING PHASE 05 COMPANY & FINANCIAL CONFIG TESTS
======================================================
[1] ✓ PASS [Company Creation] Company Creation: Successfully creates company with complete financial configuration (4.99ms)
[2] ✓ PASS [Validation] Validation: Rejects missing business name (0.11ms)
[3] ✓ PASS [Validation] Validation: Rejects invalid Financial Year dates (End <= Start) (0.06ms)
[4] ✓ PASS [Validation] Validation: Rejects Books Beginning Date earlier than Financial Year Start (0.05ms)
[5] ✓ PASS [Statutory Validation] Statutory Validation: Rejects malformed GSTIN format (0.14ms)
[6] ✓ PASS [Statutory Validation] Statutory Validation: Rejects mismatch between state code and GSTIN prefix (0.09ms)
[7] ✓ PASS [Statutory Validation] Statutory Validation: Rejects duplicate GSTIN registration (0.07ms)
[8] ✓ PASS [Configuration Updates] Configuration: Updates accounting & invoicing preferences and period lock (1.47ms)
[9] ✓ PASS [Multi-Tenancy] Multi-Tenancy: Creates second distinct company (Reliance Retail) for isolation tests (3.01ms)
[10] ✓ PASS [Company Switching] Company Switching: User context seamlessly switches active tenant (2.50ms)
[11] ✓ PASS [Company Isolation] Company Isolation: Data created in Company A is strictly isolated from Company B (2.93ms)
[12] ✓ PASS [Company Isolation] Company Isolation: Audit confirms 100% boundary with zero cross-tenant leakage (0.26ms)
------------------------------------------------------
 Summary: 12/12 tests passed (100%)
======================================================
```

---

## 6. Recommended Next Phase: Phase 06 — Chart of Accounts & General Ledger Core Engine

With company provisioning and financial configuration complete, the next phase will implement:
1. **The 28 Standard Tally Account Groups**: 15 Primary groups (Capital Account, Current Assets, Current Liabilities, Loans, Fixed Assets, Investments, Suspense, Branch/Divisions, Misc. Expenses) and 13 Secondary sub-groups.
2. **Chart of Accounts Tree Engine**: Parent-child traversal, hierarchical balance rollups, and circular reference prevention.
3. **Master Ledger Creation**: Opening balance recording with `DR`/`CR` validation, group assignment, and statutory HSN/SAC & GSTIN tagging.
4. **Trial Balance Generation**: Real-time balance rollup validating total Debits = total Credits across all active ledgers.
