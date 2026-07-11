// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MillBillPage from './pages/millbill_page/millbill_page';
import FarmerBill from './components/farmerbill/farmerbill';
import Home from './pages/home/home';
import ProfileConfigurationPage from './pages/profileconfig_page/profileconfig_page';
import MillBillBookPage from './pages/millbillBook/millbillbook';
import ViewMillBillFromBookPage from './pages/view_mill_bill_from_book_page/millbillview';
import Login from './pages/login/login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new-bill/mill" element={<MillBillPage />} />
        <Route path="/new-bill/farmer" element={<FarmerBill />} />
        <Route path="/bill-book/mill" element={<MillBillBookPage />} />
        <Route path="/bill-book/farmer" element={<div>Farmer Bill Book Page</div>} />
        <Route path="/profile-configuration" element={<ProfileConfigurationPage />} />
        <Route path="/show-mill-bill-from-bill-book" element={<ViewMillBillFromBookPage />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}