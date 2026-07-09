import { Home, UserCog } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './navbar.css';
import logo from '@/assets/karma_trading_logo_color_bg_removed.png';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/', icon: Home },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="navbar print-hide">
      <div className="navbar-inner">
        {/* ── LEFT — logo + nav buttons ── */}
        <div className="navbar-left">
          <img src={logo} alt="Company Logo" className="navbar-logo" />
          <nav className="navbar-nav">
            {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`navbar-btn ${isActive ? 'navbar-btn-active' : ''}`}
                >
                  <Icon size={25} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── RIGHT — profile configuration ── */}
        <div className="navbar-right">
          <button
            onClick={() => navigate('/profile-configuration')}
            className={`navbar-btn ${location.pathname === '/profile-configuration' ? 'navbar-btn-active' : ''}`}
          >
            <UserCog size={25} />
            <span>Profile Configuration</span>
          </button>
        </div>
      </div>
    </header>
  );
}