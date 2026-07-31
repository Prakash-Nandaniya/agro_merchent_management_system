import AddTrade from "@/components/trade/addtrade/addtrade";
import ViewInvoice from "./viewinvoice";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/navbar/navbar";

export default function ViewTrade() {
  const location = useLocation();
  const trade = location.state?.trade as any;
  const invoiceNo = location.state?.invoiceNo as any;
  return (
    <div>
      <Navbar />
      <AddTrade trade={trade} isEditMode={false} isViewMode={true} />
      <ViewInvoice invoiceNo={invoiceNo} />
    </div>
  );
}