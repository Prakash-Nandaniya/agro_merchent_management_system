import { useNavigate } from 'react-router-dom';
import './billbutton.css';

const BillIcon = () => (
  <svg width="35" height="35" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h9l3 3v17H6z" />
    <path d="M15 2v3h3" />
    <path d="M9 9h6" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </svg>
);

export default function BillButton() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/new-bill/mill');
  };

  return (
    <button onClick={handleClick} className="make-bill-button">
      <span className="make-bill-icon"><BillIcon /></span>
      <span className="make-bill-label">Make Bill</span>
    </button>
  );
}