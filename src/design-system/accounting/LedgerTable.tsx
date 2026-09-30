import React from 'react';
import { Badge } from '../core/Badge';

export interface LedgerTransaction {
  id: string;
  date: string;
  voucherType: 'SALES' | 'PURCHASE' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' | 'JOURNAL' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  voucherNumber: string;
  particulars: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: 'DR' | 'CR';
}

export interface LedgerTableProps {
  ledgerName: string;
  groupName: string;
  openingBalance: number;
  openingBalanceType: 'DR' | 'CR';
  transactions: LedgerTransaction[];
  onSelectVoucher?: (voucherId: string) => void;
  density?: 'compact' | 'comfortable';
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  ledgerName,
  groupName,
  openingBalance,
  openingBalanceType,
  transactions,
  onSelectVoucher,
  density = 'compact',
}) => {
  const totalDebit = transactions.reduce((acc, t) => acc + t.debit, 0);
  const totalCredit = transactions.reduce((acc, t) => acc + t.credit, 0);

  const finalBalance =
    transactions.length > 0
      ? transactions[transactions.length - 1].runningBalance
      : openingBalance;
  const finalBalanceType =
    transactions.length > 0
      ? transactions[transactions.length - 1].balanceType
      : openingBalanceType;

  const padClass = density === 'compact' ? 'py-1.5 px-2.5 text-xs' : 'py-2 px-3 text-sm';

  const voucherColors: Record<string, 'primary' | 'credit' | 'debit' | 'warning' | 'info' | 'neutral'> = {
    SALES: 'credit',
    RECEIPT: 'credit',
    PURCHASE: 'debit',
    PAYMENT: 'debit',
    JOURNAL: 'neutral',
    CONTRA: 'info',
    CREDIT_NOTE: 'warning',
    DEBIT_NOTE: 'warning',
  };

  return (
    <div className="w-full flex flex-col border border-slate-800 rounded bg-slate-900 shadow-xs overflow-hidden">
      {/* Ledger Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">{ledgerName}</h3>
            <span className="text-[11px] text-slate-400">({groupName})</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Opening Balance: ₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {openingBalanceType}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400">Closing Balance:</span>
          <p className={`font-mono font-bold text-sm tabular-nums ${
            finalBalanceType === 'DR' ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            ₹{finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {finalBalanceType}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider select-none">
            <tr>
              <th className={`${padClass} w-24`}>Date</th>
              <th className={`${padClass} w-28`}>Type</th>
              <th className={`${padClass} w-32`}>Voucher No</th>
              <th className={`${padClass}`}>Particulars</th>
              <th className={`${padClass} text-right w-32`}>Debit (Dr)</th>
              <th className={`${padClass} text-right w-32`}>Credit (Cr)</th>
              <th className={`${padClass} text-right w-36`}>Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-xs">
            {/* Opening Row */}
            <tr className="bg-slate-950/40 text-slate-400 italic">
              <td className={padClass}>-</td>
              <td className={padClass}>OPENING</td>
              <td className={padClass}>-</td>
              <td className={`${padClass} font-sans not-italic text-slate-300`}>Opening Balance b/f</td>
              <td className={`${padClass} text-right`}>
                {openingBalanceType === 'DR' ? `₹${openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
              </td>
              <td className={`${padClass} text-right`}>
                {openingBalanceType === 'CR' ? `₹${openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
              </td>
              <td className={`${padClass} text-right font-semibold text-slate-200`}>
                ₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {openingBalanceType}
              </td>
            </tr>

            {transactions.map((t) => (
              <tr
                key={t.id}
                onClick={() => onSelectVoucher?.(t.id)}
                className="hover:bg-slate-850/60 text-slate-300 transition-colors cursor-pointer select-none"
              >
                <td className={`${padClass} text-slate-400`}>{t.date}</td>
                <td className={padClass}>
                  <Badge variant={voucherColors[t.voucherType] || 'neutral'}>
                    {t.voucherType}
                  </Badge>
                </td>
                <td className={`${padClass} font-semibold text-indigo-300`}>{t.voucherNumber}</td>
                <td className={`${padClass} font-sans text-slate-200`}>{t.particulars}</td>
                <td className={`${padClass} text-right text-rose-300`}>
                  {t.debit > 0 ? `₹${t.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                </td>
                <td className={`${padClass} text-right text-emerald-300`}>
                  {t.credit > 0 ? `₹${t.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                </td>
                <td className={`${padClass} text-right font-medium text-slate-100`}>
                  ₹{t.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {t.balanceType}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-700 bg-slate-950 font-mono tabular-nums text-xs font-bold text-slate-100">
            <tr>
              <td colSpan={4} className={`${padClass} text-right font-sans uppercase text-slate-400`}>
                Total Period Movements:
              </td>
              <td className={`${padClass} text-right text-rose-400`}>
                ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className={`${padClass} text-right text-emerald-400`}>
                ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className={`${padClass} text-right text-slate-200`}>
                ₹{finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {finalBalanceType}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
