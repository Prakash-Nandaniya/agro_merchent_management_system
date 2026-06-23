// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MillBill from './features/millbill/millbill';
import FarmerBill from './features/farmerbill/farmerbill';
import Home from './features/home/home';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new-bill/mill" element={<MillBill />} />
        <Route path="/new-bill/farmer" element={<FarmerBill />} />
        <Route path="/bill-book/mill" element={<div>Mill Bill Book Page</div>} />
        <Route path="/bill-book/farmer" element={<div>Farmer Bill Book Page</div>} />
      </Routes>
    </BrowserRouter>
  );
}