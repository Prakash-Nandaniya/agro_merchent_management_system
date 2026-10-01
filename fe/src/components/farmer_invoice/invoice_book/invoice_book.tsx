import React, { useState, useMemo, useEffect, useRef, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create, all } from "mathjs";
import * as XLSX from "xlsx";
import { FetchFarmerPurchases } from "@/utils/cachestorage";
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
import BillRow from "../invoiceRaw/row";
import Decimal from "decimal.js";
const math = create(all);
math.config({ number: "BigNumber", precision: 64 });

// ─── Farmer purchase shape — matches backend FarmerPurchaseOut exactly ───
export interface FarmerPurchaseRecord {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  document_type: string;
  merchant_name: string;
  merchant_address: string;
  merchant_gstin: string;
  merchant_pan?: string | null;
  voucher_no: string;
  voucher_date: string;
  farmer_name: string;
  farmer_address: string;
  farmer_state: string;
  farmer_pan?: string | null;
  crop: string;
  hsn_code: string;
  qty: string;
  uqc: string;
  rate: string;
  payable_amount: string;
  cgst_rate: string;
  sgst_rate: string;
  cgst_amount: string;
  sgst_amount: string;
  final_amount: string;
  payable_amount_in_words: string;
  payment_method: string;
  payment_reference?: string | null;
  terms: string;
}

interface Filters {
  voucher_no: string;
  farmer_name: string;
  merchant_gstin: string;
  farmer_pan: string;
  voucher_date_from: string;
  voucher_date_to: string;
  created_by: string;
}

interface FieldErrors {
  date_range?: string;
  [key: string]: string | undefined;
}

const getTodayString = () => new Date().toISOString().split("T")[0];

const EMPTY_FILTERS: Filters = {
  voucher_no: "",
  farmer_name: "",
  merchant_gstin: "",
  farmer_pan: "",
  voucher_date_from: "",
  voucher_date_to: getTodayString(),
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

const FILTER_STORAGE_KEY = ["FarmerBillBookFilter"] as const;
const SEARCH_QUERY_BASE_KEY = "FarmerPurchases_Search" as const;
const ALL_QUERY_KEY = ["FarmerPurchases"] as const;

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

function compareBillsDesc(a: FarmerPurchaseRecord, b: FarmerPurchaseRecord): number {
  if (a.voucher_date !== b.voucher_date) {
    return a.voucher_date < b.voucher_date ? 1 : -1;
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

async function fetchFarmerPurchases(
  filters: Filters,
): Promise<FarmerPurchaseRecord[]> {
  const payload: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value) payload[key] = value;
  });

  const res = await apiFetch(`${settings.BE_URL}/get-farmer-purchase`, {
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
  const data: FarmerPurchaseRecord[] = await res.json();
  return [...data].sort(compareBillsDesc);
}

export default function FarmerBillBook() {
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

  // All bills come from the cache (same pattern as the invoice book)
  const { data: allBills } = useQuery<FarmerPurchaseRecord[]>({
    queryKey: [...ALL_QUERY_KEY],
    queryFn: FetchFarmerPurchases,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const {
    data: searchBills,
    isFetching: isSearching,
    error: searchError,
  } = useQuery<FarmerPurchaseRecord[]>({
    queryKey: [SEARCH_QUERY_BASE_KEY, appliedFilters],
    queryFn: () => fetchFarmerPurchases(appliedFilters as Filters),
    enabled: appliedFilters !== null,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isSearchActive = appliedFilters !== null;
  const bills = isSearchActive ? searchBills : allBills;

  const activeQueryKey = isSearchActive
    ? ([SEARCH_QUERY_BASE_KEY, appliedFilters] as const)
    : ALL_QUERY_KEY;

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
      "merchant_gstin",
      "farmer_pan",
      "created_by",
    ];
    const value = upperKeys.includes(key) ? rawValue.toUpperCase() : rawValue;

    setFilters((prev) => ({ ...prev, [key]: value }));

    setFieldErrors((prev) => {
      const next: FieldErrors = { ...prev };
      if (key === "voucher_date_from" || key === "voucher_date_to") {
        const from =
          key === "voucher_date_from" ? value : filters.voucher_date_from;
        const to = key === "voucher_date_to" ? value : filters.voucher_date_to;
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
    if (!bills || bills.length === 0) return;

    setIsExporting(true);
    try {
      const rows = bills.map((bill) => ({
        "Voucher No.": bill.voucher_no,
        "Voucher Date": bill.voucher_date,
        "Merchant Name": bill.merchant_name,
        "Merchant Address": bill.merchant_address,
        "Merchant GSTIN": bill.merchant_gstin,
        "Merchant PAN": bill.merchant_pan || "",
        "Farmer Name": bill.farmer_name,
        "Farmer Address": bill.farmer_address,
        "Farmer State": bill.farmer_state,
        "Farmer PAN": bill.farmer_pan || "",
        Crop: bill.crop,
        HSN: bill.hsn_code,
        Qty: bill.qty,
        UQC: bill.uqc,
        Rate: bill.rate,
        "Payable Amount": toIndianAmount(bill.payable_amount),
        "CGST %": bill.cgst_rate,
        "CGST Amount": toIndianAmount(bill.cgst_amount),
        "SGST %": bill.sgst_rate,
        "SGST Amount": toIndianAmount(bill.sgst_amount),
        "Final Amount": toIndianAmount(bill.final_amount),
        "Amount In Words": bill.payable_amount_in_words,
        "Payment Method": bill.payment_method,
        Reference: bill.payment_reference || "",
        "Created By": bill.created_by,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Farmer Bills");

      const fileName = `farmer_bills_export_${new Date().toISOString().split("T")[0]}.xlsx`;
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
    if (!bills || bills.length === 0) return;

    setIsDownloadingBook(true);
    try {
      const res = await apiFetch(
        `${settings.BE_URL}/generate-invoice-book-pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bills),
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `Server returned ${res.status}${detail ? `: ${detail}` : ""}`,
        );
      }

      const blob = await res.blob();
      const fileName = `farmer_bill_book_${new Date().toISOString().split("T")[0]}.pdf`;

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
    if (!bills || bills.length === 0) return null;

    const safeBignumber = (val: unknown) => {
      if (val === null || val === undefined || val === "")
        return math.bignumber(0);
      try {
        return math.bignumber(String(val));
      } catch {
        return math.bignumber(0);
      }
    };

    const sumField = (field: keyof FarmerPurchaseRecord) =>
      bills.reduce(
        (acc, bill) => math.add(acc, safeBignumber(bill[field])),
        math.bignumber(0),
      );

    return {
      taxable: sumField("payable_amount").toString(),
      cgst: sumField("cgst_amount").toString(),
      sgst: sumField("sgst_amount").toString(),
      final: sumField("final_amount").toString(),
    };
  }, [bills]);

  const totalPages = bills
    ? Math.max(1, Math.ceil(bills.length / pageSize))
    : 1;
  const pageBills = bills
    ? bills.slice((page - 1) * pageSize, page * pageSize)
    : [];

  const advancedFields: FilterField[] = [
    {
      key: "voucher_no",
      label: "Bill no.",
      type: "text",
      placeholder: "BILL-2026-0142",
    },
    {
      key: "farmer_name",
      label: "Farmer name",
      type: "text",
      placeholder: "Contains...",
    },
    {
      key: "merchant_gstin",
      label: "Merchant GSTIN",
      type: "text",
      placeholder: "24ABCDE...",
      mono: true,
    },
    {
      key: "farmer_pan",
      label: "Farmer PAN",
      type: "text",
      placeholder: "ABCDE...",
      mono: true,
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
          <h1 className="mbr-title">Farmer Bill Book</h1>
          <p className="mbr-subtitle">
            Search, filter and reconcile farmer purchase bills
          </p>
        </div>
        <div className="mbr-seal">
          <span className="mbr-seal-count">{bills ? bills.length : "—"}</span>
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
                      id="voucher_date_from"
                      type="date"
                      value={filters.voucher_date_from}
                      onChange={(e) =>
                        updateFilter("voucher_date_from", e.target.value)
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
                      id="voucher_date_to"
                      type="date"
                      value={filters.voucher_date_to}
                      onChange={(e) =>
                        updateFilter("voucher_date_to", e.target.value)
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

      {!isSearching && bills && bills.length === 0 && (
        <div className="mbr-empty">
          No bills match these filters. Try widening your search.
        </div>
      )}

      {bills && bills.length > 0 && (
        <>
          <div className="mbr-table-wrap">
            <table className="mbr-table">
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Date</th>
                  <th>Farmer</th>
                  <th className="mbr-num">Crop</th>
                  <th className="mbr-num">Amount</th>
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
                <span className="mbr-total-label">GST</span>
                <span className="mbr-total-value" title={totals.cgst}>
                  ₹{" "}
                  {toIndianAmount(
                    new Decimal(totals.cgst)
                      .plus(new Decimal(totals.sgst))
                      .toFixed(2),
                  )}
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