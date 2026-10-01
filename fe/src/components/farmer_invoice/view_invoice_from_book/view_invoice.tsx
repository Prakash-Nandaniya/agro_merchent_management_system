import { useRef, useState, useLayoutEffect, useContext, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Send as SendIcon,
  ArrowLeft,
  Loader2,
  Download,
  Pencil,
} from "lucide-react";
import Decimal from "decimal.js";
import "./view_invoice.css";
import watermarkUrl from "@/assets/karma_trading_logo_color_bg_removed.png";
import { settings } from "@/settings";
import { apiFetch } from "@/utils/apifetch";
import { ErrorContext } from "@/components/errors/errorcontext";
import type { FarmerPurchaseRecord } from "../invoice_book/invoice_book";
import BlurLoading from "@/components/blurloading/animation";

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(val: string | number | undefined | null): string {
  if (!val) return "";
  const n = Number(val);
  if (isNaN(n) || n === 0) return "";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function toDecimal(val: string | number | undefined | null): Decimal {
  if (val === undefined || val === null || val === "") return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
}

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

// ─── Printable document (same layout as the farmer bill form) ───────────────
function FarmerBillDocument({
  bill,
  displayRows,
}: {
  bill: FarmerPurchaseRecord;
  displayRows: (FarmerPurchaseRecord | null)[];
}) {
  const isRCM =
    toDecimal(bill.cgst_rate).gt(0) || toDecimal(bill.sgst_rate).gt(0);
  const documentTitle = isRCM ? "RCM PURCHASE BILL" : "PURCHASE BILL";
  const rcmTotal = toDecimal(bill.cgst_amount).plus(toDecimal(bill.sgst_amount));

  const termLines = (bill.terms || "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="invoice-container max-w-4xl mx-auto bg-white shadow-2xl print:shadow-none">
      <img
        src={watermarkUrl}
        alt=""
        aria-hidden="true"
        className="watermark-img"
      />

      {/* ── HEADER ── */}
      <div className="relative border-b border-gray-600 p-5">
        <div className="text-center">
          <div className="text-3xl font-bold tracking-wide wrap-break-word">
            {bill.merchant_name}
          </div>
          <div className="mt-1 text-sm whitespace-pre-line wrap-break-word">
            {bill.merchant_address}
          </div>
          <div className="flex flex-row justify-center items-center gap-8 mt-2 text-sm">
            {bill.merchant_pan && (
              <span className="flex items-baseline gap-1">
                <span className="font-semibold">PAN No.:</span>
                <span className="uppercase font-medium">
                  {bill.merchant_pan}
                </span>
              </span>
            )}
            <span className="flex items-baseline gap-1">
              <span className="font-semibold">GSTIN No.:</span>
              <span className="uppercase font-medium">
                {bill.merchant_gstin}
              </span>
            </span>
          </div>
        </div>
        <div className="absolute top-4 right-4 border border-gray-700 px-2 py-0.5 text-sm font-bold tracking-widest">
          ORIGINAL
        </div>
      </div>

      {/* ── TITLE BAR ── */}
      <div className="border border-gray-600">
        <div className="flex flex-col items-center justify-center text-center border-b border-gray-600 py-1.5 bg-gray-200 px-3">
          <span className="text-base font-bold tracking-widest">
            {documentTitle}
          </span>
          {isRCM && (
            <span className="text-[10px] text-gray-600 tracking-normal font-normal mt-0.5">
              (Self-Invoice cum Payment Voucher — Tax Payable on Reverse Charge)
            </span>
          )}
        </div>

        {/* ── SUPPLIER + VOUCHER DETAILS ── */}
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
              <div className="font-bold text-base w-full whitespace-pre-wrap wrap-break-word text-gray-900">
                {bill.farmer_name}
              </div>

              <span className="whitespace-nowrap font-medium">Address</span>
              <span>:</span>
              <div className="leading-tight text-sm w-full whitespace-pre-wrap wrap-break-word text-gray-900">
                {bill.farmer_address}
              </div>

              <span className="whitespace-nowrap font-medium">PAN No.</span>
              <span>:</span>
              <div className="text-sm uppercase wrap-break-word">
                {bill.farmer_pan || "-"}
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-[145px_10px_1fr] items-baseline gap-y-2 text-sm">
              <span className="whitespace-nowrap font-semibold">
                Invoice No.
              </span>
              <span>:</span>
              <div className="text-sm font-bold uppercase wrap-break-word">
                {bill.voucher_no}
              </div>

              <span className="whitespace-nowrap font-semibold">
                Invoice Date
              </span>
              <span>:</span>
              <div className="text-sm uppercase">
                {formatDate(bill.voucher_date)}
              </div>

              <span className="whitespace-nowrap font-semibold text-[13px]">
                Place of Supply (State)
              </span>
              <span>:</span>
              <div className="text-sm uppercase wrap-break-word">
                {bill.farmer_state || "-"}
              </div>
            </div>
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div className="overflow-x-auto print:overflow-visible print:w-full">
          <table className="w-full min-w-[560px] print:min-w-0 text-xs table-collapse">
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
                ).map(([label, align], i, arr) => (
                  <th
                    key={i}
                    className={`p-2 font-semibold whitespace-pre-line text-${align} line-height-1-3 ${i < arr.length - 1 ? "border-r border-gray-400" : ""}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => {
                if (!row) {
                  return (
                    <tr
                      key={`empty-${idx}`}
                      className="border-b border-gray-300 row-height-44"
                    >
                      <td className="border-r border-gray-400 p-1 text-center">
                        &nbsp;
                      </td>
                      <td className="border-r border-gray-400 p-1 text-center">
                        &nbsp;
                      </td>
                      <td className="border-r border-gray-400 p-1 text-center">
                        &nbsp;
                      </td>
                      <td className="border-r border-gray-400 p-1 text-center">
                        &nbsp;
                      </td>
                      <td className="border-r border-gray-400 p-1 text-center">
                        &nbsp;
                      </td>
                      <td className="border-r border-gray-400 p-1 text-center">
                        &nbsp;
                      </td>
                      <td className="p-1 text-right">&nbsp;</td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={idx}
                    className="border-b border-gray-300 row-height-44"
                  >
                    <td className="border-r border-gray-400 p-1 text-center align-middle text-sm">
                      {idx + 1}
                    </td>
                    <td className="border-r border-gray-400 p-1 align-middle font-medium uppercase text-center wrap-break-word">
                      {row.crop}
                    </td>
                    <td className="border-r border-gray-400 p-1 align-middle text-center">
                      {row.hsn_code}
                    </td>
                    <td className="border-r border-gray-400 p-1 align-middle text-center">
                      {row.qty}
                    </td>
                    <td className="border-r border-gray-400 p-1 align-middle text-center">
                      {row.uqc}
                    </td>
                    <td className="border-r border-gray-400 p-1 align-middle text-center">
                      {row.rate}
                    </td>
                    <td className="p-1 text-right align-middle font-semibold">
                      {fmt(row.payable_amount)}
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr className="border-t-2 border-gray-600 bg-gray-200 font-semibold text-xs">
                <td
                  colSpan={6}
                  className="border-r border-gray-400 p-2 text-center pr-4"
                >
                  Amount Payable to Supplier
                </td>
                <td className="p-2 text-right">
                  {fmt(bill.final_amount) || "0.00"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex flex-col text-sm">
          <div className="border-t-2 border-b border-gray-600 px-3 py-2">
            <div>
              <span className="font-semibold">
                Amount Payable (in Words):{" "}
              </span>
              <span className="italic ml-1 wrap-break-word">
                {bill.payable_amount_in_words}
              </span>
            </div>
            {isRCM && (
              <div className="text-[11px] font-medium text-gray-700 italic mt-1 leading-snug">
                Tax payable on reverse charge under Section 9(3), CGST Act,
                2017, and paid by {bill.merchant_name || "the recipient"}. It is
                not deducted from the amount payable to the supplier.
              </div>
            )}
          </div>

          {/* Payment details (+ RCM box) */}
          <div className="border-b border-gray-600 p-3">
            <div
              className={`grid gap-4 ${isRCM ? "grid-cols-2" : "grid-cols-1"}`}
            >
              <div className="grid grid-cols-[120px_10px_1fr] items-baseline gap-y-1.5">
                <span className="whitespace-nowrap font-semibold">
                  Payment Method
                </span>
                <span>:</span>
                <span className="text-sm text-gray-900 border-b border-dashed border-gray-400 pb-0.5 min-h-[1.4rem]">
                  {bill.payment_method || "—"}
                </span>

                {showReferenceField(bill.payment_method) && (
                  <>
                    <span className="whitespace-nowrap font-semibold">
                      {getReferenceLabel(bill.payment_method)}
                    </span>
                    <span>:</span>
                    <span className="text-sm text-gray-900 border-b border-dashed border-gray-400 pb-0.5 min-h-[1.4rem] break-all">
                      {bill.payment_reference || "—"}
                    </span>
                  </>
                )}
              </div>

              {isRCM && (
                <div className="rcm-tax-box border border-gray-500 rounded p-2.5 text-xs bg-gray-50">
                  <div className="font-semibold text-gray-700 mb-1.5">
                    GST Payable under RCM
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>CGST @ {bill.cgst_rate}%</span>
                    <span>₹ {fmt(bill.cgst_amount) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>SGST @ {bill.sgst_rate}%</span>
                    <span>₹ {fmt(bill.sgst_amount) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between py-1 mt-1 border-t border-gray-300 font-semibold">
                    <span>Total RCM Tax</span>
                    <span>₹ {fmt(rcmTotal.toString()) || "0.00"}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 italic mt-1">
                    Not part of Supplier&apos;s payment
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TERMS ── */}
      <div className="px-3 pt-3">
        <div className="font-bold text-sm mb-1">Terms &amp; Conditions</div>
        <ul className="list-disc pl-4 text-[10px] leading-snug text-gray-700 space-y-0.5">
          {termLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {/* ── SIGNATURES ── */}
      <div className="grid grid-cols-2 px-3 pt-2 pb-4 gap-0">
        <div className="pr-4">
          <div className="mt-8 border-t border-gray-500 w-52"></div>
          <div className="font-semibold text-gray-800 text-sm mt-1">
            Supplier Signature / Thumbprint
          </div>
        </div>
        <div className="flex flex-col items-end text-right">
          <div className="font-bold text-sm wrap-break-word">
            For, {bill.merchant_name}
          </div>
          <div className="mt-8 border-t border-gray-500 w-52"></div>
          <div className="text-gray-900 text-sm mt-1">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ViewFarmerBill() {
  const location = useLocation();
  const errorcontext = useContext(ErrorContext);
  const navigate = useNavigate();

  const id = location.state?.id as number | undefined;

  // Read-only from cache — the book / form have already filled it
  const { data: bills } = useQuery<FarmerPurchaseRecord[]>({
    queryKey: ["FarmerPurchases"],
    queryFn: () => Promise.resolve([]),
    enabled: false,
  });

  const bill = bills?.find((b) => b.id === id);

  const [isSending, setIsSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showRetryBanner, setShowRetryBanner] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const pdfBlobRef = useRef<Blob | null>(null);

  // Same payload shape the farmer bill form sends to the PDF endpoint
  const pdfPayload = useMemo(() => {
    if (!bill) return null;
    return {
      seller_name: bill.merchant_name,
      seller_address: bill.merchant_address,
      seller_pan: bill.merchant_pan || "",
      seller_gstin: bill.merchant_gstin,
      invoice_no: bill.voucher_no || "",
      invoice_date: bill.voucher_date,
      eway_bill_no: null,
      docket_no: null,
      transport_name: null,
      delivery_through: "",
      party_name: bill.farmer_name,
      party_address: bill.farmer_address,
      party_city: null,
      party_state: bill.farmer_state,
      party_pan: bill.farmer_pan || "",
      party_gstin: "",
      place_of_supply: bill.farmer_state || null,
      seller_bank: null,
      seller_account: null,
      seller_ifsc: null,
      payment_method: bill.payment_method,
      payment_reference: bill.payment_reference || "",
      document_type: bill.document_type,
      crop: bill.crop,
      hsn_code: bill.hsn_code,
      qty: bill.qty,
      uqc: bill.uqc,
      rate: bill.rate,
      payable_amount: bill.payable_amount,
      cgst_rate: bill.cgst_rate,
      cgst_amount: bill.cgst_amount,
      sgst_rate: bill.sgst_rate,
      sgst_amount: bill.sgst_amount,
      final_amount: bill.final_amount,
      payable_amount_in_words: bill.payable_amount_in_words,
      terms: bill.terms,
    };
  }, [bill]);

  async function fetchBillPdf(): Promise<Blob> {
    if (pdfBlobRef.current) return pdfBlobRef.current;

    setIsGeneratingPdf(true);
    try {
      const res = await apiFetch(
        `${settings.BE_URL}/generate-farmer-purchase-pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pdfPayload),
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
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

  const zoomOuterRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomReady, setZoomReady] = useState(false);
  const DESKTOP_WIDTH = 925;

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

  if (!bill) {
    return (
      <div className="min-h-screen bg-gray-300 flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-gray-700 font-medium text-lg text-center">
          No bill data found.
        </div>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-800 text-white px-4 py-2 rounded shadow flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  // One crop line per bill, padded to 5 rows to match the form's table height
  const displayRows: (FarmerPurchaseRecord | null)[] = [bill];
  while (displayRows.length < 5) {
    displayRows.push(null);
  }

  const safeFarmerName = bill.farmer_name.trim().replace(/\s+/g, "_");
  const fileName = `${safeFarmerName}_${bill.voucher_no || "purchase"}.pdf`;

  const handlePrint = async () => {
    setIsPrinting(true);
    let printFrame: HTMLIFrameElement | null = null;
    let url: string | null = null;
    try {
      const blob = await fetchBillPdf();
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
        console.error("Print blocked on this device:", err);
        window.open(url!, "_blank");
        errorcontext.addError(
          "The bill has opened in a new tab — use the print icon there.",
        );
      }
    } catch (error) {
      console.error("Error preparing bill for print:", error);
      errorcontext.addError(
        "Something went wrong while preparing the bill for printing. Please try other ways.",
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
      const pdfBlob = await fetchBillPdf();
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Purchase Bill ${bill.voucher_no}`,
          text: `Hello ${bill.farmer_name}, please find your purchase bill attached.`,
        });
      } else {
        errorcontext.addError(
          "Direct sharing is not supported on this browser. The PDF will download now so you can attach it manually.",
        );
        const url2 = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url2;
        a.download = fileName;
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
      console.error("Error generating PDF:", error);
      errorcontext.addError(
        "Something went wrong while preparing the file. Please try other ways.",
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
      const file = new File([pdfBlobRef.current], fileName, {
        type: "application/pdf",
      });
      await navigator.share({
        files: [file],
        title: `Purchase Bill ${bill.voucher_no}`,
        text: `Hello ${bill.farmer_name}, please find your purchase bill attached.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setShowRetryBanner(true);
        return;
      }
      console.error("Retry send failed:", error);
      errorcontext.addError(
        "Something went wrong while sending the file. Please try other ways.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const pdfBlob = await fetchBillPdf();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      errorcontext.addError(
        "Something went wrong while downloading the file. Please try other ways.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <BlurLoading message="Generating PDF" loading={isGeneratingPdf}>
      <div className="view_farmer_bill min-h-screen bg-gray-300 py-6 sm:py-10 px-2 sm:px-4 print:bg-white print:p-8">
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

        {/* ── Top Navigation Bar ── */}
        <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print-hide">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-400
               text-sm font-medium px-4 py-2 rounded shadow-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Book
          </button>

          <button
            onClick={() =>
              navigate("/edit-farmer-purchase", {
                state: { id, kind: "farmer-purchase" },
              })
            }
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black bg-transparent border border-black rounded cursor-pointer transition-all duration-300 hover:backdrop-brightness-110"
          >
            <Pencil size={16} />
            Edit
          </button>
        </div>

        <div ref={zoomOuterRef} className="invoice-zoom-outer">
          <div
            className="invoice-zoom-inner"
            style={{
              width: DESKTOP_WIDTH,
              zoom: zoomLevel,
              visibility: zoomReady ? "visible" : "hidden",
            }}
          >
            <FarmerBillDocument bill={bill} displayRows={displayRows} />
          </div>
        </div>

        {/* ── Created by ── */}
        <div className="max-w-4xl mx-auto mt-6 flex flex-row items-center justify-center gap-1.5 sm:gap-4 print-hide px-2 sm:px-0 flex-wrap">
          <span className="whitespace-nowrap font-semibold text-xs sm:text-sm">
            Bill created by:
          </span>
          <div className="text-xs sm:text-sm uppercase wrap-break-word">
            {bill.created_by || ""}
          </div>
        </div>

        {/* ── Bottom Action Bar ── */}
        <div className="max-w-4xl mx-auto mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 print-hide px-2 sm:px-0">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-70 disabled:cursor-not-allowed text-white
                     text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
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
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white
                     text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
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
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed text-white
                     text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
          >
            {isDownloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {isDownloading ? "Downloading..." : "Download"}
          </button>
        </div>
      </div>
    </BlurLoading>
  );
}