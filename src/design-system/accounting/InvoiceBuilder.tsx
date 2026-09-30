import React, { useState } from 'react';
import { Plus, Trash2, Printer, Save, Check } from 'lucide-react';
import { Button } from '../core/Button';
import { Input } from '../core/Input';
import { DatePicker } from '../core/DatePicker';
import { Combobox, ComboboxItem } from '../core/Combobox';
import { TaxBreakdown } from './TaxBreakdown';

export interface InvoiceItemLine {
  id: string;
  productId: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  unitRate: number;
  discountPercent: number;
  taxRatePercent: number;
}

export interface InvoiceBuilderProps {
  customers: ComboboxItem[];
  products: ComboboxItem[];
  companyStateCode?: string;
  onSave: (invoice: unknown) => void;
  onPrintPreview?: () => void;
  onOpenCreateParty?: () => void;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  customers,
  products,
  companyStateCode = '27', // Maharashtra
  onSave,
  onPrintPreview,
  onOpenCreateParty,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('INV/2026/0481');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerGstin, setCustomerGstin] = useState('27AAACR1234F1Z5');
  const [placeOfSupply, setPlaceOfSupply] = useState('27'); // 27 = Intra-state

  const [items, setItems] = useState<InvoiceItemLine[]>([
    {
      id: '1',
      productId: 'p1',
      name: 'Server Blade Unit X9',
      hsnCode: '8471',
      quantity: 2,
      unit: 'NOS',
      unitRate: 45000,
      discountPercent: 0,
      taxRatePercent: 18,
    },
    {
      id: '2',
      productId: 'p2',
      name: 'Annual Cloud Maintenance Support',
      hsnCode: '998313',
      quantity: 1,
      unit: 'YR',
      unitRate: 15000,
      discountPercent: 5,
      taxRatePercent: 18,
    },
  ]);

  const isInterstate = placeOfSupply !== companyStateCode;

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        productId: '',
        name: '',
        hsnCode: '',
        quantity: 1,
        unit: 'NOS',
        unitRate: 0,
        discountPercent: 0,
        taxRatePercent: 18,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<InvoiceItemLine>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  // Calculations
  const lineCalculations = items.map((item) => {
    const gross = (item.quantity || 0) * (item.unitRate || 0);
    const discount = (gross * (item.discountPercent || 0)) / 100;
    const taxable = gross - discount;
    const taxAmount = (taxable * (item.taxRatePercent || 0)) / 100;
    return { gross, discount, taxable, taxAmount, total: taxable + taxAmount };
  });

  const subtotalTaxable = lineCalculations.reduce((sum, l) => sum + l.taxable, 0);
  const totalDiscount = lineCalculations.reduce((sum, l) => sum + l.discount, 0);
  const totalTax = lineCalculations.reduce((sum, l) => sum + l.taxAmount, 0);

  const rawTotal = subtotalTaxable + totalTax;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;

  const cgstAmount = isInterstate ? 0 : totalTax / 2;
  const sgstAmount = isInterstate ? 0 : totalTax / 2;
  const igstAmount = isInterstate ? totalTax : 0;

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded p-4 shadow-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Tax Invoice / Sales Voucher (F8)</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            GST compliant sales invoice with automatic Place of Supply tax split
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onPrintPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrintPreview}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print Preview
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSave({ invoiceNumber, items, roundedTotal })}
            leftIcon={<Save className="w-3.5 h-3.5" />}
            shortcut="Ctrl+S"
          >
            Save &amp; Post (F8)
          </Button>
        </div>
      </div>

      {/* Invoice Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded border border-slate-800/80">
        <Input
          label="Invoice Number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          required
        />
        <DatePicker label="Invoice Date" value={invoiceDate} onChange={setInvoiceDate} />
        <DatePicker label="Due Date" value={dueDate} onChange={setDueDate} />
        <div>
          <label className="text-[11px] font-medium text-slate-300 block mb-1">
            Place of Supply
          </label>
          <select
            value={placeOfSupply}
            onChange={(e) => setPlaceOfSupply(e.target.value)}
            className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
          >
            <option value="27">27 - Maharashtra (Intra-state: CGST+SGST)</option>
            <option value="07">07 - Delhi (Inter-state: IGST)</option>
            <option value="29">29 - Karnataka (Inter-state: IGST)</option>
            <option value="24">24 - Gujarat (Inter-state: IGST)</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <Combobox
            label="Customer Ledger"
            items={customers}
            value={selectedCustomerId}
            onChange={(item) => setSelectedCustomerId(item.id)}
            onCreateNew={onOpenCreateParty}
            placeholder="Select customer account (Alt+C)..."
          />
        </div>
        <div className="md:col-span-2">
          <Input
            label="Customer GSTIN"
            value={customerGstin}
            onChange={(e) => setCustomerGstin(e.target.value)}
            placeholder="15-character GSTIN (e.g. 27AAACR1234F1Z5)"
          />
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto border border-slate-800 rounded">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2 px-2.5 w-10 text-center">#</th>
              <th className="py-2 px-2.5 min-w-[200px]">Item Description</th>
              <th className="py-2 px-2 w-20">HSN</th>
              <th className="py-2 px-2 text-right w-20">Qty</th>
              <th className="py-2 px-2 w-16">Unit</th>
              <th className="py-2 px-2 text-right w-28">Rate (₹)</th>
              <th className="py-2 px-2 text-right w-20">Disc %</th>
              <th className="py-2 px-2 text-right w-28">Taxable (₹)</th>
              <th className="py-2 px-2 text-right w-20">GST %</th>
              <th className="py-2 px-2.5 text-right w-32">Total (₹)</th>
              <th className="py-2 px-1 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {items.map((item, idx) => {
              const calc = lineCalculations[idx];

              return (
                <tr key={item.id} className="hover:bg-slate-850/40">
                  <td className="py-1.5 px-2.5 text-center text-slate-500 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-2.5">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      placeholder="Product or service name..."
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="text"
                      value={item.hsnCode}
                      onChange={(e) => updateItem(idx, { hsnCode: e.target.value })}
                      placeholder="8471"
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 font-mono text-slate-300 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-1.5 text-right font-mono tabular-nums text-slate-100 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-1 text-slate-300 font-mono text-xs outline-none"
                    >
                      <option value="NOS">NOS</option>
                      <option value="PCS">PCS</option>
                      <option value="BOX">BOX</option>
                      <option value="KGS">KGS</option>
                      <option value="YR">YR</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitRate}
                      onChange={(e) =>
                        updateItem(idx, { unitRate: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-1.5 text-right font-mono tabular-nums text-slate-100 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={item.discountPercent}
                      onChange={(e) =>
                        updateItem(idx, { discountPercent: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-1 text-right font-mono tabular-nums text-slate-300 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-200">
                    ₹{calc.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={item.taxRatePercent}
                      onChange={(e) =>
                        updateItem(idx, { taxRatePercent: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-1 text-slate-300 font-mono text-xs outline-none"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-100">
                    ₹{calc.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => removeItem(idx)}
                      className="text-slate-500 hover:text-rose-400 disabled:opacity-20 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addItem} leftIcon={<Plus className="w-3 h-3" />}>
          Add Line Item
        </Button>
      </div>

      {/* Summary Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Input
            label="Terms & Declarations"
            placeholder="Subject to Mumbai jurisdiction. Goods once sold cannot be returned."
            defaultValue="Payment due within 30 days. All disputes subject to local jurisdiction."
          />
        </div>
        <div>
          <TaxBreakdown
            taxableAmount={subtotalTaxable}
            isInterstate={isInterstate}
            cgstRate={9}
            cgstAmount={cgstAmount}
            sgstRate={9}
            sgstAmount={sgstAmount}
            igstRate={18}
            igstAmount={igstAmount}
            discountAmount={totalDiscount}
            roundOff={roundOff}
            finalTotal={roundedTotal}
            placeOfSupplyState={isInterstate ? 'Inter-state Supply' : 'Intra-state Supply'}
          />
        </div>
      </div>
    </div>
  );
};
