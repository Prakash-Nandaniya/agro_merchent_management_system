import Navbar from "@/components/navbar/navbar";
import FarmerInvoiceBook from "@/components/farmer_invoice/invoice_book/invoice_book";

export default function FarmerInvoiceBookPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <FarmerInvoiceBook />
    </div>
  );
}
