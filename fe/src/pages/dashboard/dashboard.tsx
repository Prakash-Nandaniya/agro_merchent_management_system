import BillButton from "@/components/invoice/bill_button/billbutton";
import BillBookButton from "@/components/invoice/view_bill_book_button/billbookbutton";
import AddTradeButton from "@/components/trade/addtrade_button/button";
import TradeBookButton from "@/components/trade/tradebook_button/button";
import Navbar from "@/components/navbar/navbar";
import "./dashboard.css";

export default function Dashboard() {
  return (
    <div className="dashboard min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <div className="buttons-container">
        <BillButton />
        <BillBookButton />
        <AddTradeButton />
        <TradeBookButton />
      </div>
    </div>
  );
}
