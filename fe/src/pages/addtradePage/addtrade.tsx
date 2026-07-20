import Navbar from '@/components/navbar/navbar';
import AddTrade from '@/components/addtrade/addtrade';

export default function AddTradePage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <AddTrade />
    </div>
  );
}