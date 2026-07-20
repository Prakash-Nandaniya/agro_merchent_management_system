import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Loader2, AlertTriangle, Pencil, Trash2, X } from 'lucide-react';
import './tradebook.css';
import { settings } from '@/settings';
import { apiFetch } from '@/utils/apifetch';

export interface Trade {
  id: number;
  invoice_no: string;
  party_name: string;
  crop: string;
  invoice_date: string;
  trade_date: string;
  inflow_amount: string;
  farmer_payment: string;
  labour_cost: string;
  transport_cost: string;
  other_cost: string;
  created_by: string;
}

interface Filters {
  party_name: string;
  crop: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: Filters = { party_name: '', crop: '', date_from: '', date_to: '' };

function toNum(v: string | undefined | null): number {
  const n = parseFloat(v || '0');
  return isNaN(n) ? 0 : n;
}

function fmtAmount(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateDMY(iso: string | undefined | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function tradeOutflow(t: Trade): number {
  return toNum(t.farmer_payment) + toNum(t.labour_cost) + toNum(t.transport_cost) + toNum(t.other_cost);
}

function tradeProfitLoss(t: Trade): number {
  return toNum(t.inflow_amount) - tradeOutflow(t);
}

export default function TradeBook() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  async function runSearch() {
    const payload: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) payload[key] = value;
    });

    setLoading(true);
    setRequestError('');
    setHasSearched(true);

    try {
      const res = await apiFetch(`${settings.BE_URL}/tradebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        setTrades([]);
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed with status ${res.status}`);
      } else {
        const data: Trade[] = await res.json();
        setTrades(data);
      }
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not reach the server.');
      setTrades(null);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(t: Trade) {
    navigate('/add-trade', { state: { trade: t } });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await apiFetch(`${settings.BE_URL}/deletetrade`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed with status ${res.status}`);
      }

      setTrades((prev) => prev ? prev.filter((t) => t.id !== deleteTarget.id) : prev);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setDeleting(false);
    }
  }

  const totals = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    let inflow = 0, farmer = 0, labour = 0, transport = 0, other = 0;
    trades.forEach((t) => {
      inflow += toNum(t.inflow_amount);
      farmer += toNum(t.farmer_payment);
      labour += toNum(t.labour_cost);
      transport += toNum(t.transport_cost);
      other += toNum(t.other_cost);
    });
    const outflow = farmer + labour + transport + other;
    return { inflow, farmer, labour, transport, other, outflow, profitLoss: inflow - outflow };
  }, [trades]);

  return (
    <div className="tb-page">
      <div className="tb-header">
        <div>
          <h1 className="tb-title">Trade Book</h1>
          <p className="tb-subtitle">Track full trade cycles — mill payments, farmer payouts, labour &amp; transport</p>
        </div>
      </div>

      <div className="tb-panel">
        <div className="tb-filter-grid">
          <div className="tb-field">
            <label className="tb-label" htmlFor="party_name">Party name</label>
            <input id="party_name" placeholder="Contains..." value={filters.party_name} onChange={(e) => updateFilter('party_name', e.target.value)} />
          </div>
          <div className="tb-field">
            <label className="tb-label" htmlFor="crop">Crop</label>
            <input id="crop" placeholder="Contains..." value={filters.crop} onChange={(e) => updateFilter('crop', e.target.value)} />
          </div>
          <div className="tb-field">
            <label className="tb-label" htmlFor="date_from">Date from</label>
            <input id="date_from" type="date" value={filters.date_from} onChange={(e) => updateFilter('date_from', e.target.value)} />
          </div>
          <div className="tb-field">
            <label className="tb-label" htmlFor="date_to">Date to</label>
            <input id="date_to" type="date" value={filters.date_to} onChange={(e) => updateFilter('date_to', e.target.value)} />
          </div>
        </div>

        <div className="tb-actions">
          <button className="tb-btn-ghost" onClick={clearFilters} type="button">
            <RotateCcw size={14} /> Clear filters
          </button>
          <button className="tb-btn-primary" onClick={runSearch} disabled={loading} type="button">
            {loading ? <Loader2 size={14} className="tb-spin" /> : <Search size={14} />}
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {requestError && (
        <div className="tb-banner-error">
          <AlertTriangle size={16} />
          <span>{requestError}</span>
        </div>
      )}

      {hasSearched && !loading && trades && trades.length === 0 && !requestError && (
        <div className="tb-empty">No trades match these filters.</div>
      )}

      {trades && trades.length > 0 && (
        <>
          <div className="tb-table-wrap">
            <table className="tb-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="tb-num">Inflow</th>
                  <th className="tb-num">Outflow</th>
                  <th className="tb-num">P/L</th>
                  <th className="tb-num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const outflow = tradeOutflow(t);
                  const pl = tradeProfitLoss(t);
                  return (
                    <tr key={t.id}>
                      <td className="tb-mono" data-label="Date">{formatDateDMY(t.trade_date)}</td>
                      <td className="tb-num tb-mono" data-label="Inflow">₹ {fmtAmount(toNum(t.inflow_amount))}</td>
                      <td className="tb-num tb-mono" data-label="Outflow">₹ {fmtAmount(outflow)}</td>
                      <td className={`tb-num tb-mono tb-strong ${pl >= 0 ? 'tb-profit' : 'tb-loss'}`} data-label="P/L">
                        ₹ {fmtAmount(pl)}
                      </td>
                      <td className="tb-num tb-row-actions" data-label="Actions">
                        <button className="tb-icon-btn tb-icon-btn--edit" onClick={() => handleEdit(t)} type="button" aria-label="Edit trade">
                          <Pencil size={15} />
                        </button>
                        <button className="tb-icon-btn tb-icon-btn--delete" onClick={() => setDeleteTarget(t)} type="button" aria-label="Delete trade">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totals && (
            <div className="tb-totals">
              <div className="tb-total-item">
                <span className="tb-total-label">Total Inflow</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.inflow)}</span>
              </div>
              <div className="tb-total-item">
                <span className="tb-total-label">Farmer Payment</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.farmer)}</span>
              </div>
              <div className="tb-total-item">
                <span className="tb-total-label">Labour Cost</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.labour)}</span>
              </div>
              <div className="tb-total-item">
                <span className="tb-total-label">Transport Cost</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.transport)}</span>
              </div>
              <div className="tb-total-item">
                <span className="tb-total-label">Other Cost</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.other)}</span>
              </div>
              <div className="tb-total-item">
                <span className="tb-total-label">Total Outflow</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.outflow)}</span>
              </div>
              <div className={`tb-total-item tb-total-grand ${totals.profitLoss >= 0 ? 'tb-profit' : 'tb-loss'}`}>
                <span className="tb-total-label">{totals.profitLoss >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.profitLoss)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {deleteTarget && (
        <div className="tb-modal-overlay">
          <div className="tb-modal">
            <div className="tb-modal-header">
              <h3 className="tb-modal-title">Delete trade?</h3>
              <button className="tb-modal-close" onClick={() => setDeleteTarget(null)} type="button" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="tb-modal-text">
              This will permanently delete the trade for invoice <strong>{deleteTarget.invoice_no}</strong> ({deleteTarget.party_name}). This action cannot be undone.
            </p>
            {deleteError && (
              <div className="tb-banner-error">
                <AlertTriangle size={16} />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="tb-modal-actions">
              <button className="tb-btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting} type="button">
                Cancel
              </button>
              <button className="tb-btn-danger" onClick={confirmDelete} disabled={deleting} type="button">
                {deleting ? <Loader2 size={14} className="tb-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}