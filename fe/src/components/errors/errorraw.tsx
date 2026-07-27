import { useEffect } from 'react';
import './errorraw.css';

type Props = {
  message: string;
  onExpire: () => void;
};

export default function ErrorRaw({ message, onExpire }: Props) {
  useEffect(() => {
    const timer = setTimeout(onExpire, 5000);
    return () => clearTimeout(timer);
  }, [onExpire]);

  return (
    <div className="error-raw">
      <span>{message}</span>
      <button onClick={onExpire}>✕</button>
    </div>
  );
}