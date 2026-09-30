# PRODUCT REQUIREMENTS DOCUMENT (PRD)
**Product Name:** Modern Enterprise Accounting & Business Operating System (TallyPrime Alternative)  
**Core Thesis:** *"Hide accounting complexity without hiding accounting control."*  
**Document Status:** Complete Specification (v1.0.0)

---

## 1. Vision & Design Philosophy

Traditional accounting software (e.g., TallyPrime) forced a painful compromise: accountants loved the blistering keyboard data-entry speed, but business owners, founders, and department managers were alienated by its archaic DOS-era navigation, cryptic menus, complex configuration screens, and zero visual analytics. Conversely, modern SaaS accounting apps hide double-entry so deeply that Chartered Accountants (CAs) and auditors cannot verify or control the underlying journal entries.

Our platform eliminates this false dilemma:
1. **Dual Ergonomics:**
   - **For Accountants / CAs:** Full keyboard navigation (`Enter` to advance, `Esc` to back out, `Alt+G` omni-search, `F4`-`F10` voucher toggles, debit/credit split views, raw journal inspection).
   - **For Business Owners & Operators:** Beautiful invoices, real-time dashboards, margin analytics, automated GST filing prep, one-click payment links, and natural-language AI queries.
2. **Double-Entry Ground Truth:** No "magic" balances. Every business event (sale, bill, receipt, discount, bad debt, inventory write-off) produces an immutable, balanced double-entry voucher in the General Ledger.
3. **Speed of Light UI:** Sub-100ms response times on ledger searches, instant report recalculation, and zero-latency voucher row additions.

---

## 2. Core Functional Requirements by Module

### 2.1 Accounting Engine & Double-Entry Core
- **Mathematical Invariant:** $\sum \text{Debits} = \sum \text{Credits}$ must hold for every voucher transaction.
- **Precision:** Zero floating-point drift. All calculations must use precise decimal arithmetic (base-10 scaled integers / 4 decimal places for unit prices, 2 decimal places for financial reporting).
- **Voucher Auto-Sequencing:** Multi-branch, multi-fiscal-year prefix numbering (e.g., `INV/2026-27/0001`, `PAY/26/0142`) with customizable reset policies (Annual, Monthly, or Continuous).
- **Backdating Controls & Locking:** Configurable lock dates preventing modification of closed accounting periods (end of month / financial year closing).
- **Provisional & Draft State:** Ability to stage vouchers as "Draft" without affecting the General Ledger, then approve/post with a single keystroke.

### 2.2 Chart of Accounts (CoA) & Master Ledgers
- **Hierarchical Tree Structure:** Support unlimited nesting of groups and ledgers.
- **Pre-seeded Standard Indian & International GAAP Groups:**
  - **Assets:** Current Assets (Bank Accounts, Cash-in-Hand, Sundry Debtors, Stock-in-Hand, Loans & Advances, Deposits), Fixed Assets (Tangible, Intangible, Capital Work-in-Progress), Investments.
  - **Liabilities:** Capital Account (Owner's Equity, Reserves & Surplus), Current Liabilities (Sundry Creditors, Duties & Taxes, Provisions), Loans (Secured, Unsecured, Bank OD).
  - **Income:** Direct Income (Sales, Job Work), Indirect Income (Interest Received, Discount Received, Rental Income).
  - **Expenses:** Direct Expenses (Freight Inward, Direct Wages, Manufacturing Power), Indirect Expenses (Salaries, Rent, Depreciation, Office Supplies, Advertising).
- **Ledger Master Attributes:**
  - Name, Alias / Code, Parent Group, Opening Balance (Debit/Credit), Date of Opening Balance.
  - Party Masters: Legal Business Name, Trade Name, GSTIN, PAN, TAN, MSME Registration Udyam Number, Credit Limit, Credit Period (Days), Bill-by-Bill Bill-wise tracking.
  - Address details with State Code and Country (essential for Place of Supply).
  - Bank Account details: Account Number, IFSC Code, Bank Name, Branch, Swift Code.

### 2.3 Sales & Accounts Receivable (AR)
- **Document Pipeline:** Quotation $\rightarrow$ Proforma Invoice $\rightarrow$ Sales Order $\rightarrow$ Delivery Challan $\rightarrow$ Tax Invoice $\rightarrow$ Credit Note.
- **Bill-wise Allocation:** Track invoices by unique reference numbers (`Agst Ref`, `New Ref`, `Advance`, `On Account`). Automatic calculation of overdue days and interest.
- **Item Invoice vs. Accounting Invoice:**
  - *Item Invoice:* Includes SKU, HSN, Quantity, Unit, Rate, Discount %, Taxable Value, Tax Slabs.
  - *Accounting Invoice:* For service businesses without physical inventory (Direct ledger allocation).
- **Multi-Rate Tax Splits:** Automatic line-item level CGST, SGST, IGST, and Cess computation based on customer's state vs. company's state.
- **TCS (Tax Collected at Source):** Automatic trigger when customer turnover exceeds statutory thresholds (e.g., Sec 206C(1H)).
- **Professional PDF Generation:** Clean, branded invoices with QR codes (UPI payment & e-Invoice IRN), company logo, bank transfer details, and statutory declarations.

### 2.4 Purchase & Accounts Payable (AP)
- **Document Pipeline:** Purchase Requisition $\rightarrow$ Purchase Order $\rightarrow$ Goods Receipt Note (GRN) $\rightarrow$ Purchase Bill $\rightarrow$ Debit Note.
- **Vendor Bill Matching:** Three-way matching (PO vs. GRN vs. Vendor Bill) to detect quantity discrepancies or price variances.
- **ITC (Input Tax Credit) Eligibility:** Classification of purchases as *Eligible ITC*, *Ineligible ITC* (Sec 17(5)), *Capital Goods ITC*, or *RCM (Reverse Charge)*.
- **TDS Deduction on Bills:** Automated deduction under Sec 194Q / 194C / 194J with ledger posting to `TDS Payable`.
- **Vendor Aging Analysis:** Aging buckets (0-30, 31-60, 61-90, 90+ days) with vendor credit terms enforcement.

### 2.5 Payments & Receipts (Cash & Treasury)
- **Multi-Mode Support:** Cash, Cheque, NEFT/RTGS, IMPS, UPI, Demand Draft, Credit Card.
- **Bill-by-Bill Settlement:** When selecting a Debtor/Creditor, pop up open unpaid bills with outstanding balances; allocate payment against specific bills or apply auto-FIFO.
- **Discount & Rounding:** Instant cash discount ledger debit/credit allocation and round-off auto-calculation.
- **Cheque Management:** Cheque number, cheque date, clearing date, bounced cheque reversal workflow.

### 2.6 Journal & Contra Entries
- **General Journal:** Multi-line debits and credits for adjustments, accruals, prepayments, depreciation, year-end closings, and opening balance entries.
- **Contra Vouchers:** Dedicated optimized interface for Cash deposit to Bank, Cash withdrawal from Bank, and Inter-bank fund transfers.
- **Cost Center Allocations:** Tagging expenses/incomes to specific Cost Centers (Projects, Branches, Salespersons, Departments).

### 2.7 Inventory & Multi-Warehouse Management
- **Hierarchical Classification:** Stock Categories $\rightarrow$ Stock Groups $\rightarrow$ Stock Items.
- **Units of Measure (UOM):** Simple (Nos, Kgs, Ltrs, Meters) and Compound (1 Box = 24 Pcs, 1 Carton = 12 Boxes).
- **Multi-Location / Godowns:** Unlimited warehouses, stores, rack positions, and transit locations. Inter-godown transfer vouchers.
- **Valuation Methods:** FIFO, Weighted Average, Last Purchase Price, Standard Cost.
- **Batch, Expiry & Serial Tracking:**
  - Pharmaceutical/FMCG: Batch Number, Manufacturing Date, Expiry Date with near-expiry alerts.
  - Electronics/Equipment: Individual Serial Number tracking per unit sold/purchased.
- **Reorder Levels & Low Stock Alerts:** Minimum order quantities, lead time buffer warnings.
- **Physical Stock Verification:** Stock adjustment / Physical Stock Voucher to reconcile actual counted inventory with book inventory.

### 2.8 Banking & Bank Reconciliation (BRS)
- **Bank Reconciliation Statement (BRS):** Reconcile book balance with bank passbook balance.
- **Statement Import:** Native parser for bank statements in CSV, Excel, and MT940 formats.
- **Smart Auto-Match:** Matches transactions based on Date window ($\pm 3$ days), Exact Amount, and Cheque/UTR reference.
- **Unpresented Cheques & Unrealized Credits:** Automatic segregation of items present in books but not cleared by bank, and vice versa.

### 2.9 GST Compliance Engine (Statutory Engine)
- **GSTIN Validation:** Standard 15-character structure with state code check and checksum algorithm.
- **Place of Supply Logic:**
  - Seller State = Buyer State $\implies$ CGST + SGST (or UTGST).
  - Seller State $\ne$ Buyer State $\implies$ IGST.
  - Special Economic Zone (SEZ) / Export $\implies$ Zero-rated or IGST with refund.
- **Reverse Charge Mechanism (RCM):** Auto-generation of self-invoices and dual tax liability/credit entries.
- **Statutory Returns Prep:**
  - **GSTR-1:** Export ready for B2B Invoices (4A), B2C Large (5A), B2C Small (7), Credit/Debit Notes (9B), HSN Summary (12), Document Issued (13).
  - **GSTR-3B:** Inward and outward summary computation with tax payable and ITC available.
  - **GSTR-2B Reconciliation:** Upload 2B JSON to identify vendors who haven't filed their returns, preventing ITC loss.

### 2.10 Comprehensive Financial Reports
- **Trial Balance:** Hierarchical drill-down from primary group down to individual voucher lines.
- **Profit & Loss Account:** Trading account (Gross Profit) and Income Statement (Net Profit) with period-over-period comparison.
- **Balance Sheet:** Both Horizontal (T-Format traditional Indian accounting layout) and Vertical (Schedule III Corporate format) presentations.
- **Cash Flow Statement:** Operating, Investing, and Financing activities (Direct and Indirect methods).
- **Day Book & Cash Book:** Chronological ledger of all daily business transactions with quick filtering by voucher type.
- **Outstanding Reports:** Receivables Aging & Payables Aging with customer reminder generation.
- **Inventory Reports:** Stock Summary, Movement Analysis, Godown Summary, Slow-moving / Non-moving stock.
- **Export Formats:** Print-ready PDF, Excel (.xlsx), CSV, JSON.

### 2.11 Multi-User Permissions & Security (RBAC)
- **Roles:**
  - *Super Admin:* Full system control, company creation, fiscal year close, permission assignment.
  - *Chartered Accountant / Auditor:* Read-all access, journal posting, audit trail review, financial report signing.
  - *Accountant:* Daily voucher entry, banking, ledger creation, invoice issuance.
  - *Sales Executive:* Create quotations, sales orders, view customer statements, no access to P&L or purchase costs.
  - *Inventory Clerk:* Goods receipt, stock transfers, physical count, no access to financial ledger balances.
- **Row-level / Branch-level Security:** Restrict users to specific branches or godowns.

### 2.12 Immutable Audit Trail (MCA Compliant)
- **Audit Rule:** Every voucher creation, modification, or cancellation generates an append-only audit event.
- **Attributes Captured:** Timestamp (ISO-8601 UTC), User ID, User IP/Device, Action (INSERT, UPDATE, VOID), Voucher ID, Diff JSON (previous state vs. new state).
- **Tamper Resistance:** No API endpoint or UI action can delete or update rows in the audit log table.

### 2.13 Keyboard-First UX & Rapid Data Entry
- **Omni-Search "Go To" Bar (`Alt+G` or `Cmd+K`):** Jump directly to any report, ledger, voucher type, or setting in $\le 2$ keystrokes.
- **Voucher Shortcuts:**
  - `F2`: Change Date
  - `F4`: Contra Voucher
  - `F5`: Payment Voucher
  - `F6`: Receipt Voucher
  - `F7`: Journal Voucher
  - `F8`: Sales Voucher
  - `F9`: Purchase Voucher
  - `Alt+C`: Create master on-the-fly from any ledger/item dropdown
  - `Enter`: Move to next line / Save and print
  - `Esc`: Cancel / Step backward in navigation hierarchy

### 2.14 AI Insights & Financial Intelligence (Gemini Integration)
- **Autonomous Anomaly Detection:** Flags abnormal transactions (e.g., sudden 30% jump in electricity expense, duplicate vendor bill number, missing HSN code).
- **Smart Narration Assistant:** Generates professional accounting narrations automatically from line-item context (e.g., *"Being payment made to ABC Logistics towards freight charges for Inv #401 via NEFT"*).
- **Cash Flow Forecasting:** Predictive 30/60/90-day cash projection based on customer payment history and scheduled vendor bills.
- **"Ask Books" Natural Language Query:** Users can type questions like: *"Who are my top 5 customers with overdue payments over 45 days?"* or *"What was our gross margin on electronics last quarter?"* and receive instant answers grounded in ledger data.
