import { useNavigate } from 'react-router-dom';
import './billbookbutton.css';

const FarmerBookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 15m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
    <path d="M17 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M3 15v-7a1 1 0 0 1 1 -1h8l4 7" />
    <path d="M11 7v-3h3" />
    <path d="M16 15h-1l-4 -8h5v8" />
  </svg>
);

const MillBookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21v-15l6 4v-4l6 4v-4l4 3v12z" />
    <path d="M8 21v-4h3v4z" />
    <path d="M13 21v-4h3v4z" />
    <path d="M4 12h16" />
    <path d="M8 8v-4" />
    <path d="M12 8v-4" />
  </svg>
);

const BookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6v13" />
    <path d="M12 6v13" />
    <path d="M21 6v13" />
  </svg>
);

interface BillBookButtonProps {
  buttonname: string;
  buttonpath: string;
}

export default function BillBookButton({ buttonname, buttonpath }: BillBookButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(buttonpath);
  };

  const nameClass = buttonname.toLowerCase().replace(/\s+/g, '-');

  const getIcon = () => {
    const lower = buttonname.toLowerCase();
    if (lower.includes('farmer')) return <FarmerBookIcon />;
    if (lower.includes('mill'))   return <MillBookIcon />;
    return <BookIcon />;
  };

  return (
    <button onClick={handleClick} className={`bill-book-button ${nameClass}`}>
      <span className="bill-book-icon">{getIcon()}</span>
      <span className="bill-book-label">{buttonname}</span>
      <svg className="bill-book-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6l-6 6" />
      </svg>
    </button>
  );
}