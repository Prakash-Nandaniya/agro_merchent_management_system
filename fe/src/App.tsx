// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MillBillPage from './pages/millbill_page/millbill_page';
import FarmerBill from './components/farmerbill/farmerbill';
import Home from './pages/home/home';
import ProfileConfigurationPage from './pages/profileconfig_page/profileconfig_page';
import MillBillBook from './components/millbill_book/millbill_boook';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new-bill/mill" element={<MillBillPage />} />
        <Route path="/new-bill/farmer" element={<FarmerBill />} />
        <Route path="/bill-book/mill" element={<MillBillBook />} />
        <Route path="/bill-book/farmer" element={<div>Farmer Bill Book Page</div>} />
        <Route path="/profile-configuration" element={<ProfileConfigurationPage />} />
      </Routes>
    </BrowserRouter>
  );
}