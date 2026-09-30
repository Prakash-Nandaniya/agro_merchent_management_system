import Navbar from "@/components/navbar/navbar";
import ViewFarmerPurchaseFromBook from "@/components/farmer_invoice/view_invoice_from_book/view_invoice";

export default function ViewFarmerPurchaseFromBookPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <ViewFarmerPurchaseFromBook />
    </div>
  );
}
