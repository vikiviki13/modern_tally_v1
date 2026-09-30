# TECHNICAL RISKS, MITIGATIONS & ARCHITECTURAL PITFALLS
**Platform:** Modern Accounting & Business Management Operating System  
**Document:** Technical Risk Assessment (Phase 01 Deliverable)  
**Author:** Technical Lead & Senior Product Architect

---

## 1. High-Impact Technical Risks Matrix

| Risk ID | Risk Domain | Severity | Likelihood | Impact |
| :--- | :--- | :---: | :---: | :--- |
| **TR-01** | Floating-Point Arithmetic Drift (IEEE 754) | **Critical** | **High** | Trial balance imbalance, rounding errors on GST, tax audit failure. |
| **TR-02** | Double-Entry Invariant Violation | **Critical** | **Medium** | Unbalanced vouchers corrupting the General Ledger. |
| **TR-03** | In-Memory Ledger Aggregation Bottlenecks | **High** | **High** | Browser freezing when calculating Trial Balance or P&L over thousands of rows. |
| **TR-04** | Hotkey Collision with Browser Native Shortcuts | **High** | **High** | `F5` reloading the tab, `Ctrl+W` closing window, `Alt+D` moving focus to address bar. |
| **TR-05** | State Corruption During Modal Creation (`Alt+C`) | **High** | **Medium** | User creates a new ledger or item mid-voucher; voucher draft state lost. |
| **TR-06** | MCA Non-Compliance (Audit Log Tampering) | **Critical** | **Low** | Penalties under Companies Act 2013 if audit logs can be modified or purged. |
| **TR-07** | GST Calculation Edge Cases & Inaccuracies | **High** | **Medium** | Under/over-collection of tax, interest penalties on incorrect RCM or Place of Supply. |
| **TR-08** | Offline Data Loss & Storage Quota Saturation | **Medium** | **Medium** | LocalStorage 5MB limit overflow if storing large multi-year ledger histories. |
| **TR-09** | AI Calculation Hallucinations | **High** | **Medium** | LLM providing incorrect accounting numbers instead of analytical interpretations. |
| **TR-10** | Role-Based Access Control (RBAC) Data Leakage | **High** | **Low** | Sales/Warehouse users gaining unauthorized visibility into P&L and gross margins. |

---

## 2. In-Depth Risk Analysis & Engineering Mitigations

### 2.1 TR-01: Floating-Point Arithmetic Drift (IEEE 754)
- **The Problem:** Standard JavaScript numbers are double-precision 64-bit floats (`0.1 + 0.2 === 0.30000000000000004`). In financial accounting, an off-by-one-cent rounding error accumulates across thousands of line items, causing the Trial Balance $\sum \text{Debit} \ne \sum \text{Credit}$ and triggering statutory audit flags.
- **Engineering Mitigation:**
  - Standardize on **fixed-point integer arithmetic** (storing currency in minor units, e.g., paise/cents: $₹ 1,245.50 \to 124550$) or a rock-solid arbitrary-precision decimal library/utility.
  - Apply standard statutory rounding rules: Round half up (`Math.round`) at the line-item level or document level according to GST rules (Sec 170 of CGST Act requires rounding off to nearest Rupee).

### 2.2 TR-02: Double-Entry Invariant Violation
- **The Problem:** If a voucher creation API or client action commits line items sequentially without transactional atomicity, a crash or validation error could save the debit entry without the credit entry.
- **Engineering Mitigation:**
  - Build an atomic transaction guard:
    ```typescript
    function validateVoucherIntegrity(voucher: Voucher): boolean {
      const totalDebits = voucher.entries.filter(e => e.type === 'DR').reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = voucher.entries.filter(e => e.type === 'CR').reduce((sum, e) => sum + e.amount, 0);
      return Math.abs(totalDebits - totalCredits) === 0 && voucher.entries.length >= 2;
    }
    ```
  - Enforce atomic persistence: No voucher is saved to the store unless the invariant passes with zero tolerance.

### 2.3 TR-03: In-Memory Ledger Aggregation Bottlenecks
- **The Problem:** In Tally, users expect instant drill-down from the Balance Sheet into Group Summary $\to$ Ledger Account $\to$ Monthly Summary $\to$ Day Book $\to$ Individual Voucher. Running recursive tree summations across 50,000 transactions on every render can freeze the React UI thread.
- **Engineering Mitigation:**
  - Maintain a **cached running balance index** on each ledger master (`closingDebit`, `closingCredit`, `monthlyBuckets`).
  - Update ledger balances incrementally upon voucher post/void rather than recalculating the entire history from epoch.
  - Utilize Web Workers or asynchronous batching for heavy multi-year financial statements.

### 2.4 TR-04: Keyboard Hotkey Collision with Browser Defaults
- **The Problem:** Tally users are muscle-memory programmed to hit `F2` (Date), `F4` (Contra), `F5` (Payment), `F6` (Receipt), `F7` (Journal), `F8` (Sales), `F9` (Purchase), `Esc` (Back), and `Enter` (Next field). In modern browsers, `F5` triggers a hard page reload, `Alt+F` opens file menus, and `Esc` can exit full-screen.
- **Engineering Mitigation:**
  - Implement a top-level `KeyboardShortcutProvider` using `window.addEventListener('keydown', e => { ... }, { capture: true })`.
  - Call `e.preventDefault()` on intercepted functional keys (`F2`-`F10`, `Alt+G`, `Alt+C`, `Alt+D`).
  - Provide an on-screen visual shortcut HUD and an option to switch to Mac-friendly modifier keys (`Cmd+Option+Key` or `Ctrl+Key`) if preferred.

### 2.5 TR-05: State Preservation During In-Flight Master Creation (`Alt+C`)
- **The Problem:** While typing a sales voucher on row 4, an accountant realizes a new customer or stock item doesn't exist. In Tally, pressing `Alt+C` opens the ledger creation dialog, creates the ledger, and returns the user back to row 4 of the invoice without losing any entered data. In a poorly designed SPA, navigation wipes out the active form state.
- **Engineering Mitigation:**
  - Implement a stacked modal / overlay architecture: The active voucher form remains mounted in background DOM state while an `Alt+C` modal slides over.
  - Use a centralized draft manager or reactive store that preserves in-flight voucher drafts independently of route changes.

### 2.6 TR-06: MCA Compliance & Audit Trail Non-Tamperability
- **The Problem:** Ministry of Corporate Affairs (MCA) in India requires that any software used to maintain books of accounts must feature an audit trail with edit log for each change made in the books, recording date of change and user, and this audit trail cannot be disabled.
- **Engineering Mitigation:**
  - Create a dedicated, immutable `audit_logs` store.
  - Every voucher mutation (create, edit, cancel/void) generates an append-only log record with full JSON diff snapshot.
  - Prohibit hard deletes: Vouchers are marked as `VOID` or `CANCELLED` with a reversal entry, preserving the historical sequence.

### 2.7 TR-07: GST Calculation Edge Cases
- **The Problem:** Incorrect tax computation due to misidentifying Place of Supply (e.g., Bill-to vs. Ship-to address mismatch), failing to apply Reverse Charge (RCM) on unregistered goods transport agency (GTA) services, or applying incorrect tax slabs.
- **Engineering Mitigation:**
  - Implement a rule-based tax engine:
    1. Validate party GSTIN state code (first 2 digits) against Company state code.
    2. Support explicit "Place of Supply" override if delivery address differs from billing address.
    3. Auto-populate GST slab from the Item/HSN master, with manual line-item override capabilities.
    4. Auto-generate RCM tax liability and matching input tax credit entries when RCM flag is active.

### 2.8 TR-08: Storage Quotas & Offline Persistence
- **The Problem:** Browser `localStorage` has a strict 5MB limit. Storing a year of business invoices with multiple line items easily exceeds this limit.
- **Engineering Mitigation:**
  - Use **IndexedDB** for client-side persistence, which supports gigabytes of structured storage with indexed query performance.
  - Provide automated, one-click encrypted JSON backup and restore functions so companies can safeguard their financial records locally.

### 2.9 TR-09: AI Calculation Hallucinations
- **The Problem:** Large Language Models are probabilistic and cannot be trusted to perform exact arithmetic calculations or tax assessments directly.
- **Engineering Mitigation:**
  - Strict boundary: **AI never calculates ledger numbers**.
  - All financial calculations (P&L, Trial Balance, GST returns, Aging) are executed by deterministic TypeScript accounting functions.
  - The `@google/genai` model receives pre-calculated, verified aggregations and schema data as context, using its intelligence strictly for synthesis, narrative commentary, risk flagging, and natural-language query routing.

### 2.10 TR-10: Role-Based Access Control (RBAC) Data Leakage
- **The Problem:** Frontend-only checks can be bypassed by inspecting state, exposing sensitive payroll or margin data to sales reps.
- **Engineering Mitigation:**
  - Define strict permission scopes (`READ_FINANCIAL_REPORTS`, `VIEW_PURCHASE_COST`, `CREATE_VOUCHER`, `ADMIN_ALL`).
  - Sanitize store data: If a user lacks `VIEW_PURCHASE_COST`, cost figures and profit columns are scrubbed at the selector layer before rendering.
