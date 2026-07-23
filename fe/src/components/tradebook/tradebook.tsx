import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Pencil, Trash2, X } from 'lucide-react';
import './tradebook.css';
import { settings } from '@/settings';
import { apiFetch } from '@/utils/apifetch';

export interface Trade {
  id: number;
  invoice_no: string;
  trade_creation_date: string;
  mill_qty: string;
  mill_qty_unit: string;
  mill_rate: string;
  mill_rate_unit: string;
  gst_collected: string;
  tds_deducted: string;
  mill_payment: string;
  farmer_payment: string;
  labour_cost: string;
  transport_cost: string;
  other_cost: string;
  mill_receipt: string | null;
  created_by: string;
  party_name: string | null;
  party_city: string | null;
  seller_name: string | null;
  crops: string[];
}

interface Filters {
  party_name: string;
  crop: string;
  party_city: string;
  invoice_no: string;
  created_by: string;
  date_from: string;
  date_to: string;
}

const STORAGE_KEY = 'trade_book_state';

function getSavedState() {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse session storage');
    }
  }
  return null;
}

const EMPTY_FILTERS: Filters = {
  party_name: '',
  crop: '',
  party_city: '',
  invoice_no: '',
  created_by: '',
  date_from: '',
  date_to: '',
};

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
  const datePart = iso.split('T')[0]; // trade_creation_date is a datetime, strip the time part
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function tradeInflow(t: Trade): number {
  return toNum(t.mill_payment) + toNum(t.tds_deducted) - toNum(t.gst_collected);
}

function tradeOutflow(t: Trade): number {
  return toNum(t.farmer_payment) + toNum(t.labour_cost) + toNum(t.transport_cost) + toNum(t.other_cost);
}

function tradeProfit(t: Trade): number {
  return tradeInflow(t) - tradeOutflow(t);
}

// Latest trade_creation_date first; if two trades share a date, higher id (more recently created) wins.
function compareTradesDesc(a: Trade, b: Trade): number {
  const aDate = a.trade_creation_date?.split('T')[0] || '';
  const bDate = b.trade_creation_date?.split('T')[0] || '';
  if (aDate !== bDate) return aDate < bDate ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

function getPageNumbers(current: number, total: number): Array<number | string> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const withGaps: Array<number | string> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) withGaps.push('...');
    withGaps.push(p);
  });
  return withGaps;
}

export default function TradeBook() {
  const navigate = useNavigate();
  const savedState = getSavedState();

  // ── Responsive page size: 20 rows on desktop, 10 on mobile ──────────────
  const [pageSize, setPageSize] = useState(window.innerWidth < 640 ? 10 : 20);

  useEffect(() => {
    const handleResize = () => setPageSize(window.innerWidth < 640 ? 10 : 20);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [filters, setFilters] = useState<Filters>(savedState?.filters || EMPTY_FILTERS);
  const [trades, setTrades] = useState<Trade[] | null>(
    savedState?.trades ? [...savedState.trades].sort(compareTradesDesc) : null
  );
  const [page, setPage] = useState<number>(savedState?.page || 1);
  const [hasSearched, setHasSearched] = useState<boolean>(savedState?.hasSearched || false);
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

  function extractErrorDetail(body: any, status: number): string {
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
    }
    return `Request failed with status ${status}`;
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
        throw new Error(extractErrorDetail(body, res.status));
      } else {
        const data: Trade[] = await res.json();
        setTrades([...data].sort(compareTradesDesc));
      }
      setPage(1);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not reach the server.');
      setTrades(null);
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(t: Trade) {
    navigate('/view-trade', { state: { trade: t } });
  }

  function handleEdit(e: React.MouseEvent, t: Trade) {
    e.stopPropagation(); // don't also trigger the row's own onClick
    navigate('/add-trade', { state: { trade: t } });
  }

  function handleDeleteClick(e: React.MouseEvent, t: Trade) {
    e.stopPropagation();
    setDeleteTarget(t);
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await apiFetch(`${settings.BE_URL}/delete-trade/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(extractErrorDetail(body, res.status));
      }

      setTrades((prev) => {
        if (!prev) return prev;
        const next = prev.filter((t) => t.id !== deleteTarget.id);
        // If deleting the last row on the last page, step back a page so we don't land on an empty page
        const nextTotalPages = Math.max(1, Math.ceil(next.length / pageSize));
        setPage((p) => Math.min(p, nextTotalPages));
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setDeleting(false);
    }
  }

  const totals = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    let inflow = 0, outflow = 0;
    trades.forEach((t) => {
      inflow += tradeInflow(t);
      outflow += tradeOutflow(t);
    });
    return { inflow, outflow, profit: inflow - outflow };
  }, [trades]);

  const totalPages = trades ? Math.max(1, Math.ceil(trades.length / pageSize)) : 1;
  const pageTrades = trades ? trades.slice((page - 1) * pageSize, page * pageSize) : [];

  useEffect(() => {
    const stateToSave = { filters, trades, hasSearched, page };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [filters, trades, hasSearched, page]);

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
            <label className="tb-label" htmlFor="party_city">Party City</label>
            <input id="party_city" placeholder="Contains..." value={filters.party_city} onChange={(e) => updateFilter('party_city', e.target.value)} />
          </div>
          <div className="tb-field">
            <label className="tb-label" htmlFor="invoice_no">Invoice No.</label>
            <input id="invoice_no" placeholder="Exact match" value={filters.invoice_no} onChange={(e) => updateFilter('invoice_no', e.target.value)} />
          </div>
          <div className="tb-field">
            <label className="tb-label" htmlFor="created_by">Created by</label>
            <input id="created_by" placeholder="Exact match" value={filters.created_by} onChange={(e) => updateFilter('created_by', (e.target.value).toUpperCase())} />
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
                  <th>Invoice No.</th>
                  <th>Party</th>
                  <th>Crop</th>
                  <th className="tb-num">Mill Qty</th>
                  <th className="tb-num">Mill Rate</th>
                  <th className="tb-num">Profit</th>
                  <th className="tb-num"></th>
                </tr>
              </thead>
              <tbody>
                {pageTrades.map((t) => {
                  const profit = tradeProfit(t);
                  return (
                    <tr key={t.id} className="tb-row-clickable" onClick={() => handleRowClick(t)}>
                      <td className="tb-mono" data-label="Date">{formatDateDMY(t.trade_creation_date)}</td>
                      <td className="tb-mono" data-label="Invoice No.">{t.invoice_no}</td>
                      <td data-label="Party">{t.party_name || '—'}</td>
                      <td data-label="Crop">{t.crops.length ? t.crops.join(', ') : '—'}</td>
                      <td className="tb-num tb-mono" data-label="Mill Qty">{fmtAmount(toNum(t.mill_qty))} {t.mill_qty_unit}</td>
                      <td className="tb-num tb-mono" data-label="Mill Rate">₹ {fmtAmount(toNum(t.mill_rate))} / {t.mill_rate_unit}</td>
                      <td className={`tb-num tb-mono tb-strong ${profit >= 0 ? 'tb-profit' : 'tb-loss'}`} data-label="Profit">
                        ₹ {fmtAmount(profit)}
                      </td>
                      <td className="tb-num tb-row-actions">
                        <button className="tb-icon-btn tb-icon-btn--edit" onClick={(e) => handleEdit(e, t)} type="button" aria-label="Edit trade">
                          <Pencil size={15} />
                        </button>
                        <button className="tb-icon-btn tb-icon-btn--delete" onClick={(e) => handleDeleteClick(e, t)} type="button" aria-label="Delete trade">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="tb-pagination">
              <button
                className="tb-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                type="button"
              >
                <ChevronLeft size={14} />
              </button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`gap-${i}`} className="tb-page-gap">…</span>
                ) : (
                  <button
                    key={p}
                    className={`tb-page-btn ${p === page ? 'tb-page-active' : ''}`}
                    onClick={() => setPage(p as number)}
                    type="button"
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="tb-page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                type="button"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {totals && (
            <div className="tb-totals">
              <div className="tb-total-item">
                <span className="tb-total-label">Total Inflow</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.inflow)}</span>
              </div>
              <div className="tb-total-item">
                <span className="tb-total-label">Total Outflow</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.outflow)}</span>
              </div>
              <div className={`tb-total-item tb-total-grand ${totals.profit >= 0 ? 'tb-profit' : 'tb-loss'}`}>
                <span className="tb-total-label">{totals.profit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                <span className="tb-total-value">₹ {fmtAmount(totals.profit)}</span>
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
              This will permanently delete this trade.
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