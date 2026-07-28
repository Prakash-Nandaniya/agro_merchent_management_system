import Navbar from '@/components/navbar/navbar';
import TradeBook from '@/components/trade/tradebook/tradebook';
import GlobalDataLoader from '@/utils/DataLoader';

export default function TradeBookPage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <TradeBook />
      </div>
    </GlobalDataLoader>
  );
}