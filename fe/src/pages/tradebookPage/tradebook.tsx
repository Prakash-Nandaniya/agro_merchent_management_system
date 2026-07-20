import Navbar from '@/components/navbar/navbar';
import TradeBook from '@/components/tradebook/tradebook';

export default function TradeBookPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <TradeBook />
    </div>
  );
}