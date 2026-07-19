import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/authcontext';
import '@/pages/home/home.css'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isChecking, isAuthorized } = useAuth();

  if (isChecking) {
    return (
      <div className="home-loading-screen">
        <div className="home-loading-glow">
          <img src="/apple-touch-icon.png" alt="Karma Trading" className="home-loading-logo" />
        </div>
        <div className="home-loading-text">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    console.log('hello i fucked up')
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}