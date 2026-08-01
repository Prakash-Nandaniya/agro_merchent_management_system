import { useState, useMemo, useEffect, useRef, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Trash2,
  Filter,
} from "lucide-react";
import "./tradebook.css";
import { settings } from "@/settings";
import { apiFetch } from "@/utils/apifetch";
import { ErrorContext } from "@/components/errors/errorcontext";
import { FetchTrades } from "@/utils/cachestorage"; // add this alongside FetchInvoices
import TradeRow from "@/components/trade/traderaw/trade";

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
  crop_name: string;
  vehicle_no: string;
}

interface Filters {
  party_name: string;
  crop: string;
  invoice_no: string;
  created_by: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: Filters = {
  party_name: "",
  crop: "",
  invoice_no: "",
  created_by: "",
  date_from: "",
  date_to: "",
};

const FILTER_STORAGE_KEY = ["TradeBookFilter"] as const;
const SEARCH_QUERY_BASE_KEY = "Trades_Search" as const;

function toNum(v: string | undefined | null): number {
  const n = parseFloat(v || "0");
  return isNaN(n) ? 0 : n;
}

function fmtAmount(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function tradeInflow(t: Trade): number {
  return toNum(t.mill_payment) + toNum(t.tds_deducted) - toNum(t.gst_collected);
}

function tradeOutflow(t: Trade): number {
  return (
    toNum(t.farmer_payment) +
    toNum(t.labour_cost) +
    toNum(t.transport_cost) +
    toNum(t.other_cost)
  );
}

// Latest trade_creation_date first; if two trades share a date, higher id wins.
function compareTradesDesc(a: Trade, b: Trade): number {
  const aDate = a.trade_creation_date?.split("T")[0] || "";
  const bDate = b.trade_creation_date?.split("T")[0] || "";
  if (aDate !== bDate) return aDate < bDate ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

function getPageNumbers(
  current: number,
  total: number,
): Array<number | string> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const withGaps: Array<number | string> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) withGaps.push("...");
    withGaps.push(p);
  });
  return withGaps;
}

function extractErrorDetail(body: any, status: number): string {
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
  }
  return `Request failed with status ${status}`;
}

async function fetchTradesSearch(filters: Filters): Promise<Trade[]> {
  const payload: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value) payload[key] = value;
  });

  const res = await apiFetch(`${settings.BE_URL}/tradebook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(extractErrorDetail(body, res.status));
  }
  const data: Trade[] = await res.json();
  return [...data].sort(compareTradesDesc);
}

export default function TradeBook() {
  const errorcontext = useContext(ErrorContext);
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);

  const persistedFilters =
    queryClient.getQueryData<Filters | null>([...FILTER_STORAGE_KEY]) ?? null;

  const [filters, setFilters] = useState<Filters>(
    persistedFilters ?? EMPTY_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<Filters | null>(
    persistedFilters,
  );

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState(window.innerWidth < 640 ? 10 : 20);

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Default full list, cached forever, same shape as FetchInvoices ──────
  const { data: allTrades } = useQuery<Trade[]>({
    queryKey: ["Trades"],
    queryFn: FetchTrades,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // ── Search results, only runs once filters are applied ──────────────────
  const {
    data: searchTrades,
    isFetching: isSearching,
    error: searchError,
  } = useQuery<Trade[]>({
    queryKey: [SEARCH_QUERY_BASE_KEY, appliedFilters],
    queryFn: () => fetchTradesSearch(appliedFilters as Filters),
    enabled: appliedFilters !== null,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isSearchActive = appliedFilters !== null;
  const trades = isSearchActive ? searchTrades : allTrades;

  const activeQueryKey = isSearchActive
    ? ([SEARCH_QUERY_BASE_KEY, appliedFilters] as const)
    : (["Trades"] as const);

  useEffect(() => {
    if (searchError) {
      errorcontext.addError(
        searchError instanceof Error
          ? searchError.message
          : "Could not reach the server.",
      );
    }
  }, [searchError]);

  useEffect(() => {
    const handleResize = () => setPageSize(window.innerWidth < 640 ? 10 : 20);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowAdvancedFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyFilters() {
    setShowAdvancedFilters(false);
    const snapshot = { ...filters };
    setAppliedFilters(snapshot);
    queryClient.setQueryData([...FILTER_STORAGE_KEY], snapshot);
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setShowAdvancedFilters(false);
    setAppliedFilters(null);
    setPage(1);
    queryClient.setQueryData([...FILTER_STORAGE_KEY], null);
    queryClient.removeQueries({ queryKey: [SEARCH_QUERY_BASE_KEY] });
  }

  function openDatePicker(ref: React.RefObject<HTMLInputElement | null>) {
    const el = ref.current;
    if (!el) return;
    if (typeof (el as any).showPicker === "function") {
      try {
        (el as any).showPicker();
        return;
      } catch {
        // fall through to focus
      }
    }
    el.focus();
  }

  // Stable identity -> rows that aren't affected never re-render.
  function handleDeleteClick(id: number) {
    setDeleteTargetId(id);
  }

  async function confirmDelete() {
    if (deleteTargetId === null) return;
    setDeleting(true);
    try {
      const res = await apiFetch(
        `${settings.BE_URL}/delete-trade/${deleteTargetId}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorcontext.addError(extractErrorDetail(body, res.status));
        return;
      }

      // Remove it from every cached list it could live in, so it can't
      // reappear (e.g. if the user clears filters afterwards).
      queryClient.setQueryData<Trade[]>(["Trades"], (prev) =>
        prev ? prev.filter((t) => t.id !== deleteTargetId) : prev,
      );
      if (appliedFilters) {
        queryClient.setQueryData<Trade[]>(
          [SEARCH_QUERY_BASE_KEY, appliedFilters],
          (prev) => (prev ? prev.filter((t) => t.id !== deleteTargetId) : prev),
        );
      }

      setDeleteTargetId(null);
    } catch (err) {
      errorcontext.addError(
        err instanceof Error ? err.message : "Could not reach the server.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const totals = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    let inflow = 0,
      outflow = 0;
    trades.forEach((t) => {
      inflow += tradeInflow(t);
      outflow += tradeOutflow(t);
    });
    return { inflow, outflow, profit: inflow - outflow };
  }, [trades]);

  const totalPages = trades
    ? Math.max(1, Math.ceil(trades.length / pageSize))
    : 1;
  const pageTrades = trades
    ? trades.slice((page - 1) * pageSize, page * pageSize)
    : [];

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="tb-page">
      <div className="tb-header">
        <div>
          <h1 className="tb-title">Trade Book</h1>
          <p className="tb-subtitle">
            Track full trade cycles — mill payments, farmer payouts, labour
            &amp; transport
          </p>
        </div>
      </div>

      <div className="tb-panel">
        <div className="tb-filter-bar">
          <div className="tb-filter-actions" ref={dropdownRef}>
            <button
              className={`tb-btn-filter ${hasActiveFilters ? "tb-btn-filter--active" : ""}`}
              onClick={() => setShowAdvancedFilters((v) => !v)}
              type="button"
              title="Filters"
            >
              <Filter size={16} />
              {hasActiveFilters && <span className="tb-filter-dot"></span>}
            </button>

            {showAdvancedFilters && (
              <div className="tb-advanced-dropdown">
                <div className="tb-advanced-header">
                  <h3>Search Filters</h3>
                </div>

                <div
                  className="tb-date-field"
                  onClick={() => openDatePicker(fromDateRef)}
                >
                  <span className="tb-date-label">From :</span>
                  <input
                    ref={fromDateRef}
                    id="date_from"
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => updateFilter("date_from", e.target.value)}
                    onClick={() => openDatePicker(fromDateRef)}
                  />
                </div>
                <div
                  className="tb-date-field"
                  onClick={() => openDatePicker(toDateRef)}
                >
                  <span className="tb-date-label">To :</span>
                  <input
                    ref={toDateRef}
                    id="date_to"
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => updateFilter("date_to", e.target.value)}
                    onClick={() => openDatePicker(toDateRef)}
                  />
                </div>

                <div className="tb-advanced-grid">
                  <div className="tb-field">
                    <label className="tb-label" htmlFor="party_name">
                      Party name
                    </label>
                    <input
                      id="party_name"
                      placeholder="Contains..."
                      value={filters.party_name}
                      onChange={(e) =>
                        updateFilter("party_name", e.target.value)
                      }
                    />
                  </div>
                  <div className="tb-field">
                    <label className="tb-label" htmlFor="crop">
                      Crop
                    </label>
                    <input
                      id="crop"
                      placeholder="Contains..."
                      value={filters.crop}
                      onChange={(e) => updateFilter("crop", e.target.value)}
                    />
                  </div>
                  <div className="tb-field">
                    <label className="tb-label" htmlFor="invoice_no">
                      Invoice No.
                    </label>
                    <input
                      id="invoice_no"
                      placeholder="Exact match"
                      value={filters.invoice_no}
                      onChange={(e) =>
                        updateFilter("invoice_no", e.target.value)
                      }
                    />
                  </div>
                  <div className="tb-field">
                    <label className="tb-label" htmlFor="created_by">
                      Created by
                    </label>
                    <input
                      id="created_by"
                      placeholder="Exact match"
                      value={filters.created_by}
                      onChange={(e) =>
                        updateFilter("created_by", e.target.value.toUpperCase())
                      }
                    />
                  </div>

                  <div className="tb-filter-apply-reset-buttons-raw">
                    <button
                      className="tb-btn-primary tb-btn-apply"
                      onClick={applyFilters}
                      disabled={isSearching}
                      type="button"
                    >
                      {isSearching ? (
                        <Loader2 size={16} className="tb-spin" />
                      ) : (
                        <Search size={16} />
                      )}
                      <span>{isSearching ? "Searching…" : "Search"}</span>
                    </button>
                    <button
                      className="tb-btn-clear"
                      onClick={clearFilters}
                      type="button"
                    >
                      <RotateCcw size={14} />
                      <span>Clear filters</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isSearching && trades && trades.length === 0 && (
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
                {pageTrades.map((t) => (
                  <TradeRow
                    key={t.id}
                    id={t.id}
                    trade={t}
                    onDeleteClick={handleDeleteClick}
                  />
                ))}
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
                p === "..." ? (
                  <span key={`gap-${i}`} className="tb-page-gap">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className={`tb-page-btn ${p === page ? "tb-page-active" : ""}`}
                    onClick={() => setPage(p as number)}
                    type="button"
                  >
                    {p}
                  </button>
                ),
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
                <span className="tb-total-value">
                  ₹ {fmtAmount(totals.inflow)}
                </span>
              </div>
              <div className="tb-total-item">
                <span className="tb-total-label">Total Outflow</span>
                <span className="tb-total-value">
                  ₹ {fmtAmount(totals.outflow)}
                </span>
              </div>
              <div
                className={`tb-total-item tb-total-grand ${totals.profit >= 0 ? "tb-profit" : "tb-loss"}`}
              >
                <span className="tb-total-label">
                  {totals.profit >= 0 ? "Net Profit" : "Net Loss"}
                </span>
                <span className="tb-total-value">
                  ₹ {fmtAmount(totals.profit)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {deleteTargetId !== null && (
        <div className="tb-modal-overlay">
          <div className="tb-modal">
            <div className="tb-modal-header">
              <h3 className="tb-modal-title">Delete trade?</h3>
              <button
                className="tb-modal-close"
                onClick={() => setDeleteTargetId(null)}
                type="button"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="tb-modal-text">This will permanently delete.</p>
            <div className="tb-modal-actions">
              <button
                className="tb-btn-ghost"
                onClick={() => setDeleteTargetId(null)}
                disabled={deleting}
                type="button"
              >
                Cancel
              </button>
              <button
                className="tb-btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
                type="button"
              >
                {deleting ? (
                  <Loader2 size={14} className="tb-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
