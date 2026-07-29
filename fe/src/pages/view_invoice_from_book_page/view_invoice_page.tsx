import Navbar from "@/components/navbar/navbar";
import ViewInvoiceFromBook from "@/components/invoice/view_invoice_from_book/view_invoice";

export default function ViewInvoiceFromBookPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <ViewInvoiceFromBook />
    </div>
  );
}
