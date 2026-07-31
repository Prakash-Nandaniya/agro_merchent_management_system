import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import type { Trade } from "../tradebook/tradebook";
import "./trade.css";

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

function formatDateDMY(iso: string | undefined | null): string {
  if (!iso) return "";
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
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

function tradeProfit(t: Trade): number {
  return tradeInflow(t) - tradeOutflow(t);
}

type Props = {
  id: number;
  trade: Trade;
  onDeleteClick: (id: number) => void;
};

function TradeRowInner({ id, trade, onDeleteClick }: Props) {
  const navigate = useNavigate();
  if (!trade) return null;
  const invoice_no= trade.invoice_no;
  const profit = tradeProfit(trade);

  function goToTrade() {
    navigate("/view-trade", {
      state: { trade: trade, isEditMode: false, isViewMode: true, invoiceNo:invoice_no },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToTrade();
    }
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    navigate("/add-trade", {
      state: { trade: trade, isEditMode: true, isViewMode: false },
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    onDeleteClick(id);
  }

  return (
    <tr
      className="tb-row-clickable"
      role="button"
      tabIndex={0}
      onClick={goToTrade}
      onKeyDown={handleKeyDown}
      aria-label={`View trade ${trade.invoice_no}`}
    >
      <td className="tb-mono" data-label="Date">
        {formatDateDMY(trade.trade_creation_date)}
      </td>
      <td className="tb-mono" data-label="Invoice No.">
        {trade.invoice_no}
      </td>
      <td data-label="Party">{trade.party_name || "—"}</td>
      <td data-label="Crop">{trade.crop_name || "—"}</td>
      <td className="tb-num tb-mono" data-label="Mill Qty">
        {fmtAmount(toNum(trade.mill_qty))} {trade.mill_qty_unit}
      </td>
      <td className="tb-num tb-mono" data-label="Mill Rate">
        ₹ {fmtAmount(toNum(trade.mill_rate))} / {trade.mill_rate_unit}
      </td>
      <td
        className={`tb-num tb-mono tb-strong ${profit >= 0 ? "tb-profit" : "tb-loss"}`}
        data-label="Profit"
      >
        ₹ {fmtAmount(profit)}
      </td>
      <td className="tb-num tb-row-actions">
        <button
          className="tb-icon-btn tb-icon-btn--edit"
          onClick={handleEdit}
          type="button"
          aria-label="Edit trade"
        >
          <Pencil size={15} />
        </button>
        <button
          className="tb-icon-btn tb-icon-btn--delete"
          onClick={handleDelete}
          type="button"
          aria-label="Delete trade"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

const TradeRow = memo(TradeRowInner);
export default TradeRow;
