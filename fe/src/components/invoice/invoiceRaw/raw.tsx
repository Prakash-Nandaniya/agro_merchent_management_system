import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { Invoice } from "../invoice_book/invoice_book";
import { create, all } from "mathjs";
import "./raw.css";

const math = create(all);
math.config({ number: "BigNumber", precision: 64 });

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

function formatDateDMY(isoDate: string | undefined | null): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

type Props = {
  id: number;
  queryKey: QueryKey;
};

function BillRowInner({ id, queryKey }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: bill } = useQuery<Invoice[], Error, Invoice | undefined>({
    queryKey,
    queryFn: () => queryClient.getQueryData<Invoice[]>(queryKey) ?? [],
    select: (list) => list.find((b) => b.id === id),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (!bill) return null;

  function goToBill() {
    navigate("/view-invoice", { state: { id: bill!.id } });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToBill();
    }
  }

  return (
    <tr
      className="mbr-row-clickable"
      role="button"
      tabIndex={0}
      onClick={goToBill}
      onKeyDown={handleKeyDown}
      aria-label={`View bill ${bill.invoice_no}`}
    >
      <td className="mbr-mono" data-label="Invoice no.">
        {bill.invoice_no}
      </td>
      <td className="mbr-mono" data-label="Date">
        {formatDateDMY(bill.invoice_date)}
      </td>
      <td data-label="Party">{bill.party_name}</td>
      <td className="mbr-num mbr-mono" data-label="Crop">
        {bill.crop}
      </td>
      <td className="mbr-num mbr-mono mbr-strong" data-label="Total">
        {toIndianAmount(bill.final_amount)}
      </td>
    </tr>
  );
}

const BillRow = memo(BillRowInner);

export default BillRow;
