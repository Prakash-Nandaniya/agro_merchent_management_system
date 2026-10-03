import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import * as cache from "@/utils/cachestorage";
import { FetchInvoices, FetchTrades, FetchProfile } from "@/utils/cachestorage";

import BillButton from "@/components/invoice/bill_button/billbutton";
import BillBookButton from "@/components/invoice/view_bill_book_button/billbookbutton";
import FarmerBillButton from "@/components/farmer_invoice/bill_button/billbutton";
import FarmerBillBookButton from "@/components/farmer_invoice/view_bill_book_button/billbookbutton";
import AddTradeButton from "@/components/trade/addtrade_button/button";
import TradeBookButton from "@/components/trade/tradebook_button/button";
import Navbar from "@/components/navbar/navbar";
import Chat from "@/components/chat/chat";

import "./dashboard.css";

/* ───────────────────────── helpers ───────────────────────── */

type Row = Record<string, any>;

const FY_OPTIONS = ["2025-26", "2026-27"];
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const CACHE_OPTS = {
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

// Farmer bills fetcher: uses whichever export exists in cachestorage.
const fetchFarmerBills: () => Promise<any> =
  (cache as any).FetchFarmerPurchases ??
  (cache as any).FetchFarmerInvoices ??
  (cache as any).FetchFarmerBills ??
  (async () => []);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// RCM tax column in trades.
// The trade form stores it as rcm_tax_payment and treats it as a government
// expense that is still recorded in cash flow even if it is reimbursable later.
const rcmOf = (t: Row) => num(t.rcm_tax_payment ?? t.rcm_tax_paid ?? t.rcm_tax ?? t.rcm_paid ?? t.rcm_payment);

const toRows = (d: any): Row[] =>
  Array.isArray(d)
    ? d
    : Array.isArray(d?.data)
      ? d.data
      : Array.isArray(d?.items)
        ? d.items
        : [];

const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

const compact = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);

const currentFY = () => {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fy = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  return FY_OPTIONS.includes(fy) ? fy : FY_OPTIONS[FY_OPTIONS.length - 1];
};

// Indian financial year: 1 Apr -> 31 Mar
const inFY = (s: string | undefined, fy: string) => {
  if (!s) return false;
  const d = new Date(s);
  if (isNaN(d.getTime())) return false;
  const start = parseInt(fy.slice(0, 4), 10);
  const y = d.getFullYear();
  const m = d.getMonth();
  return (y === start && m >= 3) || (y === start + 1 && m <= 2);
};

const monthIdx = (s: string) => (new Date(s).getMonth() + 9) % 12;

const cropKey = (c: string) => (c || "").trim().toLowerCase();
const cropLabel = (c: string) => {
  const t = (c || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Unknown";
};

/* ── last numbers: read straight from the cached profile (same shape as ProfileConfig) ── */

interface ProfileConfig {
  millbill_last_invoiceNo?: string;
  purchase_bill_last_invoiceNo?: string;
  rcm_purchase_bill_last_invoiceNo?: string;
}

/* ───────────────────────── pieces ───────────────────────── */

type Line = { label: string; note: string; value: number };

// Calculator-tape column: every item with its sign, a rule, then the sum
function Tape({
  title,
  sign,
  lines,
  total,
  totalLabel,
  tone,
}: {
  title: string;
  sign: "+" | "−";
  lines: Line[];
  total: number;
  totalLabel: string;
  tone: "in" | "out";
}) {
  return (
    <div className={`tape ${tone}`}>
      <h4>{title}</h4>
      <ul>
        {lines.map((l) => (
          <li key={l.label} className={l.value === 0 ? "zero" : ""}>
            <span className="sign">{sign}</span>
            <span className="what">
              {l.label}
              <small>{l.note}</small>
            </span>
            <i className="leader" />
            <b>{inr(l.value)}</b>
          </li>
        ))}
      </ul>
      <div className="rule" />
      <div className="tape-total">
        <span>{totalLabel}</span>
        <b>{inr(total)}</b>
      </div>
    </div>
  );
}

type MonthRow = { label: string; inflow: number; outflow: number; net: number };

function Monthly({ data }: { data: MonthRow[] }) {
  const max = Math.max(...data.flatMap((d) => [d.inflow, d.outflow]), 1);
  return (
    <div className="months-wrap">
      <div className="months-scroll">
      <div className="months">
        {data.map((d) => (
          <div className="month" key={d.label} tabIndex={0}>
            <div className="tip">
              <b className="tip-title">{d.label}</b>
              <div className="tip-row">
                <span>
                  <i className="sw in" /> Inflow
                </span>
                <b>{inr(d.inflow)}</b>
              </div>
              <div className="tip-row">
                <span>
                  <i className="sw out" /> Outflow
                </span>
                <b>{inr(d.outflow)}</b>
              </div>
              <div className={`tip-row net ${d.net < 0 ? "neg" : ""}`}>
                <span>Money kept</span>
                <b>{inr(d.net)}</b>
              </div>
            </div>

            <div className="pair">
              <span className="col in" style={{ height: `${(Math.max(d.inflow, 0) / max) * 100}%` }} />
              <span className="col out" style={{ height: `${(d.outflow / max) * 100}%` }} />
            </div>
            <span className="m-label">{d.label}</span>
            <span className={`m-net ${d.net < 0 ? "neg" : ""}`}>
              {d.inflow || d.outflow ? `${d.net > 0 ? "+" : ""}${compact(d.net)}` : "–"}
            </span>
          </div>
        ))}
      </div>
      </div>
      <div className="months-legend">
        <span>
          <i className="sw in" /> Inflow
        </span>
        <span>
          <i className="sw out" /> Outflow
        </span>
        <span>Number under each month = profit (+) or loss (−). Hover a month for amounts.</span>
      </div>
    </div>
  );
}

// Business bar with profit laid on top. Loss runs backwards (left of the axis).
function BusinessProfit({ rows }: { rows: { label: string; business: number; profit: number }[] }) {
  if (!rows.length) return <div className="empty">No data</div>;
  const maxB = Math.max(...rows.map((r) => Math.max(r.business, r.profit, 0)), 1);
  const minP = Math.min(0, ...rows.map((r) => r.profit));
  const span = maxB + Math.abs(minP);
  const zero = (Math.abs(minP) / span) * 100;

  return (
    <div className="bp">
      <div className="bp-key">
        <span>
          <i className="biz" /> Business
        </span>
        <span>
          <i className="profit" /> Profit
        </span>
        <span>
          <i className="loss" /> Loss (goes backward)
        </span>
      </div>
      {rows.map((r) => {
        const bw = (Math.max(r.business, 0) / span) * 100;
        const pw = (Math.abs(r.profit) / span) * 100;
        const pLeft = r.profit >= 0 ? zero : zero - pw;
        return (
          <div className="bp-row" key={r.label}>
            <span className="bp-label" title={r.label}>
              {r.label}
            </span>
            <div className="bp-track">
              <span className="bp-biz" style={{ left: `${zero}%`, width: `${bw}%` }} />
              <span
                className={`bp-profit ${r.profit < 0 ? "loss" : ""}`}
                style={{ left: `${pLeft}%`, width: `${pw}%` }}
              />
              <span className="bp-axis" style={{ left: `${zero}%` }} />
            </div>
            <div className="bp-nums">
              <b>{inr(r.business)}</b>
              <span className={r.profit < 0 ? "neg" : "pos"}>{inr(r.profit)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Count({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="count">
      <span className="count-label">{label}</span>
      <span className="count-value">{value}</span>
      <span className="count-sub">{sub}</span>
    </div>
  );
}

function GapBlock({
  label,
  invoiced,
  paid,
  shortText,
  extraText,
}: {
  label: string;
  invoiced: number;
  paid: number;
  shortText: string;
  extraText: string;
}) {
  const gap = invoiced - paid;
  const state = Math.abs(gap) < 1 ? "ok" : gap > 0 ? "short" : "extra";
  const text =
    state === "ok" ? "Matched" : state === "short" ? `${shortText} ${inr(gap)}` : `${extraText} ${inr(-gap)}`;
  return (
    <div className="gap-block">
      <h5>{label}</h5>
      <div className="gb-row">
        <span>Invoiced</span>
        <b>{inr(invoiced)}</b>
      </div>
      <div className="gb-row">
        <span>Mill paid</span>
        <b>{inr(paid)}</b>
      </div>
      <div className={`gb-gap ${state}`}>{text}</div>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

type Acc = {
  label: string;
  trades: number;
  receipts: number; // bank payment received from mills (includes GST, after TDS)
  tds: number;
  gst: number; // GST collected from mill
  rcm: number; // RCM tax paid to government
  farmer: number;
  transport: number;
  labour: number;
  other: number;
};

const newAcc = (label: string): Acc => ({
  label,
  trades: 0,
  receipts: 0,
  tds: 0,
  gst: 0,
  rcm: 0,
  farmer: 0,
  transport: 0,
  labour: 0,
  other: 0,
});

/*
  Mill value  = bank receipts + TDS (mill deposits TDS for us, so it is ours)
  Crop payment = mill value - GST   (the part that is really for the crop)
  Inflow  = crop payment + GST + RCM input credit
  Outflow = farmers + transport + labour + other + GST to govt + RCM to govt
  GST and RCM sit on both sides and cancel, so keep = crop payment - costs
*/
const finish = (a: Acc) => {
  const crop = a.receipts + a.tds - a.gst;
  const otherCosts = a.transport + a.labour + a.other;
  const costs = a.farmer + otherCosts;
  const inflow = crop + a.gst + a.rcm;
  const outflow = costs + a.gst + a.rcm;
  const keep = inflow - outflow;
  return {
    ...a,
    crop,
    otherCosts,
    costs,
    inflow,
    outflow,
    keep,
    margin: crop > 0 ? (keep / crop) * 100 : 0,
  };
};

export default function Dashboard() {
  const [fy, setFy] = useState<string>(currentFY());

  // Read from the global cache (GlobalDataLoader already filled these)
  const invoicesQ = useQuery({
    queryKey: ["Invoices"],
    queryFn: FetchInvoices as () => Promise<any>,
    ...CACHE_OPTS,
  });
  const tradesQ = useQuery({
    queryKey: ["Trades"],
    queryFn: FetchTrades as () => Promise<any>,
    ...CACHE_OPTS,
  });
  const profileQ = useQuery<ProfileConfig>({
    queryKey: ["Profile"],
    queryFn: FetchProfile as () => Promise<ProfileConfig>,
    ...CACHE_OPTS,
  });
  const farmerQ = useQuery({
    queryKey: ["FarmerPurchases"],
    queryFn: fetchFarmerBills,
    ...CACHE_OPTS,
  });

  const invoicesAll = useMemo(() => toRows(invoicesQ.data), [invoicesQ.data]);
  const tradesAll = useMemo(() => toRows(tradesQ.data), [tradesQ.data]);
  const farmerAll = useMemo(() => toRows(farmerQ.data), [farmerQ.data]);

  const lastNos = {
    invoice: profileQ.data?.millbill_last_invoiceNo || "",
    farmer: profileQ.data?.purchase_bill_last_invoiceNo || "",
    rcm: profileQ.data?.rcm_purchase_bill_last_invoiceNo || "",
  };

  const s = useMemo(() => {
    const trades = tradesAll.filter((t) => inFY(t.trade_creation_date, fy));

    const total = newAcc("Total");
    const cropMap = new Map<string, Acc>();
    const partyMap = new Map<string, Acc>();
    const monthly = MONTHS.map((label) => newAcc(label));

    const add = (a: Acc, t: Row) => {
      a.trades += 1;
      a.receipts += num(t.mill_payment);
      a.tds += num(t.tds_deducted);
      a.gst += num(t.gst_collected);
      a.rcm += rcmOf(t);
      a.farmer += num(t.farmer_payment);
      a.transport += num(t.transport_cost);
      a.labour += num(t.labour_cost);
      a.other += num(t.other_cost);
    };

    trades.forEach((t) => {
      add(total, t);

      const ck = cropKey(t.crop_name);
      if (!cropMap.has(ck)) cropMap.set(ck, newAcc(cropLabel(t.crop_name)));
      add(cropMap.get(ck)!, t);

      const party = (t.party_name || "").trim();
      if (party) {
        if (!partyMap.has(party)) partyMap.set(party, newAcc(party));
        add(partyMap.get(party)!, t);
      }

      add(monthly[monthIdx(t.trade_creation_date)], t);
    });

    const T = finish(total);

    /* cash flow ledger */
    const inLines: Line[] = [
      { label: "Mill payment on crops", note: "Bank receipts, GST not included", value: T.receipts - T.gst },
      { label: "TDS deducted by mills", note: "Raw TDS amount, taken as tax credit", value: T.tds },
      { label: "Mill GST payment", note: "GST collected from mills on sales", value: T.gst },
      { label: "GST on RCM payment", note: "Collected back as ITC, claim in GSTR-3B", value: T.rcm },
    ];
    const outLines: Line[] = [
      { label: "Paid to farmers", note: "Farmer payments", value: T.farmer },
      { label: "Transport", note: "Transport cost", value: T.transport },
      { label: "Labour", note: "Labour cost", value: T.labour },
      { label: "Other expenses", note: "Other cost", value: T.other },
      { label: "GST payment to government", note: "To be paid to government via GSTR-3B", value: T.gst },
      { label: "RCM payment to government", note: "To be paid to government via GSTR-3B", value: T.rcm },
    ];

    const crops = Array.from(cropMap.values())
      .map(finish)
      .sort((a, b) => b.crop - a.crop);

    const parties = Array.from(partyMap.values())
      .map(finish)
      .sort((a, b) => b.crop - a.crop)
      .slice(0, 7);

    const months: MonthRow[] = monthly.map((m) => {
      const f = finish(m);
      return { label: m.label, inflow: f.inflow, outflow: f.outflow, net: f.keep };
    });

    /* documents */
    const invoices = invoicesAll.filter((r) => inFY(r.invoice_date, fy));
    const farmerDocs = farmerAll.filter((r) => inFY(r.voucher_date, fy));
    const normal = farmerDocs.filter((r) => r.document_type === "Purchase Bill");
    const rcm = farmerDocs.filter((r) => r.document_type === "RCM Purchase Bill");
    const billed = [...normal, ...rcm];

    /* invoice vs mill payment check */
    const invCrop = invoices.reduce((x, r) => x + num(r.taxable_amount), 0);
    const invGst = invoices.reduce((x, r) => x + num(r.cgst_amount) + num(r.sgst_amount), 0);
    const invTotal = invoices.reduce((x, r) => x + num(r.final_amount), 0);

    return {
      tradeCount: trades.length,
      T,
      inLines,
      outLines,
      crops,
      parties,
      months,
      invoiceCount: invoices.length,
      invoiceTotal: invTotal,
      farmerCount: billed.length,
      normalCount: normal.length,
      rcmCount: rcm.length,
      farmerTotal: billed.reduce((x, r) => x + num(r.payable_amount), 0),
      rcmTotal: rcm.reduce((x, r) => x + num(r.payable_amount), 0),
      invCrop,
      invGst,
      paidTotal: T.crop + T.gst,
    };
  }, [tradesAll, invoicesAll, farmerAll, fy]);

  const { T } = s;

  return (
    <div className="dashboard min-h-screen print:bg-white">
      <Navbar />

      <header className="top">
        <div className="title">
          <h1>Business Dashboard</h1>
          <p>
            {s.tradeCount} trades in {fy}
          </p>
        </div>

        <div className="last-numbers">
          <div className="last-chip">
            <span className="chip-label">Last invoice no</span>
            <span className="chip-value">{lastNos.invoice || "—"}</span>
          </div>
          <div className="last-chip">
            <span className="chip-label">Last purchase bill no</span>
            <span className="chip-value">{lastNos.farmer || "—"}</span>
          </div>
          <div className="last-chip">
            <span className="chip-label">Last RCM bill no</span>
            <span className="chip-value">{lastNos.rcm || "—"}</span>
          </div>
        </div>

        <div className="year-select">
          <label htmlFor="fy-select">Financial year</label>
          <select id="fy-select" value={fy} onChange={(e) => setFy(e.target.value)}>
            {FY_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="page">
        <aside className="rail">
          <section className="panel actions">
            <h3>Quick actions</h3>

            <div className="action-group">
              <span className="group-name">Mill invoices</span>
              <div className="action-row">
                <BillButton />
                <BillBookButton />
              </div>
            </div>

            <div className="action-group">
              <span className="group-name">Farmer bills</span>
              <div className="action-row">
                <FarmerBillButton />
                <FarmerBillBookButton />
              </div>
            </div>

            <div className="action-group">
              <span className="group-name">Trades</span>
              <div className="action-row">
                <AddTradeButton />
                <TradeBookButton />
              </div>
            </div>
          </section>

          <div className="chat-slot">
            <Chat />
          </div>

          {/* invoice vs mill payment: find the deficit and mismatch */}
          <section className="panel recon">
            <div className="panel-head">
              <h3>Invoice vs mill payment</h3>
              <span className="hint">Mill paid includes TDS</span>
            </div>

            <GapBlock
              label="Crop payment"
              invoiced={s.invCrop}
              paid={T.crop}
              shortText="Lost on weight or rate"
              extraText="Mill paid extra"
            />
            <GapBlock
              label="GST"
              invoiced={s.invGst}
              paid={T.gst}
              shortText="GST short by"
              extraText="GST extra by"
            />
            <GapBlock
              label="Total"
              invoiced={s.invoiceTotal}
              paid={s.paidTotal}
              shortText="Total short by"
              extraText="Total extra by"
            />
          </section>
        </aside>

        <main className="main">
          {/* ───── counts ───── */}
          <div className="counts span-12">
            <Count label="Total invoices" value={s.invoiceCount} sub={`${inr(s.invoiceTotal)} billed to mills`} />
            <Count
              label="Total farmer bills"
              value={s.farmerCount}
              sub={`${s.normalCount} purchase + ${s.rcmCount} RCM, ${inr(s.farmerTotal)}`}
            />
            <Count label="Total RCM farmer bills" value={s.rcmCount} sub={`${inr(s.rcmTotal)} payable`} />
          </div>

          {/* ───── cash flow ───── */}
          <section className="panel cashflow span-12">
            <div className="panel-head">
              <h3>Cash flow</h3>
              <span className="hint">Every trade added up: what comes in, what goes out, what you keep</span>
            </div>

            <div className="ledger">
              <Tape
                tone="in"
                title="Money coming in"
                sign="+"
                lines={s.inLines}
                total={T.inflow}
                totalLabel="Total in"
              />
              <span className="op">−</span>
              <Tape
                tone="out"
                title="Money going out"
                sign="−"
                lines={s.outLines}
                total={T.outflow}
                totalLabel="Total out"
              />
              <span className="op">=</span>

              <div className={`keep ${T.keep < 0 ? "loss" : ""}`}>
                <span className="keep-label">Final money you keep</span>
                <b className="keep-value">{inr(T.keep)}</b>
                <span className="keep-pct">
                  {T.crop > 0 ? `${T.margin.toFixed(1)}% profit on sales` : "No sales yet"}
                </span>
                <span className="keep-sub">Sales = crop payment + TDS = {inr(T.crop)}</span>
              </div>
            </div>

            <p className="ledger-note">
              Mill GST comes in and goes to the government. RCM goes to the government and comes back as ITC. Both
              cancel. What you keep = crop payment + TDS − farmers − costs.
            </p>
          </section>

          {/* ───── monthly ───── */}
          <section className="panel span-12">
            <div className="panel-head">
              <h3>Month by month</h3>
              <span className="hint">Inflow vs outflow for each month</span>
            </div>
            <Monthly data={s.months} />
          </section>

          {/* ───── crop + mills ───── */}
          <section className="panel span-7">
            <div className="panel-head">
              <h3>Business and profit by crop</h3>
            </div>
            <BusinessProfit rows={s.crops.map((c) => ({ label: c.label, business: c.crop, profit: c.keep }))} />
          </section>

          <section className="panel span-5">
            <div className="panel-head">
              <h3>Top mills</h3>
              <span className="hint">Top 7 by business</span>
            </div>
            <BusinessProfit rows={s.parties.map((p) => ({ label: p.label, business: p.crop, profit: p.keep }))} />
          </section>

          {/* ───── crop summary ───── */}
          <section className="panel span-12">
            <div className="panel-head">
              <h3>Crop summary</h3>
              <span className="hint">Sales = mill payment on crops (bank + TDS − GST)</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Trades</th>
                    <th>Sales</th>
                    <th>Paid to farmers</th>
                    <th>Other costs</th>
                    <th>Money kept</th>
                    <th>Profit on sales</th>
                  </tr>
                </thead>
                <tbody>
                  {s.crops.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty">
                        No trades in {fy}
                      </td>
                    </tr>
                  )}
                  {s.crops.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td>{c.trades}</td>
                      <td>{inr(c.crop)}</td>
                      <td>{inr(c.farmer)}</td>
                      <td>{inr(c.otherCosts)}</td>
                      <td className={c.keep >= 0 ? "pos" : "neg"}>{inr(c.keep)}</td>
                      <td className={c.margin >= 0 ? "pos" : "neg"}>{c.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                {s.crops.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>All crops</td>
                      <td>{T.trades}</td>
                      <td>{inr(T.crop)}</td>
                      <td>{inr(T.farmer)}</td>
                      <td>{inr(T.otherCosts)}</td>
                      <td className={T.keep >= 0 ? "pos" : "neg"}>{inr(T.keep)}</td>
                      <td className={T.margin >= 0 ? "pos" : "neg"}>{T.margin.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="table-note">
              Other costs = transport + labour + other. GST and RCM cancel out, so they do not change money kept. TDS is
              already inside sales. The last row matches the final money you keep.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}