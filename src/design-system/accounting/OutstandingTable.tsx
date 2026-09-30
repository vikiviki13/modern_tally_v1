import React from 'react';
import { Badge } from '../core/Badge';
import { Button } from '../core/Button';

export interface OutstandingRecord {
  id: string;
  partyName: string;
  contactPerson?: string;
  phone?: string;
  totalPending: number;
  bucket0to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket90Plus: number;
  creditLimit?: number;
  creditPeriodDays?: number;
}

export interface OutstandingTableProps {
  type: 'RECEIVABLES' | 'PAYABLES';
  records: OutstandingRecord[];
  onSelectParty?: (partyId: string) => void;
  onRecordAction?: (partyId: string) => void;
  density?: 'compact' | 'comfortable';
}

export const OutstandingTable: React.FC<OutstandingTableProps> = ({
  type,
  records,
  onSelectParty,
  onRecordAction,
  density = 'compact',
}) => {
  const padClass = density === 'compact' ? 'py-1.5 px-2.5 text-xs' : 'py-2 px-3 text-sm';

  const totalOutstanding = records.reduce((sum, r) => sum + r.totalPending, 0);
  const total0to30 = records.reduce((sum, r) => sum + r.bucket0to30, 0);
  const total31to60 = records.reduce((sum, r) => sum + r.bucket31to60, 0);
  const total61to90 = records.reduce((sum, r) => sum + r.bucket61to90, 0);
  const total90Plus = records.reduce((sum, r) => sum + r.bucket90Plus, 0);

  return (
    <div className="w-full flex flex-col border border-slate-800 rounded bg-slate-900 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {type === 'RECEIVABLES' ? 'Accounts Receivable Aging' : 'Accounts Payable Aging'}
          </h3>
          <p className="text-[11px] text-slate-400">
            Bill-wise aging schedule classified into 30-day statutory liquidity buckets
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400">Total {type === 'RECEIVABLES' ? 'Due' : 'Payable'}:</span>
          <p className="font-mono font-bold text-sm text-rose-400 tabular-nums">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800 select-none">
            <tr>
              <th className={`${padClass} min-w-[200px]`}>
                {type === 'RECEIVABLES' ? 'Customer' : 'Supplier'}
              </th>
              <th className={`${padClass} text-right w-32`}>Total Outstanding</th>
              <th className={`${padClass} text-right w-28 text-emerald-400`}>0-30 Days</th>
              <th className={`${padClass} text-right w-28 text-sky-400`}>31-60 Days</th>
              <th className={`${padClass} text-right w-28 text-amber-400`}>61-90 Days</th>
              <th className={`${padClass} text-right w-28 text-rose-400`}>90+ Days</th>
              <th className={`${padClass} text-center w-28`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-slate-300">
            {records.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelectParty?.(r.id)}
                className="hover:bg-slate-850/60 transition-colors select-none"
              >
                <td className={`${padClass} font-sans`}>
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-100">{r.partyName}</span>
                    {r.phone && <span className="text-[10px] text-slate-500 font-mono">{r.phone}</span>}
                  </div>
                </td>
                <td className={`${padClass} text-right font-bold text-slate-100`}>
                  ₹{r.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className={`${padClass} text-right text-emerald-300`}>
                  {r.bucket0to30 > 0 ? `₹${r.bucket0to30.toLocaleString('en-IN')}` : '-'}
                </td>
                <td className={`${padClass} text-right text-sky-300`}>
                  {r.bucket31to60 > 0 ? `₹${r.bucket31to60.toLocaleString('en-IN')}` : '-'}
                </td>
                <td className={`${padClass} text-right text-amber-300`}>
                  {r.bucket61to90 > 0 ? `₹${r.bucket61to90.toLocaleString('en-IN')}` : '-'}
                </td>
                <td className={`${padClass} text-right text-rose-400 font-semibold`}>
                  {r.bucket90Plus > 0 ? `₹${r.bucket90Plus.toLocaleString('en-IN')}` : '-'}
                </td>
                <td className={`${padClass} text-center font-sans`}>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRecordAction?.(r.id);
                    }}
                  >
                    {type === 'RECEIVABLES' ? 'Collect (F6)' : 'Pay (F5)'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-700 bg-slate-950 font-mono tabular-nums text-xs font-bold text-slate-100">
            <tr>
              <td className={`${padClass} uppercase font-sans text-slate-400`}>Grand Total:</td>
              <td className={`${padClass} text-right text-rose-400`}>
                ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className={`${padClass} text-right text-emerald-400`}>
                ₹{total0to30.toLocaleString('en-IN')}
              </td>
              <td className={`${padClass} text-right text-sky-400`}>
                ₹{total31to60.toLocaleString('en-IN')}
              </td>
              <td className={`${padClass} text-right text-amber-400`}>
                ₹{total61to90.toLocaleString('en-IN')}
              </td>
              <td className={`${padClass} text-right text-rose-400`}>
                ₹{total90Plus.toLocaleString('en-IN')}
              </td>
              <td className={padClass}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
