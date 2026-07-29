import Navbar from '@/components/navbar/navbar';
import InvoiceForm from '@/components/invoice/invoice_form/invoice_form';
import GlobalDataLoader from '@/utils/DataLoader';

export default function InvoicePage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <InvoiceForm />
      </div>
    </GlobalDataLoader>
  );
}
