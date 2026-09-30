import React, { useState } from 'react';
import { Button } from '../core/Button';
import { Input } from '../core/Input';
import { DatePicker } from '../core/DatePicker';
import { Combobox, ComboboxItem } from '../core/Combobox';
import { CurrencyInput } from '../core/CurrencyInput';

export interface OutstandingBill {
  billNumber: string;
  billDate: string;
  originalAmount: number;
  pendingAmount: number;
  allocatedAmount: number;
}

export interface PaymentFormProps {
  partyLedgers: ComboboxItem[];
  bankLedgers: ComboboxItem[];
  sampleBills?: OutstandingBill[];
  onPostPayment: (data: unknown) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  partyLedgers,
  bankLedgers,
  sampleBills = [
    { billNumber: 'PB/2026/011', billDate: '2026-09-01', originalAmount: 45000, pendingAmount: 45000, allocatedAmount: 0 },
    { billNumber: 'PB/2026/029', billDate: '2026-09-15', originalAmount: 30000, pendingAmount: 30000, allocatedAmount: 0 },
  ],
  onPostPayment,
}) => {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNumber, setPaymentNumber] = useState('PAY/2026/0092');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [referenceNumber, setReferenceNumber] = useState('HDFCN2691823');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [narration, setNarration] = useState('');

  const [bills, setBills] = useState<OutstandingBill[]>(sampleBills);

  const handleAllocate = (index: number, amt: number) => {
    setBills((prev) =>
      prev.map((b, i) => (i === index ? { ...b, allocatedAmount: amt } : b))
    );
  };

  const autoAllocate = () => {
    let remaining = totalAmount;
    setBills((prev) =>
      prev.map((bill) => {
        if (remaining <= 0) return { ...bill, allocatedAmount: 0 };
        const alloc = Math.min(bill.pendingAmount, remaining);
        remaining -= alloc;
        return { ...bill, allocatedAmount: alloc };
      })
    );
  };

  const allocatedTotal = bills.reduce((sum, b) => sum + b.allocatedAmount, 0);
  const unallocatedAmount = Math.max(0, totalAmount - allocatedTotal);

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Payment Voucher (F5)
          </h3>
          <p className="text-[11px] text-slate-400">
            Outward disbursement to vendor with bill-by-bill reference settlement
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={totalAmount <= 0}
          onClick={() =>
            onPostPayment({ paymentNumber, paymentDate, totalAmount, bills })
          }
          shortcut="Ctrl+Enter"
        >
          Post Payment (F5)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded border border-slate-800/80">
        <Input
          label="Payment Voucher #"
          value={paymentNumber}
          onChange={(e) => setPaymentNumber(e.target.value)}
          required
        />
        <DatePicker label="Payment Date" value={paymentDate} onChange={setPaymentDate} />
        <div>
          <label className="text-[11px] font-medium text-slate-300 block mb-1">
            Payment Mode
          </label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
          >
            <option value="NEFT">NEFT / RTGS</option>
            <option value="IMPS">IMPS Immediate</option>
            <option value="CHEQUE">Cheque</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash in Hand</option>
          </select>
        </div>
        <Input
          label="UTR / Cheque Ref"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
        />

        <div className="md:col-span-2">
          <Combobox
            label="Paid To (Vendor / Creditor Account)"
            items={partyLedgers}
            value={selectedPartyId}
            onChange={(item) => setSelectedPartyId(item.id)}
            placeholder="Search vendor ledger..."
          />
        </div>

        <div className="md:col-span-2">
          <Combobox
            label="Paid From (Bank / Cash Account)"
            items={bankLedgers}
            value={selectedBankId}
            onChange={(item) => setSelectedBankId(item.id)}
            placeholder="Select bank or cash ledger..."
          />
        </div>

        <div className="md:col-span-2">
          <CurrencyInput
            label="Total Amount Paid"
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
            Auto-Allocate FIFO Against Pending Bills
          </Button>
        </div>
      </div>

      {/* Bill-by-Bill Allocation Table */}
      <div className="border border-slate-800 rounded overflow-hidden">
        <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">
            Bill-wise Settlement Allocations
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Unallocated / On Account: ₹{unallocatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
            <tr>
              <th className="py-2 px-3">Ref Bill No</th>
              <th className="py-2 px-3">Bill Date</th>
              <th className="py-2 px-3 text-right">Original (₹)</th>
              <th className="py-2 px-3 text-right">Pending Due (₹)</th>
              <th className="py-2 px-3 text-right w-40">Allocated (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {bills.map((bill, idx) => (
              <tr key={bill.billNumber} className="hover:bg-slate-850/50">
                <td className="py-2 px-3 font-semibold text-indigo-300">{bill.billNumber}</td>
                <td className="py-2 px-3 text-slate-400">{bill.billDate}</td>
                <td className="py-2 px-3 text-right text-slate-300">
                  ₹{bill.originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-right text-rose-300 font-semibold">
                  ₹{bill.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    value={bill.allocatedAmount || ''}
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
        placeholder="Being payment made towards vendor invoice..."
      />
    </div>
  );
};
