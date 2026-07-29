import Navbar from "@/components/navbar/navbar";
import InvoiceForm from "@/components/invoice/invoice_form/invoice_form";

export default function InvoicePage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <InvoiceForm />
    </div>
  );
}
