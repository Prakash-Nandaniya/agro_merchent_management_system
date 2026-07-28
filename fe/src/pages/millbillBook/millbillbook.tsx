import Navbar from '@/components/navbar/navbar';
import MillBillBook from '@/components/invoice/millbill_book/millbill_boook';
import GlobalDataLoader from '@/utils/DataLoader';

export default function MillBillBookPage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <MillBillBook />
      </div>
    </GlobalDataLoader>
  );
}