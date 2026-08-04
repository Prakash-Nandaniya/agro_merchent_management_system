import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Loader2,
  Save as SaveIcon,
  AlertTriangle,
  Calendar,
  FileText,
  Plus,
  X,
  Printer,
  Download,
  Send as SendIcon,
} from "lucide-react";
import Decimal from "decimal.js";
import "./addtrade.css";
import { settings } from "@/settings";
import { apiFetch } from "@/utils/apifetch";
import type { SVGProps } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Wheat, Truck, ChevronDown, ArrowLeft } from "lucide-react";
import { useContext } from "react";
import { ErrorContext } from "@/components/errors/errorcontext";
import type { ProfileConfig } from "@/components/profile_configuration/profileconfig";
import { useQueryClient } from "@tanstack/react-query";
import type { Trade } from "../tradebook/tradebook";
import BlurLoading from "@/components/blurloading/animation";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const PDF_RENDER_WIDTH = 480;

type IconProps = {
  size?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "className">;

type AmountInputProps = {
  className?: string;
  value: string;
  onValueChange: (raw: string) => void;
  placeholder?: string;
  readOnly?: boolean;
};

const WalletInflow = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="3.25" r="2.25" />
    <circle cx="12" cy="3.25" r="0.55" fill="currentColor" stroke="none" />
    <path d="M3 12a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 10h6" />
    <path d="M21 14.5h-3a1.5 1.5 0 0 0 0 3h3" />
    <circle cx="18" cy="16" r="0.55" fill="currentColor" stroke="none" />
  </svg>
);

const WalletOutflow = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 14h6" />
    <path d="M21 7.5h-3a1.5 1.5 0 0 0 0 3h3" />
    <circle cx="18" cy="9" r="0.55" fill="currentColor" stroke="none" />
    <circle cx="12" cy="20.75" r="2.25" />
    <circle cx="12" cy="20.75" r="0.55" fill="currentColor" stroke="none" />
    <circle cx="12" cy="20.75" r="2.25" />
    <circle cx="12" cy="20.75" r="0.55" fill="currentColor" stroke="none" />
  </svg>
);

const parseDecimal = (val: string | number | undefined | null): Decimal => {
  if (val === undefined || val === null || val === "") return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
};

function toRawNumber(display: string): string {
  return display.replace(/,/g, "");
}

function formatIndian(raw: string): string {
  if (raw === "") return "";
  const [intPart, decPart] = raw.split(".");
  const groupedInt =
    intPart === "" ? "" : Number(intPart).toLocaleString("en-IN");
  if (decPart === undefined) return groupedInt;
  return `${groupedInt}.${decPart}`;
}

function AmountInput({
  className,
  value,
  onValueChange,
  placeholder,
  readOnly,
}: AmountInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const displayValue = formatIndian(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const cursorBefore = el.selectionStart ?? el.value.length;
    const rawDigitsBeforeCursor = toRawNumber(
      el.value.slice(0, cursorBefore),
    ).replace(/[^0-9.]/g, "").length;

    const cleaned = toRawNumber(el.value).replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const safeRaw =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;

    onValueChange(safeRaw);

    requestAnimationFrame(() => {
      if (!ref.current) return;
      const newFormatted = formatIndian(safeRaw);
      let count = 0,
        pos = 0;
      for (; pos < newFormatted.length; pos++) {
        if (newFormatted[pos] !== ",") count++;
        if (count >= rawDigitsBeforeCursor) {
          pos++;
          break;
        }
      }
      ref.current.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      className={className}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  );
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function toISODateOnly(raw: string): string {
  if (!raw) return todayISO();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const parts = raw.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  }

  return todayISO();
}

const UNIT_OPTIONS = ["Kg", "Qtl", "T", "MT"];

export default function AddTrade(props: {
  trade?: any;
  isEditMode?: boolean;
  isViewMode?: boolean;
}) {
  const errorcontext = useContext(ErrorContext);
  const navigate = useNavigate();
  const location = useLocation();

  const existingTrade =
    props.trade !== undefined ? props.trade : location.state?.trade;
  const isEditMode =
    props.isEditMode !== undefined
      ? props.isEditMode
      : location.state?.isEditMode;
  const isViewMode =
    props.isViewMode !== undefined
      ? props.isViewMode
      : location.state?.isViewMode;

  const isReadOnly = isViewMode;

  const [tradeDate, setTradeDate] = useState(
    existingTrade?.trade_creation_date
      ? toISODateOnly(existingTrade.trade_creation_date)
      : todayISO(),
  );

  const [invoiceNo, setInvoiceNo] = useState(existingTrade?.invoice_no || "");
  const [cropName, setcropName] = useState(existingTrade?.crop_name || "");
  const [VehicleNo, setvehicleNo] = useState(existingTrade?.vehicle_no || "");

  const [partyName, setpartyName] = useState(existingTrade?.party_name || "");
  const [millQty, setMillQty] = useState(existingTrade?.mill_qty || "");
  const [millQtyUnit, setMillQtyUnit] = useState(
    existingTrade?.mill_qty_unit || "",
  );
  const [millRate, setMillRate] = useState(existingTrade?.mill_rate || "");
  const [millRateUnit, setMillRateUnit] = useState(
    existingTrade?.mill_rate_unit || "",
  );
  const [gstCollected, setGstCollected] = useState(
    existingTrade?.gst_collected || "",
  );
  const [tdsDeducted, setTdsDeducted] = useState(
    existingTrade?.tds_deducted || "",
  );
  const [millPayment, setMillPayment] = useState(
    existingTrade?.mill_payment || "",
  );

  const [farmerPayment, setFarmerPayment] = useState(
    existingTrade?.farmer_payment || "",
  );
  const [labourCost, setLabourCost] = useState(
    existingTrade?.labour_cost || "",
  );
  const [transportCost, setTransportCost] = useState(
    existingTrade?.transport_cost || "",
  );
  const [otherCost, setOtherCost] = useState(existingTrade?.other_cost || "");

  const [saving, setSaving] = useState(false);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptEdited, setReceiptEdited] = useState(false);
  const [existingReceiptKey] = useState<string | null>(
    existingTrade?.mill_receipt || null,
  );
  const [millReceiptUrl, setMillReceiptUrl] = useState<string>("");
  const [millReceiptIsPdf, setMillReceiptIsPdf] = useState(false);
  const [loadingExistingReceipt, setLoadingExistingReceipt] = useState(false);
  const [cropOptions, setcropOptions] = useState<string[]>([]);

  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const queryClient = useQueryClient();
  useEffect(() => {
    const data = queryClient.getQueryData<ProfileConfig>(["Profile"]);
    const crops = data ? Object.keys(data.crops) : [];
    setcropOptions(crops);
  }, []);

  useEffect(() => {
    const tradeId = existingTrade?.id;
    if (!tradeId || !existingTrade?.mill_receipt) return;

    setLoadingExistingReceipt(true);
    (async () => {
      try {
        const res = await apiFetch(
          `${settings.BE_URL}/get-mill-receipt/${tradeId}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setMillReceiptUrl(data.url);
        const isPdf = data.url.split("?")[0].toLowerCase().endsWith(".pdf");
        setMillReceiptIsPdf(isPdf);
      } catch {
        errorcontext.addError("Could not load the mill receipt.");
      } finally {
        setLoadingExistingReceipt(false);
      }
    })();
  }, []);

  function openReceiptPicker() {
    receiptFileInputRef.current?.click();
  }

  function handleReceiptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);
    setReceiptEdited(true);

    const localPreviewUrl = URL.createObjectURL(file);
    setMillReceiptUrl(localPreviewUrl);
    setMillReceiptIsPdf(
      file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"),
    );

    e.target.value = "";
  }

  function handleRemoveReceipt() {
    setReceiptFile(null);
    setMillReceiptUrl("");
    setMillReceiptIsPdf(false);
    setReceiptEdited(true);
  }

  const inflowDec = parseDecimal(millPayment)
    .plus(parseDecimal(tdsDeducted))
    .minus(parseDecimal(gstCollected));
  const outflowDec = parseDecimal(farmerPayment)
    .plus(parseDecimal(labourCost))
    .plus(parseDecimal(transportCost))
    .plus(parseDecimal(otherCost));
  const profitLossDec = inflowDec.minus(outflowDec);

  const receiptFileSource = useMemo(
    () => receiptFile || millReceiptUrl,
    [receiptFile, millReceiptUrl],
  );

  const [pdfRendered, setPdfRendered] = useState(false);

  useEffect(() => {
    setPdfRendered(false);
  }, [receiptFileSource]);

  function handleQtyUnitSelect(value: string) {
    setMillQtyUnit(value);
  }

  function handleRateUnitSelect(value: string) {
    setMillRateUnit(value);
  }

  function toDDMMYYYY(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    return `${day}-${month}-${year}`;
  }

  const receiptBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    receiptBlobRef.current = null;
  }, [receiptFileSource]);

  async function getReceiptBlob(): Promise<Blob> {
    if (receiptFile) return receiptFile; 
    if (receiptBlobRef.current) return receiptBlobRef.current;
    const res = await fetch(millReceiptUrl);
    const blob = await res.blob();
    receiptBlobRef.current = blob;
    return blob;
  }

  // --- Mill receipt Print / Download / Send ---
  async function handlePrint() {
    if (!millReceiptUrl) return;
    setIsPrinting(true);
    let printFrame: HTMLIFrameElement | null = null;
    let url: string | null = null;
    try {
      const blob = await getReceiptBlob();
      url = URL.createObjectURL(blob);

      printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      document.body.appendChild(printFrame);

      await new Promise<void>((resolve) => {
        printFrame!.onload = () => resolve();
        printFrame!.src = url!;
      });

      printFrame.contentWindow?.focus();
      try {
        printFrame.contentWindow?.print();
      } catch {
        window.open(url!, "_blank");
        errorcontext.addError(
          "The receipt has opened in a new tab — use the print icon there.",
        );
      }
    } catch {
      errorcontext.addError("Could not print the mill receipt.");
    } finally {
      setIsPrinting(false);
      setTimeout(() => {
        if (printFrame) document.body.removeChild(printFrame);
        if (url) URL.revokeObjectURL(url);
      }, 60000);
    }
  }

  async function handleDownload() {
    if (!millReceiptUrl) return;
    setIsDownloading(true);
    try {
      const blob = await getReceiptBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mill-receipt-${invoiceNo || existingTrade?.id || "trade"}${millReceiptIsPdf ? ".pdf" : ""}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      errorcontext.addError("Could not download the mill receipt.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSend() {
    if (!millReceiptUrl) return;
    setIsSending(true);
    try {
      const blob = await getReceiptBlob();
      const fileName = `mill-receipt-${invoiceNo || existingTrade?.id || "trade"}${millReceiptIsPdf ? ".pdf" : ""}`;
      const file = new File([blob], fileName, {
        type:
          blob.type || (millReceiptIsPdf ? "application/pdf" : "image/jpeg"),
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Mill Receipt",
        });
      } else {
        errorcontext.addError(
          "Direct sharing is not supported on this browser. The file will download now so you can attach it manually.",
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      errorcontext.addError("Could not send the mill receipt.");
    } finally {
      setIsSending(false);
    }
  }

  function renderReceiptSection() {
    return (
      <section className="at-receipt-section">
        <div className="at-receipt-section__header">
          <FileText size={25} />
          <h2 className="at-receipt-section__title">Mill Receipt</h2>
        </div>

        {!isReadOnly && (
          <input
            ref={receiptFileInputRef}
            type="file"
            className="at-receipt-section__hidden-input"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*,application/pdf"
            onChange={handleReceiptFileChange}
          />
        )}

        {!millReceiptUrl && !loadingExistingReceipt && !isReadOnly && (
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
          <div className="at-receipt-section__box">
            <div className="at-receipt-section__skeleton" />
          </div>
        )}

        {millReceiptUrl && !loadingExistingReceipt && (
          <div className="at-receipt-section__preview">
            {!isReadOnly && (
              <button
                type="button"
                className="at-receipt-section__remove-btn"
                onClick={handleRemoveReceipt}
                title="Remove receipt"
              >
                <X size={20} />
              </button>
            )}

            <div className="at-receipt-section__viewport">
              {millReceiptIsPdf ? (
                <div className="at-receipt-section__pdf-frame">
                  {!pdfRendered && (
                    <div className="at-receipt-section__box">
                      <div className="at-receipt-section__skeleton" />
                    </div>
                  )}
                  <div
                    className={`at-receipt-section__document ${pdfRendered ? "is-ready" : "is-loading"}`}
                  >
                    <Document
                      file={receiptFileSource}
                      error={
                        <div className="at-receipt-section__error">
                          <AlertTriangle size={16} />
                          Could not load PDF.
                        </div>
                      }
                    >
                      <Page
                        pageNumber={1}
                        width={PDF_RENDER_WIDTH}
                        devicePixelRatio={Math.max(
                          window.devicePixelRatio || 1,
                          3,
                        )}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onRenderSuccess={() => setPdfRendered(true)}
                      />
                    </Document>
                  </div>
                </div>
              ) : (
                <img
                  src={millReceiptUrl}
                  className="at-receipt-section__image"
                  alt="Mill receipt"
                />
              )}
            </div>
            {isReadOnly && (
              <div
                className="max-w-4xl mx-auto mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 print-hide px-2 sm:px-0"
                style={{ margin: 0, width: "100%" }}
              >
                <>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-70
                         disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
                  >
                    {isPrinting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Printer size={16} />
                    )}
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70
                         disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
                  >
                    {isSending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <SendIcon size={16} />
                    )}
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isPrinting || isDownloading || isSending}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70
                         disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
                  >
                    {isDownloading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Download
                  </button>
                </>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  const shouldRenderReceiptSection =
    !isViewMode || !!existingTrade?.mill_receipt;

  return (
    <BlurLoading message="Saving" loading={saving}>
      <div className="at-page">
        <div className="at-shell">
          {isEditMode || isViewMode ? (
            <button
              type="button"
              className="at-btn-back"
              onClick={() => navigate("/trade-book")}
            >
              <ArrowLeft size={16} />
              Back to Trade Book
            </button>
          ) : (
            ""
          )}
          <header className="at-header">
            <div>
              <div className="at-eyebrow">Trade Book</div>
              <h1 className="at-title">
                {isViewMode
                  ? "View Trade"
                  : isEditMode
                    ? "Edit Trade"
                    : "Add New Trade"}
              </h1>
              <p className="at-subtitle">
                Record inflow from mill and outflow to farmers, labour &amp;
                transport.
              </p>
            </div>
            <div className="at-date-card">
              <Calendar size={16} />
              <label className="at-label">Trade Date</label>
              <input
                type="date"
                className="at-date-input"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                readOnly={isReadOnly}
              />
            </div>
          </header>
          <div className="at-invoice-title-row">
            <h2 className="at-section-title">Invoice</h2>
          </div>
          <div className="at-invoice-inline">
            <div className="at-field-group">
              <label className="at-label">Invoice No.</label>
              <input
                type="text"
                className="at-invoice-input"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                readOnly={isReadOnly}
              />
            </div>

            <div className="at-field-group">
              <Wheat size={18} className="at-icon" />
              <label className="at-label">Crop</label>
              <div className="at-select-wrapper">
                <select
                  className="at-invoice-input at-select-inline"
                  value={cropName}
                  onChange={(e) => setcropName(e.target.value)}
                  disabled={isReadOnly}
                >
                  <option value="">Select</option>
                  {cropOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="at-select-icon" />
              </div>
            </div>

            <div className="at-field-group">
              <Truck size={18} className="at-icon" />
              <label className="at-label">Vehicle No.</label>
              <input
                type="text"
                className="at-invoice-input at-vehicle-input"
                value={VehicleNo}
                onChange={(e) => setvehicleNo(e.target.value.toUpperCase())}
                readOnly={isReadOnly}
              />
            </div>
          </div>

          <div className="at-two-col">
            <section className="at-panel at-panel--inflow">
              <div className="at-panel-head">
                <WalletInflow size={30} />
                <h2 className="at-section-title">Inflow</h2>
              </div>
              <div className="at-form-grid">
                <div className="at-field">
                  <label className="at-label">Party Name</label>
                  <input
                    type="text"
                    className="at-millqty-input"
                    value={partyName}
                    onChange={(e) => setpartyName(e.target.value)}
                    readOnly={isReadOnly}
                  />
                </div>

                <div className="at-field">
                  <div className="at-label-row">
                    <label className="at-label">Mill Qty</label>
                    <span className="at-label-paren">(</span>
                    <select
                      className="at-rate-inline-select"
                      value={millQtyUnit}
                      onChange={(e) => handleQtyUnitSelect(e.target.value)}
                      disabled={isReadOnly}
                    >
                      <option value="">unit</option>
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <span className="at-label-paren">)</span>
                  </div>
                  <AmountInput
                    className="at-millqty-input"
                    value={millQty}
                    onValueChange={setMillQty}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>

                <div className="at-field">
                  <div className="at-label-row">
                    <label className="at-label">Mill Rate</label>
                    <span className="at-label-paren">(per</span>
                    <select
                      className="at-rate-inline-select"
                      value={millRateUnit}
                      onChange={(e) => handleRateUnitSelect(e.target.value)}
                      disabled={isReadOnly}
                    >
                      <option value="">unit</option>
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <span className="at-label-paren">)</span>
                  </div>
                  <AmountInput
                    className="at-millrate-input"
                    value={millRate}
                    onValueChange={setMillRate}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>

                <div className="at-field">
                  <label className="at-label">GST Collected</label>
                  <AmountInput
                    className="at-gst-input"
                    value={gstCollected}
                    onValueChange={setGstCollected}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="at-field">
                  <label className="at-label">TDS Deducted</label>
                  <AmountInput
                    className="at-tds-input"
                    value={tdsDeducted}
                    onValueChange={setTdsDeducted}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="at-field">
                  <label className="at-label">Mill Payment</label>
                  <AmountInput
                    className="at-millpayment-input"
                    value={millPayment}
                    onValueChange={setMillPayment}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
            </section>
            <section className="at-panel at-panel--outflow">
              <div className="at-panel-head">
                <WalletOutflow size={30} />
                <h2 className="at-section-title">Outflow</h2>
              </div>
              <div className="at-form-grid">
                <div className="at-field">
                  <label className="at-label">Farmer Payment</label>
                  <AmountInput
                    className="at-farmer-input"
                    value={farmerPayment}
                    onValueChange={setFarmerPayment}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="at-field">
                  <label className="at-label">Labour Cost</label>
                  <AmountInput
                    className="at-labour-input"
                    value={labourCost}
                    onValueChange={setLabourCost}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="at-field">
                  <label className="at-label">Transport Cost</label>
                  <AmountInput
                    className="at-transport-input"
                    value={transportCost}
                    onValueChange={setTransportCost}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="at-field">
                  <label className="at-label">Other Cost</label>
                  <AmountInput
                    className="at-other-input"
                    value={otherCost}
                    onValueChange={setOtherCost}
                    placeholder="0.00"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
            </section>
          </div>
          <section className="at-summary">
            <div className="at-summary-item">
              <span className="at-summary-label">Inflow</span>
              <span className="at-summary-value">
                ₹ {formatIndian(inflowDec.toFixed(2))}
              </span>
            </div>
            <div className="at-summary-divider" />
            <div className="at-summary-item">
              <span className="at-summary-label">Outflow</span>
              <span className="at-summary-value">
                ₹ {formatIndian(outflowDec.toFixed(2))}
              </span>
            </div>
            <div
              className={`at-summary-item at-summary-item--grand ${profitLossDec.gte(0) ? "at-profit" : "at-loss"}`}
            >
              <span className="at-summary-label">
                {profitLossDec.gte(0) ? "Net Profit" : "Net Loss"}
              </span>
              <span className="at-summary-value">
                ₹ {formatIndian(profitLossDec.abs().toFixed(2))}
              </span>
            </div>
          </section>

          {shouldRenderReceiptSection && renderReceiptSection()}

          {!isReadOnly && (
            <div className="at-actions">
              <button
                className="at-btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={16} className="at-spin" />
                ) : (
                  <SaveIcon size={16} />
                )}
                {saving
                  ? "Saving..."
                  : isEditMode
                    ? "Save Changes"
                    : "Save Trade"}
              </button>
            </div>
          )}
        </div>
      </div>
    </BlurLoading>
  );

  async function handleSave() {
    if (cropName == "") {
      errorcontext.addError("Please select Crop");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("trade_creation_date", toDDMMYYYY(tradeDate));
      fd.append("invoice_no", invoiceNo.trim());
      fd.append("crop_name", cropName);
      fd.append("vehicle_no", VehicleNo || "");
      fd.append("party_name", partyName || "");
      fd.append("mill_qty", millQty || "");
      fd.append("mill_qty_unit", millQtyUnit);
      fd.append("mill_rate", millRate || "");
      fd.append("mill_rate_unit", millRateUnit);
      fd.append("gst_collected", gstCollected || "");
      fd.append("tds_deducted", tdsDeducted || "");
      fd.append("mill_payment", millPayment || "");
      fd.append("farmer_payment", farmerPayment || "");
      fd.append("labour_cost", labourCost || "");
      fd.append("transport_cost", transportCost || "");
      fd.append("other_cost", otherCost || "");

      if (isEditMode) {
        fd.append("id", existingTrade!.id);
        fd.append("form_edited", "true");
        fd.append("mill_receipt_edited", String(receiptEdited));
        if (existingReceiptKey)
          fd.append("existing_mill_receipt", existingReceiptKey);
      }

      if (receiptFile) fd.append("file", receiptFile);

      const url = isEditMode
        ? `${settings.BE_URL}/edit-trade`
        : `${settings.BE_URL}/create-trade`;
      const res = await apiFetch(url, {
        method: isEditMode ? "PUT" : "POST",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail =
          typeof body.detail === "string"
            ? body.detail
            : Array.isArray(body.detail)
              ? body.detail
                  .map((d: any) => d.msg || JSON.stringify(d))
                  .join(", ")
              : `Request failed with status ${res.status}`;
        errorcontext.addError(detail);
        return;
      }
      const savedTrade = await res.json();
      queryClient.setQueryData<Trade[]>(["Trades"], (oldData) => {
        if (!oldData) return [savedTrade];

        const exists = oldData.some((trade) => trade.id === savedTrade.id);

        if (exists) {
          return oldData.map((trade) =>
            trade.id === savedTrade.id ? savedTrade : trade,
          );
        } else {
          return [savedTrade, ...oldData];
        }
      });
      navigate("/trade-book");
    } catch (err) {
      errorcontext.addError(
        err instanceof Error ? err.message : "Could not reach the server.",
      );
    } finally {
      setSaving(false);
    }
  }
}
