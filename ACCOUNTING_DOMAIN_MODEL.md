# ACCOUNTING DOMAIN MODEL: Domain-Driven Design (DDD) Core
**Platform:** Next-Gen Enterprise ERP & Accounting System  
**Pattern:** Domain-Driven Design (DDD) & Event-Driven Architecture  
**Philosophy:** *"Hide accounting complexity without hiding accounting control."*  
**Document:** Accounting Domain Model (Phase 02 Deliverable)  
**Author:** Accounting Domain Expert & Senior Systems Architect

---

## 1. Bounded Contexts Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               BOUNDED CONTEXTS                              │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│ 1. GENERAL LEDGER   │ 2. ACCOUNTS         │ 3. ACCOUNTS PAYABLE (AP)        │
│    CONTEXT (GL)     │    RECEIVABLE (AR)  │ • Vendor Bills & Debit Notes    │
│ • Chart of Accounts │ • Sales Invoices    │ • Three-Way PO Matching         │
│ • Journal Entries   │ • Credit Notes      │ • Bill-by-Bill Vendor Aging     │
│ • Period Locks      │ • Customer Aging    │ • TDS Deduction on Bills        │
│ • Double-Entry Invs │ • Bill Allocations  │                                 │
├─────────────────────┼─────────────────────┼─────────────────────────────────┤
│ 4. INVENTORY &      │ 5. CASH & BANKING   │ 6. STATUTORY & TAX              │
│    WAREHOUSING      │ • Multi-mode Payouts│ • Place of Supply Engine        │
│ • Stock Valuation   │ • Customer Receipts │ • GST Returns (1, 3B, 2B)       │
│ • Godown Transfers  │ • Contra Vouchers   │ • RCM & ITC Rules               │
│ • Batch/Serial Move │ • Bank Recon (BRS)  │ • GSTIN Mod-36 Validator        │
├─────────────────────┴─────────────────────┴─────────────────────────────────┤
│ 7. AUDIT & STATUTORY GOVERNANCE                                             │
│ • Append-only MCA Audit Trail  • Tamper-Evident Event Log  • Approvals      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ubiquitous Language & Core Value Objects

Value objects are immutable, identity-less domain constructs that encapsulate business rules and validation:

### 2.1 `Money`
```typescript
interface Money {
  readonly amount: number; // Stored in base currency or minor units
  readonly currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  readonly precision: number; // Default: 2 decimal places

  add(other: Money): Money;
  subtract(other: Money): Money;
  multiply(factor: number): Money;
  isZero(): boolean;
  equals(other: Money): boolean;
}
```
*Rule:* Arithmetic operations between different currencies without an explicit `ExchangeRate` are rejected at compile time.

### 2.2 `GSTIN`
- Represents a 15-character Indian Goods and Services Tax Identification Number.
- Structure: `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`.
- Embedded logic:
  - Validates state code (characters 1–2).
  - Validates embedded PAN (characters 3–12).
  - Calculates and verifies Mod-36 ISO-7064 check-digit algorithm.

### 2.3 `HSNCode` & `SACCode`
- 2 to 8 digit code classifying goods (HSN) and services (SAC).
- Determines statutory GST rates (0%, 5%, 12%, 18%, 28%) and Cess.

### 2.4 `AccountingPeriod` & `FiscalYear`
- Value object defining valid calendar windows (e.g., April 1 to March 31).
- Invariant: Transactions with `entryDate < period.startDate` or `entryDate > period.endDate` are rejected.

---

## 3. Aggregates & Domain Entities

### 3.1 Aggregate Root: `JournalEntry`
The fundamental transaction unit of the General Ledger:
- **Root Entity:** `JournalEntry`
- **Internal Entities:** `JournalLine[]`
- **Invariants Enforced by Aggregate:**
  1. **Luca Pacioli Invariant:**
     $$\sum \text{Debit Lines} = \sum \text{Credit Lines}$$
     The aggregate root cannot transition to `POSTED` status if $\Delta \ne 0.00$.
  2. **Minimum Line Invariant:** A journal entry must possess at least two distinct lines.
  3. **Leaf Ledger Invariant:** Journal lines cannot reference parent summary groups; they must reference valid posting ledgers.
  4. **Period Open Invariant:** The entry date must fall within an open, unlocked accounting period.
  5. **Post-State Immutability:** Once marked `POSTED`, neither the entry date nor any line item can be mutated directly. Any correction requires a compensating `ReversalJournalEntry`.

### 3.2 Aggregate Root: `SalesInvoice`
- **Root Entity:** `SalesInvoice`
- **Internal Entities:** `SalesInvoiceItem[]`, `TaxAllocation[]`
- **Domain Responsibilities:**
  - Calculates line item taxable values: $\text{Quantity} \times \text{Rate} - \text{Discount}$.
  - Determines tax structure based on Seller State vs. Buyer State (Place of Supply).
  - Computes statutory round-off to the nearest integer rupee.
  - Commands the General Ledger to post a corresponding `JournalEntry`.
  - Commands the Inventory Context to emit stock depletion events.

### 3.3 Aggregate Root: `Ledger`
- Represents an account in the Chart of Accounts.
- **Attributes:** Name, Code, Parent Group, Classification (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`), Normal Balance Direction (`DEBIT` or `CREDIT`).
- **Core Domain Logic:**
  - Derives running balance:
    $$\text{Balance} = \text{Opening Balance} + \sum \text{Debits} - \sum \text{Credits}$$
    *(Inverted for Credit-normal accounts like Liabilities/Revenue).*
  - **No Mutable Balance Attribute:** The ledger aggregate never persists an editable balance field; balance is always a computed projection of underlying posted journal lines.

---

## 4. Domain Events & Event Storming

All major accounting state changes emit domain events, enabling reactive decoupling across contexts:

| Domain Event | Emitted By | Handlers & Actions Triggered |
| :--- | :--- | :--- |
| `VoucherDraftCreatedEvent` | Voucher Aggregate | Saves draft state; no GL or stock impact. |
| `VoucherPostedEvent` | Voucher Aggregate | 1. Generates balanced `JournalLines` in GL.<br>2. Updates stock registers via Inventory context.<br>3. Generates append-only MCA audit log record.<br>4. Updates customer/vendor outstanding bill ledger. |
| `VoucherVoidedEvent` | Voucher Aggregate | 1. Generates compensating reversal journal lines.<br>2. Restores depleted inventory.<br>3. Flags MCA audit log with void reason. |
| `BankStatementImportedEvent` | Banking Context | Triggers heuristic reconciliation matching engine against unpresented cheques and receipts. |
| `PeriodLockedEvent` | General Ledger Context | Closes date window; blocks any new voucher creation or backdating. |
| `StockDepletedEvent` | Inventory Context | Evaluates FIFO unit cost and generates COGS journal entry. |

---

## 5. Golden Rules of Accounting Implementation

The domain model mathematically codifies the three classical Golden Rules of Double-Entry Bookkeeping:

1. **Personal Accounts (Debtors, Creditors, Banks, Capital):**
   - *Rule:* Debit the Receiver, Credit the Giver.
   - *Implementation:* Customer payment $\to$ Debit Bank (Receiver), Credit Customer Ledger (Giver).
2. **Real Accounts (Cash, Inventory, Machinery, Buildings, Land):**
   - *Rule:* Debit what comes in, Credit what goes out.
   - *Implementation:* Cash Purchase $\to$ Debit Inventory/Asset (Comes in), Credit Cash (Goes out).
3. **Nominal Accounts (Sales, Purchases, Salaries, Rent, Depreciation):**
   - *Rule:* Debit all expenses and losses, Credit all incomes and gains.
   - *Implementation:* Invoicing $\to$ Debit Customer / Bank, Credit Sales Account (Income).
