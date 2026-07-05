import { useState } from 'react';
import { Printer, X } from 'lucide-react';
import './millbill.css';
import React from 'react';
// ─── Crop HSN map ──────────────────────────────────────────────────────────────
const CROPS: { label: string; hsn: string }[] = [
  { label: 'MOONG (GREEN GRAM)', hsn: '07133100' },
  { label: 'WHEAT', hsn: '10019910' },
  { label: 'COTTON', hsn: '52010012' },
  { label: 'CHANA (BENGAL GRAM)', hsn: '07132020' },
  { label: 'PEANUT (GROUNDNUT)', hsn: '12022090' },
];

// ─── Number → Indian words ─────────────────────────────────────────────────────
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
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

function fmt(n: number): string {
  if (!n || n === 0) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateForPrint(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Field component ───────────────────────────────────────────────────────────
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
        align === 'right' ? 'text-right' : '',
        align === 'center' ? 'text-center' : '',
        bold ? 'font-semibold' : '',
        className,
      ].join(' ')}
    />
  );
}

// ─── Seller constants — edit these once ───────────────────────────────────────
const SELLER_NAME = 'KARMA TRADING';
const SELLER_ADDRESS = '0, Baloch Road, Baloch PRA Shala, NEAR RAM MANDIR, Baloch, Porbandar, Gujarat, 362650';

// ─── Form state ────────────────────────────────────────────────────────────────
const INIT = {
  sellerPAN: 'APDPR2494B',
  sellerGSTIN: '24APDPR2494B1Z2',
  sellerBank: '',
  sellerAccount: '',
  sellerIFSC: '',
  invoiceNo: '',
  invoiceDate: todayISO(),
  docketNo: '',
  transportName: '',
  deliveryThrough: '',
  partyName: '',
  partyAddress: '',
  partyGSTIN: '',
  partyPAN: '',
  partyState: '',
  partyCity: '',
  terms: 'As per provided in the Quotation and Order Form.',
};

type FormState = typeof INIT;

interface RowState {
  crop: string;
  hsnCode: string;
  qty: string;
  rate: string;
  cgstRate: string;
  sgstRate: string;
}

const EMPTY_ROW: RowState = {
  crop: '', hsnCode: '', qty: '', rate: '', cgstRate: '', sgstRate: '',
};

// ─── Validation error popup ────────────────────────────────────────────────────
function ErrorPopup({ errors, onClose }: { errors: string[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white border border-red-300 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-red-600 text-base">Please fix before printing</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-2 transition-colors">
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-1.5 mb-5">
          {errors.map((e, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
              <span className="text-red-500 mt-0.5 shrink-0">•</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded transition-colors"
        >
          OK, let me fix it
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function MillBill() {
  const [s, setS] = useState<FormState>(INIT);
  const [rows, setRows] = useState<RowState[]>([
    { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW },
  ]);
  const [errors, setErrors] = useState<string[]>([]);

  const f = (key: keyof FormState) => (v: string) => setS(p => ({ ...p, [key]: v }));

  const updateRow = (index: number, field: keyof RowState, value: string) =>
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));

  const handleCropChange = (index: number, cropLabel: string) => {
    const found = CROPS.find(c => c.label === cropLabel);
    setRows(prev => prev.map((row, i) =>
      i === index ? { ...row, crop: cropLabel, hsnCode: found?.hsn ?? '', cgstRate: '0', sgstRate: '0' } : row
    ));
  };

  // ── Per-row calculations ──
  const rowCalcs = rows.map(row => {
    const qty = parseFloat(row.qty) || 0;
    const rate = parseFloat(row.rate) || 0;
    const cgstRate = parseFloat(row.cgstRate) || 0;
    const sgstRate = parseFloat(row.sgstRate) || 0;
    const taxableAmt = qty * rate;
    const cgstAmt = (taxableAmt * cgstRate) / 100;
    const sgstAmt = (taxableAmt * sgstRate) / 100;
    const finalAmt = taxableAmt + cgstAmt + sgstAmt;
    return { taxableAmt, cgstAmt, sgstAmt, finalAmt };
  });

  const totalTaxable = rowCalcs.reduce((sum, r) => sum + r.taxableAmt, 0);
  const totalCgst = rowCalcs.reduce((sum, r) => sum + r.cgstAmt, 0);
  const totalSgst = rowCalcs.reduce((sum, r) => sum + r.sgstAmt, 0);
  const totalFinal = rowCalcs.reduce((sum, r) => sum + r.finalAmt, 0);
  const totalTax = totalCgst + totalSgst;

  // ── Validate then print ────────────────────────────────────────────────────
  function handlePrint() {
    const errs: string[] = [];

    if (!s.partyName.trim()) errs.push('Party / Buyer name is required.');
    if (!s.invoiceNo.trim()) errs.push('Invoice number is required.');

    const filledRows = rows.filter(r => r.crop !== '');
    if (filledRows.length === 0) errs.push('Select at least one crop row before printing.');

    rows.forEach((row, idx) => {
      if (!row.crop) return;
      if (!row.qty || parseFloat(row.qty) <= 0)
        errs.push(`Row ${idx + 1} (${row.crop}): Quantity is missing or zero.`);
      if (!row.rate || parseFloat(row.rate) <= 0)
        errs.push(`Row ${idx + 1} (${row.crop}): Rate is missing or zero.`);
    });

    if (errs.length > 0) { setErrors(errs); return; }
    window.print();
  }

  return (
    <div className="min-h-screen bg-gray-300 py-10 px-4 print:bg-white print:p-0">

      {errors.length > 0 && (
        <ErrorPopup errors={errors} onClose={() => setErrors([])} />
      )}

      {/* ── Toolbar ── */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print-hide">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white
                     text-sm font-medium px-4 py-2 rounded shadow-md transition-colors"
        >
          <Printer size={16} />
          Print Invoice
        </button>
      </div>

      {/* ══════════════════════════════════════════
          INVOICE PAPER
      ══════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl invoice-container border border-gray-600 print:shadow-none">

        {/* ── HEADER ── */}
        <div className="relative border-b border-gray-600 p-5">
          <div className="text-center">
            <div className="text-3xl font-bold tracking-wide">{SELLER_NAME}</div>
            <div className="mt-1 text-sm text-gray-600">{SELLER_ADDRESS}</div>
            <div className="flex justify-center gap-8 mt-2 text-sm">
              <span className="flex items-baseline gap-1">
                <span className="font-semibold">PAN No.:</span>
                <Field value={s.sellerPAN} onChange={f('sellerPAN')} upper width="w-32" />
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-semibold">GSTIN No.:</span>
                <Field value={s.sellerGSTIN} onChange={f('sellerGSTIN')} upper width="w-44" />
              </span>
            </div>
          </div>
          <div className="absolute top-4 right-4 border border-gray-700 px-2 py-0.5 text-sm font-bold tracking-widest">
            ORIGINAL
          </div>
        </div>

        {/* ── TITLE BAR ── */}
        <div className="border border-gray-600 ">
          <div className="text-center border-b border-gray-600 py-1.5 bg-gray-200">
            <span className="text-base font-bold tracking-widest">TAX INVOICE</span>
          </div>
          {/* ── PARTY + INVOICE DETAILS ── */}
          {/* Swapped custom grid-2-1 for Tailwind grid to shrink the left side to 55% */}
          <div className="border-b border-gray-600 grid grid-cols-[55%_45%]">

            {/* LEFT — party details */}
            <div className="border-r border-gray-600 p-4">

              {/* ONE MASTER GRID FOR ALL LEFT DETAILS */}
              <div className="grid grid-cols-[100px_10px_1fr] items-baseline gap-y-1 text-sm">

                {/* 1. M/s. Name */}
                <span className="font-bold whitespace-nowrap text-base">M/s.</span>
                <span></span> {/* Empty column where the colon usually goes */}
                <input
                  value={s.partyName}
                  onChange={e => f('partyName')(e.target.value.toUpperCase())}
                  placeholder="PARTY / BUYER NAME"
                  className="bg-transparent outline-none border-b border-dashed border-gray-400
                           hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300
                           text-gray-900 transition-colors font-bold text-base w-full"
                />

                {/* 2. Address */}
                <span></span>
                <span></span>
                <textarea
                  rows={s.partyAddress.length > 45 || s.partyAddress.includes('\n') ? 2 : 1}
                  value={s.partyAddress}
                  onChange={e => f('partyAddress')(e.target.value.toUpperCase())}
                  placeholder="ADDRESS..."
                  className="bg-transparent outline-none border-b border-dashed border-gray-400
                           hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300
                           text-gray-900 transition-colors w-full resize-none overflow-hidden
                           leading-tight text-sm"
                />

                {/* 3. City, State, GSTIN, PAN */}
                {([
                  ['City', 'partyCity', false],
                  ['State', 'partyState', false],
                  ['Party GSTIN', 'partyGSTIN', true],
                  ['Party PAN', 'partyPAN', true],
                ] as [string, keyof FormState, boolean][]).map(([label, key, up]) => (
                  <React.Fragment key={key}>
                    <span className="whitespace-nowrap font-medium">{label}</span>
                    <span>:</span>
                    <Field value={s[key]} onChange={f(key)} upper={up} className="text-sm w-full" />
                  </React.Fragment>
                ))}

              </div>
            </div>

            {/* RIGHT — invoice info */}
            <div className="p-4 space-y-1 text-sm">

              {/* PERFECT COLON ALIGNMENT GRID (Right Side) */}
              <div className="grid grid-cols-[135px_10px_1fr] items-baseline gap-y-1">

                <span className="whitespace-nowrap font-semibold">Invoice No.</span>
                <span>:</span>
                <Field value={s.invoiceNo} onChange={f('invoiceNo')} bold className="text-sm w-full" />

                <span className="whitespace-nowrap font-semibold">Invoice Date</span>
                <span>:</span>
                <div className="flex-1 w-full">
                  <input
                    type="date"
                    value={s.invoiceDate}
                    onChange={e => f('invoiceDate')(e.target.value)}
                    className="bg-transparent outline-none w-full border-b border-dashed border-gray-400
                             hover:border-blue-400 focus:border-blue-600 text-sm transition-colors print-hide"
                  />
                  <span className="screen-hide">{formatDateForPrint(s.invoiceDate)}</span>
                </div>

                {([
                  ['Docket No.', 'docketNo', false],
                  ['Transport Name', 'transportName', false],
                  ['Delivery Through', 'deliveryThrough', true],
                ] as [string, keyof FormState, boolean][]).map(([label, key, up]) => (
                  <React.Fragment key={key}>
                    <span className="whitespace-nowrap font-semibold">{label}</span>
                    <span>:</span>
                    <Field
                      value={s[key]}
                      onChange={f(key)}
                      upper={up}
                      placeholder={key === 'deliveryThrough' ? 'Vehicle No.' : ''}
                      className="text-sm w-full"
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* ── ITEMS TABLE ── */}
          <div className="border-b border-gray-600 overflow-x-auto">
            <table className="w-full text-xs table-collapse">
              <thead>
                <tr className="bg-gray-300 border-b border-gray-600">
                  {([
                    ['Sr.\nNo.', 'center'],
                    ['Description of Goods', 'center'],
                    ['HSN /\nSAC', 'center'],
                    ['Qty.', 'center'],
                    ['Rate', 'center'],
                    ['Taxable\nAmt.', 'right'],
                    ['CGST\n%', 'center'],
                    ['CGST\nAmt.', 'right'],
                    ['SGST\n%', 'center'],
                    ['SGST\nAmt.', 'right'],
                    ['FINAL\nAMT', 'right'],
                  ] as [string, string][]).map(([label, align], i) => (
                    <th
                      key={i}
                      className={`p-2 font-semibold whitespace-pre-line text-${align} line-height-1-3
                      ${i < 10 ? 'border-r border-gray-400' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const { taxableAmt, cgstAmt, sgstAmt, finalAmt } = rowCalcs[idx];
                  const isEmpty = row.crop === '';

                  return (
                    <tr key={idx} className="border-b border-gray-300 row-height-44">

                      {/* Sr. No. — always visible on screen; on print only if filled */}
                      <td className="border-r border-gray-400 p-1 text-center align-middle text-sm">
                        <span className="print-hide">{idx + 1}</span>
                        {!isEmpty && <span className="screen-hide">{idx + 1}</span>}
                      </td>

                      {/* Crop — dropdown on screen, plain text on print */}
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <select
                          value={row.crop}
                          onChange={e => handleCropChange(idx, e.target.value)}
                          className="crop-select bg-transparent outline-none w-full border-b border-dashed
                                   border-gray-400 hover:border-blue-400 focus:border-blue-600
                                   text-xs transition-colors text-gray-900 print-hide"
                        >
                          <option value="">— Select Crop —</option>
                          {CROPS.map(c => (
                            <option key={c.label} value={c.label}>{c.label}</option>
                          ))}
                        </select>
                        {/* Print: show crop name only — empty rows show nothing */}
                        {!isEmpty && (
                          <span className="screen-hide font-medium">{row.crop}</span>
                        )}
                      </td>

                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.hsnCode} onChange={v => updateRow(idx, 'hsnCode', v)} align="center" />
                      </td>
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.qty} onChange={v => updateRow(idx, 'qty', v)} type="number" align="right" />
                      </td>
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.rate} onChange={v => updateRow(idx, 'rate', v)} type="number" align="right" />
                      </td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle font-medium">
                        {taxableAmt > 0 ? fmt(taxableAmt) : ''}
                      </td>
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.cgstRate} onChange={v => updateRow(idx, 'cgstRate', v)} type="number" align="center" />
                      </td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle">
                        {isEmpty ? '' : (cgstAmt > 0 ? fmt(cgstAmt) : '0.00')}
                      </td>
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.sgstRate} onChange={v => updateRow(idx, 'sgstRate', v)} type="number" align="center" />
                      </td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle">
                        {isEmpty ? '' : (sgstAmt > 0 ? fmt(sgstAmt) : '0.00')}
                      </td>
                      <td className="p-1 text-right align-middle font-semibold">
                        {finalAmt > 0 ? fmt(finalAmt) : ''}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr className="border-t-2 border-gray-600 bg-gray-200 font-semibold text-sm">
                  <td colSpan={5} className="border-r border-gray-400 p-2 text-center">Final Amount</td>
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(totalTaxable)}</td>
                  <td className="border-r border-gray-400" />
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(totalCgst)}</td>
                  <td className="border-r border-gray-400" />
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(totalSgst)}</td>
                  <td className="p-2 text-right">{fmt(totalFinal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── FOOTER ── */}
          <div className="flex flex-col text-sm">

            {/* 1. Amount in Words Row (Full width with bottom border) */}
            <div className="border-b border border-gray-600 p-3">
              <span className="font-semibold">Amt in Word: </span>
              <span className="italic ml-2">
                {totalFinal > 0
                  ? amountInWords(totalFinal)
                  : <span className="text-gray-300">Auto-generated when amount is entered</span>}
              </span>
            </div>

            {/* 2. Bank Details Row (With bottom border, GSTIN/PAN ignored) */}
            <div className="border-b border-gray-600 p-3">
              <div className="grid grid-cols-[90px_10px_1fr] items-baseline gap-y-1.5 w-1/2">
                <span className="whitespace-nowrap">Bank</span>
                <span>:</span>
                <Field value={s.sellerBank} onChange={f('sellerBank')} placeholder="Bank Name" className="w-full" />

                <span className="whitespace-nowrap">Account No.</span>
                <span>:</span>
                <Field value={s.sellerAccount} onChange={f('sellerAccount')} placeholder="000000000000" className="w-full" />

                <span className="whitespace-nowrap">IFSC</span>
                <span>:</span>
                <Field value={s.sellerIFSC} onChange={f('sellerIFSC')} placeholder="XXXX0000000" upper className="w-full" />
              </div>
            </div>
          </div>
        </div>
        {/* 3. Terms & Signatory Row */}
        <div className="grid grid-cols-2 p-3 min-h-[120px]">
          {/* Left: Terms */}
          <div className="flex flex-col pr-4">
            <div className="font-bold text-base mb-1">Terms & Condition</div>
            <textarea
              value={s.terms}
              onChange={e => f('terms')(e.target.value)}
              rows={2}
              className="w-full bg-transparent outline-none resize-none text-sm border border-dashed
                           border-gray-300 hover:border-blue-400 focus:border-blue-600 transition-colors p-1"
            />
          </div>
          {/* Right: Signatory */}
          <div className="flex flex-col justify-between text-right">
            <div className="font-bold text-base">For, {SELLER_NAME}</div>
            <div className="mt-12 text-gray-900">
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}