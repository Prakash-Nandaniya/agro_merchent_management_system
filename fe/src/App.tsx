import { BrowserRouter, Routes, Route } from 'react-router-dom';
import InvoicePage from './pages/invoice_page/invoice_page';
import Dashboard from './pages/dashboard/dashboard';
import ProfileConfigurationPage from './pages/profileconfig_page/profileconfig_page';
import InvoiceBookPage from './pages/invoice_book_page/invoice_book_page';
import ViewInvoiceFromBookPage from './pages/view_invoice_from_book_page/view_invoice_page';
import Home from './pages/home/home'
import Login from './pages/login/login'
import AddTradePage from './pages/addtradePage/addtrade';
import TradeBookPage from './pages/tradebookPage/tradebook';
import { AuthProvider } from './components/authcontext';
import { ProtectedRoute } from './components/protectedcomponent';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorContextProvider } from './components/errors/errorcontext.tsx'
import EditInvoiceForm from './components/invoice/editinvoice/editinvoice.tsx';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ErrorContextProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/new-invoice" element={<ProtectedRoute><InvoicePage /></ProtectedRoute>} />
              <Route path="/invoice-book" element={<ProtectedRoute><InvoiceBookPage /></ProtectedRoute>} />
              <Route path="/profile-configuration" element={<ProtectedRoute><ProfileConfigurationPage /></ProtectedRoute>} />
              <Route path="/show-invoice-from-book" element={<ProtectedRoute><ViewInvoiceFromBookPage /></ProtectedRoute>} />
              <Route path="/trade-book" element={<ProtectedRoute><TradeBookPage /></ProtectedRoute>} />
              <Route path="/add-trade" element={<ProtectedRoute><AddTradePage /></ProtectedRoute>} />
              <Route path="/edit-invoice" element={<ProtectedRoute><EditInvoiceForm /></ProtectedRoute>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorContextProvider>
  );
}