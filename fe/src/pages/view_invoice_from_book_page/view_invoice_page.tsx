import Navbar from '@/components/navbar/navbar';
import ViewInvoiceFromBook from '@/components/invoice/view_invoice_from_book/view_invoice';
import GlobalDataLoader from '@/utils/DataLoader';

export default function ViewInvoiceFromBookPage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <ViewInvoiceFromBook />
      </div>
    </GlobalDataLoader>
  );
}
