import React, { useState, useMemo, useEffect, useRef, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create, all } from "mathjs";
import * as XLSX from "xlsx";
import { FetchInvoices } from "@/utils/cachestorage";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  Download,
  Filter,
} from "lucide-react";
import "./invoice_book.css";
import { settings } from "@/settings";
import { apiFetch } from "@/utils/apifetch";
import { ErrorContext } from "@/components/errors/errorcontext";
import BillRow from "../invoiceRaw/raw";

const math = create(all);
math.config({ number: "BigNumber", precision: 64 });

// ─── Flat invoice shape — matches backend InvoiceOut exactly, one crop per bill ──
export interface Invoice {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  seller_name: string;
  seller_address: string;
  seller_pan: string;
  seller_gstin: string;
  invoice_no: string;
  invoice_date: string;
  eway_bill_no: string | null;
  docket_no?: string | null;
  transport_name?: string | null;
  delivery_through: string;
  party_name: string;
  party_address: string;
  party_city?: string | null;
  party_state: string;
  party_gstin: string;
  party_pan: string;
  crop: string;
  hsn_code: string;
  qty: string;
  uqc: string;
  rate: string;
  taxable_amount: string;
  cgst_rate: string;
  sgst_rate: string;
  cgst_amount: string;
  sgst_amount: string;
  final_amount: string;
  seller_bank?: string | null;
  seller_account?: string | null;
  seller_ifsc?: string | null;
  final_amount_in_words: string;
  terms: string;
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

interface FieldErrors {
  date_range?: string;
  [key: string]: string | undefined;
}

const getTodayString = () => new Date().toISOString().split("T")[0];

const EMPTY_FILTERS: Filters = {
  invoice_no: "",
  party_name: "",
  party_gstin: "",
  party_pan: "",
  party_city: "",
  invoice_date_from: "",
  invoice_date_to: getTodayString(),
  created_by: "",
};

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
  type: "text";
  placeholder: string;
  mono?: boolean;
};

type SelectFilterField = FilterFieldBase & {
  type: "select";
  options: readonly string[];
};

type FilterField = TextFilterField | SelectFilterField;

const FILTER_STORAGE_KEY = ["InvoiceBookFilter"] as const;
const SEARCH_QUERY_BASE_KEY = "Invoices_Search" as const;

function toIndianAmount(decimalString: string): string {
  const bn = math.bignumber(decimalString || "0");
  const fixed = bn.toFixed(2);
  const negative = fixed.startsWith("-");
  const [intPart, decPart] = (negative ? fixed.slice(1) : fixed).split(".");
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d)$)/g, ",");
  const grouped = rest ? `${groupedRest},${lastThree}` : lastThree;
  return `${negative ? "-" : ""}${grouped}.${decPart}`;
}

function compareInvoicesDesc(a: Invoice, b: Invoice): number {
  if (a.invoice_date !== b.invoice_date) {
    return a.invoice_date < b.invoice_date ? 1 : -1;
  }
  const aTime = new Date(a.created_at).getTime();
  const bTime = new Date(b.created_at).getTime();
  return aTime < bTime ? 1 : -1;
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

async function fetchInvoices(filters: Filters): Promise<Invoice[]> {
  const payload: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value) payload[key] = value;
  });

  const res = await apiFetch(`${settings.BE_URL}/get-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed with status ${res.status}`);
  }
  const data: Invoice[] = await res.json();
  return [...data].sort(compareInvoicesDesc);
}

export default function InvoiceBook() {
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

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [page, setPage] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isDownloadingBook, setIsDownloadingBook] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState(window.innerWidth < 640 ? 10 : 20);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { data: allInvoices } = useQuery<Invoice[]>({
    queryKey: ["Invoices"],
    queryFn: FetchInvoices,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const {
    data: searchInvoices,
    isFetching: isSearching,
    error: searchError,
  } = useQuery<Invoice[]>({
    queryKey: [SEARCH_QUERY_BASE_KEY, appliedFilters],
    queryFn: () => fetchInvoices(appliedFilters as Filters),
    enabled: appliedFilters !== null,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isSearchActive = appliedFilters !== null;
  const invoices = isSearchActive ? searchInvoices : allInvoices;

  const activeQueryKey = isSearchActive
    ? ([SEARCH_QUERY_BASE_KEY, appliedFilters] as const)
    : (["Invoices"] as const);

  useEffect(() => {
    if (searchError) {
      const message =
        searchError instanceof Error
          ? searchError.message
          : "Could not reach the server.";
      errorcontext.addError(message);
    }
  }, [searchError]);

  useEffect(() => {
    const handleResize = () => {
      setPageSize(window.innerWidth < 640 ? 10 : 20);
    };
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

  function updateFilter(key: keyof Filters, rawValue: string) {
    const upperKeys: Array<keyof Filters> = [
      "party_gstin",
      "party_pan",
      "created_by",
    ];
    const value = upperKeys.includes(key) ? rawValue.toUpperCase() : rawValue;

    setFilters((prev) => ({ ...prev, [key]: value }));

    setFieldErrors((prev) => {
      const next: FieldErrors = { ...prev };
      if (key === "invoice_date_from" || key === "invoice_date_to") {
        const from =
          key === "invoice_date_from" ? value : filters.invoice_date_from;
        const to = key === "invoice_date_to" ? value : filters.invoice_date_to;
        if (from && to && from > to) {
          const errorMsg = "Start date must be before end date";
          next.date_range = errorMsg;
          errorcontext.addError(errorMsg);
        } else {
          next.date_range = "";
        }
      }
      return next;
    });
  }

  function hasBlockingErrors(): boolean {
    return Object.values(fieldErrors).some((msg) => !!msg);
  }

  function applyFilters() {
    if (hasBlockingErrors()) {
      errorcontext.addError(
        "Please fix the errors in your filters before searching.",
      );
      return;
    }
    setShowAdvancedFilters(false);
    const snapshot = { ...filters };
    setAppliedFilters(snapshot);
    queryClient.setQueryData([...FILTER_STORAGE_KEY], snapshot);
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setFieldErrors({});
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

  function handleDownloadExcel() {
    if (!invoices || invoices.length === 0) return;

    setIsExporting(true);
    try {
      const rows = invoices.map((bill) => ({
        "Invoice No.": bill.invoice_no,
        "Invoice Date": bill.invoice_date,
        "Seller Name": bill.seller_name,
        "Seller Address": bill.seller_address,
        "Seller PAN": bill.seller_pan,
        "Seller GSTIN": bill.seller_gstin,
        "Party Name": bill.party_name,
        "Party Address": bill.party_address,
        "Party City": bill.party_city || "",
        "Party State": bill.party_state,
        "Party GSTIN": bill.party_gstin,
        "Party PAN": bill.party_pan,
        "E-way Bill No.": bill.eway_bill_no || "",
        "Docket No.": bill.docket_no || "",
        "Transport Name": bill.transport_name || "",
        "Vehicle No.": bill.delivery_through,
        "Seller Bank": bill.seller_bank || "",
        "Seller Account": bill.seller_account || "",
        "Seller IFSC": bill.seller_ifsc || "",
        Crop: bill.crop,
        HSN: bill.hsn_code,
        Qty: bill.qty,
        UQC: bill.uqc,
        Rate: bill.rate,
        "Taxable Amount": toIndianAmount(bill.taxable_amount),
        "CGST %": bill.cgst_rate,
        "CGST Amount": toIndianAmount(bill.cgst_amount),
        "SGST %": bill.sgst_rate,
        "SGST Amount": toIndianAmount(bill.sgst_amount),
        "Final Amount": toIndianAmount(bill.final_amount),
        "Amount In Words": bill.final_amount_in_words,
        "Created By": bill.created_by,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Mill Bills");

      const fileName = `invoices_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error("Error exporting bills to Excel:", err);
      errorcontext.addError(
        "Something went wrong while generating the Excel file.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadBook() {
    if (!invoices || invoices.length === 0) return;

    setIsDownloadingBook(true);
    try {
      const res = await apiFetch(
        `${settings.BE_URL}/generate-invoice-book-pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoices),
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `Server returned ${res.status}${detail ? `: ${detail}` : ""}`,
        );
      }

      const blob = await res.blob();
      const fileName = `invoice_book_${new Date().toISOString().split("T")[0]}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading bill book PDF:", err);
      errorcontext.addError(
        err instanceof Error
          ? err.message
          : "Something went wrong while downloading the book PDF.",
      );
    } finally {
      setIsDownloadingBook(false);
    }
  }

  const totals: Totals | null = useMemo(() => {
    if (!invoices || invoices.length === 0) return null;

    const safeBignumber = (val: unknown) => {
      if (val === null || val === undefined || val === "")
        return math.bignumber(0);
      try {
        return math.bignumber(String(val));
      } catch {
        return math.bignumber(0);
      }
    };

    const sumField = (field: keyof Invoice) =>
      invoices.reduce(
        (acc, bill) => math.add(acc, safeBignumber(bill[field])),
        math.bignumber(0),
      );

    return {
      taxable: sumField("taxable_amount").toString(),
      cgst: sumField("cgst_amount").toString(),
      sgst: sumField("sgst_amount").toString(),
      final: sumField("final_amount").toString(),
    };
  }, [invoices]);

  const totalPages = invoices
    ? Math.max(1, Math.ceil(invoices.length / pageSize))
    : 1;
  const pageBills = invoices
    ? invoices.slice((page - 1) * pageSize, page * pageSize)
    : [];

  const advancedFields: FilterField[] = [
    {
      key: "invoice_no",
      label: "Invoice no.",
      type: "text",
      placeholder: "INV-2026-0142",
    },
    {
      key: "party_name",
      label: "Party name",
      type: "text",
      placeholder: "Contains...",
    },
    {
      key: "party_gstin",
      label: "Party GSTIN",
      type: "text",
      placeholder: "24ABCDE...",
      mono: true,
    },
    {
      key: "party_pan",
      label: "Party PAN",
      type: "text",
      placeholder: "ABCDE...",
      mono: true,
    },
    {
      key: "party_city",
      label: "Party city",
      type: "text",
      placeholder: "Contains...",
    },
    {
      key: "created_by",
      label: "Created By",
      type: "text",
      placeholder: "Contains...",
    },
  ];

  const hasActiveAdvancedFilters = advancedFields.some(
    (f) => filters[f.key] !== "",
  );

  return (
    <div className="mbr-page">
      <div className="mbr-header">
        <div>
          <h1 className="mbr-title">Mill bill Book</h1>
          <p className="mbr-subtitle">
            Search, filter and reconcile crop trade invoices
          </p>
        </div>
        <div className="mbr-seal">
          <span className="mbr-seal-count">
            {invoices ? invoices.length : "—"}
          </span>
          <span className="mbr-seal-label">bills</span>
        </div>
      </div>

      <div className="mbr-panel">
        <div className="mbr-filter-bar">
          <div className="mbr-filter-top-row">
            <div className="mbr-filter-actions" ref={dropdownRef}>
              <button
                className={`mbr-btn-filter ${hasActiveAdvancedFilters ? "mbr-btn-filter--active" : ""}`}
                onClick={() => setShowAdvancedFilters((v) => !v)}
                type="button"
                title="Filters"
              >
                <Filter size={16} />
                {hasActiveAdvancedFilters && (
                  <span className="mbr-filter-dot"></span>
                )}
              </button>

              {showAdvancedFilters && (
                <div className="mbr-advanced-dropdown">
                  <div className="mbr-advanced-header">
                    <h3>Search Filters</h3>
                  </div>
                  <div
                    className="mbr-date-field"
                    onClick={() => openDatePicker(fromDateRef)}
                  >
                    <span className="mbr-date-label">From :</span>
                    <input
                      ref={fromDateRef}
                      id="invoice_date_from"
                      type="date"
                      value={filters.invoice_date_from}
                      onChange={(e) =>
                        updateFilter("invoice_date_from", e.target.value)
                      }
                      onClick={() => openDatePicker(fromDateRef)}
                    />
                  </div>
                  <div
                    className="mbr-date-field"
                    onClick={() => openDatePicker(toDateRef)}
                  >
                    <span className="mbr-date-label">To :</span>
                    <input
                      ref={toDateRef}
                      id="invoice_date_to"
                      type="date"
                      value={filters.invoice_date_to}
                      onChange={(e) =>
                        updateFilter("invoice_date_to", e.target.value)
                      }
                      onClick={() => openDatePicker(toDateRef)}
                    />
                  </div>
                  <div className="mbr-advanced-grid">
                    {advancedFields.map((f) => (
                      <div className="mbr-field" key={f.key}>
                        <label className="mbr-label" htmlFor={f.key}>
                          {f.label}
                        </label>
                        {f.type === "select" ? (
                          <select
                            id={f.key}
                            value={filters[f.key]}
                            onChange={(e) =>
                              updateFilter(f.key, e.target.value)
                            }
                          >
                            <option value="">Any</option>
                            {f.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={f.key}
                            type="text"
                            className={f.mono ? "mbr-mono" : ""}
                            placeholder={f.placeholder}
                            value={filters[f.key]}
                            onChange={(e) =>
                              updateFilter(f.key, e.target.value)
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && applyFilters()
                            }
                          />
                        )}
                      </div>
                    ))}
                    <div className="mbr-filter-apply-reset-buttons-raw">
                      <button
                        className="mbr-btn-primary mbr-btn-apply"
                        onClick={applyFilters}
                        disabled={isSearching || hasBlockingErrors()}
                        type="button"
                      >
                        {isSearching ? (
                          <Loader2 size={16} className="mbr-spin" />
                        ) : (
                          <Search size={16} />
                        )}
                        <span>Apply</span>
                      </button>
                      <button
                        className="mbr-btn-clear"
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
      </div>

      {!isSearching && invoices && invoices.length === 0 && (
        <div className="mbr-empty">
          No bills match these filters. Try widening your search.
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <>
          <div className="mbr-table-wrap">
            <table className="mbr-table">
              <thead>
                <tr>
                  <th>Invoice no.</th>
                  <th>Date</th>
                  <th>Party Name</th>
                  <th className="mbr-num">Crop</th>
                  <th className="mbr-num">Total Amt.</th>
                </tr>
              </thead>
              <tbody>
                {pageBills.map((bill) => (
                  <BillRow
                    key={bill.id}
                    id={bill.id}
                    queryKey={activeQueryKey}
                  />
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
                p === "..." ? (
                  <span key={`gap-${i}`} className="mbr-page-gap">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className={`mbr-page-btn ${p === page ? "mbr-page-active" : ""}`}
                    onClick={() => setPage(p as number)}
                    type="button"
                  >
                    {p}
                  </button>
                ),
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
                <span className="mbr-total-value" title={totals.taxable}>
                  ₹ {toIndianAmount(totals.taxable)}
                </span>
              </div>
              <div className="mbr-total-item">
                <span className="mbr-total-label">CGST</span>
                <span className="mbr-total-value" title={totals.cgst}>
                  ₹ {toIndianAmount(totals.cgst)}
                </span>
              </div>
              <div className="mbr-total-item">
                <span className="mbr-total-label">SGST</span>
                <span className="mbr-total-value" title={totals.sgst}>
                  ₹ {toIndianAmount(totals.sgst)}
                </span>
              </div>
              <div className="mbr-total-item mbr-total-grand">
                <span className="mbr-total-label">Grand total</span>
                <span className="mbr-total-value" title={totals.final}>
                  ₹ {toIndianAmount(totals.final)}
                </span>
              </div>
            </div>
          )}

          <div className="mbr-export-bar">
            <button
              className="mbr-btn-export mbr-btn-export--excel"
              onClick={handleDownloadExcel}
              disabled={isExporting}
              type="button"
            >
              {isExporting ? (
                <Loader2 size={14} className="mbr-spin" />
              ) : (
                <FileSpreadsheet size={14} />
              )}
              {isExporting ? "Preparing..." : "Download Excel"}
            </button>

            <button
              className="mbr-btn-export mbr-btn-export--book"
              onClick={handleDownloadBook}
              disabled={isDownloadingBook}
              type="button"
            >
              {isDownloadingBook ? (
                <Loader2 size={14} className="mbr-spin" />
              ) : (
                <Download size={14} />
              )}
              {isDownloadingBook ? "Preparing..." : "Download Book"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
