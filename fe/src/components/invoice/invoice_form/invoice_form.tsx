import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  Printer,
  X,
  Eye,
  Pencil,
  Save as SaveIcon,
  Send as SendIcon,
  Loader2,
  Download,
} from "lucide-react";
import "./invoice_form.css";
import React from "react";
import { settings } from "@/settings";
import Decimal from "decimal.js";
import karmaLogo from "@/assets/karma_trading_logo.png";
import { apiFetch } from "@/utils/apifetch";
import { useContext } from "react";
import { ErrorContext } from "@/components/errors/errorcontext";
import { useQueryClient } from "@tanstack/react-query";

// ─── Profile config shapes (matches backend ProfileConfigSchema) ──────────────
interface ProfileBank {
  bank: string;
  account: string;
  ifsc: string;
}

// ─── Crop option shape: array of dict, "crop" as key ───────────────────────────
interface CropOption {
  crop: string;
  hsn: string;
  cgst: string;
  sgst: string;
}

// ─── Saved invoice shape sent to the PDF generator — one flat crop row now ────
interface SavedInvoice {
  seller_name: string;
  seller_address: string;
  seller_pan: string;
  seller_gstin: string;
  invoice_no: string;
  invoice_date: string;
  eway_bill_no:string | null;
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
  crop: string;
  hsn_code: string;
  qty: string;
  uqc: string;
  rate: string;
  taxable_amount: string;
  cgst_rate: string;
  cgst_amount: string;
  sgst_rate: string;
  sgst_amount: string;
  final_amount: string;
  final_amount_in_words: string;
  terms: string;
}

// ─── Number → Indian words ─────────────────────────────────────────────────────
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function toWords(n: number): string {
  if (n === 0) return "Zero";
  if (n < 20) return ONES[n];
  if (n < 100)
    return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1_000)
    return (
      ONES[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + toWords(n % 100) : "")
    );
  if (n < 1_00_000)
    return (
      toWords(Math.floor(n / 1000)) +
      " Thousand" +
      (n % 1000 ? " " + toWords(n % 1000) : "")
    );
  if (n < 1_00_00_000)
    return (
      toWords(Math.floor(n / 1_00_000)) +
      " Lakh" +
      (n % 1_00_000 ? " " + toWords(n % 1_00_000) : "")
    );
  return (
    toWords(Math.floor(n / 1_00_00_000)) +
    " Crore" +
    (n % 1_00_00_000 ? " " + toWords(n % 1_00_00_000) : "")
  );
}

function amountInWords(amount: Decimal | null | undefined): string {
  if (!amount || amount.lte(0)) {
    return "";
  }
  const safeAmount = amount.toDecimalPlaces(2);
  const rupees = safeAmount.floor().toNumber();
  return toWords(rupees) + " Rupees" + " Only.";
}

// ─── Safely convert any string/number/undefined into a Decimal ────────────────
const parseDecimal = (val: string | number | undefined | null): Decimal => {
  if (val === undefined || val === null || val === "") return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
};

// ─── Format a Decimal to 2-decimal Indian-format string for display only ──────
function fmt(x: Decimal): string {
  const n = x.toNumber();
  if (!n || n === 0) return "0.00";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateForPrint(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Field component ───────────────────────────────────────────────────────────
interface FieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  align?: "left" | "right" | "center";
  bold?: boolean;
  upper?: boolean;
  width?: string;
  readOnly?: boolean;
  autoFit?: boolean;
  minChars?: number;
}

function Field({
  value,
  onChange,
  placeholder = "",
  className = "",
  type = "text",
  align = "left",
  bold = false,
  upper = false,
  width = "w-full",
  readOnly = false,
  autoFit = false,
  minChars = 3,
}: FieldProps) {
  // ── When autoFit is on, size the input in `ch` units to match the
  //    content length (plus a little breathing room), instead of using
  //    a fixed Tailwind width class. Grows/shrinks live as you type. ──
  const fitStyle = autoFit
    ? { width: `${Math.max(minChars, value.length + 1)}ch` }
    : undefined;

  return (
    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(upper ? e.target.value.toUpperCase() : e.target.value)
      }
      placeholder={placeholder}
      readOnly={readOnly}
      style={fitStyle}
      className={[
        "bg-transparent outline-none",
        "border-b border-dashed border-gray-400",
        readOnly
          ? "cursor-not-allowed text-gray-500"
          : "hover:border-blue-400 focus:border-blue-600",
        "placeholder:text-gray-300 text-gray-900",
        "transition-colors duration-150",
        autoFit ? "" : width, // skip the Tailwind width class when auto-fitting
        align === "right" ? "text-right" : "",
        align === "center" ? "text-center" : "",
        bold ? "font-semibold" : "",
        className,
      ].join(" ")}
    />
  );
}

// ─── Central form state — every field is a plain string, including the single
//     crop row now that a bill holds exactly one crop ──────────────────────────
const INIT = {
  sellerName: "",
  sellerAddress: "",
  sellerPAN: "",
  sellerGSTIN: "",
  sellerBank: "",
  sellerAccount: "",
  sellerIFSC: "",
  invoiceNo: "",
  invoiceDate: todayISO(),
  eway_bill_no:"",
  docketNo: "",
  transportName: "",
  deliveryThrough: "",
  partyName: "",
  partyAddress: "",
  partyGSTIN: "",
  partyPAN: "",
  partyState: "24-Gujarat",
  partyCity: "",

  // ── single crop row, folded directly into central state ──
  crop: "",
  hsnCode: "",
  qty: "",
  uqc: "",
  rate: "",
  taxableAmt: "",
  cgstRate: "",
  cgstAmt: "",
  sgstRate: "",
  sgstAmt: "",
  finalAmt: "",

  final_amount_in_words: "",
  terms: "",
  createdBy: "",
};

type FormState = typeof INIT;

interface Crop {
  hsn: string;
  sgst: string;
  cgst: string;
}
interface Bank {
  bank: string;
  account: string;
  ifsc: string;
}
interface ProfileConfig {
  seller: { name: string; address: string; pan: string; gstin: string };
  bank_accounts: Bank[];
  crops: Record<string, Crop>;
  terms_and_conditions: string;
}

const EMPTY_CONFIG: ProfileConfig = {
  seller: { name: "", address: "", pan: "", gstin: "" },
  bank_accounts: [],
  crops: {},
  terms_and_conditions: "",
};
// UQC options
const uqcOptions = ["KGS", "TONS", "MTN", "NOS"];

// ─── Validation error popup ────────────────────────────────────────────────────
function ErrorPopup({
  errors,
  onClose,
}: {
  errors: string[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white border border-red-300 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-red-600 text-base">
            Please fix before save
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-1.5 mb-5">
          {errors.map((e, i) => (
            <li
              key={i}
              className="text-sm text-gray-700 flex items-start gap-1.5"
            >
              <span className="text-red-500 mt-0.5 shrink-0">•</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded transition-colors"
        >
          OK, let me fix it
        </button>
      </div>
    </div>
  );
}

// ─── Saving overlay — shown while the bill is being POSTed to the backend ─────
function SavingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print-hide">
      <div className="bg-white rounded-lg shadow-xl px-8 py-6 flex flex-col items-center gap-3">
        <div className="mb-spinner" />
        <span className="text-sm text-gray-700 font-medium">Saving...</span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function InvoiceForm() {
  const errorcontext = useContext(ErrorContext);
  // ── Central state — all bill fields as strings, including the single crop ───
  const [s, setS] = useState<FormState>(INIT);
  const [isSending, setIsSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showRetryBanner, setShowRetryBanner] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<"edit" | "preview" | "saved">(
    "edit",
  );
  const [isSaving, setIsSaving] = useState(false);
  const isReadOnly = viewMode !== "edit";

  // ── Profile-driven state ──────────────────────────────────────────────────────
  const [cropOptions, setCropOptions] = useState<CropOption[]>([]);
  const [bankAccountOptions, setBankAccountOptions] = useState<ProfileBank[]>(
    [],
  );
  const [selectedBankIndex, setSelectedBankIndex] = useState(0);

  const pdfBlobRef = useRef<Blob | null>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const zoomOuterRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomReady, setZoomReady] = useState(false);
  const DESKTOP_WIDTH = 925;

  const queryClient = useQueryClient();
  const profile =
    queryClient.getQueryData<ProfileConfig>(["Profile"]) || EMPTY_CONFIG;

  // ── Fetch profile config on mount ─────────────────────────────────────────────
  useEffect(() => {
    setS((prev) => ({
      ...prev,
      sellerName: profile.seller.name,
      sellerAddress: profile.seller.address,
      sellerPAN: profile.seller.pan,
      sellerGSTIN: profile.seller.gstin,
      terms: profile.terms_and_conditions,
    }));

    // Build crop dropdown from profile.crops — array of dict, "crop" as key
    const cropsFromProfile: CropOption[] = Object.entries(
      profile.crops || {},
    ).map(([name, c]) => ({
      crop: name,
      hsn: c.hsn,
      cgst: c.cgst,
      sgst: c.sgst,
    }));
    if (cropsFromProfile.length > 0) setCropOptions(cropsFromProfile);

    // Bank accounts — array of dict
    const banks = profile.bank_accounts || [];
    setBankAccountOptions(banks);
    if (banks.length >= 1) {
      setSelectedBankIndex(0);
      setS((prev) => ({
        ...prev,
        sellerBank: banks[0].bank,
        sellerAccount: banks[0].account,
        sellerIFSC: banks[0].ifsc,
      }));
    }
  }, []);

  // ── Derive taxable/cgst/sgst/final + words whenever qty/rate/rates change ────
  const calcInputsKey = `${s.qty}|${s.rate}|${s.cgstRate}|${s.sgstRate}`;

  useEffect(() => {
    const qty = parseDecimal(s.qty);
    const rate = parseDecimal(s.rate);
    const cgstRate = parseDecimal(s.cgstRate);
    const sgstRate = parseDecimal(s.sgstRate);

    const taxableAmt = qty.mul(rate);
    const cgstAmt = taxableAmt.mul(cgstRate).div(100);
    const sgstAmt = taxableAmt.mul(sgstRate).div(100);
    const finalAmt = taxableAmt.plus(cgstAmt).plus(sgstAmt);

    setS((prev) => ({
      ...prev,
      taxableAmt: taxableAmt.toString(),
      cgstAmt: cgstAmt.toString(),
      sgstAmt: sgstAmt.toString(),
      finalAmt: finalAmt.toString(),
      final_amount_in_words: amountInWords(finalAmt),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcInputsKey]);

  useLayoutEffect(() => {
    const computeZoom = () => {
      const el = zoomOuterRef.current;
      if (!el) return;
      const availableWidth = el.clientWidth;
      setZoomLevel(
        availableWidth < DESKTOP_WIDTH ? availableWidth / DESKTOP_WIDTH : 1,
      );
      setZoomReady(true);
    };

    computeZoom();
    window.addEventListener("resize", computeZoom);
    window.addEventListener("orientationchange", computeZoom);
    return () => {
      window.removeEventListener("resize", computeZoom);
      window.removeEventListener("orientationchange", computeZoom);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const f = (key: keyof FormState) => (v: string) =>
    setS((p) => ({ ...p, [key]: v }));

  const handleCropChange = (cropName: string) => {
    const found = cropOptions.find((c) => c.crop === cropName);
    setS((prev) => ({
      ...prev,
      crop: cropName,
      hsnCode: found?.hsn ?? "",
      cgstRate: found?.cgst ?? "0",
      sgstRate: found?.sgst ?? "0",
    }));
  };

  const handleBankSelect = (idx: number) => {
    const b = bankAccountOptions[idx];
    if (b) {
      setSelectedBankIndex(idx);
      setS((prev) => ({
        ...prev,
        sellerBank: b.bank,
        sellerAccount: b.account,
        sellerIFSC: b.ifsc,
      }));
    }
  };

  // Helper to generate the clean file name
  const getDynamicFileName = () => {
    const safePartyName = s.partyName.trim().replace(/\s+/g, "_");
    return `${safePartyName}_${s.invoiceNo}.pdf`;
  };

  const handleuqcChange = (uqc: string) => {
    setS((prev) => ({ ...prev, uqc }));
  };

  // ── Build plain JSON payload for the /save-invoice endpoint — flat, matches
  //    the Invoice schema's field names/aliases 1:1 now that there's one crop ──
  function buildPayload() {
    return {
      sellerName: s.sellerName,
      sellerAddress: s.sellerAddress,
      sellerPAN: s.sellerPAN,
      sellerGSTIN: s.sellerGSTIN,
      sellerBank: s.sellerBank,
      sellerAccount: s.sellerAccount,
      sellerIFSC: s.sellerIFSC,
      invoiceDate: s.invoiceDate,
      eway_bill_no:s.eway_bill_no,
      docketNo: s.docketNo,
      transportName: s.transportName,
      deliveryThrough: s.deliveryThrough,
      partyName: s.partyName,
      partyAddress: s.partyAddress,
      partyCity: s.partyCity,
      partyState: s.partyState,
      partyGSTIN: s.partyGSTIN,
      partyPAN: s.partyPAN,
      crop: s.crop,
      hsnCode: s.hsnCode,
      qty: s.qty,
      uqc: s.uqc,
      rate: s.rate,
      taxableAmt: s.taxableAmt,
      cgstRate: s.cgstRate,
      cgstAmt: s.cgstAmt,
      sgstRate: s.sgstRate,
      sgstAmt: s.sgstAmt,
      finalAmt: s.finalAmt,
      final_amount_in_words: s.final_amount_in_words,
      terms: s.terms,
    };
  }

  function buildBillForPdf(): SavedInvoice {
    return {
      seller_name: s.sellerName,
      seller_address: s.sellerAddress,
      seller_pan: s.sellerPAN,
      seller_gstin: s.sellerGSTIN,
      invoice_no: s.invoiceNo,
      invoice_date: s.invoiceDate,
      eway_bill_no:s.eway_bill_no || null,
      docket_no: s.docketNo || null,
      transport_name: s.transportName || null,
      delivery_through: s.deliveryThrough,
      party_name: s.partyName,
      party_address: s.partyAddress,
      party_city: s.partyCity || null,
      party_state: s.partyState,
      party_gstin: s.partyGSTIN,
      party_pan: s.partyPAN,
      seller_bank: s.sellerBank || null,
      seller_account: s.sellerAccount || null,
      seller_ifsc: s.sellerIFSC || null,
      crop: s.crop,
      hsn_code: s.hsnCode,
      qty: s.qty,
      uqc: s.uqc,
      rate: s.rate,
      taxable_amount: s.taxableAmt,
      cgst_rate: s.cgstRate,
      cgst_amount: s.cgstAmt,
      sgst_rate: s.sgstRate,
      sgst_amount: s.sgstAmt,
      final_amount: s.finalAmt,
      final_amount_in_words: s.final_amount_in_words,
      terms: s.terms,
    };
  }

  // ── Shared validation, reused by the Preview flow ─────────────────────────────
  function validateBill(): string[] {
    const errs: string[] = [];
    if (!s.partyName.trim()) errs.push("Party / Buyer name is required.");
    if (!s.partyGSTIN.trim()) errs.push("Party / Buyer GSTIN is required.");
    if (!s.sellerGSTIN.trim()) errs.push("Seller GSTIN is required.");
    if (!s.sellerPAN.trim()) errs.push("Seller PAN is required.");
    if (!s.partyPAN.trim()) errs.push("Party / Buyer PAN is required.");
    if (!s.deliveryThrough) errs.push("Delivery through is required.");
    if (!s.crop) errs.push("Select a crop before printing.");
    if (s.crop) {
      if (!s.qty || parseFloat(s.qty) <= 0)
        errs.push(`${s.crop}: Quantity is missing or zero.`);
      if (!s.rate || parseFloat(s.rate) <= 0)
        errs.push(`${s.crop}: Rate is missing or zero.`);
      if (!s.uqc) errs.push(`${s.crop}: UQC is required.`);
    }
    return errs;
  }

  // ── Preview button: validate, then switch to the read-only preview view
  function handlePreview() {
    const errs = validateBill();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setViewMode("preview");
  }

  // ── Edit button (from preview): go back to the fully editable form ───────────
  function handleEdit() {
    setViewMode("edit");
  }

  // ── Save button (from preview): POST to backend, show saving animation,
  //    update the cached "Invoices" list on success, then move to the
  //    'saved' view with Print / Send actions ──────────────────────────────────
  async function handleSaveBill() {
    setIsSaving(true);
    try {
      const payload = buildPayload();
      const res = await apiFetch(`${settings.BE_URL}/save-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorcontext.addError(
          body?.detail ? String(body.detail) : "Failed to save bill.",
        );
        return;
      }
      const savedBillResp = await res.json();
      setS((prev) => ({
        ...prev,
        invoiceNo: savedBillResp.invoice_no,
        createdBy: savedBillResp.created_by ?? prev.createdBy,
      }));

      // ── Update the "Invoices" cache with the newly saved bill so any
      //    screen reading that key sees it immediately, no refetch needed ──
      queryClient.setQueryData(["Invoices"], (old: unknown) =>
        Array.isArray(old) ? [savedBillResp, ...old] : [savedBillResp],
      );

      pdfBlobRef.current = null;
      setViewMode("saved");
    } catch (err) {
      errorcontext.addError(
        err instanceof Error
          ? err.message
          : "Failed to save bill. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function fetchInvoicePdf(): Promise<Blob> {
    if (pdfBlobRef.current) return pdfBlobRef.current;

    setIsGeneratingPdf(true);
    try {
      const res = await apiFetch(`${settings.BE_URL}/generate-invoice-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBillForPdf()),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        errorcontext.addError(
          `Server returned ${res.status}${detail ? `: ${detail}` : ""}`,
        );
      }

      const blob = await res.blob();
      pdfBlobRef.current = blob;
      return blob;
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const pdfBlob = await fetchInvoicePdf();
      const fileName = getDynamicFileName();

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      errorcontext.addError(
        "Something went wrong while downloading the file. Please try other ways.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Print: fetch the backend PDF, hand it to the browser's print dialog ──
  const handlePrint = async () => {
    setIsPrinting(true);
    let printFrame: HTMLIFrameElement | null = null;
    let url: string | null = null;
    try {
      const blob = await fetchInvoicePdf();
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
      } catch (err) {
        window.open(url!, "_blank");
        errorcontext.addError(
          "The invoice has opened in a new tab — use the print icon there.",
        );
      }
    } catch (error) {
      errorcontext.addError(
        "Something went wrong while preparing the invoice for printing. Please try other ways.",
      );
    } finally {
      setIsPrinting(false);
      setTimeout(() => {
        if (printFrame) document.body.removeChild(printFrame);
        if (url) URL.revokeObjectURL(url);
      }, 60000);
    }
  };

  // ── Send: fetch the backend PDF, share it as a file ──
  const handleSend = async () => {
    setIsSending(true);
    try {
      const pdfBlob = await fetchInvoicePdf();
      const safePartyName = s.partyName.trim().replace(/\s+/g, "_");
      const file = new File([pdfBlob], `${safePartyName}_${s.invoiceNo}.pdf`, {
        type: "application/pdf",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${s.invoiceNo}`,
          text: `Hello ${s.partyName}, please find your invoice attached.`,
        });
      } else {
        errorcontext.addError(
          "Direct sharing is not supported on this browser. The PDF will download now so you can attach it manually.",
        );
        const url2 = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url2;
        a.download = `${safePartyName}_${s.invoiceNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url2);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setShowRetryBanner(true);
        return;
      }
      errorcontext.addError(
        "Something went wrong while preparing the file. Please try other ways.",
      );
    } finally {
      setIsSending(false);
    }
  };

  // ── Retry Send: PDF is already cached, so this runs instantly on a fresh tap ──
  const handleSendRetry = async () => {
    setShowRetryBanner(false);
    if (!pdfBlobRef.current) return;
    setIsSending(true);
    try {
      const safePartyName = s.partyPAN.trim().replace(/\s+/g, "_");
      const file = new File(
        [pdfBlobRef.current],
        `${safePartyName}_${s.invoiceNo}.pdf`,
        { type: "application/pdf" },
      );
      await navigator.share({
        files: [file],
        title: `Invoice ${s.invoiceNo}`,
        text: `Hello ${s.partyName}, please find your invoice attached.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setShowRetryBanner(true);
        return;
      }
      errorcontext.addError(
        "Something went wrong while sending the file. Please try other ways.",
      );
    } finally {
      setIsSending(false);
    }
  };

  // ── Decimal values derived from central-state strings, for display only ──────
  const taxableDec = parseDecimal(s.taxableAmt);
  const cgstDec = parseDecimal(s.cgstAmt);
  const sgstDec = parseDecimal(s.sgstAmt);
  const finalDec = parseDecimal(s.finalAmt);
  const isCropEmpty = s.crop === "";

  // ── Render bill ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-300 py-6 sm:py-10 px-2 sm:px-4 print:bg-white print:p-20">
      {errors.length > 0 && (
        <ErrorPopup errors={errors} onClose={() => setErrors([])} />
      )}

      {isSaving && <SavingOverlay />}

      {isGeneratingPdf && (
        <div className="pdf-generating-overlay print-hide">
          <div className="mb-spinner" />
          <div className="pdf-generating-text">Generating PDF...</div>
        </div>
      )}

      {showRetryBanner && (
        <div className="send-retry-banner print-hide">
          <div className="send-retry-banner-text">
            Please tap Send again to complete it.
          </div>
          <div className="send-retry-banner-actions">
            <button onClick={handleSendRetry} className="send-retry-btn">
              <SendIcon size={16} /> Send
            </button>
            <button
              onClick={() => setShowRetryBanner(false)}
              className="send-retry-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div ref={zoomOuterRef} className="invoice-zoom-outer">
        <div
          className="invoice-zoom-inner"
          style={{
            width: DESKTOP_WIDTH,
            zoom: zoomLevel,
            visibility: zoomReady ? "visible" : "hidden",
          }}
        >
          <div
            className={`invoice-form invoice-container max-w-4xl mx-auto bg-white shadow-2xl print:shadow-none ${isReadOnly ? "preview-mode" : ""}`}
          >
            {/* ── HEADER ── */}
            <img
              src={karmaLogo}
              alt=""
              aria-hidden="true"
              className="watermark-img"
            />
            <div className="relative border-b border-gray-600 p-5">
              <div className="text-center">
                <div className="text-3xl font-bold tracking-wide break-words">
                  {s.sellerName}
                </div>
                <div className="mt-1 text-sm">{s.sellerAddress}</div>
                <div className="flex flex-row justify-center items-center gap-8 mt-2 text-sm">
                  <span className="flex items-baseline gap-1">
                    <span className="font-semibold">PAN No.:</span>
                    <Field
                      value={s.sellerPAN}
                      onChange={f("sellerPAN")}
                      upper
                      width="w-32"
                    />
                  </span>
                  <span className="flex items-baseline gap-1">
                    <span className="font-semibold">GSTIN No.:</span>
                    <Field
                      value={s.sellerGSTIN}
                      onChange={f("sellerGSTIN")}
                      upper
                      width="w-44"
                    />
                  </span>
                </div>
              </div>
              <div className="absolute top-4 right-4 border border-gray-700 px-2 py-0.5 text-sm font-bold tracking-widest">
                ORIGINAL
              </div>
            </div>

            {/* ── TITLE BAR ── */}
            <div className="border border-gray-600">
              <div className="text-center border-b border-gray-600 py-1.5 bg-gray-200">
                <span className="text-base font-bold tracking-widest">
                  TAX INVOICE
                </span>
              </div>

              {/* ── PARTY + INVOICE DETAILS ── */}
              <div className="border-b border-gray-600 grid grid-cols-[55%_45%]">
                {/* LEFT — party details */}
                <div className="border-r border-gray-600 p-4">
                  <div className="grid grid-cols-[100px_10px_1fr] items-baseline gap-y-1 text-sm">
                    <span className="font-bold whitespace-nowrap text-base">
                      M/s.
                    </span>
                    <span></span>
                    <input
                      value={s.partyName}
                      onChange={(e) =>
                        f("partyName")(e.target.value.toUpperCase())
                      }
                      placeholder="PARTY / BUYER NAME"
                      spellCheck={false}
                      className="bg-transparent outline-none border-b border-dashed border-gray-400
                                 hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300
                                 text-gray-900 transition-colors font-bold text-base w-full"
                    />

                    <span></span>
                    <span></span>
                    <textarea
                      rows={
                        s.partyAddress.length > 45 ||
                        s.partyAddress.includes("\n")
                          ? 2
                          : 1
                      }
                      value={s.partyAddress}
                      onChange={(e) =>
                        f("partyAddress")(e.target.value.toUpperCase())
                      }
                      placeholder="ADDRESS..."
                      spellCheck={false}
                      className="bg-transparent outline-none border-b border-dashed border-gray-400
                                 hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300
                                 text-gray-900 transition-colors w-full resize-none overflow-hidden
                                 leading-tight text-sm"
                    />

                    {(
                      [
                        ["City", "partyCity", false],
                        ["State", "partyState", false],
                        ["Party GSTIN", "partyGSTIN", true],
                        ["Party PAN", "partyPAN", true],
                      ] as [string, keyof FormState, boolean][]
                    ).map(([label, key, up]) => (
                      <React.Fragment key={key}>
                        <span className="whitespace-nowrap font-medium">
                          {label}
                        </span>
                        <span>:</span>
                        <Field
                          value={s[key]}
                          onChange={f(key)}
                          upper={up}
                          className="text-sm w-full"
                        />
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* RIGHT — invoice info */}
                <div className="p-4 space-y-1 text-sm">
                  <div className="grid grid-cols-[135px_10px_1fr] items-baseline gap-y-1">
                    <span className="whitespace-nowrap font-semibold">
                      Invoice No.
                    </span>
                    <span>:</span>
                    <Field
                      value={s.invoiceNo}
                      onChange={f("invoiceNo")}
                      bold
                      readOnly
                      placeholder="Auto-generated on save"
                      className="text-sm w-full"
                    />
                    <span className="whitespace-nowrap font-semibold">
                      Invoice Date
                    </span>
                    <span>:</span>
                    <div className="flex-1 w-full">
                      <input
                        type="date"
                        value={s.invoiceDate}
                        onChange={(e) => f("invoiceDate")(e.target.value)}
                        className="bg-transparent outline-none w-full border-b border-dashed border-gray-400
                                   hover:border-blue-400 focus:border-blue-600 text-sm transition-colors print-hide"
                      />
                      <span className="screen-hide">
                        {formatDateForPrint(s.invoiceDate)}
                      </span>
                    </div>
                    <div className="col-span-3 border-b border-gray-400 my-2 print:my-1 -mx-4 w-[calc(100%+2rem)]"></div>
                    {(
                      [
                        ["E-Way Bill No.","eway_bill_no",false],
                        ["Docket No.", "docketNo", false],
                        ["Transport Name", "transportName", false],
                        ["Delivery Through", "deliveryThrough", true],
                      ] as [string, keyof FormState, boolean][]
                    ).map(([label, key, up]) => (
                      <React.Fragment key={key}>
                        <span className="whitespace-nowrap font-semibold">
                          {label}
                        </span>
                        <span>:</span>
                        <Field
                          value={s[key]}
                          onChange={f(key)}
                          upper={up}
                          placeholder={
                            key === "deliveryThrough" ? "Vehicle No." : ""
                          }
                          className="text-sm w-full"
                        />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── ITEMS TABLE — mapped with exactly 6 rows (1 input, 5 dummies) ──
                  Alignment convention: Crop / HSN / UQC / Rate / CGST% / SGST%
                  (and Sr.No.) are centred; Qty and all money columns
                  (Taxable/CGST Amt/SGST Amt/Final Amt) are right-aligned. */}
              <div className="border-b border-gray-600 overflow-x-auto print:overflow-visible print:w-full">
                <table className="w-full min-w-[700px] print:min-w-0 text-xs table-collapse">
                  <thead>
                    <tr className="bg-gray-300 border-b border-gray-600">
                      {(
                        [
                          ["Sr.\nNo.", "center"],
                          ["Crop", "center"],
                          ["HSN /\nSAC", "center"],
                          ["Qty.", "center"],
                          ["UQC", "center"],
                          ["Rate", "center"],
                          ["Taxable\nAmt.", "right"],
                          ["CGST\n%", "center"],
                          ["CGST\nAmt.", "right"],
                          ["SGST\n%", "center"],
                          ["SGST\nAmt.", "right"],
                          ["FINAL\nAmt.", "right"],
                        ] as [string, string][]
                      ).map(([label, align], i) => (
                        <th
                          key={i}
                          className={`p-2 font-semibold whitespace-pre-line text-${align} line-height-1-3
                            ${i < 12 ? "border-r border-gray-400" : ""}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, idx) => {
                      if (idx === 0) {
                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-300 row-height-44"
                          >
                            <td className="border-r border-gray-400 p-1 text-center align-middle text-sm">
                              <span className="print-hide">1</span>
                              {s.crop !== "" && (
                                <span className="screen-hide">1</span>
                              )}
                            </td>

                            <td className="border-r border-gray-400 p-1 align-middle text-center">
                              <select
                                value={s.crop}
                                onChange={(e) =>
                                  handleCropChange(e.target.value)
                                }
                                className="crop-select bg-transparent outline-none w-full border-b border-dashed
                                           border-gray-400 hover:border-blue-400 focus:border-blue-600
                                           text-xs transition-colors text-gray-900 print-hide text-center"
                              >
                                <option value="">—Select—</option>
                                {cropOptions.map((c) => (
                                  <option key={c.crop} value={c.crop}>
                                    {c.crop}
                                  </option>
                                ))}
                              </select>
                              {s.crop !== "" && (
                                <span className="screen-hide font-medium">
                                  {s.crop}
                                </span>
                              )}
                            </td>

                            <td className="border-r border-gray-400 p-1 align-middle text-center">
                              <Field
                                value={s.hsnCode}
                                onChange={f("hsnCode")}
                                align="center"
                                width="w-16"
                              />
                            </td>
                            <td className="border-r border-gray-400 p-1 align-middle text-center">
                              <Field
                                value={s.qty}
                                onChange={f("qty")}
                                type="number"
                                align="center"
                                autoFit
                                minChars={3}
                              />
                            </td>
                            <td className="border-r border-gray-400 p-1 align-middle text-center">
                              <select
                                value={s.uqc}
                                onChange={(e) =>
                                  handleuqcChange(e.target.value)
                                }
                                className="crop-select bg-transparent outline-none w-15 border-b border-dashed
                                           border-gray-400 hover:border-blue-400 focus:border-blue-600
                                           text-xs transition-colors text-gray-900 print-hide text-center"
                              >
                                <option value="">—Select—</option>
                                {uqcOptions.map((uqc, i) => (
                                  <option key={i} value={uqc}>
                                    {uqc}
                                  </option>
                                ))}
                              </select>
                              {s.crop !== "" && (
                                <span className="screen-hide font-medium">
                                  {s.uqc}
                                </span>
                              )}
                            </td>
                            <td className="border-r border-gray-400 p-1 align-middle text-center">
                              <Field
                                value={s.rate}
                                onChange={f("rate")}
                                type="number"
                                align="center"
                                autoFit
                                minChars={3}
                              />
                            </td>
                            <td className="border-r border-gray-400 p-1 text-right align-middle font-medium">
                              {taxableDec.gt(0) ? fmt(taxableDec) : ""}
                            </td>
                            <td className="border-r border-gray-400 p-1 align-middle text-center">
                              <Field
                                value={s.cgstRate}
                                onChange={f("cgstRate")}
                                type="number"
                                align="center"
                                width="w-10"
                              />
                            </td>
                            <td className="border-r border-gray-400 p-1 text-right align-middle">
                              {isCropEmpty
                                ? ""
                                : cgstDec.gt(0)
                                  ? fmt(cgstDec)
                                  : "0.00"}
                            </td>
                            <td className="border-r border-gray-400 p-1 align-middle text-center">
                              <Field
                                value={s.sgstRate}
                                onChange={f("sgstRate")}
                                type="number"
                                align="center"
                                width="w-10"
                              />
                            </td>
                            <td className="border-r border-gray-400 p-1 text-right align-middle">
                              {isCropEmpty
                                ? ""
                                : sgstDec.gt(0)
                                  ? fmt(sgstDec)
                                  : "0.00"}
                            </td>
                            <td className="p-1 text-right align-middle font-semibold">
                              {finalDec.gt(0) ? fmt(finalDec) : ""}
                            </td>
                          </tr>
                        );
                      }

                      // rows 2–6: static dummy rows, same alignment scheme as
                      // the live row above, no inputs
                      return (
                        <tr
                          key={idx}
                          className="border-b border-gray-300 row-height-44"
                        >
                          <td className="border-r border-gray-400 p-1 text-center"></td>
                          <td className="border-r border-gray-400 p-1 text-center"></td>
                          <td className="border-r border-gray-400 p-1 text-center"></td>
                          <td className="border-r border-gray-400 p-1 text-right"></td>
                          <td className="border-r border-gray-400 p-1 text-center"></td>
                          <td className="border-r border-gray-400 p-1 text-center"></td>
                          <td className="border-r border-gray-400 p-1 text-right"></td>
                          <td className="border-r border-gray-400 p-1 text-center"></td>
                          <td className="border-r border-gray-400 p-1 text-right"></td>
                          <td className="border-r border-gray-400 p-1 text-center"></td>
                          <td className="border-r border-gray-400 p-1 text-right"></td>
                          <td className="p-1 text-right"></td>
                        </tr>
                      );
                    })}

                    {/* Totals row */}
                    <tr className="border-t-2 border-gray-600 bg-gray-200 font-semibold text-xs">
                      <td
                        colSpan={6}
                        className="border-r border-gray-400 p-2 text-center pr-4"
                      >
                        Final Amount
                      </td>
                      <td className="border-r border-gray-400 p-2 text-right">
                        {fmt(taxableDec)}
                      </td>
                      <td className="border-r border-gray-400" />
                      <td className="border-r border-gray-400 p-2 text-right">
                        {fmt(cgstDec)}
                      </td>
                      <td className="border-r border-gray-400" />
                      <td className="border-r border-gray-400 p-2 text-right">
                        {fmt(sgstDec)}
                      </td>
                      <td className="p-2 text-right">{fmt(finalDec)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── FOOTER ── */}
              <div className="flex flex-col text-sm">
                {/* Amount in words */}
                <div className="border-b border border-gray-600 p-3">
                  <span className="font-semibold">Amt in Word: </span>
                  <span className="italic ml-2 break-words">
                    {finalDec.gt(0) ? (
                      s.final_amount_in_words
                    ) : (
                      <span className="text-gray-300">
                        Auto-generated when amount is entered
                      </span>
                    )}
                  </span>
                </div>

                {/* Bank details */}
                <div className="border-b border-gray-600 p-3">
                  {bankAccountOptions.length > 1 && (
                    <div className="mb-2 print-hide">
                      <label className="text-xs font-semibold text-gray-600 mr-2">
                        Select Bank Account:
                      </label>
                      <select
                        value={selectedBankIndex}
                        onChange={(e) =>
                          handleBankSelect(Number(e.target.value))
                        }
                        className="bg-transparent outline-none border-b border-dashed border-gray-400
                                   hover:border-blue-400 focus:border-blue-600 text-sm transition-colors"
                      >
                        {bankAccountOptions.map((b, i) => (
                          <option key={i} value={i}>
                            {b.bank} - {b.account}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-[90px_10px_1fr] items-baseline gap-y-1.5 w-1/2">
                    <span className="whitespace-nowrap">Bank</span>
                    <span>:</span>
                    <Field
                      value={s.sellerBank}
                      onChange={f("sellerBank")}
                      placeholder="Bank Name"
                      className="w-full"
                    />

                    <span className="whitespace-nowrap">Account No.</span>
                    <span>:</span>
                    <Field
                      value={s.sellerAccount}
                      onChange={f("sellerAccount")}
                      placeholder="000000000000"
                      className="w-full"
                    />

                    <span className="whitespace-nowrap">IFSC</span>
                    <span>:</span>
                    <Field
                      value={s.sellerIFSC}
                      onChange={f("sellerIFSC")}
                      placeholder="XXXX0000000"
                      upper
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Signatory */}
            <div className="grid grid-cols-2 p-3 gap-0 min-h-[120px]">
              <div className="flex flex-col pr-4">
                <div className="font-bold text-base mb-1">
                  Terms &amp; Condition
                </div>
                <textarea
                  value={s.terms}
                  onChange={(e) => f("terms")(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent outline-none resize-none text-sm border border-dashed
                             border-gray-300 hover:border-blue-400 focus:border-blue-600 transition-colors p-1"
                />
              </div>
              <div className="flex flex-col justify-between text-right">
                <div className="font-bold text-base">For, {s.sellerName}</div>
                <div className="mt-12 text-gray-900">Authorised Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════ BOTTOM ACTION BAR — horizontally centred, ══════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 print-hide px-2 sm:px-0">
        {viewMode === "edit" && (
          <button
            onClick={handlePreview}
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white
                       text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
          >
            <Eye size={16} />
            Preview Bill
          </button>
        )}

        {viewMode === "preview" && (
          <>
            <button
              onClick={handleEdit}
              className="flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-800
                         border border-gray-400 text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
            >
              <Pencil size={16} />
              Edit
            </button>
            <button
              onClick={handleSaveBill}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60
                         disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
            >
              <SaveIcon size={16} />
              Save
            </button>
          </>
        )}

        {viewMode === "saved" && (
          <>
            <button
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
              {isPrinting ? "Preparing..." : "Print"}
            </button>
            <button
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
              {isSending ? "Preparing PDF..." : "Send"}
            </button>
            <button
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
              {isDownloading ? "Downloading..." : "Download"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
