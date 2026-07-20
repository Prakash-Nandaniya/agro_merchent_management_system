import { useNavigate } from 'react-router-dom';
import './button.css';

const PlusIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
);

export default function AddTradeButton() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/add-trade');
  };

  return (
    <button onClick={handleClick} className="add-trade-button">
      <span className="add-trade-icon"><PlusIcon /></span>
      <span className="add-trade-label">Add Trade</span>
    </button>
  );
}