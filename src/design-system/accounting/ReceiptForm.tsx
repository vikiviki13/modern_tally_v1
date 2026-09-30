import React, { useState } from 'react';
import { Button } from '../core/Button';
import { Input } from '../core/Input';
import { DatePicker } from '../core/DatePicker';
import { Combobox, ComboboxItem } from '../core/Combobox';
import { CurrencyInput } from '../core/CurrencyInput';

export interface CustomerInvoiceRef {
  invoiceNumber: string;
  invoiceDate: string;
  originalAmount: number;
  pendingAmount: number;
  allocatedAmount: number;
}

export interface ReceiptFormProps {
  customerLedgers: ComboboxItem[];
  bankLedgers: ComboboxItem[];
  sampleInvoices?: CustomerInvoiceRef[];
  onPostReceipt: (data: unknown) => void;
}

export const ReceiptForm: React.FC<ReceiptFormProps> = ({
  customerLedgers,
  bankLedgers,
  sampleInvoices = [
    { invoiceNumber: 'INV/2026/0401', invoiceDate: '2026-09-05', originalAmount: 85000, pendingAmount: 85000, allocatedAmount: 0 },
    { invoiceNumber: 'INV/2026/0415', invoiceDate: '2026-09-18', originalAmount: 38000, pendingAmount: 38000, allocatedAmount: 0 },
  ],
  onPostReceipt,
}) => {
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNumber, setReceiptNumber] = useState('REC/2026/0148');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('UPI-2691823101');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [narration, setNarration] = useState('');

  const [invoices, setInvoices] = useState<CustomerInvoiceRef[]>(sampleInvoices);

  const handleAllocate = (index: number, amt: number) => {
    setInvoices((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, allocatedAmount: amt } : inv))
    );
  };

  const autoAllocate = () => {
    let remaining = totalAmount;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (remaining <= 0) return { ...inv, allocatedAmount: 0 };
        const alloc = Math.min(inv.pendingAmount, remaining);
        remaining -= alloc;
        return { ...inv, allocatedAmount: alloc };
      })
    );
  };

  const allocatedTotal = invoices.reduce((sum, i) => sum + i.allocatedAmount, 0);
  const unallocatedAmount = Math.max(0, totalAmount - allocatedTotal);

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Receipt Voucher (F6)
          </h3>
          <p className="text-[11px] text-slate-400">
            Customer inward payment collection with invoice knockoff and advance tracking
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={totalAmount <= 0}
          onClick={() =>
            onPostReceipt({ receiptNumber, receiptDate, totalAmount, invoices })
          }
          shortcut="Ctrl+Enter"
        >
          Post Receipt (F6)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded border border-slate-800/80">
        <Input
          label="Receipt Voucher #"
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
          required
        />
        <DatePicker label="Receipt Date" value={receiptDate} onChange={setReceiptDate} />
        <div>
          <label className="text-[11px] font-medium text-slate-300 block mb-1">
            Collection Mode
          </label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
          >
            <option value="UPI">UPI Instant</option>
            <option value="NEFT">NEFT / RTGS</option>
            <option value="IMPS">IMPS Immediate</option>
            <option value="CHEQUE">Cheque Clearance</option>
            <option value="CASH">Cash in Hand</option>
          </select>
        </div>
        <Input
          label="Reference / UTR #"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
        />

        <div className="md:col-span-2">
          <Combobox
            label="Received From (Customer / Debtor Account)"
            items={customerLedgers}
            value={selectedCustomerId}
            onChange={(item) => setSelectedCustomerId(item.id)}
            placeholder="Search customer account..."
          />
        </div>

        <div className="md:col-span-2">
          <Combobox
            label="Deposit To (Bank / Cash Account)"
            items={bankLedgers}
            value={selectedBankId}
            onChange={(item) => setSelectedBankId(item.id)}
            placeholder="Select bank or cash ledger..."
          />
        </div>

        <div className="md:col-span-2">
          <CurrencyInput
            label="Total Amount Received"
            value={totalAmount}
            onChange={setTotalAmount}
          />
        </div>

        <div className="md:col-span-2 flex items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={autoAllocate}
            disabled={totalAmount <= 0}
            className="w-full"
          >
            Auto-Allocate FIFO Against Invoices
          </Button>
        </div>
      </div>

      {/* Invoice Allocation Table */}
      <div className="border border-slate-800 rounded overflow-hidden">
        <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">
            Open Invoices for Settlement
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Unallocated / Advance: ₹{unallocatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
            <tr>
              <th className="py-2 px-3">Invoice No</th>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3 text-right">Original (₹)</th>
              <th className="py-2 px-3 text-right">Pending Balance (₹)</th>
              <th className="py-2 px-3 text-right w-40">Allocated (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {invoices.map((inv, idx) => (
              <tr key={inv.invoiceNumber} className="hover:bg-slate-850/50">
                <td className="py-2 px-3 font-semibold text-indigo-300">{inv.invoiceNumber}</td>
                <td className="py-2 px-3 text-slate-400">{inv.invoiceDate}</td>
                <td className="py-2 px-3 text-right text-slate-300">
                  ₹{inv.originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-right text-rose-300 font-semibold">
                  ₹{inv.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    value={inv.allocatedAmount || ''}
                    onChange={(e) => handleAllocate(idx, parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-right font-mono text-emerald-300 text-xs outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Input
        label="Narration"
        value={narration}
        onChange={(e) => setNarration(e.target.value)}
        placeholder="Being amount received against sales invoices..."
      />
    </div>
  );
};
