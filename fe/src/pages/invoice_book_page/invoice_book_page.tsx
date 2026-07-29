import Navbar from '@/components/navbar/navbar';
import InvoiceBook from '@/components/invoice/invoice_book/invoice_book';
import GlobalDataLoader from '@/utils/DataLoader';

export default function InvoiceBookPage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <InvoiceBook />
      </div>
    </GlobalDataLoader>
  );
}
