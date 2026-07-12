import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { create, all } from 'mathjs';
import { Search, RotateCcw, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import './millbill_book.css';
import { settings } from "@/settings";
import { apiFetch } from '@/utils/apifetch';

const math = create(all);
math.config({ number: 'BigNumber', precision: 64 });


export interface BillCrop {
  id: number;
  crop: string;
  hsn_code: string;
  qty: string;
  uqc: string;
  rate: string;
  taxable_value: string;
  cgst_rate: string;
  sgst_rate: string;
  cgst_amount: string;
  sgst_amount: string;
  final_amount: string;
}

export interface MillBill {
  id: number;
  created_at: string;
  updated_at: string;
  seller_name: string;
  seller_address: string;
  seller_pan: string;
  seller_gstin: string;
  invoice_no: string;
  invoice_date: string;
  docket_no?: string | null;
  transport_name?: string | null;
  delivery_through: string;
  party_name: string;
  party_address: string;
  party_city?: string | null;
  party_state: string;
  party_gstin: string;
  party_pan: string;
  seller_bank?: string | null;
  seller_account?: string | null;
  seller_ifsc?: string | null;
  final_taxable_amount: string;
  final_cgst_amount: string;
  final_sgst_amount: string;
  final_amount: string;
  final_amount_in_words: string;
  terms: string;
  crops: BillCrop[];
  created_by: string;
}

interface Filters {
  invoice_no: string;
  party_name: string;
  party_gstin: string;
  party_pan: string;
  party_city: string;
  invoice_date_from: string;
  invoice_date_to: string;
  created_by: string;
}

const EMPTY_FILTERS: Filters = {
  invoice_no: '',
  party_name: '',
  party_gstin: '',
  party_pan: '',
  party_city: '',
  invoice_date_from: '',
  invoice_date_to: '',
  created_by: '',
};

type FieldErrorKey =
  | 'party_pan'
  | 'party_gstin'
  | 'date_range';

type FieldErrors = Partial<Record<FieldErrorKey, string>>;

interface Totals {
  taxable: string;
  cgst: string;
  sgst: string;
  final: string;
}

type FilterFieldBase = {
  key: keyof Filters;
  label: string;
};

type TextFilterField = FilterFieldBase & {
  type: 'text';
  placeholder: string;
  mono?: boolean;
};

type SelectFilterField = FilterFieldBase & {
  type: 'select';
  options: readonly string[];
};

type FilterField = TextFilterField | SelectFilterField;

// ── Indian digit grouping, always 2 decimals, input is a plain decimal string ──
function toIndianAmount(decimalString: string): string {
  const bn = math.bignumber(decimalString || '0');
  const fixed = bn.toFixed(2);
  const negative = fixed.startsWith('-');
  const [intPart, decPart] = (negative ? fixed.slice(1) : fixed).split('.');
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d)$)/g, ',');
  const grouped = rest ? `${groupedRest},${lastThree}` : lastThree;
  return `${negative ? '-' : ''}${grouped}.${decPart}`;
}

// Latest invoice_date first; if two bills share a date, most recently created wins.
function compareBillsDesc(a: MillBill, b: MillBill): number {
  if (a.invoice_date !== b.invoice_date) {
    return a.invoice_date < b.invoice_date ? 1 : -1;
  }
  const aTime = new Date(a.created_at).getTime();
  const bTime = new Date(b.created_at).getTime();
  return aTime < bTime ? 1 : -1;
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

const STORAGE_KEY = 'mill_bill_book_state';

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

export default function MillBillBook() {

  const navigate = useNavigate();
  const savedState = getSavedState();

  // ── 1. Create dynamic state for page size ──
  const [pageSize, setPageSize] = useState(window.innerWidth < 640 ? 10 : 20);

  // ── 2. Listen for screen resizing in real-time ──
  useEffect(() => {
    const handleResize = () => {
      setPageSize(window.innerWidth < 640 ? 10 : 20);
    };

    // Attach the event listener
    window.addEventListener('resize', handleResize);

    // Clean it up when the component unmounts
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [filters, setFilters] = useState<Filters>(savedState?.filters || EMPTY_FILTERS);
  const [bills, setBills] = useState<MillBill[] | null>(savedState?.bills || null);
  const [page, setPage] = useState<number>(savedState?.page || 1);
  const [hasSearched, setHasSearched] = useState<boolean>(savedState?.hasSearched || false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [requestError, setRequestError] = useState<string>('');

  function updateFilter(key: keyof Filters, rawValue: string) {
    const upperKeys: Array<keyof Filters> = ['party_gstin', 'party_pan','created_by'];
    const value = upperKeys.includes(key) ? rawValue.toUpperCase() : rawValue;
    setFilters((prev) => ({ ...prev, [key]: value }));

    setFieldErrors((prev) => {
      const next: FieldErrors = { ...prev };
      if (key === 'invoice_date_from' || key === 'invoice_date_to') {
        const from = key === 'invoice_date_from' ? value : filters.invoice_date_from;
        const to = key === 'invoice_date_to' ? value : filters.invoice_date_to;
        next.date_range = from && to && from > to ? 'Start date must be before end date' : '';
      }
      return next;
    });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setFieldErrors({});
  }

  function hasBlockingErrors(): boolean {
    return Object.values(fieldErrors).some((msg) => !!msg);
  }

  async function runSearch() {
    if (hasBlockingErrors()) return;

    const payload: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) payload[key] = value;
    });

    setLoading(true);
    setRequestError('');
    setHasSearched(true);

    try {
      const res = await apiFetch(`${settings.BE_URL}/get-mill-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        setBills([]);
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed with status ${res.status}`);
      } else {
        const data: MillBill[] = await res.json();
        setBills([...data].sort(compareBillsDesc));
      }
      setPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reach the server.';
      setRequestError(message);
      setBills(null);
    } finally {
      setLoading(false);
    }
  }

  // Clicking a bill routes to the detail page, carrying the full bill record along.
  function goToBill(bill: MillBill) {
    navigate('/show-mill-bill-from-bill-book', { state: { bill } });
  }

  function handleRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, bill: MillBill) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToBill(bill);
    }
  }

  const totals: Totals | null = useMemo(() => {
    if (!bills || bills.length === 0) return null;
    const sumField = (field: keyof MillBill) =>
      bills.reduce(
        (acc, bill) => math.add(acc, math.bignumber(String(bill[field]))),
        math.bignumber(0)
      );
    return {
      taxable: sumField('final_taxable_amount').toString(),
      cgst: sumField('final_cgst_amount').toString(),
      sgst: sumField('final_sgst_amount').toString(),
      final: sumField('final_amount').toString(),
    };
  }, [bills]);

  const totalPages = bills ? Math.max(1, Math.ceil(bills.length / pageSize)) : 1;
  const pageBills = bills ? bills.slice((page - 1) * pageSize, page * pageSize) : [];

  const filterFields: FilterField[] = [
    { key: 'invoice_no', label: 'Invoice no.', type: 'text', placeholder: 'INV-2026-0142' },
    { key: 'party_name', label: 'Party name', type: 'text', placeholder: 'Contains...' },
    { key: 'party_gstin', label: 'Party GSTIN', type: 'text', placeholder: '24ABCDE1234F1Z5', mono: true },
    { key: 'party_pan', label: 'Party PAN', type: 'text', placeholder: 'ABCDE1234F', mono: true },
    { key: 'party_city', label: 'Party city', type: 'text', placeholder: 'Contains...' },
    { key: 'created_by', label: 'Created By', type: 'text', placeholder: 'Contains...' },
  ];

  useEffect(() => {
    const stateToSave = {
      filters,
      bills,
      page,
      hasSearched
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [filters, bills, page, hasSearched]);

  return (
    <div className="mbr-page">
      <div className="mbr-header">
        <div>
          <h1 className="mbr-title">Mill bill Book</h1>
          <p className="mbr-subtitle">Search, filter and reconcile crop trade invoices</p>
        </div>
        <div className="mbr-seal">
          <span className="mbr-seal-count">{bills ? bills.length : '—'}</span>
          <span className="mbr-seal-label">bills</span>
        </div>
      </div>

      <div className="mbr-panel">
        <div className="mbr-filter-grid">
          {filterFields.map((f) => (
            <div className="mbr-field" key={f.key}>
              <label className="mbr-label" htmlFor={f.key}>{f.label}</label>
              {f.type === 'select' ? (
                <select
                  id={f.key}
                  value={filters[f.key]}
                  onChange={(e) => updateFilter(f.key, e.target.value)}
                >
                  <option value="">Any</option>
                  {f.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={f.key}
                  type="text"
                  className={f.mono ? 'mbr-mono' : ''}
                  placeholder={f.placeholder}
                  value={filters[f.key]}
                  onChange={(e) => updateFilter(f.key, e.target.value)}
                />
              )}
              {fieldErrors[f.key as FieldErrorKey] && (
                <span className="mbr-error-text">{fieldErrors[f.key as FieldErrorKey]}</span>
              )}
            </div>
          ))}

          <div className="mbr-field">
            <label className="mbr-label" htmlFor="invoice_date_from">Invoice date from</label>
            <input
              id="invoice_date_from"
              type="date"
              value={filters.invoice_date_from}
              onChange={(e) => updateFilter('invoice_date_from', e.target.value)}
            />
          </div>
          <div className="mbr-field">
            <label className="mbr-label" htmlFor="invoice_date_to">Invoice date to</label>
            <input
              id="invoice_date_to"
              type="date"
              value={filters.invoice_date_to}
              onChange={(e) => updateFilter('invoice_date_to', e.target.value)}
            />
            {fieldErrors.date_range && <span className="mbr-error-text">{fieldErrors.date_range}</span>}
          </div>
        </div>

        <div className="mbr-actions">
          <button className="mbr-btn-ghost" onClick={clearFilters} type="button">
            <RotateCcw size={14} /> Clear filters
          </button>
          <button
            className="mbr-btn-primary"
            onClick={runSearch}
            disabled={loading || hasBlockingErrors()}
            type="button"
          >
            {loading ? <Loader2 size={14} className="mbr-spin" /> : <Search size={14} />}
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {requestError && (
        <div className="mbr-banner-error">
          <AlertTriangle size={16} />
          <span>{requestError}</span>
        </div>
      )}

      {hasSearched && !loading && bills && bills.length === 0 && !requestError && (
        <div className="mbr-empty">No bills match these filters. Try widening your search.</div>
      )}

      {bills && bills.length > 0 && (
        <>
          <div className="mbr-table-wrap">
            <table className="mbr-table">
              <thead>
                <tr>
                  <th>Invoice no.</th>
                  <th>Date</th>
                  <th>Party Name</th>
                  <th className="mbr-num">Crops</th>
                  <th className="mbr-num">Total Amt.</th>
                </tr>
              </thead>
              <tbody>
                {pageBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="mbr-row-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => goToBill(bill)}
                    onKeyDown={(e) => handleRowKeyDown(e, bill)}
                    aria-label={`View bill ${bill.invoice_no}`}
                  >
                    <td className="mbr-mono" data-label="Invoice no.">{bill.invoice_no}</td>
                    <td className="mbr-mono" data-label="Date">{bill.invoice_date}</td>
                    <td data-label="Party">{bill.party_name}</td>
                    <td className="mbr-num mbr-mono" data-label="Crops">{bill.crops?.map((crop) => crop.crop).join(', ')}</td>
                    <td className="mbr-num mbr-mono mbr-strong" data-label="Total">{toIndianAmount(bill.final_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mbr-pagination">
              <button
                className="mbr-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                type="button"
              >
                <ChevronLeft size={14} />
              </button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`gap-${i}`} className="mbr-page-gap">…</span>
                ) : (
                  <button
                    key={p}
                    className={`mbr-page-btn ${p === page ? 'mbr-page-active' : ''}`}
                    onClick={() => setPage(p as number)}
                    type="button"
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="mbr-page-btn"
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
            <div className="mbr-totals">
              <div className="mbr-total-item">
                <span className="mbr-total-label">Taxable</span>
                <span className="mbr-total-value" title={totals.taxable}>₹ {toIndianAmount(totals.taxable)}</span>
              </div>
              <div className="mbr-total-item">
                <span className="mbr-total-label">CGST</span>
                <span className="mbr-total-value" title={totals.cgst}>₹ {toIndianAmount(totals.cgst)}</span>
              </div>
              <div className="mbr-total-item">
                <span className="mbr-total-label">SGST</span>
                <span className="mbr-total-value" title={totals.sgst}>₹ {toIndianAmount(totals.sgst)}</span>
              </div>
              <div className="mbr-total-item mbr-total-grand">
                <span className="mbr-total-label">Grand total</span>
                <span className="mbr-total-value" title={totals.final}>₹ {toIndianAmount(totals.final)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}