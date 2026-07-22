import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Save as SaveIcon, AlertTriangle, TrendingUp, TrendingDown, Calendar, FileText, Plus, X } from 'lucide-react';
import Decimal from 'decimal.js';
import './addtrade.css';
import { settings } from '@/settings';
import { apiFetch } from '@/utils/apifetch';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ─── Safely convert any string/number/undefined into a Decimal ────────────────
const parseDecimal = (val: string | number | undefined | null): Decimal => {
  if (val === undefined || val === null || val === '') return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
};

// ─── Format a Decimal to 2-decimal Indian-format string, display only ─────────
function fmt(x: Decimal): string {
  return x.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Preset units offered in the quantity / rate dropdowns ────────────────────
const UNIT_OPTIONS = ['Kg', 'Qtl', 'T', 'MT'];


export default function AddTrade() {
  const navigate = useNavigate();
  const location = useLocation();
  const existingTrade = location.state?.trade as any;
  const isEditMode = !!existingTrade;

  const [invoiceNo, setInvoiceNo] = useState(existingTrade?.invoice_no || '');
  const [tradeDate, setTradeDate] = useState(existingTrade?.trade_creation_date || todayISO());

  // ── Inflow ────────────────────────────────────────────────────────────────
  const [millQty, setMillQty] = useState(existingTrade?.mill_qty || '');
  const [millQtyUnit, setMillQtyUnit] = useState(existingTrade?.mill_qty_unit || '');

  const [millRate, setMillRate] = useState(existingTrade?.mill_rate || '');
  const [millRateUnit, setMillRateUnit] = useState(existingTrade?.mill_rate_unit || '');

  const [gstCollected, setGstCollected] = useState(existingTrade?.gst_collected || '');
  const [tdsDeducted, setTdsDeducted] = useState(existingTrade?.tds_deducted || '');
  const [millPayment, setMillPayment] = useState(existingTrade?.mill_payment || '');

  // ── Outflow ───────────────────────────────────────────────────────────────
  const [farmerPayment, setFarmerPayment] = useState(existingTrade?.farmer_payment || '');
  const [labourCost, setLabourCost] = useState(existingTrade?.labour_cost || '');
  const [transportCost, setTransportCost] = useState(existingTrade?.transport_cost || '');
  const [otherCost, setOtherCost] = useState(existingTrade?.other_cost || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptEdited, setReceiptEdited] = useState(false);
  const [existingReceiptKey] = useState<string | null>(existingTrade?.mill_receipt || null);
  const [millReceiptUrl, setMillReceiptUrl] = useState<string>('');
  const [millReceiptIsPdf, setMillReceiptIsPdf] = useState(false);
  const [loadingExistingReceipt, setLoadingExistingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    const tradeId = existingTrade?.id;
    if (!tradeId || !existingTrade?.mill_receipt) return;

    setLoadingExistingReceipt(true);
    (async () => {
      try {
        const res = await apiFetch(`${settings.BE_URL}/get-mill-receipt/${tradeId}`);
        if (!res.ok) return;
        const data = await res.json();
        setMillReceiptUrl(data.url);
        setMillReceiptIsPdf(true); // everything stored server-side is normalized to PDF
      } catch {
      } finally {
        setLoadingExistingReceipt(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openReceiptPicker() {
    receiptFileInputRef.current?.click();
  }

  function handleReceiptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptError('');
    setReceiptFile(file);
    setReceiptEdited(true);

    const localPreviewUrl = URL.createObjectURL(file);
    setMillReceiptUrl(localPreviewUrl);
    setMillReceiptIsPdf(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

    e.target.value = '';
  }

  function handleRemoveReceipt() {
    setReceiptFile(null);
    setMillReceiptUrl('');
    setMillReceiptIsPdf(false);
    setReceiptEdited(true);
  }

  // ── Actual money received from mill = mill payment + TDS - GST ─────────────
  const inflowDec = parseDecimal(millPayment).plus(parseDecimal(tdsDeducted)).minus(parseDecimal(gstCollected));
  const outflowDec = parseDecimal(farmerPayment)
    .plus(parseDecimal(labourCost))
    .plus(parseDecimal(transportCost))
    .plus(parseDecimal(otherCost));
  const profitLossDec = inflowDec.minus(outflowDec);

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pdfWidth, setPdfWidth] = useState<number>(520);

  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      // Cap at 520 on large screens, but shrink to fit on small ones
      setPdfWidth(Math.min(el.clientWidth, 520));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [millReceiptUrl]); // re-measure when a receipt loads in

  function handleQtyUnitSelect(value: string) {
    setMillQtyUnit(value);
  }

  function handleRateUnitSelect(value: string) {
    setMillRateUnit(value);
  }

  function toDDMMYYYY(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}-${month}-${year}`;
  }

  async function handleSave() {
    if (!invoiceNo.trim()) {
      setSaveError('Invoice number is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const fd = new FormData();
      fd.append('invoice_no', invoiceNo.trim());
      fd.append('trade_creation_date', toDDMMYYYY(tradeDate));
      fd.append('mill_qty', millQty || '0');
      fd.append('mill_qty_unit', millQtyUnit);
      fd.append('mill_rate', millRate || '0');
      fd.append('mill_rate_unit', millRateUnit);
      fd.append('gst_collected', gstCollected || '0');
      fd.append('tds_deducted', tdsDeducted || '0');
      fd.append('mill_payment', millPayment || '0');
      fd.append('farmer_payment', farmerPayment || '0');
      fd.append('labour_cost', labourCost || '0');
      fd.append('transport_cost', transportCost || '0');
      fd.append('other_cost', otherCost || '0');

      if (isEditMode) {
        fd.append('id', existingTrade!.id);
        fd.append('receipt_edited', String(receiptEdited));
        if (existingReceiptKey) fd.append('existing_mill_receipt', existingReceiptKey);
      }

      if (receiptFile) fd.append('file', receiptFile);

      const url = isEditMode ? `${settings.BE_URL}/edit-trade` : `${settings.BE_URL}/create-trade`;
      const res = await apiFetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail =
          typeof body.detail === 'string'
            ? body.detail
            : Array.isArray(body.detail)
              ? body.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
              : `Request failed with status ${res.status}`;
        throw new Error(detail);
      }

      navigate('/dashboard');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="at-page">
      <div className="at-shell">
        {/* Header */}
        <header className="at-header">
          <div>
            <div className="at-eyebrow">Trade Book</div>
            <h1 className="at-title">{isEditMode ? 'Edit Trade' : 'Add New Trade'}</h1>
            <p className="at-subtitle">Record inflow from mill and outflow to farmers, labour &amp; transport.</p>
          </div>
          <div className="at-date-card">
            <Calendar size={16} />
            <label className="at-label">Trade Date</label>
            <input
              type="date"
              className="at-date-input"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
            />
          </div>
        </header>

        {/* Invoice No. - plain inline field, underline only */}
        <div className="at-invoice-inline">
          <label className="at-label">Invoice No.</label>
          <input
            type="text"
            className="at-invoice-input"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            readOnly={isEditMode}
          />
        </div>

        {/* Two column: outflow + inflow */}
        <div className="at-two-col">
          <section className="at-panel at-panel--inflow">
            <div className="at-panel-head">
              <TrendingUp size={18} />
              <h2 className="at-section-title">Inflow</h2>
            </div>
            <div className="at-form-grid">
              {/* Mill Qty — unit dropdown sits next to the label, not the value */}
              <div className="at-field">
                <div className="at-label-row">
                  <label className="at-label">Mill Qty</label>
                  <span className="at-label-paren">(</span>
                  <select
                    className="at-rate-inline-select"
                    value={millQtyUnit}
                    onChange={(e) => handleQtyUnitSelect(e.target.value)}
                  >
                    <option value="">unit</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <span className="at-label-paren">)</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  className="at-millqty-input"
                  value={millQty}
                  onChange={(e) => setMillQty(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Mill Rate — (per unit) dropdown sits next to the label */}
              <div className="at-field">
                <div className="at-label-row">
                  <label className="at-label">Mill Rate</label>
                  <span className="at-label-paren">(per</span>
                  <select
                    className="at-rate-inline-select"
                    value={millRateUnit}
                    onChange={(e) => handleRateUnitSelect(e.target.value)}
                  >
                    <option value="">unit</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <span className="at-label-paren">)</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  className="at-millrate-input"
                  value={millRate}
                  onChange={(e) => setMillRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="at-field">
                <label className="at-label">GST Collected</label>
                <input type="number" inputMode="decimal" className="at-gst-input" value={gstCollected} onChange={(e) => setGstCollected(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">TDS Deducted</label>
                <input type="number" inputMode="decimal" className="at-tds-input" value={tdsDeducted} onChange={(e) => setTdsDeducted(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">Mill Payment</label>
                <input type="number" inputMode="decimal" className="at-millpayment-input" value={millPayment} onChange={(e) => setMillPayment(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </section>
          <section className="at-panel at-panel--outflow">
            <div className="at-panel-head">
              <TrendingDown size={18} />
              <h2 className="at-section-title">Outflow</h2>
            </div>
            <div className="at-form-grid">
              <div className="at-field">
                <label className="at-label">Farmer Payment</label>
                <input type="number" inputMode="decimal" className="at-farmer-input" value={farmerPayment} onChange={(e) => setFarmerPayment(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">Labour Cost</label>
                <input type="number" inputMode="decimal" className="at-labour-input" value={labourCost} onChange={(e) => setLabourCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">Transport Cost</label>
                <input type="number" inputMode="decimal" className="at-transport-input" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">Other Cost</label>
                <input type="number" inputMode="decimal" className="at-other-input" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </section>
        </div>

        {/* Summary */}
        <section className="at-summary">
          <div className="at-summary-item">
            <span className="at-summary-label">Inflow</span>
            <span className="at-summary-value">₹ {fmt(inflowDec)}</span>
          </div>
          <div className="at-summary-divider" />
          <div className="at-summary-item">
            <span className="at-summary-label">Outflow</span>
            <span className="at-summary-value">₹ {fmt(outflowDec)}</span>
          </div>
          <div className={`at-summary-item at-summary-item--grand ${profitLossDec.gte(0) ? 'at-profit' : 'at-loss'}`}>
            <span className="at-summary-label">{profitLossDec.gte(0) ? 'Net Profit' : 'Net Loss'}</span>
            <span className="at-summary-value">₹ {fmt(profitLossDec.abs())}</span>
          </div>
        </section>

        {/* Mill Receipt — staged locally, only uploaded when Save is hit */}
        <section className="at-receipt-section">
          <div className="at-receipt-section__header">
            <FileText size={18} />
            <h2 className="at-receipt-section__title">Mill Receipt</h2>
          </div>

          <input
            ref={receiptFileInputRef}
            type="file"
            className="at-receipt-section__hidden-input"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*,application/pdf"
            onChange={handleReceiptFileChange}
          />

          {!millReceiptUrl && !loadingExistingReceipt && (
            <button
              type="button"
              className="at-receipt-section__add-btn"
              onClick={openReceiptPicker}
            >
              <Plus size={16} />
              Add Mill Receipt
            </button>
          )}

          {loadingExistingReceipt && (
            <div className="at-receipt-section__loading">
              <Loader2 size={16} className="at-spin" />
              Loading receipt...
            </div>
          )}

          {millReceiptUrl && (
            <div className="at-receipt-section__preview">
              <button
                type="button"
                className="at-receipt-section__remove-btn"
                onClick={handleRemoveReceipt}
                title="Remove receipt"
              >
                <X size={20} />
              </button>

              {millReceiptIsPdf ? (
                <div className="at-receipt-section__pdf-frame" ref={pdfContainerRef}>
                  <Document
                    file={receiptFile || millReceiptUrl}
                    loading={<div className="at-receipt-section__loading"><Loader2 size={16} className="at-spin" />Loading receipt...</div>}
                    error={<div className="at-receipt-section__error"><AlertTriangle size={16} />Could not load PDF.</div>}
                  >
                    <Page pageNumber={1} width={pdfWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                  </Document>
                </div>
              ) : (
                <img src={millReceiptUrl} className="at-receipt-section__image" alt="Mill receipt" />
              )}
            </div>
          )}

          {receiptError && (
            <div className="at-receipt-section__error">
              <AlertTriangle size={16} />
              {receiptError}
            </div>
          )}
        </section>

        {saveError && (
          <div className="at-banner-error">
            <AlertTriangle size={16} />
            {saveError}
          </div>
        )}

        <div className="at-actions">
          <button className="at-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="at-spin" /> : <SaveIcon size={16} />}
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}