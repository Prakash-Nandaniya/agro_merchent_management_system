import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Printer, Send as SendIcon, ArrowLeft } from 'lucide-react';
import './view_mill_bill.css';

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

export default function ViewMillBillFromBook() {
  const location = useLocation();
  const navigate = useNavigate();

  const bill = location.state?.bill as MillBill | undefined;

  if (!bill) {
    return (
      <div className="min-h-screen bg-gray-300 flex flex-col items-center justify-center gap-4">
        <div className="text-gray-700 font-medium text-lg">No bill data found.</div>
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

  const handlePrint = () => window.print();
  const handleSend = () => console.log('Sending bill:', bill.invoice_no);

  return (
    <div className="min-h-screen bg-gray-300 py-10 px-4 print:bg-white print:p-0">

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
      <div className="max-w-4xl mx-auto bg-white shadow-2xl  print:shadow-none">
        {/* ── HEADER ── */}
        <div className="relative border-b border-gray-600 p-5">
          <div className="text-center">
            <div className="text-3xl font-bold tracking-wide">{bill.seller_name}</div>
            <div className="mt-1 text-sm text-gray-600 whitespace-pre-line">{bill.seller_address}</div>
            <div className="flex justify-center gap-8 mt-2 text-sm">
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
          <div className="absolute top-4 right-4 border border-gray-700 px-2 py-0.5 text-sm font-bold tracking-widest">
            ORIGINAL
          </div>
        </div>

        {/* ── TITLE BAR ── */}
        <div className="border border-gray-600">
          <div className="text-center border-b border-gray-600 py-1.5 bg-gray-200">
            <span className="text-base font-bold tracking-widest">TAX INVOICE</span>
          </div>

          {/* ── PARTY + INVOICE DETAILS ── */}
          <div className="border-b border-gray-600 grid grid-cols-[55%_45%]">

            {/* LEFT — party details */}
            <div className="border-r border-gray-600 p-4">
              <div className="grid grid-cols-[100px_10px_1fr] items-baseline gap-y-1 text-sm">
                <span className="font-bold whitespace-nowrap text-base">M/s.</span>
                <span></span>
                <div className="font-bold text-base uppercase">{bill.party_name}</div>

                <span></span>
                <span></span>
                <div className="uppercase leading-tight text-sm whitespace-pre-wrap">{bill.party_address}</div>

                <span className="whitespace-nowrap font-medium">City</span><span>:</span>
                <div className="text-sm uppercase">{bill.party_city || '-'}</div>

                <span className="whitespace-nowrap font-medium">State</span><span>:</span>
                <div className="text-sm uppercase">{bill.party_state}</div>

                <span className="whitespace-nowrap font-medium">Party GSTIN</span><span>:</span>
                <div className="text-sm uppercase">{bill.party_gstin}</div>

                <span className="whitespace-nowrap font-medium">Party PAN</span><span>:</span>
                <div className="text-sm uppercase">{bill.party_pan}</div>
              </div>
            </div>

            {/* RIGHT — invoice info */}
            <div className="p-4 space-y-1 text-sm">
              <div className="grid grid-cols-[135px_10px_1fr] items-baseline gap-y-1">
                <span className="whitespace-nowrap font-semibold">Invoice No.</span><span>:</span>
                <div className="text-sm font-bold uppercase">{bill.invoice_no}</div>

                <span className="whitespace-nowrap font-semibold">Invoice Date</span><span>:</span>
                <div className="text-sm uppercase">{formatDate(bill.invoice_date)}</div>

                <div className="col-span-3 border-b border-gray-400 my-2 print:my-1 -mx-4 w-[calc(100%+2rem)]"></div>

                <span className="whitespace-nowrap font-semibold">Docket No.</span><span>:</span>
                <div className="text-sm uppercase">{bill.docket_no || ''}</div>

                <span className="whitespace-nowrap font-semibold">Transport Name</span><span>:</span>
                <div className="text-sm uppercase">{bill.transport_name || ''}</div>

                <span className="whitespace-nowrap font-semibold">Vehicle No.</span><span>:</span>
                <div className="text-sm uppercase">{bill.delivery_through}</div>
              </div>
            </div>
          </div>

          {/* ── ITEMS TABLE ── */}
          <div className="border-b border-gray-600 overflow-x-auto print:overflow-visible print:w-full">
            <table className="w-full text-xs table-collapse">
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
                <tr className="border-t-2 border-gray-600 bg-gray-200 font-semibold text-sm">
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
          <div className="flex flex-col text-sm">
            <div className="border-b border border-gray-600 p-3">
              <span className="font-semibold">Amt in Word: </span>
              <span className="italic ml-2">{bill.final_amount_in_words}</span>
            </div>

            {/* Bank details */}
            <div className="border-b border-gray-600 p-3">
              <div className="grid grid-cols-[90px_10px_1fr] items-baseline gap-y-1.5 w-1/2">
                <span className="whitespace-nowrap font-medium">Bank</span><span>:</span>
                <div className="uppercase">{bill.seller_bank || '-'}</div>

                <span className="whitespace-nowrap font-medium">Account No.</span><span>:</span>
                <div className="uppercase">{bill.seller_account || '-'}</div>

                <span className="whitespace-nowrap font-medium">IFSC</span><span>:</span>
                <div className="uppercase">{bill.seller_ifsc || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Signatory */}
        <div className="grid grid-cols-2 p-3 min-h-[120px]">
          <div className="flex flex-col pr-4">
            <div className="font-bold text-base mb-1">Terms &amp; Condition</div>
            <div className="w-full bg-transparent text-sm p-1 whitespace-pre-wrap">{bill.terms}</div>
          </div>
          <div className="flex flex-col justify-between text-right">
            <div className="font-bold text-base">For, {bill.seller_name}</div>
            <div className="mt-12 text-gray-900">Authorised Signatory</div>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════
          BOTTOM ACTION BAR
      ══════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto mt-6 flex items-center justify-center gap-4 print-hide">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white
                     text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors"
        >
          <Printer size={16} /> Print
        </button>
        <button
          onClick={handleSend}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                     text-sm font-medium px-6 py-2.5 rounded shadow-md transition-colors"
        >
          <SendIcon size={16} /> Send
        </button>
      </div>
    </div>
  );
}