import Navbar from '@/components/navbar/navbar';
import MillBillBook from '@/components/millbill_book/millbill_boook';

export default function MillBillBookPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <MillBillBook />
    </div>
  );
}