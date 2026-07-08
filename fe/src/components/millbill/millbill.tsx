import { useState, useEffect } from 'react';
import { Printer, X, Eye, Pencil, Save as SaveIcon, Send as SendIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './millbill.css';
import React from 'react';
import { settings } from "@/settings";
import Decimal from 'decimal.js';
import karmaLogo from '@/assets/karma_trading_logo.png';

// ─── Profile config shapes (matches backend ProfileConfigSchema) ──────────────
interface ProfileBank { bank: string; account: string; ifsc: string }
interface ProfileCrop { hsn: string; cgst: string; sgst: string }
interface ProfileData {
  seller: { name: string; address: string; pan: string; gstin: string };
  bank_accounts: ProfileBank[];
  crops: Record<string, ProfileCrop>;
  terms_and_conditions: string;
}

// ─── Crop option shape: array of dict, "crop" as key ───────────────────────────
interface CropOption { crop: string; hsn: string; cgst: string; sgst: string }

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

function amountInWords(amount: Decimal | null | undefined): string {
  if (!amount || amount.lte(0)) {
    return '';
  }
  const safeAmount = amount.toDecimalPlaces(2);
  const rupees = safeAmount.floor().toNumber();
  return toWords(rupees) + ' Rupees' + ' Only.';
}

// ─── Safely convert any string/number/undefined into a Decimal ────────────────
const parseDecimal = (val: string | number | undefined | null): Decimal => {
  if (val === undefined || val === null || val === '') return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
};

// ─── Format a Decimal to 2-decimal Indian-format string for display only ──────
function fmt(x: Decimal): string {
  const n = x.toNumber();
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

// ─── Central form state — every field is a plain string ───────────────────────
const INIT = {
  sellerName: '',
  sellerAddress: '',
  sellerPAN: '',
  sellerGSTIN: '',
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
  partyState: '24-Gujarat',
  partyCity: '',
  final_taxable_amount: '',
  final_cgst_amount: '',
  final_sgst_amount: '',
  final_amount: '',
  final_amount_in_words: '',
  terms: '',
};

type FormState = typeof INIT;

// UQC options 
const uqcOptions = ["KGS", "TONS", "MTN", "NOS",];


// ─── Per-crop-row state — every field is a plain string ───────────────────────
interface RowState {
  crop: string;
  hsnCode: string;
  qty: string;
  uqc: string;
  rate: string;
  taxableAmt: string;
  cgstRate: string;
  cgstAmt: string;
  sgstRate: string;
  sgstAmt: string;
  finalAmt: string;
}

const EMPTY_ROW: RowState = {
  crop: '', hsnCode: '', qty: '', uqc: '', rate: '', taxableAmt: '', cgstRate: '', cgstAmt: '', sgstRate: '', sgstAmt: '', finalAmt: '',
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

// ─── Saving overlay — shown while the bill is being POSTed to the backend ─────
function SavingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print-hide">
      <div className="bg-white rounded-lg shadow-xl px-8 py-6 flex flex-col items-center gap-3">
        <div className="mb-spinner" />
        <span className="text-sm text-gray-700 font-medium">Saving...</span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function MillBill() {
  // ── Central state — all bill fields as strings ───────────────────────────────
  const [s, setS] = useState<FormState>(INIT);

  // ── Per-row crop state — all fields as strings ────────────────────────────────
  const [rows, setRows] = useState<RowState[]>([
    { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW },
    { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW },
  ]);

  const [errors, setErrors] = useState<string[]>([]);

  // ── View mode: 'edit' (default, fully editable) → 'preview' (validated,
  //    read-only, looks like print) → 'saved' (posted to backend, print/send) ──
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'saved'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const isReadOnly = viewMode !== 'edit';

  // ── Profile-driven state ──────────────────────────────────────────────────────
  const [profileLoading, setProfileLoading] = useState(true);
  const [cropOptions, setCropOptions] = useState<CropOption[]>([]);
  const [bankAccountOptions, setBankAccountOptions] = useState<ProfileBank[]>([]);
  const [selectedBankIndex, setSelectedBankIndex] = useState(0);

  // ── Fetch profile config on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch(`${settings.BE_URL}/profile-configuration`)
      .then(r => r.json())
      .then((data: ProfileData & { detail?: string }) => {
        if (!data || data.detail) return;   // 404 — no profile saved yet, keep defaults
        setS(prev => ({
          ...prev,
          sellerName: data.seller.name,
          sellerAddress: data.seller.address,
          sellerPAN: data.seller.pan,
          sellerGSTIN: data.seller.gstin,
          terms: data.terms_and_conditions,
        }));

        // Build crop dropdown from profile.crops — array of dict, "crop" as key
        const cropsFromProfile: CropOption[] = Object.entries(data.crops || {}).map(([name, c]) => ({
          crop: name,
          hsn: c.hsn,
          cgst: c.cgst,
          sgst: c.sgst,
        }));
        if (cropsFromProfile.length > 0) setCropOptions(cropsFromProfile);

        // Bank accounts — array of dict
        const banks = data.bank_accounts || [];
        setBankAccountOptions(banks);
        if (banks.length >= 1) {
          setSelectedBankIndex(0);
          setS(prev => ({
            ...prev,
            sellerBank: banks[0].bank,
            sellerAccount: banks[0].account,
            sellerIFSC: banks[0].ifsc,
          }));
        }
      })
      .catch(console.error)
      .finally(() => setProfileLoading(false));
  }, []);

  const rowInputsKey = rows.map(r => `${r.qty}|${r.rate}|${r.cgstRate}|${r.sgstRate}`).join(',');

  useEffect(() => {
    setRows(prev => prev.map(row => {
      const qty = parseDecimal(row.qty);
      const rate = parseDecimal(row.rate);
      const cgstRate = parseDecimal(row.cgstRate);
      const sgstRate = parseDecimal(row.sgstRate);

      const taxableAmt = qty.mul(rate);
      const cgstAmt = taxableAmt.mul(cgstRate).div(100);
      const sgstAmt = taxableAmt.mul(sgstRate).div(100);
      const finalAmt = taxableAmt.plus(cgstAmt).plus(sgstAmt);

      return {
        ...row,
        taxableAmt: taxableAmt.toString(),
        cgstAmt: cgstAmt.toString(),
        sgstAmt: sgstAmt.toString(),
        finalAmt: finalAmt.toString(),
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowInputsKey]);

  // ── Totals: sum row strings via Decimal, store back into central state as strings ──
  useEffect(() => {
    const totalTaxable = rows.reduce((sum, r) => sum.plus(parseDecimal(r.taxableAmt)), new Decimal(0));
    const totalCgst = rows.reduce((sum, r) => sum.plus(parseDecimal(r.cgstAmt)), new Decimal(0));
    const totalSgst = rows.reduce((sum, r) => sum.plus(parseDecimal(r.sgstAmt)), new Decimal(0));
    const totalFinal = rows.reduce((sum, r) => sum.plus(parseDecimal(r.finalAmt)), new Decimal(0));

    setS(prev => ({
      ...prev,
      final_taxable_amount: totalTaxable.toString(),
      final_cgst_amount: totalCgst.toString(),
      final_sgst_amount: totalSgst.toString(),
      final_amount: totalFinal.toString(),
      final_amount_in_words: amountInWords(totalFinal),
    }));
  }, [rows]);

  // ── Loading screen — shown while profile fetch is in flight ──────────────────
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-300 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="mb-spinner" />
          <span className="text-sm text-gray-600 font-medium">Loading bill settings...</span>
        </div>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const f = (key: keyof FormState) => (v: string) => setS(p => ({ ...p, [key]: v }));

  const updateRow = (index: number, field: keyof RowState, value: string) =>
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));

  const handleCropChange = (index: number, cropName: string) => {
    const found = cropOptions.find(c => c.crop === cropName);
    setRows(prev => prev.map((row, i) =>
      i === index
        ? { ...row, crop: cropName, hsnCode: found?.hsn ?? '', cgstRate: found?.cgst ?? '0', sgstRate: found?.sgst ?? '0' }
        : row
    ));
  };

  const handleBankSelect = (idx: number) => {
    const b = bankAccountOptions[idx];
    if (b) {
      setSelectedBankIndex(idx);
      setS(prev => ({ ...prev, sellerBank: b.bank, sellerAccount: b.account, sellerIFSC: b.ifsc }));
    }
  };

  const handleuqcChange = (index: number, uqc: string) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, uqc } : row));
  };

  // ── Build plain JSON payload from central state — all values as strings ──────
  function buildPayload() {
    return {
      ...s,
      crops: rows.map(row => ({ ...row })),
    };
  }

  // ── Shared validation, reused by the Preview flow ─────────────────────────────
  function validateBill(): string[] {
    const errs: string[] = [];
    if (!s.partyName.trim()) errs.push('Party / Buyer name is required.');
    if (!s.invoiceNo.trim()) errs.push('Invoice number is required.');
    if(!s.partyGSTIN.trim()) errs.push('Party / Buyer GSTIN is required.');
    if(!s.sellerGSTIN.trim()) errs.push('Seller GSTIN is required.');
    if(!s.sellerPAN.trim()) errs.push('Seller PAN is required.');
    if(!s.partyPAN.trim()) errs.push('Party / Buyer PAN is required.');
    if(!s.deliveryThrough) errs.push('Delivery through is required.');
    const filledRows = rows.filter(r => r.crop !== '');
    if (filledRows.length === 0) errs.push('Select at least one crop row before printing.');
    rows.forEach((row, idx) => {
      if (!row.crop) return;
      if (!row.qty || parseFloat(row.qty) <= 0)
        errs.push(`Row ${idx + 1} (${row.crop}): Quantity is missing or zero.`);
      if (!row.rate || parseFloat(row.rate) <= 0)
        errs.push(`Row ${idx + 1} (${row.crop}): Rate is missing or zero.`);
    });
    return errs;
  }

  // ── Validate then print (kept as-is; still usable if wired up elsewhere) ─────
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

    // Send plain JSON, all datatypes as string, built from central state
    const payload = buildPayload();
    fetch(`${settings.BE_URL}/save-mill-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(console.error);

    window.print();
  }

  // ── Preview button: validate, then switch to the read-only preview view
  //    (same visual styling as print, but no window.print() call) ──────────────
  function handlePreview() {
    const errs = validateBill();
    if (errs.length > 0) { setErrors(errs); return; }
    setViewMode('preview');
  }

  // ── Edit button (from preview): go back to the fully editable form ───────────
  function handleEdit() {
    setViewMode('edit');
  }

  // ── Save button (from preview): POST to backend, show saving animation,
  //    then move to the 'saved' view with Print / Send actions ────────────────
  async function handleSaveBill() {
    setIsSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`${settings.BE_URL}/save-mill-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ? String(body.detail) : 'Failed to save bill.');
      }
      setViewMode('saved');
    } catch (err) {
      console.error(err);
      setErrors([err instanceof Error ? err.message : 'Failed to save bill. Please try again.']);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Print button (from saved view) ────────────────────────────────────────────
  function handlePrintFinal() {
    window.print();
  }

  // ── Send button (from saved view) — placeholder hook for whatever "send"
  //    should do (email/WhatsApp/share); wire this up to the real action later ──
  function handleSend() {
    // TODO: wire up the actual send/share action
    console.log('Send bill:', buildPayload());
  }

  // ── Decimal values derived from central-state strings, for display only ──────
  const totalTaxableDec = parseDecimal(s.final_taxable_amount);
  const totalCgstDec = parseDecimal(s.final_cgst_amount);
  const totalSgstDec = parseDecimal(s.final_sgst_amount);
  const totalFinalDec = parseDecimal(s.final_amount);


  // ── Render bill ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-300 py-10 px-4 print:bg-white print:p-0">
      
      {errors.length > 0 && (
        <ErrorPopup errors={errors} onClose={() => setErrors([])} />
      )}

      {isSaving && <SavingOverlay />}

      {/* ══════════════════════════════════════════
          INVOICE PAPER
      ══════════════════════════════════════════ */}
      <div className={`max-w-4xl mx-auto bg-white shadow-2xl invoice-container border border-gray-600 print:shadow-none ${isReadOnly ? 'preview-mode' : ''}`}>

        {/* ── HEADER ── */}
        <div className="relative border-b border-gray-600 p-5">
          <div className="text-center">
            <div className="text-3xl font-bold tracking-wide">{s.sellerName}</div>
            <div className="mt-1 text-sm text-gray-600">{s.sellerAddress}</div>
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
        <div className="border border-gray-600">
          <div className="text-center border-b border-gray-600 py-1.5 bg-gray-200">
            <span className="text-base font-bold tracking-widest">TAX INVOICE</span>
          </div>

          {/* ── PARTY + INVOICE DETAILS ── */}
          <div className="border-b border-gray-600 grid grid-cols-[55%_45%]">

            {/* LEFT — party details */}
            <div className="border-r border-gray-600 p-4">
              <div className="grid grid-cols-[100px_10px_1fr] items-baseline gap-y-1 text-sm">

                <span className="font-bold whitespace-nowrap text-base">M/s.</span>
                <span></span>
                <input
                  value={s.partyName}
                  onChange={e => f('partyName')(e.target.value.toUpperCase())}
                  placeholder="PARTY / BUYER NAME"
                  className="bg-transparent outline-none border-b border-dashed border-gray-400
                             hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300
                             text-gray-900 transition-colors font-bold text-base w-full"
                />

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
                <div className="col-span-3 border-b border-gray-400 my-2 print:my-1 -mx-4 w-[calc(100%+2rem)]"></div>
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
                    ['UQC', 'center'],
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
                  const isEmpty = row.crop === '';
                  const taxableAmt = parseDecimal(row.taxableAmt);
                  const cgstAmt = parseDecimal(row.cgstAmt);
                  const sgstAmt = parseDecimal(row.sgstAmt);
                  const finalAmt = parseDecimal(row.finalAmt);

                  return (
                    <tr key={idx} className="border-b border-gray-300 row-height-44">

                      <td className="border-r border-gray-400 p-1 text-center align-middle text-sm">
                        <span className="print-hide">{idx + 1}</span>
                        {!isEmpty && <span className="screen-hide">{idx + 1}</span>}
                      </td>

                      <td className="border-r border-gray-400 p-1 align-middle">
                        <select
                          value={row.crop}
                          onChange={e => handleCropChange(idx, e.target.value)}
                          className="crop-select bg-transparent outline-none w-full border-b border-dashed
                                     border-gray-400 hover:border-blue-400 focus:border-blue-600
                                     text-xs transition-colors text-gray-900 print-hide"
                        >
                          <option value="">— Select Crop —</option>
                          {cropOptions.map(c => (
                            <option key={c.crop} value={c.crop}>{c.crop}</option>
                          ))}
                        </select>
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
                        <select
                          value={row.uqc}
                          onChange={e => handleuqcChange(idx, e.target.value)}
                          className="crop-select bg-transparent outline-none w-full border-b border-dashed
                                     border-gray-400 hover:border-blue-400 focus:border-blue-600
                                     text-xs transition-colors text-gray-900 print-hide text-center"
                        >
                          <option value="">— Select UQC —</option>
                          {uqcOptions.map((uqc, i) => (
                            <option key={i} value={uqc}>{uqc}</option>
                          ))}
                        </select>
                        {!isEmpty && (
                          <span className="screen-hide font-medium">{row.uqc}</span>
                        )}
                      </td>
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.rate} onChange={v => updateRow(idx, 'rate', v)} type="number" align="right" />
                      </td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle font-medium">
                        {taxableAmt.gt(0) ? fmt(taxableAmt) : ''}
                      </td>
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.cgstRate} onChange={v => updateRow(idx, 'cgstRate', v)} type="number" align="center" />
                      </td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle">
                        {isEmpty ? '' : (cgstAmt.gt(0) ? fmt(cgstAmt) : '0.00')}
                      </td>
                      <td className="border-r border-gray-400 p-1 align-middle">
                        <Field value={row.sgstRate} onChange={v => updateRow(idx, 'sgstRate', v)} type="number" align="center" />
                      </td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle">
                        {isEmpty ? '' : (sgstAmt.gt(0) ? fmt(sgstAmt) : '0.00')}
                      </td>
                      <td className="p-1 text-right align-middle font-semibold">
                        {finalAmt.gt(0) ? fmt(finalAmt) : ''}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr className="border-t-2 border-gray-600 bg-gray-200 font-semibold text-sm">
                  <td colSpan={5} className="border-r border-gray-400 p-2 text-center">Final Amount</td>
                  <td className="border-r border-gray-400 p-2 text-right"></td>
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(totalTaxableDec)}</td>
                  <td className="border-r border-gray-400" />
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(totalCgstDec)}</td>
                  <td className="border-r border-gray-400" />
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(totalSgstDec)}</td>
                  <td className="p-2 text-right">{fmt(totalFinalDec)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── FOOTER ── */}
          <div className="flex flex-col text-sm">

            {/* Amount in words */}
            <div className="border-b border border-gray-600 p-3">
              <span className="font-semibold">Amt in Word: </span>
              <span className="italic ml-2">
                {totalFinalDec.gt(0)
                  ? s.final_amount_in_words
                  : <span className="text-gray-300">Auto-generated when amount is entered</span>}
              </span>
            </div>

            {/* Bank details */}
            <div className="border-b border-gray-600 p-3">

              {bankAccountOptions.length > 1 && (
                <div className="mb-2 print-hide">
                  <label className="text-xs font-semibold text-gray-600 mr-2">Select Bank Account:</label>
                  <select
                    value={selectedBankIndex}
                    onChange={e => handleBankSelect(Number(e.target.value))}
                    className="bg-transparent outline-none border-b border-dashed border-gray-400
                               hover:border-blue-400 focus:border-blue-600 text-sm transition-colors"
                  >
                    {bankAccountOptions.map((b, i) => (
                      <option key={i} value={i}>{b.bank} - {b.account}</option>
                    ))}
                  </select>
                </div>
              )}

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

        {/* Terms & Signatory */}
        <div className="grid grid-cols-2 p-3 min-h-[120px]">
          <div className="flex flex-col pr-4">
            <div className="font-bold text-base mb-1">Terms &amp; Condition</div>
            <textarea
              value={s.terms}
              onChange={e => f('terms')(e.target.value)}
              rows={2}
              className="w-full bg-transparent outline-none resize-none text-sm border border-dashed
                         border-gray-300 hover:border-blue-400 focus:border-blue-600 transition-colors p-1"
            />
          </div>
          <div className="flex flex-col justify-between text-right">
            <div className="font-bold text-base">For, {s.sellerName}</div>
            <div className="mt-12 text-gray-900">Authorised Signatory</div>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════
          BOTTOM ACTION BAR — horizontally centred,
          buttons change depending on viewMode
      ══════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto mt-6 flex items-center justify-center gap-4 print-hide">
        {viewMode === 'edit' && (
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white
                       text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors"
          >
            <Eye size={16} />
            Preview Bill
          </button>
        )}

        {viewMode === 'preview' && (
          <>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800
                         border border-gray-400 text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors"
            >
              <Pencil size={16} />
              Edit
            </button>
            <button
              onClick={handleSaveBill}
              disabled={isSaving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60
                         disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors"
            >
              <SaveIcon size={16} />
              Save
            </button>
          </>
        )}

        {viewMode === 'saved' && (
          <>
            <button
              onClick={handlePrintFinal}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white
                         text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={handleSend}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors"
            >
              <SendIcon size={16} />
              Send
            </button>
          </>
        )}
      </div>
    </div>
  );
}