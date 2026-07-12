import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Printer, Send as SendIcon, ArrowLeft, Loader2 } from 'lucide-react';
import './view_mill_bill.css';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import watermarkUrl from '@/assets/karma_trading_logo_color_bg_removed.png';
// ─── Interfaces ──────────────────────────────────────────────────────────────
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

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmt(val: string | number | undefined | null): string {
  if (!val) return '';
  const n = Number(val);
  if (isNaN(n) || n === 0) return '';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function waitForImages(root: HTMLElement, timeoutMs = 4000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();

  return Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((res) => {
        const done = () => res();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        // safety net so a broken/slow image never blocks Send or Print forever
        setTimeout(done, timeoutMs);
      });
    })
  ).then(() => undefined);
}

export default function ViewMillBillFromBook() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const bill = location.state?.bill as MillBill | undefined;

  if (!bill) {
    return (
      <div className="min-h-screen bg-gray-300 flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-gray-700 font-medium text-lg text-center">No bill data found.</div>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-800 text-white px-4 py-2 rounded shadow flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  const displayRows = [...(bill.crops || [])];
  while (displayRows.length < 6) {
    displayRows.push(null as any);
  }

  const buildDesktopClone = (): Promise<{ iframe: HTMLIFrameElement; node: HTMLElement }> => {
    return new Promise((resolve, reject) => {
      const original = document.querySelector('.invoice-container') as HTMLElement;
      if (!original) return reject(new Error('Invoice not found'));

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '-99999px'; // off-screen, but still "rendered" so styles apply
      iframe.style.width = '960px';   // > 640px so all sm: rules activate
      iframe.style.height = '1400px';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      iframe.onload = () => {
        const doc = iframe.contentDocument!;
        const base = doc.createElement('base');
        base.href = window.location.origin + '/';
        doc.head.appendChild(base);
        document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
          doc.head.appendChild(el.cloneNode(true));
        });

        const wrapper = doc.createElement('div');
        wrapper.className = 'view_mill_bill_from_book';
        wrapper.style.background = '#ffffff';
        wrapper.style.padding = '32px';
        wrapper.style.width = '896px';
        wrapper.style.margin = '0 auto';
        wrapper.appendChild(original.cloneNode(true));
        doc.body.style.margin = '0';
        doc.body.appendChild(wrapper);

        const node = wrapper.querySelector('.invoice-container') as HTMLElement;

        waitForImages(node).then(() => {
          resolve({ iframe, node });
        });
      };

      iframe.src = 'about:blank';
    });
  };

  const generateInvoicePdfBlob = async (): Promise<Blob> => {
    const built = await buildDesktopClone();
    const iframe = built.iframe;
    try {
      const element = built.node;

      const dataUrl = await toJpeg(element, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'a4' });
      const imgProps = pdf.getImageProperties(dataUrl);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 0.3;
      const printWidth = pageWidth - margin * 2;
      const printHeight = (imgProps.height * printWidth) / imgProps.width;
      pdf.addImage(dataUrl, 'JPEG', margin, margin, printWidth, printHeight);

      return pdf.output('blob');
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    let printFrame: HTMLIFrameElement | null = null;
    let url: string | null = null;
    try {
      const blob = await generateInvoicePdfBlob();
      url = URL.createObjectURL(blob);

      printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      await new Promise<void>((resolve) => {
        printFrame!.onload = () => resolve();
        printFrame!.src = url!;
      });

      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    } catch (error) {
      console.error('Error preparing invoice for print:', error);
      alert('Something went wrong while preparing the invoice for printing.');
    } finally {
      setIsPrinting(false);
      setTimeout(() => {
        if (printFrame) document.body.removeChild(printFrame);
        if (url) URL.revokeObjectURL(url);
      }, 60000);
    }
  };

  // ─── PDF Generation & Share Logic ──────────────────────────────────────────
  const handleSend = async () => {
    setIsSending(true);
    try {
      const pdfBlob = await generateInvoicePdfBlob();
      const file = new File([pdfBlob], `Invoice_${bill.invoice_no}.pdf`, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${bill.invoice_no}`,
          text: `Hello ${bill.party_name}, please find your invoice attached.`,
        });
      } else {
        alert("Direct sharing is not supported on this browser. The PDF will download now so you can attach it manually.");
        const url2 = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = `Invoice_${bill.invoice_no}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url2);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert("Something went wrong while preparing the file.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="view_mill_bill_from_book min-h-screen bg-gray-300 py-6 sm:py-10 px-2 sm:px-4 print:bg-white print:p-8">

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
      </div>

      {/* ══════════════════════════════════════════
          INVOICE PAPER
      ══════════════════════════════════════════ */}
      <div className="invoice-container max-w-4xl mx-auto bg-white shadow-2xl print:shadow-none">
        <img
          src={watermarkUrl}
          alt=""
          aria-hidden="true"
          className="watermark-img"
        />

        {/* ── HEADER ── */}
        <div className="relative border-b border-gray-600 p-3 sm:p-5 pt-10 sm:pt-5">
          <div className="text-center">
            <div className="text-xl sm:text-3xl font-bold tracking-wide break-words">{bill.seller_name}</div>
            <div className="mt-1 text-xs sm:text-sm whitespace-pre-line">{bill.seller_address}</div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-8 mt-2 text-xs sm:text-sm">
              <span className="flex items-baseline gap-1">
                <span className="font-semibold">PAN No.:</span>
                <span className="uppercase font-medium">{bill.seller_pan}</span>
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-semibold">GSTIN No.:</span>
                <span className="uppercase font-medium">{bill.seller_gstin}</span>
              </span>
            </div>
          </div>
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 border border-gray-700 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-sm font-bold tracking-widest">
            ORIGINAL
          </div>
        </div>

        {/* ── TITLE BAR ── */}
        <div className="border border-gray-600">
          <div className="text-center border-b border-gray-600 py-1.5 bg-gray-200">
            <span className="text-sm sm:text-base font-bold tracking-widest">TAX INVOICE</span>
          </div>

          {/* ── PARTY + INVOICE DETAILS ── */}
          <div className="border-b border-gray-600 grid grid-cols-1 sm:grid-cols-[55%_45%]">

            {/* LEFT — party details */}
            <div className="sm:border-r border-b sm:border-b-0 border-gray-600 p-3 sm:p-4">
              <div className="grid grid-cols-[90px_10px_1fr] sm:grid-cols-[100px_10px_1fr] items-baseline gap-y-1 text-xs sm:text-sm">
                <span className="font-bold whitespace-nowrap text-sm sm:text-base">M/s.</span>
                <span></span>
                <div className="font-bold text-sm sm:text-base uppercase break-words">{bill.party_name}</div>

                <span></span>
                <span></span>
                <div className="uppercase leading-tight text-xs sm:text-sm whitespace-pre-wrap break-words">{bill.party_address}</div>

                <span className="whitespace-nowrap font-medium">City</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase break-words">{bill.party_city || '-'}</div>

                <span className="whitespace-nowrap font-medium">State</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase break-words">{bill.party_state}</div>

                <span className="whitespace-nowrap font-medium">Party GSTIN</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase break-words">{bill.party_gstin}</div>

                <span className="whitespace-nowrap font-medium">Party PAN</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase break-words">{bill.party_pan}</div>
              </div>
            </div>

            {/* RIGHT — invoice info */}
            <div className="p-3 sm:p-4 space-y-1 text-xs sm:text-sm">
              <div className="grid grid-cols-[110px_10px_1fr] sm:grid-cols-[135px_10px_1fr] items-baseline gap-y-1">
                <span className="whitespace-nowrap font-semibold">Invoice No.</span><span>:</span>
                <div className="text-xs sm:text-sm font-bold uppercase break-words">{bill.invoice_no}</div>

                <span className="whitespace-nowrap font-semibold">Invoice Date</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase">{formatDate(bill.invoice_date)}</div>

                <div className="col-span-3 border-b border-gray-400 my-2 print:my-1 -mx-3 sm:-mx-4 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)]"></div>

                <span className="whitespace-nowrap font-semibold">Docket No.</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase break-words">{bill.docket_no || ''}</div>

                <span className="whitespace-nowrap font-semibold">Transport Name</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase break-words">{bill.transport_name || ''}</div>

                <span className="whitespace-nowrap font-semibold">Vehicle No.</span><span>:</span>
                <div className="text-xs sm:text-sm uppercase break-words">{bill.delivery_through}</div>
              </div>
            </div>
          </div>

          {/* ── ITEMS TABLE ── */}
          <div className="border-b border-gray-600 overflow-x-auto print:overflow-visible print:w-full">
            <table className="w-full min-w-[700px] print:min-w-0 text-xs table-collapse">
              <thead>
                <tr className="bg-gray-300 border-b border-gray-600">
                  {([
                    ['Sr.\nNo.', 'center'], ['Description of Goods', 'center'], ['HSN /\nSAC', 'center'],
                    ['Qty.', 'center'], ['UQC', 'center'], ['Rate', 'center'], ['Taxable\nAmt.', 'right'],
                    ['CGST\n%', 'center'], ['CGST\nAmt.', 'right'], ['SGST\n%', 'center'],
                    ['SGST\nAmt.', 'right'], ['FINAL\nAMT', 'right'],
                  ] as [string, string][]).map(([label, align], i) => (
                    <th key={i} className={`p-2 font-semibold whitespace-pre-line text-${align} line-height-1-3 ${i < 12 ? 'border-r border-gray-400' : ''}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => {
                  if (!row) {
                    // Render Empty Padding Row
                    return (
                      <tr key={`empty-${idx}`} className="border-b border-gray-300 row-height-44">
                        <td className="border-r border-gray-400 p-1 text-center align-middle text-sm"></td>
                        <td className="border-r border-gray-400 p-1"></td><td className="border-r border-gray-400 p-1"></td>
                        <td className="border-r border-gray-400 p-1"></td><td className="border-r border-gray-400 p-1"></td>
                        <td className="border-r border-gray-400 p-1"></td><td className="border-r border-gray-400 p-1"></td>
                        <td className="border-r border-gray-400 p-1"></td><td className="border-r border-gray-400 p-1"></td>
                        <td className="border-r border-gray-400 p-1"></td><td className="border-r border-gray-400 p-1"></td>
                        <td className="p-1"></td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="border-b border-gray-300 row-height-44">
                      <td className="border-r border-gray-400 p-1 text-center align-middle text-sm">{idx + 1}</td>
                      <td className="border-r border-gray-400 p-1 align-middle font-medium uppercase">{row.crop}</td>
                      <td className="border-r border-gray-400 p-1 align-middle text-center">{row.hsn_code}</td>
                      <td className="border-r border-gray-400 p-1 align-middle text-right">{row.qty}</td>
                      <td className="border-r border-gray-400 p-1 align-middle text-center">{row.uqc}</td>
                      <td className="border-r border-gray-400 p-1 align-middle text-right">{row.rate}</td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle font-medium">{fmt(row.taxable_value)}</td>
                      <td className="border-r border-gray-400 p-1 align-middle text-center">{row.cgst_rate}</td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle">{fmt(row.cgst_amount) || '0.00'}</td>
                      <td className="border-r border-gray-400 p-1 align-middle text-center">{row.sgst_rate}</td>
                      <td className="border-r border-gray-400 p-1 text-right align-middle">{fmt(row.sgst_amount) || '0.00'}</td>
                      <td className="p-1 text-right align-middle font-semibold">{fmt(row.final_amount)}</td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr className="border-t-2 border-gray-600 bg-gray-200 font-semibold text-xs">
                  <td colSpan={5} className="border-r border-gray-400 p-2 text-center">Final Amount</td>
                  <td className="border-r border-gray-400 p-2 text-right"></td>
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(bill.final_taxable_amount)}</td>
                  <td className="border-r border-gray-400" />
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(bill.final_cgst_amount)}</td>
                  <td className="border-r border-gray-400" />
                  <td className="border-r border-gray-400 p-2 text-right">{fmt(bill.final_sgst_amount)}</td>
                  <td className="p-2 text-right">{fmt(bill.final_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── FOOTER ── */}
          <div className="flex flex-col text-xs sm:text-sm">
            <div className="border-b border border-gray-600 p-3">
              <span className="font-semibold">Amt in Word: </span>
              <span className="italic ml-2 break-words">{bill.final_amount_in_words}</span>
            </div>

            {/* Bank details */}
            <div className="border-b border-gray-600 p-3">
              <div className="grid grid-cols-[80px_10px_1fr] sm:grid-cols-[90px_10px_1fr] items-baseline gap-y-1.5 w-full sm:w-1/2">
                <span className="whitespace-nowrap font-medium">Bank</span><span>:</span>
                <div className="uppercase break-words">{bill.seller_bank || '-'}</div>

                <span className="whitespace-nowrap font-medium">Account No.</span><span>:</span>
                <div className="uppercase break-words">{bill.seller_account || '-'}</div>

                <span className="whitespace-nowrap font-medium">IFSC</span><span>:</span>
                <div className="uppercase break-words">{bill.seller_ifsc || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Signatory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 p-3 gap-4 sm:gap-0 min-h-[120px]">
          <div className="flex flex-col sm:pr-4">
            <div className="font-bold text-sm sm:text-base mb-1">Terms &amp; Condition</div>
            <div className="w-full bg-transparent text-xs sm:text-sm p-1 whitespace-pre-wrap break-words">{bill.terms}</div>
          </div>
          <div className="flex flex-col justify-between text-left sm:text-right">
            <div className="font-bold text-sm sm:text-base">For, {bill.seller_name}</div>
            <div className="mt-8 sm:mt-12 text-gray-900">Authorised Signatory</div>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════
          BOTTOM ACTION BAR
      ══════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto mt-6 flex flex-row items-center justify-center gap-1.5 sm:gap-4 print-hide px-2 sm:px-0 flex-wrap">
        <span className="whitespace-nowrap font-semibold text-xs sm:text-sm">Bill created by:</span>
        <div className="text-xs sm:text-sm uppercase break-words">{bill.created_by || ''}</div>
      </div>
      <div className="max-w-4xl mx-auto mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 print-hide px-2 sm:px-0">
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-70 disabled:cursor-not-allowed text-white
                     text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
        >
          {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
          {isPrinting ? 'Preparing...' : 'Print'}
        </button>
        <button
          onClick={handleSend}
          disabled={isSending}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white
                     text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors w-full sm:w-auto"
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <SendIcon size={16} />}
          {isSending ? 'Preparing PDF...' : 'Send'}
        </button>
      </div>
    </div>
  );
}