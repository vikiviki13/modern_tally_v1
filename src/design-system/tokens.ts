/**
 * Design Tokens for LedgerPulse ERP
 * Built for high-density, professional financial and accounting applications.
 */

export const tokens = {
  colors: {
    // Dominant neutral canvas & structural surfaces
    neutral: {
      950: '#090d16', // Deep canvas (Accountant dark mode baseline)
      900: '#0f172a', // Primary surface / sidebar
      850: '#141e33', // Elevated card / active row
      800: '#1e293b', // Borders & input backgrounds
      700: '#334155', // Hairline dividers & muted borders
      600: '#475569', // Secondary icons / disabled
      500: '#64748b', // Muted text / helper labels
      400: '#94a3b8', // Secondary text
      300: '#cbd5e1', // High-contrast labels
      200: '#e2e8f0', // Light mode border
      100: '#f1f5f9', // Light mode surface
      50: '#f8fafc',  // Light mode canvas
    },
    // Primary brand & high-intent actions
    primary: {
      600: '#4f46e5', // Deep indigo primary button / active focus
      500: '#6366f1', // Hover primary
      400: '#818cf8', // Accent highlights
      50: '#eef2ff',  // Soft brand tint
    },
    // Accounting semantics (Luca Pacioli standards)
    financial: {
      credit: '#10b981',   // Emerald 500: Credit, Inward cash, Gross Profit, Assets
      creditMuted: '#064e3b',
      creditBg: 'rgba(16, 185, 129, 0.1)',
      debit: '#f43f5e',    // Rose 500: Debit, Outward cash, Expense, Liability addition
      debitMuted: '#881337',
      debitBg: 'rgba(244, 63, 94, 0.1)',
      warning: '#f59e0b',  // Amber 500: Unreconciled, Pending approval, Overdue
      warningBg: 'rgba(245, 158, 11, 0.1)',
      info: '#0284c7',     // Sky 600: System notices, Draft status
      infoBg: 'rgba(2, 132, 199, 0.1)',
    },
  },
  typography: {
    fontSans: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    sizes: {
      micro: '11px',    // Keyboard badges, table column headers in dense mode
      caption: '12px',  // Helper text, metadata, breadcrumbs
      sm: '13px',       // Standard table cells, form inputs, buttons (dense accounting default)
      base: '14px',     // Body text, standard view mode
      md: '16px',       // Section subheadings, dialog titles
      lg: '18px',       // Card headings, summary totals
      xl: '22px',       // View headers, primary metrics
      display: '28px',  // Large balance metrics
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    // High-density accounting spacing scale
    compact: {
      cellY: 'py-1.5',
      cellX: 'px-2.5',
      gap: 'gap-1.5',
      inputHeight: 'h-8 text-xs',
      containerPad: 'p-3',
    },
    comfortable: {
      cellY: 'py-2.5',
      cellX: 'px-3.5',
      gap: 'gap-3',
      inputHeight: 'h-9 text-sm',
      containerPad: 'p-5',
    },
  },
  radii: {
    xs: '2px',   // Dense accounting inputs, ledger cells
    sm: '4px',   // Buttons, dropdown menus, table items
    md: '6px',   // Cards, modal bodies
    lg: '8px',   // Application shell boundaries
    none: '0px', // Data table cells (sharp borders)
  },
  shadows: {
    subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
    dropdown: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
    modal: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
  },
  zIndex: {
    dropdown: 1000,
    stickyHeader: 1020,
    drawer: 1040,
    modalBackdrop: 1050,
    modal: 1060,
    commandPalette: 1070,
    toast: 1080,
    tooltip: 1090,
  },
  transitions: {
    fast: '150ms cubic-bezier(0.16, 1, 0.3, 1)',
    normal: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

export type DensityMode = 'accountant' | 'business';
