import Navbar from '@/components/navbar/navbar';
import ViewMillBillFromBook from '@/components/invoice/view_mill_bill_from_book/view_mill_bill';
import GlobalDataLoader from '@/utils/DataLoader';

export default function ViewMillBillFromBookPage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <ViewMillBillFromBook />
      </div>
    </GlobalDataLoader>
  );
}