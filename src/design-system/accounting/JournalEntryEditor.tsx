import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../core/Button';
import { Combobox, ComboboxItem } from '../core/Combobox';
import { DatePicker } from '../core/DatePicker';
import { Input } from '../core/Input';

export interface JournalLineState {
  id: string;
  ledgerId: string;
  ledgerName: string;
  direction: 'DR' | 'CR';
  amount: number;
  narration: string;
}

export interface JournalEntryEditorProps {
  availableLedgers: ComboboxItem[];
  initialLines?: JournalLineState[];
  onPost: (entry: {
    entryDate: string;
    voucherNumber: string;
    narration: string;
    lines: JournalLineState[];
  }) => void;
  onCancel?: () => void;
  onOpenCreateLedger?: () => void;
}

export const JournalEntryEditor: React.FC<JournalEntryEditorProps> = ({
  availableLedgers,
  initialLines,
  onPost,
  onCancel,
  onOpenCreateLedger,
}) => {
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [voucherNumber, setVoucherNumber] = useState<string>('JV/2026/0104');
  const [overallNarration, setOverallNarration] = useState<string>('');

  const [lines, setLines] = useState<JournalLineState[]>(
    initialLines || [
      {
        id: '1',
        ledgerId: '',
        ledgerName: '',
        direction: 'DR',
        amount: 0,
        narration: '',
      },
      {
        id: '2',
        ledgerId: '',
        ledgerName: '',
        direction: 'CR',
        amount: 0,
        narration: '',
      },
    ]
  );

  const addLine = () => {
    // Calculate current difference to auto-fill balancing amount
    const totalDr = lines
      .filter((l) => l.direction === 'DR')
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const totalCr = lines
      .filter((l) => l.direction === 'CR')
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const diff = totalDr - totalCr;

    const newDirection = diff > 0 ? 'CR' : 'DR';
    const newAmount = Math.abs(diff);

    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        ledgerId: '',
        ledgerName: '',
        direction: newDirection,
        amount: newAmount,
        narration: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return; // Keep minimum 2 lines
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<JournalLineState>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...updates } : line))
    );
  };

  const totalDebit = lines
    .filter((l) => l.direction === 'DR')
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const totalCredit = lines
    .filter((l) => l.direction === 'CR')
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = difference === 0 && totalDebit > 0;

  const handlePost = () => {
    if (!isBalanced) return;
    onPost({
      entryDate,
      voucherNumber,
      narration: overallNarration,
      lines,
    });
  };

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded p-4 shadow-sm">
      {/* Top Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-slate-800 pb-3">
        <Input
          label="Voucher Number"
          value={voucherNumber}
          onChange={(e) => setVoucherNumber(e.target.value)}
          required
        />
        <DatePicker
          label="Date"
          value={entryDate}
          onChange={setEntryDate}
        />
        <div className="flex flex-col justify-end">
          <div className="text-[11px] text-slate-400 mb-1">Voucher Type</div>
          <div className="h-7 px-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between text-xs font-medium text-indigo-300">
            <span>General Journal (F7)</span>
            <kbd className="text-[10px] font-mono text-slate-500">Auto-Balancing</kbd>
          </div>
        </div>
      </div>

      {/* Grid Lines */}
      <div className="overflow-x-auto border border-slate-800 rounded">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2 px-2 w-16 text-center">Dr/Cr</th>
              <th className="py-2 px-2.5 min-w-[220px]">Account / Ledger</th>
              <th className="py-2 px-2.5 text-right w-36">Debit Amount (₹)</th>
              <th className="py-2 px-2.5 text-right w-36">Credit Amount (₹)</th>
              <th className="py-2 px-2.5 min-w-[180px]">Line Narration</th>
              <th className="py-2 px-1 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {lines.map((line, idx) => (
              <tr key={line.id} className="hover:bg-slate-850/40">
                <td className="py-1.5 px-2 text-center">
                  <select
                    value={line.direction}
                    onChange={(e) =>
                      updateLine(idx, { direction: e.target.value as 'DR' | 'CR' })
                    }
                    className={`h-7 px-1.5 rounded font-mono font-bold text-xs border outline-none cursor-pointer ${
                      line.direction === 'DR'
                        ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                        : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    }`}
                  >
                    <option value="DR">Dr</option>
                    <option value="CR">Cr</option>
                  </select>
                </td>
                <td className="py-1.5 px-2.5">
                  <Combobox
                    items={availableLedgers}
                    value={line.ledgerId}
                    onChange={(item) =>
                      updateLine(idx, { ledgerId: item.id, ledgerName: item.name })
                    }
                    onCreateNew={onOpenCreateLedger}
                    placeholder="Search ledger (Alt+C to create)..."
                  />
                </td>
                <td className="py-1.5 px-2.5">
                  {line.direction === 'DR' ? (
                    <input
                      type="number"
                      step="0.01"
                      value={line.amount || ''}
                      onChange={(e) =>
                        updateLine(idx, { amount: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0.00"
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-right font-mono tabular-nums text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  ) : (
                    <div className="text-right text-slate-600 font-mono pr-2">-</div>
                  )}
                </td>
                <td className="py-1.5 px-2.5">
                  {line.direction === 'CR' ? (
                    <input
                      type="number"
                      step="0.01"
                      value={line.amount || ''}
                      onChange={(e) =>
                        updateLine(idx, { amount: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0.00"
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-right font-mono tabular-nums text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  ) : (
                    <div className="text-right text-slate-600 font-mono pr-2">-</div>
                  )}
                </td>
                <td className="py-1.5 px-2.5">
                  <input
                    type="text"
                    value={line.narration}
                    onChange={(e) => updateLine(idx, { narration: e.target.value })}
                    placeholder="Optional line remarks..."
                    className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 px-1 text-center">
                  <button
                    type="button"
                    disabled={lines.length <= 2}
                    onClick={() => removeLine(idx)}
                    className="text-slate-500 hover:text-rose-400 disabled:opacity-20 cursor-pointer p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-700 bg-slate-950 font-mono tabular-nums text-xs">
            <tr>
              <td colSpan={2} className="py-2 px-3">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={addLine}
                  leftIcon={<Plus className="w-3 h-3" />}
                >
                  Add Entry Line (Enter)
                </Button>
              </td>
              <td className="py-2 px-2.5 text-right font-bold text-rose-400">
                ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-2 px-2.5 text-right font-bold text-emerald-400">
                ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td colSpan={2} className="py-2 px-2.5 text-right font-sans">
                {isBalanced ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Balanced (Δ = ₹0.00)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Unbalanced: Diff ₹{Math.abs(difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Narration & Actions */}
      <div className="flex flex-col md:flex-row items-end justify-between gap-4 pt-2">
        <div className="w-full md:w-2/3">
          <Input
            label="Voucher Narration (Remarks)"
            value={overallNarration}
            onChange={(e) => setOverallNarration(e.target.value)}
            placeholder="Being payment made towards..."
            helperText="Narration will be logged in the permanent audit trail."
          />
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" size="md" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            disabled={!isBalanced}
            onClick={handlePost}
            shortcut="Ctrl+Enter"
          >
            Post Voucher
          </Button>
        </div>
      </div>
    </div>
  );
};
