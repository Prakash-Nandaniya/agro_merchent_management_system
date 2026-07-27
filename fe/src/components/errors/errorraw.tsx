import './errorraw.css';

type Props = {
  message: string;
  onExpire: () => void;
};

function ErrorRaw({ message, onExpire }: Props) {
  return (
    <div className="error-raw">
      <span>{message}</span>
      <button onClick={onExpire}>✕</button>
    </div>
  );
}

export default ErrorRaw;