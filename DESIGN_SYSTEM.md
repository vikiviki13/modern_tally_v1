# LEDGERPULSE DESIGN SYSTEM (LPDS)
**Platform:** Next-Generation Enterprise Accounting & ERP System (Tally Replacement)  
**Philosophy:** *"Hide accounting complexity without hiding accounting control."*  
**Aesthetic Core:** High-Density Modern Financial Tooling · Anti-AI Slop · Tabular Precision · Dual Ergonomics  
**Document Version:** 1.0.0 (Phase 03 Deliverable)

---

## 1. Design Direction & Core Philosophy

Traditional accounting software (such as TallyPrime) excelled at keyboard speed and tabular density but suffered from dated monochrome DOS-era UI, zero visual hierarchy, and an intimidating learning curve. Conversely, modern generic SaaS apps swing to the opposite extreme: excessive whitespace, cartoonish bubbly pill badges, and low information density that forces accountants to click through 10 pages just to see a 20-line transaction history.

**The LedgerPulse Design System establishes a new paradigm:**
1. **High Information Density by Default:** Accountants work with massive volumes of financial rows. Our baseline "Accountant Mode" displays **35–45 visible ledger transactions per 1080p viewport** using 28px compact rows, hairline borders, and zero wasteful padding.
2. **Dual Ergonomics (Business Mode vs. Accountant Mode):**
   - **Accountant Mode:** Optimized for Chartered Accountants and data-entry operators. Monospace numbers, strict Dr/Cr balances, keyboard shortcuts (`F4`-`F9`, `Alt+C`), and compact grids.
   - **Business Mode:** Optimized for founders, CFOs, and business managers. Executive metrics, visual tax breakdowns, cards, and guided workflows.
3. **Luca Pacioli Visual Grammar:**
   - **Credit (Inflow / Asset / Revenue):** Clean Emerald (`#10b981`).
   - **Debit (Outflow / Expense / Liability):** Clean Rose (`#f43f5e`).
   - **Unbalanced Discrepancy:** High-contrast Amber (`#f59e0b`).
   - All financial amounts are rendered in tabular figures (`font-mono tabular-nums`) so that decimal places align vertically in every column.
4. **Anti-AI Slop & Zero-Pill Discipline:**
   - **No rounded pill capsules for static metadata:** Metadata is rendered as clean unboxed text separated by subtle typographical dividers (`·`, `/`).
   - **No decorative icon clutter:** Icons are reserved strictly for interactive functional affordances (Search, Filter, Sort, Expand).
   - **No mechanical code-comment titles:** Clean human title-case prose throughout.

---

## 2. Design Tokens Specification

### 2.1 Color Palette

```
Canvas / Structural Neutrals:
  #090d16  -- Neutral 950 (Canvas background)
  #0f172a  -- Neutral 900 (Sidebar & base surfaces)
  #141e33  -- Neutral 850 (Elevated cards & hover rows)
  #1e293b  -- Neutral 800 (Borders & input backgrounds)
  #334155  -- Neutral 700 (Hairline dividers)
  #475569  -- Neutral 600 (Secondary icons / disabled states)
  #64748b  -- Neutral 500 (Muted labels & captions)
  #94a3b8  -- Neutral 400 (Secondary text)
  #f1f5f9  -- Neutral 100 (Primary text headings)

Primary Brand Actions:
  #4f46e5  -- Indigo 600 (Primary buttons & active selection)
  #6366f1  -- Indigo 500 (Hover state)
  #818cf8  -- Indigo 400 (Focus ring & active links)

Financial & Accounting Semantics:
  #10b981  -- Credit / Cash Inflow / Profit (Emerald 500)
  #f43f5e  -- Debit / Cash Outflow / Expense (Rose 500)
  #f59e0b  -- Warning / Unreconciled / Pending Approval (Amber 500)
  #0284c7  -- System Notices / Draft Status (Sky 600)
```

### 2.2 Typography Pairings & Hierarchy

Our system implements the **2+1 Font Pairing Rule**:
- **Display & UI Body:** `Plus Jakarta Sans` (Characterful, modern, highly legible at small sizes).
- **Financial Figures, Ledger Cards & Code:** `JetBrains Mono` with `tabular-nums` enabled.

| Token | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-micro` | `10px` | 600 | 12px | Hotkey badges (`F2`, `Alt+G`), table column header caps |
| `text-caption` | `11px` | 500 | 14px | Input labels, helper remarks, breadcrumbs |
| `text-xs` | `12px` | 400 / 500 | 16px | Table cell contents, button text, form inputs |
| `text-sm` | `13px` | 500 / 600 | 18px | Dialog headers, card titles, section labels |
| `text-base` | `14px` | 600 | 20px | Page titles, primary invoice headers |
| `text-lg` | `18px` | 700 | 24px | Final total invoice amounts, closing balance metrics |

### 2.3 Spacing Scale & Density Modes

```typescript
// Dense Accountant Mode (Default)
const accountantScale = {
  rowHeight: '28px',
  tableCellPadding: 'py-1.5 px-2.5',
  inputHeight: 'h-7 text-xs',
  containerPadding: 'p-3',
};

// Executive Business Mode
const businessScale = {
  rowHeight: '38px',
  tableCellPadding: 'py-2.5 px-3.5',
  inputHeight: 'h-9 text-sm',
  containerPadding: 'p-5',
};
```

### 2.4 Elevation & Layering (Z-Index Scale)

```
z-10  -- Sticky table headers
z-20  -- Top navigation bar
z-30  -- Application sidebar
z-40  -- Slide-over drawers
z-50  -- Modals, dialog backdrops, command palettes
z-60  -- Global toasts and floating notifications
z-70  -- Tooltips & hover popovers
```

---

## 3. Core Component Library

All components reside in `src/design-system/core/` and are fully typed with TypeScript:

1. **`Button`**: Primary, secondary, outline, danger, success, and ghost variants. Includes built-in keyboard shortcut badges (`<kbd>`) and loading spinners.
2. **`Input`**: High-density input with label, helper text, error indicator, and left/right icon slots.
3. **`CurrencyInput`**: Specialized monetary field with locale comma formatting (`en-IN`), tabular numbers, zero float drift, and inline `DR`/`CR` toggles.
4. **`DatePicker`**: Keyboard-first date entry with quick shortcuts (`Today`, `Month End`, `FY Start`) and statutory `F2` trigger.
5. **`Combobox`**: Ultra-fast autocomplete for ledgers and items with keyboard arrows, Enter selection, and inline `Alt+C` fast master creation trigger.
6. **`DataTable`**: High-density table supporting sorting, sticky headers, dense/comfortable modes, and statutory double-underlined footer totals rows.
7. **`CommandPalette` (`Alt+G` / `Cmd+K`)**: The central omni-search engine enabling navigation to any report, ledger, or voucher in $\le 2$ keystrokes.
8. **`Modal` & `Drawer`**: Accessible dialogs with focus trapping, `Esc` handling, and zero state unmounting on background voucher forms.
9. **`Badge`**: Anti-slop rectangular micro-badges for Luca Pacioli statuses (`credit`, `debit`, `warning`, `info`).
10. **`Toast` & `Alert`**: Accessible, non-intrusive feedback notifications.
11. **`Checkbox`, `Radio`, `Switch`**: Accessible state toggles.
12. **`EmptyState`, `LoadingState`, `ErrorState`**: Standardized fallback and async loading templates.

---

## 4. Accounting-Specific Components

Located in `src/design-system/accounting/`:

1. **`LedgerTable`**:
   - Implements full running balance debit/credit calculation.
   - Shows opening balance brought forward, chronological transactions with voucher type badges, and closing balance with `DR`/`CR` flags.
   - Supports 1-click drilldown to original source voucher.
2. **`JournalEntryEditor` (`F7`)**:
   - Multi-line debit and credit entry editor.
   - Calculates total debits, total credits, and unbalance difference ($\Delta$).
   - Enforces the Luca Pacioli invariant: disables "Post" until $\Delta \equiv 0.00$.
   - Auto-fills the balancing difference on newly added lines.
3. **`InvoiceBuilder` (`F8`)**:
   - Full sales tax invoice composer with multi-item grid.
   - Item SKU, HSN/SAC code, quantity, unit of measure, unit rate, and discount %.
   - Integrated with `TaxBreakdown` for automatic Place of Supply (Intra-state CGST+SGST vs. Inter-state IGST) calculation and Section 170 rupee round-off.
4. **`PaymentForm` (`F5`) & `ReceiptForm` (`F6`)**:
   - Dedicated treasury disbursement and collection workflows.
   - Bill-by-bill settlement grid with automated FIFO allocation against open invoices.
5. **`TaxBreakdown`**:
   - Explicit visual calculation of Subtotal, CGST, SGST, IGST, Cess, Round-off, and Final Invoice Amount.
6. **`OutstandingTable`**:
   - Bill-by-bill aging schedule partitioned into statutory liquidity buckets (0-30, 31-60, 61-90, 90+ days).
7. **`StockMovementTable`**:
   - Perpetual inventory stock ledger tracking Inward, Outward, and Closing quantities and valuation rates (FIFO/Weighted Average).
8. **`ReconciliationRow`**:
   - Bank Reconciliation Statement (BRS) tool comparing bank statement lines against book entries with 1-click matching.
9. **`ApprovalTimeline`**:
   - Multi-stage hierarchical sign-off for high-value transactions.
10. **`AuditHistory`**:
    - MCA Companies Act 2013 compliant audit trail viewer displaying immutable log records and detailed JSON property diffs.

---

## 5. Keyboard Navigation Architecture

The system enables 100% mouse-free operation for experienced accountants:

| Hotkey | Global Function |
| :--- | :--- |
| `Alt+G` / `Cmd+K` | Open universal "Go To" Command Palette |
| `Alt+C` | Open In-Flight Master Creation modal from any combobox |
| `F2` | Focus / Change Transaction Date |
| `F4` | Open Contra Voucher (Bank/Cash Transfer) |
| `F5` | Open Payment Voucher |
| `F6` | Open Receipt Voucher |
| `F7` | Open General Journal Entry |
| `F8` | Open Sales Tax Invoice |
| `F9` | Open Purchase Bill Voucher |
| `Enter` | Move focus to next input / Append balanced row in Journal |
| `Ctrl+Enter` / `Ctrl+S` | Save & Post active voucher |
| `Esc` | Close active modal / step back to previous menu |
