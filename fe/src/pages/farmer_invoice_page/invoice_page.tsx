import Navbar from "@/components/navbar/navbar";
import FarmerInvoiceForm from "@/components/farmer_invoice/invoice_form/invoice_form";

export default function FarmerInvoicePage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <FarmerInvoiceForm />
    </div>
  );
}
