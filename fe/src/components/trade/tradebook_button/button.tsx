import { useNavigate } from 'react-router-dom';
import './button.css';

const BookIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6v13" />
    <path d="M12 6v13" />
    <path d="M21 6v13" />
  </svg>
);

export default function TradeBookButton() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/trade-book');
  };

  return (
    <button onClick={handleClick} className="trade-book-button">
      <span className="trade-book-icon"><BookIcon /></span>
      <span className="trade-book-label">Trade Book</span>
    </button>
  );
}