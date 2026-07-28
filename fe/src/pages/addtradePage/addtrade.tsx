import Navbar from '@/components/navbar/navbar';
import AddTrade from '@/components/trade/addtrade/addtrade';
import GlobalDataLoader from '@/utils/DataLoader';

export default function AddTradePage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <AddTrade />
      </div>
    </GlobalDataLoader>
  );
}