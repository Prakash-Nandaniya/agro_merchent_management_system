import Navbar from "@/components/navbar/navbar";
import EditInvoiceForm from "@/components/invoice/editinvoice/editinvoice";

export default function EditInvoicePage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <EditInvoiceForm />
    </div>
  );
}