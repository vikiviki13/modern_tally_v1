# API DESIGN SPECIFICATION: Enterprise Financial Services API
**Platform:** Modern Accounting & ERP Operating System  
**Protocol:** RESTful JSON + Financial RPC Endpoints  
**Version:** `v1` (`/api/v1/...`)  
**Document:** API Design Specification (Phase 02 Deliverable)  
**Author:** Technical Lead & Senior API Architect

---

## 1. Global API Standards & Envelope

### 1.1 Mandatory Headers
| Header Name | Type | Description |
| :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT>` | Cryptographically signed user authentication token. |
| `X-Tenant-ID` | `UUID` | Active organization / company identifier. Validated against user membership. |
| `X-Idempotency-Key`| `UUID` | **Mandatory for all `POST`/`PUT` voucher endpoints.** Guarantees that duplicate requests do not post double financial transactions. |
| `If-Match` | `ETag` string | Optimistic concurrency control guard preventing overwrites. |

### 1.2 Standard Response Envelopes
#### Success Response (`200 OK`, `201 Created`):
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_01j982a7b819",
    "timestamp": "2026-09-30T04:24:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalRecords": 1420,
      "totalPages": 29
    }
  }
}
```

#### Error Response (`400`, `401`, `403`, `409`, `422`):
```json
{
  "success": false,
  "error": {
    "code": "DOUBLE_ENTRY_IMBALANCE",
    "message": "Debit lines total ₹ 12,500.00 does not equal Credit lines total ₹ 12,450.00.",
    "details": [
      {
        "field": "lines",
        "issue": "Unbalanced variance of ₹ 50.00 detected."
      }
    ],
    "timestamp": "2026-09-30T04:24:00.000Z"
  }
}
```

---

## 2. API Endpoints Catalog

### 2.1 Authentication & Multi-Tenant Setup
- `POST /api/v1/auth/login`: User credentials $\to$ returns JWT + tenant access list.
- `POST /api/v1/auth/switch-tenant`: Switches active company context.
- `GET /api/v1/companies/current`: Retrieves company legal master, GSTIN, PAN, and settings.
- `GET /api/v1/fiscal-years`: List of fiscal years with open/locked status.
- `POST /api/v1/fiscal-years/:id/lock-period`: Lock an accounting period against modifications.

### 2.2 Chart of Accounts & Master Ledgers
- `GET /api/v1/chart-of-accounts`: Retrieves the complete hierarchical tree of account groups and ledgers.
- `POST /api/v1/ledgers`: Create a new ledger (Supports rapid inline creation via `Alt+C`).
  ```json
  // Request
  {
    "name": "Reliance Petrochemicals Ltd",
    "groupId": "018f92a1-7c4a-71b3-8fa9-715d2a901f41",
    "openingBalance": 45000.00,
    "openingBalanceType": "DEBIT",
    "isBillWise": true,
    "partyDetails": {
      "partyType": "CUSTOMER",
      "gstin": "27AAACR1234F1Z5",
      "billingAddress": {
        "street": "Maker Chambers IV, Nariman Point",
        "city": "Mumbai",
        "stateCode": "27",
        "pincode": "400021"
      },
      "creditPeriodDays": 30
    }
  }
  ```
- `GET /api/v1/ledgers/:id/statement`: Returns chronological ledger card entries with running balances and drill-down references.

### 2.3 Financial Vouchers (The Transaction Engine)

#### General Journal Voucher (`F7`)
- `POST /api/v1/vouchers/journal`
  ```json
  // Request
  {
    "entryDate": "2026-09-30",
    "narration": "Depreciation on Office IT Equipment for Q2",
    "referenceNumber": "JV/2026/089",
    "lines": [
      {
        "ledgerId": "018f92a1-7c4a-71b3-8fa9-715d2a901f11", // Depreciation Expense
        "entryDirection": "DEBIT",
        "amount": 18500.00,
        "narration": "Depreciation at 15% WDV"
      },
      {
        "ledgerId": "018f92a1-7c4a-71b3-8fa9-715d2a901f22", // Accumulated Depreciation
        "entryDirection": "CREDIT",
        "amount": 18500.00,
        "narration": "Asset reduction"
      }
    ]
  }
  ```

#### Sales Invoice Voucher (`F8`)
- `POST /api/v1/vouchers/sales`
  - Validates GSTIN, computes CGST/SGST/IGST automatically, deducts warehouse stock, and atomically posts both sales document and double-entry journal.
  ```json
  // Request
  {
    "invoiceNumber": "INV/2026/0412",
    "invoiceDate": "2026-09-30",
    "dueDate": "2026-10-30",
    "customerLedgerId": "018f92a1-7c4a-71b3-8fa9-715d2a901f41",
    "placeOfSupplyStateCode": "27",
    "items": [
      {
        "productId": "018f92a1-7c4a-71b3-8fa9-715d2a901f99",
        "warehouseId": "018f92a1-7c4a-71b3-8fa9-715d2a901f88",
        "quantity": 10.0000,
        "unitRate": 2500.0000,
        "discountPercent": 5.00
      }
    ]
  }
  ```

#### Purchase Bill Voucher (`F9`)
- `POST /api/v1/vouchers/purchase`
  - Records vendor bill, verifies purchase order references, checks Reverse Charge (RCM), and handles ITC eligibility.

#### Payment (`F5`) & Receipt (`F6`) Vouchers with Bill-by-Bill Allocation
- `POST /api/v1/vouchers/receipt`
  ```json
  // Request
  {
    "receiptDate": "2026-09-30",
    "bankCashLedgerId": "018f92a1-7c4a-71b3-8fa9-715d2a901f33", // HDFC Current A/c
    "partyLedgerId": "018f92a1-7c4a-71b3-8fa9-715d2a901f41",    // Reliance Petrochem
    "paymentMode": "NEFT",
    "referenceNumber": "HDFCN262738910",
    "totalAmount": 50000.00,
    "allocations": [
      {
        "allocationType": "AGAINST_REF",
        "targetDocumentId": "018f92a1-7c4a-71b3-8fa9-715d2a901e77", // Inv #INV/2026/0412
        "targetDocumentType": "SALES_INVOICE",
        "allocatedAmount": 50000.00
      }
    ]
  }
  ```

### 2.4 Banking & Bank Reconciliation (BRS)
- `POST /api/v1/banking/statements/upload`: Ingests bank statements in CSV, OFX, or MT940 format.
- `GET /api/v1/banking/accounts/:id/reconciliation`: Returns side-by-side comparison of bank ledger transactions vs. bank statement records.
- `POST /api/v1/banking/reconcile`: Matches statement lines to book entries, stamping clearing dates.

### 2.5 Statutory GST & Compliance
- `GET /api/v1/gst/gstr-1?period=2026-09`: Generates GSTR-1 tables (B2B, B2CL, B2CS, CDNR, HSN summary) with official JSON schema output.
- `GET /api/v1/gst/gstr-3b?period=2026-09`: Computes summary tax payable and eligible Input Tax Credit (ITC).
- `POST /api/v1/gst/gstr-2b/reconcile`: Compares purchase register against vendor-filed GSTR-2B data to detect missing credits.

### 2.6 Financial Reporting & Drill-Down
- `GET /api/v1/reports/trial-balance?asOfDate=2026-09-30&detailed=true`: Full hierarchical tree Trial Balance with drill-down URLs.
- `GET /api/v1/reports/profit-and-loss?startDate=2026-04-01&endDate=2026-09-30`: Trading & Net Profit & Loss statement.
- `GET /api/v1/reports/balance-sheet?asOfDate=2026-09-30&format=HORIZONTAL`: T-Format or Schedule III Vertical Balance Sheet.
- `GET /api/v1/reports/day-book?date=2026-09-30`: Chronological audit log of all transactions posted on the date.
- `GET /api/v1/reports/aging?type=RECEIVABLES&asOfDate=2026-09-30`: Bill-by-bill aging schedule (0-30, 31-60, 61-90, 90+ days).

### 2.7 Statutory MCA Audit Trail
- `GET /api/v1/audit/logs?entityType=VOUCHER&entityId=:id`: Retrieves complete chronological edit log showing who made what modification, when, and from which IP.

### 2.8 AI Financial Intelligence (Gemini Powered)
- `POST /api/v1/ai/ask-books`: Natural language query engine (e.g. *"Show top 5 debtors with balances overdue over 60 days"*).
- `POST /api/v1/ai/narrate`: Auto-generates standard accounting narration from line item context.
- `GET /api/v1/ai/anomalies`: Analyzes posted transactions and flags unusual expense spikes or duplicate billing patterns.
