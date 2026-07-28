import Navbar from '@/components/navbar/navbar';
import MillBill from '@/components/invoice/millbill/millbill';
import GlobalDataLoader from '@/utils/DataLoader';

export default function MillBillPage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <MillBill />
      </div>
    </GlobalDataLoader>
  );
}