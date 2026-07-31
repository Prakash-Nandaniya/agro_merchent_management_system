import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import InvoicePage from "./pages/invoice_page/invoice_page";
import Dashboard from "./pages/dashboard/dashboard";
import ProfileConfigurationPage from "./pages/profileconfig_page/profileconfig_page";
import InvoiceBookPage from "./pages/invoice_book_page/invoice_book_page";
import ViewInvoiceFromBookPage from "./pages/view_invoice_from_book_page/view_invoice_page";
import Home from "./pages/home/home";
import Login from "./pages/login/login";
import AddTradePage from "./pages/addtradePage/addtrade";
import TradeBookPage from "./pages/tradebookPage/tradebook";
import { AuthProvider } from "./components/authcontext";
import { ProtectedRoute } from "./components/protectedcomponent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorContextProvider } from "./components/errors/errorcontext.tsx";
import EditInvoicePage from "./pages/editinvoice/invoice.tsx";
import GlobalDataLoader from "./utils/DataLoader";
import ViewTrade from "./pages/viewtradePage/viewtrade.tsx";

const queryClient = new QueryClient();

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <GlobalDataLoader>
        <Outlet />
      </GlobalDataLoader>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ErrorContextProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/new-invoice" element={<InvoicePage />} />
                <Route path="/invoice-book" element={<InvoiceBookPage />} />
                <Route
                  path="/profile-configuration"
                  element={<ProfileConfigurationPage />}
                />
                <Route
                  path="/view-invoice"
                  element={<ViewInvoiceFromBookPage />}
                />
                <Route path="/trade-book" element={<TradeBookPage />} />
                <Route path="/add-trade" element={<AddTradePage />} />
                <Route path="/edit-invoice" element={<EditInvoicePage />} />
                <Route path="/view-trade" element={<ViewTrade />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorContextProvider>
  );
}
