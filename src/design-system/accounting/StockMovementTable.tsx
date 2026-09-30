import React from 'react';
import { Badge } from '../core/Badge';

export interface StockMovementItem {
  id: string;
  date: string;
  movementType: 'PURCHASE_RECEIPT' | 'SALES_DELIVERY' | 'INTERNAL_TRANSFER' | 'ADJUSTMENT';
  voucherNumber: string;
  warehouseName: string;
  batchNumber?: string;
  inwardQty: number;
  inwardRate: number;
  outwardQty: number;
  outwardRate: number;
  closingQty: number;
  valuationRate: number;
  closingValue: number;
}

export interface StockMovementTableProps {
  productName: string;
  sku: string;
  uom: string;
  hsn: string;
  movements: StockMovementItem[];
  density?: 'compact' | 'comfortable';
}

export const StockMovementTable: React.FC<StockMovementTableProps> = ({
  productName,
  sku,
  uom,
  hsn,
  movements,
  density = 'compact',
}) => {
  const padClass = density === 'compact' ? 'py-1.5 px-2.5 text-xs' : 'py-2 px-3 text-sm';

  const totalInward = movements.reduce((sum, m) => sum + m.inwardQty, 0);
  const totalOutward = movements.reduce((sum, m) => sum + m.outwardQty, 0);
  const lastMovement = movements[movements.length - 1];

  return (
    <div className="w-full flex flex-col border border-slate-800 rounded bg-slate-900 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">{productName}</h3>
            <span className="font-mono text-xs text-indigo-300">SKU: {sku}</span>
            <span className="text-[11px] text-slate-400">HSN: {hsn}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Perpetual inventory register tracked in {uom}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400">Current Stock in Hand:</span>
          <p className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
            {lastMovement ? lastMovement.closingQty.toLocaleString('en-IN') : 0} {uom} (₹
            {lastMovement ? lastMovement.closingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'})
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800 select-none">
            <tr>
              <th className={`${padClass} w-24`}>Date</th>
              <th className={`${padClass} w-28`}>Type</th>
              <th className={`${padClass} w-28`}>Voucher</th>
              <th className={`${padClass}`}>Warehouse</th>
              <th className={`${padClass} text-right w-24 text-emerald-400`}>Inward Qty</th>
              <th className={`${padClass} text-right w-24 text-rose-400`}>Outward Qty</th>
              <th className={`${padClass} text-right w-28`}>Balance Qty</th>
              <th className={`${padClass} text-right w-28`}>Unit Valuation</th>
              <th className={`${padClass} text-right w-32`}>Stock Value (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-slate-300">
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-slate-850/60 transition-colors">
                <td className={`${padClass} text-slate-400`}>{m.date}</td>
                <td className={padClass}>
                  <Badge
                    variant={
                      m.movementType === 'PURCHASE_RECEIPT'
                        ? 'credit'
                        : m.movementType === 'SALES_DELIVERY'
                        ? 'debit'
                        : 'neutral'
                    }
                  >
                    {m.movementType.replace('_', ' ')}
                  </Badge>
                </td>
                <td className={`${padClass} font-semibold text-indigo-300`}>{m.voucherNumber}</td>
                <td className={`${padClass} font-sans text-slate-200`}>{m.warehouseName}</td>
                <td className={`${padClass} text-right text-emerald-300`}>
                  {m.inwardQty > 0 ? `+${m.inwardQty} ${uom}` : '-'}
                </td>
                <td className={`${padClass} text-right text-rose-400`}>
                  {m.outwardQty > 0 ? `-${m.outwardQty} ${uom}` : '-'}
                </td>
                <td className={`${padClass} text-right font-bold text-slate-100`}>
                  {m.closingQty} {uom}
                </td>
                <td className={`${padClass} text-right text-slate-300`}>
                  ₹{m.valuationRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className={`${padClass} text-right font-semibold text-slate-100`}>
                  ₹{m.closingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-700 bg-slate-950 font-mono tabular-nums text-xs font-bold text-slate-100">
            <tr>
              <td colSpan={4} className={`${padClass} uppercase font-sans text-slate-400`}>
                Total Movements:
              </td>
              <td className={`${padClass} text-right text-emerald-400`}>
                +{totalInward} {uom}
              </td>
              <td className={`${padClass} text-right text-rose-400`}>
                -{totalOutward} {uom}
              </td>
              <td className={`${padClass} text-right text-slate-100`}>
                {lastMovement ? lastMovement.closingQty : 0} {uom}
              </td>
              <td colSpan={2} className={`${padClass} text-right text-emerald-400`}>
                ₹{lastMovement ? lastMovement.closingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : 0}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
