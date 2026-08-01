import { useEffect } from 'react';
import './errorraw.css';

type Props = {
  id: string;
  message: string;
  onExpire: (id: string) => void;
};

export default function ErrorRaw({ id, message, onExpire }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => onExpire(id), 5000);
    return () => clearTimeout(timer);
  }, [id, onExpire]); 
  return (
    <div className="error-raw">
      <span>{message}</span>
      <button onClick={() => onExpire(id)}>✕</button>
    </div>
  );
}