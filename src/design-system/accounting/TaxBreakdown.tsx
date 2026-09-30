import React from 'react';

export interface TaxBreakdownProps {
  taxableAmount: number;
  isInterstate: boolean;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  cessAmount?: number;
  discountAmount?: number;
  roundOff?: number;
  finalTotal: number;
  placeOfSupplyState?: string;
  companyState?: string;
}

export const TaxBreakdown: React.FC<TaxBreakdownProps> = ({
  taxableAmount,
  isInterstate,
  cgstRate = 9,
  cgstAmount = 0,
  sgstRate = 9,
  sgstAmount = 0,
  igstRate = 18,
  igstAmount = 0,
  cessAmount = 0,
  discountAmount = 0,
  roundOff = 0,
  finalTotal,
  placeOfSupplyState = 'Maharashtra (27)',
  companyState = 'Maharashtra (27)',
}) => {
  return (
    <div className="w-full max-w-sm ml-auto bg-slate-950/80 border border-slate-800 rounded p-3 text-xs font-sans">
      <div className="border-b border-slate-800/80 pb-2 mb-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>Place of Supply:</span>
        <span className="font-medium text-slate-200">{placeOfSupplyState}</span>
      </div>

      <div className="space-y-1.5 font-mono tabular-nums text-slate-300">
        <div className="flex justify-between">
          <span className="font-sans text-slate-400">Taxable Subtotal:</span>
          <span>₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-emerald-400">
            <span className="font-sans">Discount:</span>
            <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        )}

        {isInterstate ? (
          <div className="flex justify-between text-indigo-300">
            <span className="font-sans">Output IGST ({igstRate}%):</span>
            <span>₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-indigo-300">
              <span className="font-sans">Output CGST ({cgstRate}%):</span>
              <span>₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-indigo-300">
              <span className="font-sans">Output SGST ({sgstRate}%):</span>
              <span>₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </>
        )}

        {cessAmount > 0 && (
          <div className="flex justify-between text-amber-400">
            <span className="font-sans">Compensation Cess:</span>
            <span>₹{cessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        )}

        {roundOff !== 0 && (
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span className="font-sans">Round Off (Sec 170):</span>
            <span>{roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
          </div>
        )}
      </div>

      <div className="border-t-2 border-slate-700 mt-2.5 pt-2 flex items-center justify-between text-sm font-bold text-slate-100 font-mono">
        <span className="font-sans uppercase tracking-wider text-xs text-slate-300">Invoice Total:</span>
        <span className="text-emerald-400 text-base">
          ₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
};
