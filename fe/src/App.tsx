import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MillBillPage from './pages/millbill_page/millbill_page';
import Dashboard from './pages/dashboard/dashboard';
import ProfileConfigurationPage from './pages/profileconfig_page/profileconfig_page';
import MillBillBookPage from './pages/millbillBook/millbillbook';
import ViewMillBillFromBookPage from './pages/view_mill_bill_from_book_page/millbillview';
import Home from './pages/home/home'
import Login from './pages/login/login'
import AddTradePage from './pages/addtradePage/addtrade';
import TradeBookPage from './pages/tradebookPage/tradebook';
import { AuthProvider } from './components/authcontext';
import { ProtectedRoute } from './components/protectedcomponent';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/new-bill/mill" element={<ProtectedRoute><MillBillPage /></ProtectedRoute>} />
          <Route path="/bill-book/mill" element={<ProtectedRoute><MillBillBookPage /></ProtectedRoute>} />
          <Route path="/profile-configuration" element={<ProtectedRoute><ProfileConfigurationPage /></ProtectedRoute>} />
          <Route path="/show-mill-bill-from-bill-book" element={<ProtectedRoute><ViewMillBillFromBookPage /></ProtectedRoute>} />
          <Route path="/trade-book" element={<ProtectedRoute><TradeBookPage /></ProtectedRoute>} />
          <Route path="/add-trade" element={<ProtectedRoute><AddTradePage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}