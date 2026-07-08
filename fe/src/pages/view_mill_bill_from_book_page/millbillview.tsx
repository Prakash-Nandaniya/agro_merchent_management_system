import Navbar from '@/components/navbar/navbar';
import ViewMillBillFromBook from '@/components/view_mill_bill_from_book/view_mill_bill';

export default function ViewMillBillFromBookPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <ViewMillBillFromBook />
    </div>
  );
}