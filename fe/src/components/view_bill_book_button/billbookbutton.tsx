import { useNavigate } from 'react-router-dom';
import './billbookbutton.css';

const BookIcon = () => (
  <svg width="35" height="35" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6v13" />
    <path d="M12 6v13" />
    <path d="M21 6v13" />
  </svg>
);

export default function BillBookButton() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/bill-book/mill');
  };

  return (
    <button onClick={handleClick} className="bill-book-button">
      <span className="bill-book-icon"><BookIcon /></span>
      <span className="bill-book-label">Bill Book</span>
    </button>
  );
}