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
import { settings } from "@/settings";
import Decimal from "decimal.js";
import karmaLogo from "@/assets/karma_trading_logo.png";
import { apiFetch } from "@/utils/apifetch";
import { useContext } from "react";
import { ErrorContext } from "@/components/errors/errorcontext";
import { useQueryClient } from "@tanstack/react-query";
import BlurLoading from "@/components/blurloading/animation";

interface CropOption {
  crop: string;
  hsn: string;
  cgst: string;
  sgst: string;
}

interface SavedInvoice {
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
  party_pan: string | "";
  party_gstin: string;
  place_of_supply?: string | null;
  seller_bank?: string | null;
  seller_account?: string | null;
  seller_ifsc?: string | null;
  payment_method: string;
  payment_reference: string;
  document_type: string;
  crop: string;
  hsn_code: string;
  qty: string;
  uqc: string;
  rate: string;
  payable_amount: string;
  cgst_rate: string;
  cgst_amount: string;
  sgst_rate: string;
  sgst_amount: string;
  final_amount: string;
  payable_amount_in_words: string;
  terms: string;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
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

const parseDecimal = (val: string | number | undefined | null): Decimal => {
  if (val === undefined || val === null || val === "") return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
};

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
        autoFit ? "" : width,
        align === "right" ? "text-right" : "",
        align === "center" ? "text-center" : "",
        bold ? "font-semibold" : "",
        className,
      ].join(" ")}
    />
  );
}

function hasNonZeroGstRate(cgstRate: string, sgstRate: string): boolean {
  return parseDecimal(cgstRate).gt(0) || parseDecimal(sgstRate).gt(0);
}

// ─── Payment reference: label + visibility depend on the chosen method ───────
function getReferenceLabel(method: string): string {
  switch (method) {
    case "NEFT":
      return "NEFT UTR No.";
    case "RTGS":
      return "RTGS UTR No.";
    case "UPI":
      return "UPI Ref. No.";
    case "Cheque":
      return "Cheque No.";
    default:
      return "Reference";
  }
}
function showReferenceField(method: string): boolean {
  return method !== "Cash" && method !== "Pending";
}
function getReferencePlaceholder(method: string): string {
  switch (method) {
    case "NEFT":
    case "RTGS":
      return "UTR number";
    case "UPI":
      return "UPI transaction ID";
    case "Cheque":
      return "Cheque number";
    default:
      return "";
  }
}

const INIT = {
  merchantName: "",
  merchantAddress: "",
  merchantPAN: "",
  merchantGSTIN: "",
  invoiceNo: "",
  invoiceDate: todayISO(),
  placeOfSupply: "Gujarat (24)",
  farmerName: "",
  farmerAddress: "",
  farmerVillage: "",
  farmerState: "Gujarat (24)",
  farmerPAN: "",
  crop: "",
  hsnCode: "",
  qty: "",
  uqc: "",
  rate: "",
  cgstRate: "0",
  sgstRate: "0",
  paymentMethod: "Cash",
  paymentReference: "",
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
  farmer_bill_terms?: string;
}

const EMPTY_CONFIG: ProfileConfig = {
  seller: { name: "", address: "", pan: "", gstin: "" },
  bank_accounts: [],
  crops: {},
  terms_and_conditions: "",
  farmer_bill_terms: "",
};

const uqcOptions = ["KGS", "TONS", "MTN", "NOS"];

function ErrorPopup({
  errors,
  onClose,
  title = "Please fix before save",
  buttonText = "OK, let me fix it",
}: {
  errors: string[];
  onClose: () => void;
  title?: string;
  buttonText?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white border border-red-300 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-red-600 text-base">{title}</h3>
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
          {buttonText}
        </button>
      </div>
    </div>
  );
}

export default function InvoiceForm() {
  const errorcontext = useContext(ErrorContext);
  const [s, setS] = useState<FormState>(INIT);
  const [isSending, setIsSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showRetryBanner, setShowRetryBanner] = useState(false);
  const itemsTableWrapRef = useRef<HTMLDivElement | null>(null);
  const itemsTableRef = useRef<HTMLTableElement | null>(null);
  const [rowFontScale, setRowFontScale] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<"edit" | "preview" | "saved">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const isReadOnly = viewMode !== "edit";

  const [cropOptions, setCropOptions] = useState<CropOption[]>([]);
  const pdfBlobRef = useRef<Blob | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const zoomOuterRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomReady, setZoomReady] = useState(false);
  const DESKTOP_WIDTH = 925;

  const queryClient = useQueryClient();
  const profile = queryClient.getQueryData<ProfileConfig>(["Profile"]) || EMPTY_CONFIG;

  useEffect(() => {
    setS((prev) => ({
      ...prev,
      merchantName: profile.seller.name,
      merchantAddress: profile.seller.address,
      merchantPAN: profile.seller.pan,
      merchantGSTIN: profile.seller.gstin,
      terms: profile.farmer_bill_terms || profile.terms_and_conditions,
    }));

    const cropsFromProfile: CropOption[] = Object.entries(
      profile.crops || {}
    ).map(([name, c]) => ({
      crop: name,
      hsn: c.hsn,
      cgst: c.cgst,
      sgst: c.sgst,
    }));
    if (cropsFromProfile.length > 0) setCropOptions(cropsFromProfile);
  }, []);

  useLayoutEffect(() => {
    const computeZoom = () => {
      const el = zoomOuterRef.current;
      if (!el) return;
      const availableWidth = el.clientWidth;
      setZoomLevel(
        availableWidth < DESKTOP_WIDTH ? availableWidth / DESKTOP_WIDTH : 1
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

  const f = (key: keyof FormState) => (v: string) =>
    setS((p) => ({ ...p, [key]: v }));

  const handleCropChange = (cropName: string) => {
    const found = cropOptions.find((c) => c.crop === cropName);
    const hsn = found?.hsn ?? "";
    setS((prev) => ({
      ...prev,
      crop: cropName,
      hsnCode: hsn,
      cgstRate: found?.cgst ?? "0",
      sgstRate: found?.sgst ?? "0",
    }));
  };

  // ── Payment method change also clears any stale reference value when the
  //    new method has no reference field (Cash / Pending) — otherwise a
  //    previously typed UTR/cheque number could silently ride along hidden. ──
  const handlePaymentMethodChange = (method: string) => {
    setS((prev) => ({
      ...prev,
      paymentMethod: method,
      paymentReference: showReferenceField(method) ? prev.paymentReference : "",
    }));
  };

  const getDynamicFileName = () => {
    const safeFarmerName = s.farmerName.trim().replace(/\s+/g, "_");
    return `${safeFarmerName}_${s.invoiceNo || "purchase"}.pdf`;
  };

  const handleuqcChange = (uqc: string) => {
    setS((prev) => ({ ...prev, uqc }));
  };

  const taxableDec = parseDecimal(s.qty).mul(parseDecimal(s.rate));
  const cgstDec = taxableDec.mul(parseDecimal(s.cgstRate)).div(100);
  const sgstDec = taxableDec.mul(parseDecimal(s.sgstRate)).div(100);
  const finalDec = taxableDec;
  const rcmTaxTotal = cgstDec.plus(sgstDec);
  const isRCM = hasNonZeroGstRate(s.cgstRate, s.sgstRate);
  const documentType = isRCM ? "RCM Purchase Bill" : "Purchase Bill";
  const finalAmountInWords = amountInWords(finalDec);

  const termLines = s.terms
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  function buildPayload() {
    return {
      documentType,
      merchantName: s.merchantName,
      merchantAddress: s.merchantAddress,
      merchantPAN: s.merchantPAN,
      merchantGSTIN: s.merchantGSTIN,
      voucherDate: s.invoiceDate,
      voucherNo: s.invoiceNo,
      farmerName: s.farmerName,
      farmerAddress: s.farmerAddress,
      farmerState: s.farmerState,
      farmerPAN: s.farmerPAN,
      crop: s.crop,
      hsnCode: s.hsnCode,
      qty: s.qty,
      uqc: s.uqc,
      rate: s.rate,
      payableAmt: taxableDec.toString(),
      cgstRate: s.cgstRate,
      cgstAmt: cgstDec.toString(),
      sgstRate: s.sgstRate,
      sgstAmt: sgstDec.toString(),
      finalAmt: finalDec.toString(),
      payableAmtInWords: finalAmountInWords,
      paymentMethod: s.paymentMethod,
      paymentReference: s.paymentReference,
      terms: s.terms,
    };
  }

  function buildBillForPdf(): SavedInvoice {
    return {
      seller_name: s.merchantName,
      seller_address: s.merchantAddress,
      seller_pan: s.merchantPAN || "",
      seller_gstin: s.merchantGSTIN,
      invoice_no: s.invoiceNo || "",
      invoice_date: s.invoiceDate,
      eway_bill_no: null,
      docket_no: null,
      transport_name: null,
      delivery_through: "",
      party_name: s.farmerName,
      party_address: s.farmerAddress,
      party_city: null,
      party_state: s.farmerState,
      party_pan: s.farmerPAN || "",
      party_gstin: "",
      place_of_supply: s.placeOfSupply || null,
      seller_bank: null,
      seller_account: null,
      seller_ifsc: null,
      payment_method: s.paymentMethod,
      payment_reference: s.paymentReference,
      document_type: documentType,
      crop: s.crop,
      hsn_code: s.hsnCode,
      qty: s.qty,
      uqc: s.uqc,
      rate: s.rate,
      payable_amount: taxableDec.toString(),
      cgst_rate: s.cgstRate,
      cgst_amount: cgstDec.toString(),
      sgst_rate: s.sgstRate,
      sgst_amount: sgstDec.toString(),
      final_amount: finalDec.toString(),
      payable_amount_in_words: finalAmountInWords,
      terms: s.terms,
    };
  }

  function getDocumentTitle(): string {
    return documentType === "RCM Purchase Bill"
      ? "RCM PURCHASE BILL"
      : "PURCHASE BILL";
  }

  function validateBill(): string[] {
    const errs: string[] = [];
    if (!s.merchantName.trim()) errs.push("Merchant name is required.");
    if (!s.merchantAddress.trim()) errs.push("Merchant address is required.");
    if (!s.merchantGSTIN.trim()) errs.push("Merchant GSTIN is required.");
    if (!s.farmerName.trim()) errs.push("Supplier name is required.");
    if (!s.farmerAddress.trim()) errs.push("Supplier address is required.");
    if (!s.invoiceDate) errs.push("Invoice date is required.");
    if (!s.crop) errs.push("Select a crop before printing.");
    if (s.crop) {
      if (!s.qty || parseFloat(s.qty) <= 0)
        errs.push(`${s.crop}: Quantity is missing or zero.`);
      if (!s.rate || parseFloat(s.rate) <= 0)
        errs.push(`${s.crop}: Rate is missing or zero.`);
      if (!s.uqc) errs.push(`${s.crop}: UQC is required.`);
      if (taxableDec.lte(0))
        errs.push(`${s.crop}: Amount could not be calculated.`);
    }
    return errs;
  }

  function handlePreview() {
    const errs = validateBill();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setViewMode("preview");
  }

  function handleEdit() {
    setViewMode("edit");
  }

  async function handleSaveBill() {
    setIsSaving(true);
    try {
      const payload = buildPayload();
      const res = await apiFetch(`${settings.BE_URL}/save-farmer-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorcontext.addError(
          body?.detail ? String(body.detail) : "Failed to save bill."
        );
        return;
      }
      const savedBillResp = await res.json();
      setS((prev) => ({
        ...prev,
        invoiceNo: savedBillResp.voucher_no,
        createdBy: savedBillResp.created_by ?? prev.createdBy,
      }));
      const newInvoiceNo = savedBillResp.voucher_no;
      queryClient.setQueryData<ProfileConfig>(["Profile"], (oldProfile) => {
        if (!oldProfile) {
          return {
            ...EMPTY_CONFIG,
            ...(documentType === "RCM Purchase Bill"
              ? { rcm_purchase_bill_last_invoiceNo: newInvoiceNo }
              : { purchase_bill_last_invoiceNo: newInvoiceNo }),
          };
        }
        return {
          ...oldProfile,
          ...(documentType === "RCM Purchase Bill"
            ? { rcm_purchase_bill_last_invoiceNo: newInvoiceNo }
            : { purchase_bill_last_invoiceNo: newInvoiceNo }),
        };
      });

      queryClient.setQueryData(["Invoices"], (old: unknown) =>
        Array.isArray(old) ? [savedBillResp, ...old] : [savedBillResp]
      );
      queryClient.setQueryData(["FarmerPurchases"], (old: unknown) => {
        const current = Array.isArray(old) ? old : [];
        return [savedBillResp, ...current];
      });

      pdfBlobRef.current = null;
      setViewMode("saved");
    } catch (err) {
      errorcontext.addError(
        err instanceof Error
          ? err.message
          : "Failed to save bill. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function fetchInvoicePdf(): Promise<Blob> {
    if (pdfBlobRef.current) return pdfBlobRef.current;

    setIsGeneratingPdf(true);
    try {
      const res = await apiFetch(`${settings.BE_URL}/generate-farmer-purchase-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBillForPdf()),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        errorcontext.addError(
          `Server returned ${res.status}${detail ? `: ${detail}` : ""}`
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
        "Something went wrong while downloading the file. Please try other ways."
      );
    } finally {
      setIsDownloading(false);
    }
  };

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
          "The invoice has opened in a new tab — use the print icon there."
        );
      }
    } catch (error) {
      errorcontext.addError(
        "Something went wrong while preparing the invoice for printing. Please try other ways."
      );
    } finally {
      setIsPrinting(false);
      setTimeout(() => {
        if (printFrame) document.body.removeChild(printFrame);
        if (url) URL.revokeObjectURL(url);
      }, 60000);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const pdfBlob = await fetchInvoicePdf();
      const safeFarmerName = s.farmerName.trim().replace(/\s+/g, "_");
      const file = new File([pdfBlob], `${safeFarmerName}_${s.invoiceNo || "purchase"}.pdf`, {
        type: "application/pdf",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Purchase Bill ${s.invoiceNo || ""}`,
          text: `Hello ${s.farmerName}, please find your purchase bill attached.`,
        });
      } else {
        errorcontext.addError(
          "Direct sharing is not supported on this browser. The PDF will download now so you can attach it manually."
        );
        const url2 = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url2;
        a.download = `${safeFarmerName}_${s.invoiceNo || "purchase"}.pdf`;
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
        "Something went wrong while preparing the file. Please try other ways."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSendRetry = async () => {
    setShowRetryBanner(false);
    if (!pdfBlobRef.current) return;
    setIsSending(true);
    try {
      const safeFarmerName = s.farmerName.trim().replace(/\s+/g, "_");
      const file = new File(
        [pdfBlobRef.current],
        `${safeFarmerName}_${s.invoiceNo || "purchase"}.pdf`,
        { type: "application/pdf" }
      );
      await navigator.share({
        files: [file],
        title: `Purchase Bill ${s.invoiceNo || ""}`,
        text: `Hello ${s.farmerName}, please find your purchase bill attached.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setShowRetryBanner(true);
        return;
      }
      errorcontext.addError(
        "Something went wrong while sending the file. Please try other ways."
      );
    } finally {
      setIsSending(false);
    }
  };

  useLayoutEffect(() => {
    const wrap = itemsTableWrapRef.current;
    const table = itemsTableRef.current;
    if (!wrap || !table) return;

    table.style.fontSize = "";

    const availableWidth = wrap.clientWidth;
    const naturalWidth = table.scrollWidth;

    if (naturalWidth > availableWidth && availableWidth > 0) {
      const ratio = availableWidth / naturalWidth;
      const clamped = Math.max(0.55, Math.min(1, ratio));
      setRowFontScale(clamped);
    } else {
      setRowFontScale(1);
    }
  }, [
    s.crop,
    s.hsnCode,
    s.qty,
    s.uqc,
    s.rate,
    taxableDec.toString(),
    zoomLevel,
  ]);

  useLayoutEffect(() => {
    const table = itemsTableRef.current;
    if (!table) return;
    table.style.fontSize = `${12 * rowFontScale}px`;
  }, [rowFontScale]);

  return (
    <BlurLoading
      message={isSaving ? "Saving" : isGeneratingPdf ? "Generating PDF" : ""}
      loading={isSaving || isGeneratingPdf}
    >
      <div className="invoice-form-container min-h-screen bg-gray-300 py-6 sm:py-10 px-2 sm:px-4 print:bg-white print:p-20">
        {errors.length > 0 && (
          <ErrorPopup errors={errors} onClose={() => setErrors([])} />
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
              <img
                src={karmaLogo}
                alt=""
                aria-hidden="true"
                className="watermark-img"
              />
              <div className="relative border-b border-gray-600 p-5">
                <div className="text-center">
                  <div className="text-3xl font-bold tracking-wide wrap-break-word">
                    {s.merchantName || "Merchant Name"}
                  </div>
                  <div className="mt-1 text-sm">{s.merchantAddress || "Merchant Address"}</div>
                  <div className="flex flex-row justify-center items-center gap-8 mt-2 text-sm">
                    <span className="flex items-baseline gap-1">
                      <span className="font-semibold">PAN No.:</span>
                      <Field
                        value={s.merchantPAN || ""}
                        onChange={f("merchantPAN")}
                        upper
                        width="w-28"
                      />
                    </span>
                    <span className="flex items-baseline gap-1">
                      <span className="font-semibold">GSTIN No.:</span>
                      <Field
                        value={s.merchantGSTIN}
                        onChange={f("merchantGSTIN")}
                        upper
                        width="w-44"
                      />
                    </span>
                  </div>
                </div>
                <div className="absolute top-4 right-4 text-sm font-bold tracking-widest print:hidden">
                  ORIGINAL
                </div>
              </div>

              <div className="border border-gray-600">
                <div className="flex flex-col items-center justify-center text-center border-b border-gray-600 py-1.5 bg-gray-200 px-3">
                  <span className="text-base font-bold tracking-widest">
                    {getDocumentTitle()}
                  </span>
                  {isRCM && (
                    <span className="text-[10px] text-gray-600 tracking-normal font-normal mt-0.5">
                      (Self-Invoice cum Payment Voucher — Tax Payable on Reverse Charge)
                    </span>
                  )}
                </div>

                <div className="border-b border-gray-600 grid grid-cols-2">
                  <div className="border-r border-gray-600 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                      Supplier (Farmer) Details
                    </div>
                    <div className="grid grid-cols-[90px_10px_1fr] items-start gap-y-1 gap-x-1 text-sm leading-tight">
                      <span className="font-bold whitespace-nowrap text-base">
                        Name
                      </span>
                      <span>:</span>
                      <textarea
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }
                        }}
                        rows={1}
                        value={s.farmerName}
                        onChange={(e) => f("farmerName")(e.target.value.toUpperCase())}
                        placeholder="SUPPLIER NAME"
                        spellCheck={false}
                        className="bg-transparent outline-none border-b border-dashed border-gray-400 hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300 text-gray-900 transition-colors font-bold text-base w-full resize-none overflow-hidden"
                      />

                      <span className="whitespace-nowrap font-medium">Address</span>
                      <span>:</span>
                      <textarea
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }
                        }}
                        rows={2}
                        value={s.farmerAddress}
                        onChange={(e) => f("farmerAddress")(e.target.value.toUpperCase())}
                        placeholder="FULL ADDRESS INCL. VILLAGE, TALUKA, STATE"
                        spellCheck={false}
                        className="bg-transparent outline-none border-b border-dashed border-gray-400 hover:border-blue-400 focus:border-blue-600 placeholder:text-gray-300 text-gray-900 transition-colors w-full resize-none overflow-hidden leading-tight text-sm"
                      />

                      <span className="whitespace-nowrap font-medium">PAN No.</span>
                      <span>:</span>
                      <div className="pt-0.5">
                        <Field value={s.farmerPAN} onChange={f("farmerPAN")} upper className="text-sm w-full" />
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-[145px_10px_1fr] items-baseline gap-y-2 text-sm">
                      <span className="whitespace-nowrap font-semibold">Invoice No.</span>
                      <span>:</span>
                      <Field value={s.invoiceNo} onChange={f("invoiceNo")} bold placeholder="Auto-generated on save" className="text-sm w-full" />

                      <span className="whitespace-nowrap font-semibold">Invoice Date</span>
                      <span>:</span>
                      <div className="flex-1 w-full">
                        <input
                          type="date"
                          value={s.invoiceDate}
                          onChange={(e) => f("invoiceDate")(e.target.value)}
                          className="bg-transparent outline-none w-full border-b border-dashed border-gray-400 hover:border-blue-400 focus:border-blue-600 text-sm transition-colors print-hide"
                        />
                        <span className="screen-hide">{formatDateForPrint(s.invoiceDate)}</span>
                      </div>

                      <span className="whitespace-nowrap font-semibold text-[13px]">Place of Supply (State)</span>
                      <span>:</span>
                      <Field value={s.placeOfSupply} onChange={f("placeOfSupply")} className="text-sm w-full" />
                    </div>
                  </div>
                </div>

                <div
                  ref={itemsTableWrapRef}
                  className="overflow-x-auto print:overflow-visible print:w-full"
                >
                  <table
                    ref={itemsTableRef}
                    className="w-full min-w-140 print:min-w-0 text-xs table-collapse"
                  >
                    <thead>
                      <tr className="bg-gray-300 border-b border-gray-600">
                        {(
                          [
                            ["Sr.\nNo.", "center"],
                            ["Crop", "center"],
                            ["HSN / SAC", "center"],
                            ["Qty.", "center"],
                            ["UQC", "center"],
                            ["Rate", "center"],
                            ["Amount", "right"],
                          ] as [string, string][]
                        ).map(([label, align], i) => (
                          <th
                            key={i}
                            className={`p-2 font-semibold whitespace-pre-line text-${align} line-height-1-3
                            ${i < 7 ? "border-r border-gray-400" : ""}`}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, idx) => {
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
                                  readOnly
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
                              <td className="p-1 text-right align-middle font-semibold">
                                {taxableDec.gt(0) ? fmt(taxableDec) : ""}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-300 row-height-44"
                          >
                            <td className="border-r border-gray-400 p-1 text-center"></td>
                            <td className="border-r border-gray-400 p-1 text-center"></td>
                            <td className="border-r border-gray-400 p-1 text-center"></td>
                            <td className="border-r border-gray-400 p-1 text-center"></td>
                            <td className="border-r border-gray-400 p-1 text-center"></td>
                            <td className="border-r border-gray-400 p-1 text-center"></td>
                            <td className="p-1 text-right"></td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-600 bg-gray-200 font-semibold text-xs">
                        <td
                          colSpan={6}
                          className="border-r border-gray-400 p-2 text-center pr-4"
                        >
                          Amount Payable to Supplier
                        </td>
                        <td className="p-2 text-right">{fmt(finalDec)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col text-sm">
                  <div className="border-t-2 border-b border-gray-600 px-3 py-2">
                    <div>
                      <span className="font-semibold">Amount Payable (in Words): </span>
                      <span className="italic ml-1 wrap-break-word">
                        {finalDec.gt(0) ? (
                          finalAmountInWords
                        ) : (
                          <span className="text-gray-300">
                            Auto-generated when amount is entered
                          </span>
                        )}
                      </span>
                    </div>
                    {isRCM && (
                      <div className="text-[11px] font-medium text-gray-700 italic mt-1 leading-snug">
                        Tax payable on reverse charge under Section 9(3), CGST Act, 2017, and
                        paid by {s.merchantName || "the recipient"}. It is not deducted from
                        the amount payable to the supplier.
                      </div>
                    )}
                  </div>

                  <div className="border-b border-gray-600 p-3">
                    <div className={`grid gap-4 ${isRCM ? "grid-cols-2" : "grid-cols-1"}`}>
                      <div className="grid grid-cols-[120px_10px_1fr] items-baseline gap-y-1.5">
                        <span className="whitespace-nowrap font-semibold">Payment Method</span>
                        <span>:</span>
                        {isReadOnly ? (
                          <span className="text-sm text-gray-900 border-b border-dashed border-gray-400 pb-0.5 min-h-[1.4rem]">
                            {s.paymentMethod || "—"}
                          </span>
                        ) : (
                          <select
                            value={s.paymentMethod}
                            onChange={(e) => handlePaymentMethodChange(e.target.value)}
                            className="bg-transparent outline-none border-b border-dashed border-gray-400 hover:border-blue-400 focus:border-blue-600 text-sm transition-colors w-full"
                          >
                            <option value="Cash">Cash</option>
                            <option value="NEFT">NEFT</option>
                            <option value="RTGS">RTGS</option>
                            <option value="UPI">UPI</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Pending">Pending</option>
                          </select>
                        )}

                        {showReferenceField(s.paymentMethod) && (
                          <>
                            <span className="whitespace-nowrap font-semibold">
                              {getReferenceLabel(s.paymentMethod)}
                            </span>
                            <span>:</span>
                            {isReadOnly ? (
                              <span className="text-sm text-gray-900 border-b border-dashed border-gray-400 pb-0.5 min-h-[1.4rem] break-all">
                                {s.paymentReference || "—"}
                              </span>
                            ) : (
                              <Field
                                value={s.paymentReference}
                                onChange={f("paymentReference")}
                                placeholder={getReferencePlaceholder(s.paymentMethod)}
                                className="text-sm w-full"
                              />
                            )}
                          </>
                        )}
                      </div>

                      {isRCM && (
                        <div className="rcm-tax-box border border-gray-500 rounded p-2.5 text-xs bg-gray-50">
                          <div className="font-semibold text-gray-700 mb-1.5">
                            GST Payable under RCM
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>CGST @ {s.cgstRate}%</span>
                            <span>₹ {fmt(cgstDec)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>SGST @ {s.sgstRate}%</span>
                            <span>₹ {fmt(sgstDec)}</span>
                          </div>
                          <div className="flex justify-between py-1 mt-1 border-t border-gray-300 font-semibold">
                            <span>Total RCM Tax</span>
                            <span>₹ {fmt(rcmTaxTotal)}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 italic mt-1">
                            Not part of Supplier's payment
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-3 pt-3">
                <div className="font-bold text-sm mb-1">Terms & Conditions</div>
                {isReadOnly ? (
                  <ul className="list-disc pl-4 text-[10px] leading-snug text-gray-700 space-y-0.5">
                    {termLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <textarea
                    value={s.terms}
                    onChange={(e) => f("terms")(e.target.value)}
                    rows={5}
                    placeholder="One point per line"
                    className="w-full bg-transparent outline-none resize-none text-[10px] leading-snug border border-dashed
                             border-gray-300 hover:border-blue-400 focus:border-blue-600 transition-colors p-1"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 px-3 pt-2 pb-4 gap-0">
                <div className="pr-4">
                  <div className="mt-8 border-t border-gray-500 w-52"></div>
                  <div className="font-semibold text-gray-800 text-sm mt-1">
                    Supplier Signature / Thumbprint
                  </div>
                </div>
                <div className="flex flex-col items-end text-right">
                  <div className="font-bold text-sm">For, {s.merchantName || "Merchant"}</div>
                  <div className="mt-8 border-t border-gray-500 w-52"></div>
                  <div className="text-gray-900 text-sm mt-1">Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
    </BlurLoading>
  );
}