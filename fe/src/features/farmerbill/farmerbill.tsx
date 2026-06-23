import { useState } from 'react';
import { Printer } from 'lucide-react';
import './farmerbill.css';

// ─── Indian number → words ─────────────────────────────────────────────────────
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function toWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1_000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
  if (n < 1_00_000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
  if (n < 1_00_00_000) return toWords(Math.floor(n / 1_00_000)) + ' Lakh' + (n % 1_00_000 ? ' ' + toWords(n % 1_00_000) : '');
  return toWords(Math.floor(n / 1_00_00_000)) + ' Crore' + (n % 1_00_00_000 ? ' ' + toWords(n % 1_00_00_000) : '');
}

function amountInWords(amount: number): string {
  if (!amount || amount <= 0) return '';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = toWords(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + toWords(paise) + ' Paise';
  return result + ' Only.';
}

// ─── Format number to Indian currency string ───────────────────────────────────
function fmt(n: number): string {
  if (!n || n === 0) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Reusable inline editable field ───────────────────────────────────────────
interface FieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
  upper?: boolean;
  width?: string;
}

function Field({
  value, onChange, placeholder = '', className = '',
  type = 'text', align = 'left', bold = false, upper = false, width = 'w-full',
}: FieldProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
      placeholder={placeholder}
      className={[
        'bg-transparent outline-none',
        'border-b border-dashed border-gray-400',
        'hover:border-blue-400 focus:border-blue-600',
        'placeholder:text-gray-300 text-gray-900',
        'transition-colors duration-150',
        width,
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        bold ? 'font-semibold' : '',
        className,
      ].join(' ')}
    />
  );
}

// ─── Initial state ─────────────────────────────────────────────────────────────
const INIT = {
  sellerName:      '',
  sellerAddress:   '',
  sellerPAN:       '',
  sellerGSTIN:     '',
  sellerBank:      '',
  sellerAccount:   '',
  sellerIFSC:      '',

  invoiceNo:       '',
  invoiceDate:     '',
  docketNo:        '',

  partyName:       '',
  partyAddress:    '',
  partyGSTIN:      '',
  partyPAN:        '',
  partyState:      '',
  partyCity:       '',
  transportName:   '',
  deliveryThrough: '',

  description:     '',
  hsnCode:         '',
  qty:             '',
  rate:            '',
  cgstRate:        '0',
  sgstRate:        '0',

  terms:           'As per provided in the Quotation and Order Form.',
};

type FormState = typeof INIT;

// ─── Component ────────────────────────────────────────────────────────────────
export default function FarmerBill() {
  const [s, setS] = useState<FormState>(INIT);

  // Single updater 
  const f = (key: keyof FormState) => (v: string) => setS(p => ({ ...p, [key]: v }));

  // ── Auto-calculations ──
  const qty      = parseFloat(s.qty)      || 0;
  const rate     = parseFloat(s.rate)     || 0;
  const cgstRate = parseFloat(s.cgstRate) || 0;
  const sgstRate = parseFloat(s.sgstRate) || 0;

  const taxableAmt = qty * rate;
  const cgstAmt    = (taxableAmt * cgstRate) / 100;
  const sgstAmt    = (taxableAmt * sgstRate) / 100;
  const finalAmt   = taxableAmt + cgstAmt + sgstAmt;
  const totalTax   = cgstAmt + sgstAmt;

  return (
    <div className="min-h-screen bg-gray-300 py-10 px-4 print:bg-white print:p-0">

      {/* ── Toolbar ── */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print-hide">
        <p className="text-xs text-gray-500 italic">
          Click any field to fill · Amounts calculate automatically
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded shadow-md transition-colors"
        >
          <Printer size={14} />
          Print Invoice
        </button>
      </div>

      {/* ── The invoice "paper" ── */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl invoice-container print:shadow-none">

        {/* HEADER */}
        <div className="relative border-b border-gray-600 p-4">
          <div className="text-center">
            <input
              value={s.sellerName}
              onChange={e => f('sellerName')(e.target.value)}
              placeholder="Your Firm / Business Name"
              className="text-2xl font-bold text-center bg-transparent outline-none w-full border-b border-dashed border-gray-300 hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300 transition-colors"
            />
            <input
              value={s.sellerAddress}
              onChange={e => f('sellerAddress')(e.target.value)}
              placeholder="Full Address, City, State — Pincode  |  Mobile: XXXXXXXXXX  |  Email: ..."
              className="mt-1 text-xs text-center bg-transparent outline-none w-full border-b border-dashed border-gray-300 hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300 transition-colors"
            />
            <div className="flex justify-center gap-8 mt-1.5 text-xs">
              <span className="flex items-baseline gap-1">
                <span className="font-semibold">PAN No.:</span>
                <Field value={s.sellerPAN} onChange={f('sellerPAN')} placeholder="XXXXX0000X" upper width="w-28" />
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-semibold">GSTIN No.:</span>
                <Field value={s.sellerGSTIN} onChange={f('sellerGSTIN')} placeholder="00XXXXX0000X0XX" upper width="w-40" />
              </span>
            </div>
          </div>
          <div className="absolute top-3 right-3 border border-gray-700 px-2 py-0.5 text-xs font-bold tracking-widest">
            ORIGINAL
          </div>
        </div>

        {/* TITLE */}
        <div className="text-center border-b border-gray-600 py-1 bg-gray-50">
          <span className="text-sm font-bold tracking-widest">TAX INVOICE</span>
        </div>

        {/* PARTY DETAILS & INVOICE INFO */}
        <div className="border-b border-gray-600 grid-2-1">
          <div className="border-r border-gray-600 p-3 space-y-1.5 text-xs">
            <div className="flex items-baseline gap-1">
              <span className="font-semibold whitespace-nowrap">M/s.</span>
              <Field value={s.partyName} onChange={f('partyName')} placeholder="Party / Buyer Name" bold />
            </div>
            <div className="pl-6">
              <Field value={s.partyAddress} onChange={f('partyAddress')} placeholder="Address..." />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">Party GSTIN</span><span>:</span>
              <Field value={s.partyGSTIN} onChange={f('partyGSTIN')} placeholder="24XXXXX0000X0XX" upper />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">Party PAN</span><span>:</span>
              <Field value={s.partyPAN} onChange={f('partyPAN')} placeholder="XXXXX0000X" upper />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">Docket No.</span><span>:</span>
              <Field value={s.docketNo} onChange={f('docketNo')} placeholder="" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">State</span><span>:</span>
              <Field value={s.partyState} onChange={f('partyState')} placeholder="24 - Gujarat" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">City</span><span>:</span>
              <Field value={s.partyCity} onChange={f('partyCity')} placeholder="" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">Transport Name</span><span>:</span>
              <Field value={s.transportName} onChange={f('transportName')} placeholder="" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">Delivery Through</span><span>:</span>
              <Field value={s.deliveryThrough} onChange={f('deliveryThrough')} placeholder="Vehicle No." upper />
            </div>
          </div>

          <div className="p-3 space-y-2 text-xs">
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap font-semibold">Invoice No.</span><span>:</span>
              <Field value={s.invoiceNo} onChange={f('invoiceNo')} placeholder="2009" bold />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap font-semibold">Invoice Date</span><span>:</span>
              <input
                type="date"
                value={s.invoiceDate}
                onChange={e => f('invoiceDate')(e.target.value)}
                className="bg-transparent outline-none flex-1 border-b border-dashed border-gray-400 hover:border-blue-400 focus:border-blue-600 text-xs w-full transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="border-b border-gray-600 overflow-x-auto">
          <table className="w-full text-xs table-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-600">
                {[
                  ['Sr.\nNo.',        'w-7',  'center'],
                  ['Description of Goods', 'flex-1','center'],
                  ['HSN /\nSAC',      'w-20', 'center'],
                  ['Qty.',            'w-14', 'center'],
                  ['Rate',            'w-16', 'center'],
                  ['Taxable\nAmt.',   'w-24', 'right'],
                  ['CGST\n%',         'w-10', 'center'],
                  ['CGST\nAmt.',      'w-20', 'right'],
                  ['SGST\n%',         'w-10', 'center'],
                  ['SGST\nAmt.',      'w-20', 'right'],
                  ['FINAL\nAMT',      'w-24', 'right'],
                ].map(([label, , align], i) => (
                  <th
                    key={i}
                    className={`p-1.5 font-semibold whitespace-pre-line text-${align} line-height-1-3 ${i < 10 ? 'border-r border-gray-400' : ''}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Filled item row */}
              <tr className="border-b border-gray-300 row-height-40">
                <td className="border-r border-gray-400 p-1 text-center align-middle">1</td>
                <td className="border-r border-gray-400 p-1 align-middle">
                  <Field value={s.description} onChange={f('description')} placeholder="MAG (MOONG)" upper />
                </td>
                <td className="border-r border-gray-400 p-1 align-middle">
                  <Field value={s.hsnCode} onChange={f('hsnCode')} placeholder="07133100" align="center" />
                </td>
                <td className="border-r border-gray-400 p-1 align-middle">
                  <Field value={s.qty} onChange={f('qty')} placeholder="0" type="number" align="right" />
                </td>
                <td className="border-r border-gray-400 p-1 align-middle">
                  <Field value={s.rate} onChange={f('rate')} placeholder="0.00" type="number" align="right" />
                </td>
                <td className="border-r border-gray-400 p-1 text-right align-middle font-medium">
                  {taxableAmt > 0 ? fmt(taxableAmt) : ''}
                </td>
                <td className="border-r border-gray-400 p-1 align-middle">
                  <Field value={s.cgstRate} onChange={f('cgstRate')} placeholder="0" type="number" align="center" />
                </td>
                <td className="border-r border-gray-400 p-1 text-right align-middle">
                  {cgstAmt > 0 ? fmt(cgstAmt) : '0.00'}
                </td>
                <td className="border-r border-gray-400 p-1 align-middle">
                  <Field value={s.sgstRate} onChange={f('sgstRate')} placeholder="0" type="number" align="center" />
                </td>
                <td className="border-r border-gray-400 p-1 text-right align-middle">
                  {sgstAmt > 0 ? fmt(sgstAmt) : '0.00'}
                </td>
                <td className="p-1 text-right align-middle font-semibold">
                  {finalAmt > 0 ? fmt(finalAmt) : ''}
                </td>
              </tr>

              {/* 3 empty rows */}
              {[2, 3, 4].map(n => (
                <tr key={n} className="border-b border-gray-200 row-height-32">
                  <td className="border-r border-gray-400 p-1 text-center text-gray-300 text-xs">{n}</td>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <td key={i} className="border-r border-gray-400" />
                  ))}
                  <td />
                </tr>
              ))}

              {/* Totals row */}
              <tr className="border-t-2 border-gray-600 bg-gray-50 font-semibold text-xs">
                <td colSpan={5} className="border-r border-gray-400 p-1.5 text-right">Final Amount</td>
                <td className="border-r border-gray-400 p-1.5 text-right">{fmt(taxableAmt)}</td>
                <td className="border-r border-gray-400" />
                <td className="border-r border-gray-400 p-1.5 text-right">{fmt(cgstAmt)}</td>
                <td className="border-r border-gray-400" />
                <td className="border-r border-gray-400 p-1.5 text-right">{fmt(sgstAmt)}</td>
                <td className="p-1.5 text-right">{fmt(finalAmt)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="grid-1-1 text-xs">
          <div className="border-r border-gray-600 p-3 space-y-3">
            <div>
              <span className="font-semibold">Amt in Word: </span>
              <span className="italic">
                {finalAmt > 0 ? amountInWords(finalAmt) : <span className="text-gray-300">Auto-generated when amount is entered</span>}
              </span>
            </div>
            <div className="space-y-1 pt-1 border-t border-gray-300">
              <div className="flex items-baseline gap-1">
                <span className="font-semibold whitespace-nowrap">Bank</span><span>:</span>
                <Field value={s.sellerBank} onChange={f('sellerBank')} placeholder="ICICI Bank" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-semibold whitespace-nowrap">Account No.</span><span>:</span>
                <Field value={s.sellerAccount} onChange={f('sellerAccount')} placeholder="000000000000" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-semibold whitespace-nowrap">IFSC</span><span>:</span>
                <Field value={s.sellerIFSC} onChange={f('sellerIFSC')} placeholder="XXXX0000000" upper />
              </div>
            </div>
            <div className="pt-1 border-t border-gray-300">
              <div className="font-semibold mb-1">Terms &amp; Condition</div>
              <textarea
                value={s.terms}
                onChange={e => f('terms')(e.target.value)}
                rows={2}
                className="w-full bg-transparent outline-none resize-none text-xs border border-dashed border-gray-300 hover:border-blue-400 focus:border-blue-600 transition-colors p-1"
              />
            </div>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Final Amount</span>
                <span className="font-medium">{fmt(taxableAmt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax Total (CGST + SGST)</span>
                <span className="font-medium">{fmt(totalTax)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-500 pt-1 font-bold text-sm">
                <span>Final Amount</span>
                <span>{fmt(finalAmt)}</span>
              </div>
            </div>
            <div className="text-right mt-10">
              <div className="font-semibold">
                For, {s.sellerName || <span className="text-gray-400 font-normal italic">[Your Firm Name]</span>}
              </div>
              <div className="mt-10 border-t border-gray-700 pt-1 text-gray-500">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}