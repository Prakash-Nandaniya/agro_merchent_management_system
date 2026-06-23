import { useNavigate } from 'react-router-dom';
import './billbutton.css';

const TractorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 15m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
    <path d="M17 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M3 15v-7a1 1 0 0 1 1 -1h8l4 7" />
    <path d="M11 7v-3h3" />
    <path d="M16 15h-1l-4 -8h5v8" />
  </svg>
);

const FactoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21v-15l6 4v-4l6 4v-4l4 3v12z" />
    <path d="M8 21v-4h3v4z" />
    <path d="M13 21v-4h3v4z" />
    <path d="M4 12h16" />
    <path d="M8 8v-4" />
    <path d="M12 8v-4" />
  </svg>
);

interface BillButtonProps {
  buttonname: string;
  buttonpath: string;
}

export default function BillButton({ buttonname, buttonpath }: BillButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(buttonpath);
  };

  const nameClass = buttonname.toLowerCase().replace(/\s+/g, '-');

  const getIcon = () => {
    const lower = buttonname.toLowerCase();
    if (lower.includes('farmer')) return <TractorIcon />;
    if (lower.includes('mill'))   return <FactoryIcon />;
    return null;
  };

  return (
    <button onClick={handleClick} className={`make-bill-button ${nameClass}`}>
      {getIcon()}
      {buttonname}
    </button>
  );
}