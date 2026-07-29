import Navbar from "@/components/navbar/navbar";
import InvoiceBook from "@/components/invoice/invoice_book/invoice_book";

export default function InvoiceBookPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <InvoiceBook />
    </div>
  );
}
