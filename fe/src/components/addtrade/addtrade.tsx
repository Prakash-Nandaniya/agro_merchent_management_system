import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Loader2, Save as SaveIcon, AlertTriangle, TrendingUp, TrendingDown, FileText, Calendar, Wheat } from 'lucide-react';
import './addtrade.css';
import { settings } from '@/settings';
import { apiFetch } from '@/utils/apifetch';

function toPaise(v: string): number {
  const n = parseFloat(v);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

function paiseToAmountStr(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function AddTrade() {
  const navigate = useNavigate();
  const location = useLocation();
  const existingTrade = location.state?.trade as any;
  const isEditMode = !!existingTrade;

  const [invoiceNo, setInvoiceNo] = useState(existingTrade?.invoice_no || '');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [partyName, setPartyName] = useState(existingTrade?.party_name || '');
  const [crop, setCrop] = useState(existingTrade?.crop || '');
  const [rate, setRate] = useState(existingTrade?.rate != null ? String(existingTrade.rate) : '');
  const [hasInvoice, setHasInvoice] = useState(isEditMode);

  const [tradeDate, setTradeDate] = useState(existingTrade?.trade_date || todayISO());
  const [paymentFromMill, setPaymentFromMill] = useState(existingTrade?.payment_from_mill || '');

  const [farmerPayment, setFarmerPayment] = useState(existingTrade?.farmer_payment || '');
  const [labourCost, setLabourCost] = useState(existingTrade?.labour_cost || '');
  const [transportCost, setTransportCost] = useState(existingTrade?.transport_cost || '');
  const [otherCost, setOtherCost] = useState(existingTrade?.other_cost || '');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleFetchInvoice() {
    if (!invoiceNo.trim()) return;
    setFetching(true);
    setFetchError('');
    setHasInvoice(false);
    try {
      const res = await apiFetch(`${settings.BE_URL}/trade-invoiceNo-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_no: invoiceNo.trim() }),
      });
      if (res.status === 404) { setFetchError('No invoice found with this invoice number.'); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      const bill = Array.isArray(data) ? data[0] : data;
      if (!bill) { setFetchError('No invoice found with this invoice number.'); return; }
      setPartyName(bill.party_name ?? '');
      setCrop(bill.crop ?? '');
      setRate(bill.rate != null ? String(bill.rate) : '');
      setHasInvoice(true);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setFetching(false);
    }
  }

  const inflowPaise = toPaise(paymentFromMill);
  const outflowPaise = toPaise(farmerPayment) + toPaise(labourCost) + toPaise(transportCost) + toPaise(otherCost);
  const profitLossPaise = inflowPaise - outflowPaise;

  async function handleSave() {
    if (!hasInvoice) { setSaveError('Fetch a valid invoice before saving the trade.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        invoice_no: invoiceNo.trim(),
        party_name: partyName, crop, rate: rate || '0',
        trade_date: tradeDate,
        payment_from_mill: paymentFromMill || '0',
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
            <p className="at-subtitle">Record inflow from mill and outflow to farmers, labour & transport.</p>
          </div>
          <div className="at-date-card">
            <Calendar size={16} />
            <label className="at-label">Trade Date</label>
            <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
          </div>
        </header>

        {/* Details panel (full width) */}
        <section className="at-panel at-panel--details">
          <div className="at-panel-head">
            <FileText size={18} />
            <h2 className="at-section-title">Trade Details</h2>
          </div>

          <div className="at-invoice-row">
            <div className="at-field at-field--grow">
              <label className="at-label">Invoice No.</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchInvoice()}
                placeholder="Enter invoice number"
                disabled={isEditMode}
              />
            </div>
            {!isEditMode && (
              <button className="at-btn-fetch" onClick={handleFetchInvoice} disabled={fetching || !invoiceNo.trim()}>
                {fetching ? <Loader2 size={16} className="at-spin" /> : <Search size={16} />}
                {fetching ? 'Fetching...' : 'Fetch'}
              </button>
            )}
          </div>

          {fetchError && (
            <div className="at-banner-error">
              <AlertTriangle size={16} />
              {fetchError}
            </div>
          )}

          <div className="at-form-grid">
            <div className="at-field">
              <label className="at-label">Party Name</label>
              <input type="text" value={partyName} readOnly disabled={!hasInvoice} />
            </div>
            <div className="at-field">
              <label className="at-label"><Wheat size={12} style={{ display: 'inline', marginRight: 4 }} />Crop</label>
              <input type="text" value={crop} readOnly disabled={!hasInvoice} />
            </div>
            <div className="at-field">
              <label className="at-label">Rate (₹)</label>
              <input type="text" className="at-mono" value={rate} readOnly disabled={!hasInvoice} />
            </div>
          </div>
        </section>

        {/* Two column: inflow + outflow */}
        <div className="at-two-col">
          <section className="at-panel at-panel--inflow">
            <div className="at-panel-head">
              <TrendingUp size={18} />
              <h2 className="at-section-title">Inflow</h2>
            </div>
            <div className="at-form-grid">
              <div className="at-field at-field--full">
                <label className="at-label">Payment from Mill</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="at-mono"
                  value={paymentFromMill}
                  onChange={(e) => setPaymentFromMill(e.target.value)}
                  placeholder="0.00"
                />
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
                <input type="number" inputMode="decimal" className="at-mono" value={farmerPayment} onChange={(e) => setFarmerPayment(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">Labour Cost</label>
                <input type="number" inputMode="decimal" className="at-mono" value={labourCost} onChange={(e) => setLabourCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">Transport Cost</label>
                <input type="number" inputMode="decimal" className="at-mono" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="at-field">
                <label className="at-label">Other Cost</label>
                <input type="number" inputMode="decimal" className="at-mono" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </section>
        </div>

        {/* Summary */}
        <section className="at-summary">
          <div className="at-summary-item">
            <span className="at-summary-label">Inflow</span>
            <span className="at-summary-value">₹ {paiseToAmountStr(inflowPaise)}</span>
          </div>
          <div className="at-summary-divider" />
          <div className="at-summary-item">
            <span className="at-summary-label">Outflow</span>
            <span className="at-summary-value">₹ {paiseToAmountStr(outflowPaise)}</span>
          </div>
          <div className={`at-summary-item at-summary-item--grand ${profitLossPaise >= 0 ? 'at-profit' : 'at-loss'}`}>
            <span className="at-summary-label">{profitLossPaise >= 0 ? 'Net Profit' : 'Net Loss'}</span>
            <span className="at-summary-value">₹ {paiseToAmountStr(Math.abs(profitLossPaise))}</span>
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
