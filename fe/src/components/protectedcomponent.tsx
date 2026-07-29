import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/authcontext';
import '@/pages/home/home.css'
import OpaqueLoading from './opaqueloading/loading';
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isChecking, isAuthorized } = useAuth();

  if (isChecking) {
    return (
      <OpaqueLoading/>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}