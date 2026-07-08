import Navbar from '@/components/navbar/navbar';
import MillBill from '@/components/millbill/millbill';

export default function MillBillPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <MillBill />
    </div>
  );
}