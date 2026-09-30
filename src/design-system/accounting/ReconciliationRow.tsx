import React from 'react';
import { Check, CheckCircle2, Clock, Link2 } from 'lucide-react';
import { Button } from '../core/Button';
import { Badge } from '../core/Badge';

export interface BankTransactionLine {
  id: string;
  transactionDate: string;
  valueDate: string;
  description: string;
  reference: string;
  amount: number;
  direction: 'DR' | 'CR';
}

export interface MatchedBookEntry {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  partyName: string;
  amount: number;
  direction: 'DR' | 'CR';
}

export interface ReconciliationRowProps {
  bankTx: BankTransactionLine;
  matchedEntry?: MatchedBookEntry;
  isReconciled: boolean;
  clearedDate?: string;
  onReconcile: (bankTxId: string, voucherId: string) => void;
  onUnreconcile?: (bankTxId: string) => void;
}

export const ReconciliationRow: React.FC<ReconciliationRowProps> = ({
  bankTx,
  matchedEntry,
  isReconciled,
  clearedDate,
  onReconcile,
  onUnreconcile,
}) => {
  return (
    <div
      className={`p-3 rounded border text-xs transition-colors ${
        isReconciled
          ? 'bg-emerald-950/20 border-emerald-800/40'
          : matchedEntry
          ? 'bg-slate-900 border-indigo-700/60'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Bank statement record */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-slate-400">{bankTx.transactionDate}</span>
            <Badge variant={bankTx.direction === 'CR' ? 'credit' : 'debit'}>
              {bankTx.direction === 'CR' ? 'CREDIT (INFLOW)' : 'DEBIT (OUTFLOW)'}
            </Badge>
            <span className="font-mono text-[11px] text-slate-500">Ref: {bankTx.reference}</span>
          </div>
          <p className="font-medium text-slate-200 text-xs">{bankTx.description}</p>
          <p className="font-mono font-bold text-slate-100 text-sm mt-0.5">
            ₹{bankTx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Center: Linked Book Voucher */}
        <div className="flex-1 bg-slate-950/60 p-2.5 rounded border border-slate-800">
          {matchedEntry ? (
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="flex items-center gap-1 text-indigo-300 font-semibold">
                  <Link2 className="w-3 h-3" />
                  <span>Matched Book Voucher:</span>
                </span>
                <span className="font-mono">{matchedEntry.voucherDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{matchedEntry.partyName}</span>
                <span className="font-mono font-bold text-slate-200">
                  ₹{matchedEntry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {matchedEntry.voucherNumber}
              </span>
            </div>
          ) : (
            <div className="text-slate-500 italic py-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Unmatched in books. No corresponding voucher found.</span>
            </div>
          )}
        </div>

        {/* Right: Reconciliation status & action */}
        <div className="flex flex-col items-end gap-1.5 min-w-[140px]">
          {isReconciled ? (
            <div className="flex items-center gap-1 text-emerald-400 font-medium text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Reconciled</span>
              {clearedDate && <span className="font-mono text-[10px] text-slate-400">({clearedDate})</span>}
            </div>
          ) : matchedEntry ? (
            <Button
              variant="success"
              size="xs"
              onClick={() => onReconcile(bankTx.id, matchedEntry.voucherId)}
              leftIcon={<Check className="w-3 h-3" />}
            >
              Confirm Match
            </Button>
          ) : (
            <Button variant="outline" size="xs">
              Create Voucher
            </Button>
          )}

          {isReconciled && onUnreconcile && (
            <button
              type="button"
              onClick={() => onUnreconcile(bankTx.id)}
              className="text-[10px] text-slate-500 hover:text-rose-400 underline cursor-pointer"
            >
              Unlink / Revert
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
