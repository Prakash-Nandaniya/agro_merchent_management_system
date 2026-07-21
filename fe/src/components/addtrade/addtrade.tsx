import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Save as SaveIcon, AlertTriangle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import Decimal from 'decimal.js';
import './addtrade.css';
import { settings } from '@/settings';
import { apiFetch } from '@/utils/apifetch';

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

  // ── Actual money received from mill = mill payment + TDS - GST ─────────────
  const inflowDec = parseDecimal(millPayment).plus(parseDecimal(tdsDeducted)).minus(parseDecimal(gstCollected));
  const outflowDec = parseDecimal(farmerPayment)
    .plus(parseDecimal(labourCost))
    .plus(parseDecimal(transportCost))
    .plus(parseDecimal(otherCost));
  const profitLossDec = inflowDec.minus(outflowDec);

  function handleQtyUnitSelect(value: string) {
      setMillQtyUnit(value);
  }

  function handleRateUnitSelect(value: string) {
      setMillRateUnit(value);
  }

  async function handleSave() {
    if (!invoiceNo.trim()) {
      setSaveError('Invoice number is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        invoice_no: invoiceNo.trim(),
        trade_creation_date: tradeDate,
        mill_qty: millQty || '0',
        mill_qty_unit: millQtyUnit,
        mill_rate: millRate || '0',
        mill_rate_unit: millRateUnit,
        gst_collected: gstCollected || '0',
        tds_deducted: tdsDeducted || '0',
        mill_payment: millPayment || '0',
        farmer_payment: farmerPayment || '0',
        labour_cost: labourCost || '0',
        transport_cost: transportCost || '0',
        other_cost: otherCost || '0',
      };

      const url = isEditMode ? `${settings.BE_URL}/edittrade` : `${settings.BE_URL}/addtrade`;
      const body = isEditMode ? JSON.stringify({ id: existingTrade!.id, ...payload }) : JSON.stringify(payload);

      const res = await apiFetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok) {
        const body2 = await res.json().catch(() => ({}));
        throw new Error(body2.detail || `Request failed with status ${res.status}`);
      }

      navigate('/trade-book');
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