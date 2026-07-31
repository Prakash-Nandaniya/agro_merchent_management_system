import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import "./animation.css";

export default function BlurLoading({
  message,
  loading,
  children,
}: {
  message: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div className="at-blur-wrap">
      {children}
      {loading && (
        <div className="at-saving-overlay">
          <div className="at-saving-overlay__box">
            <Loader2 size={50} className="at-saving-overlay__spinner" />
            <span className="at-saving-overlay__text">
              {message}
              <span className="at-saving-dots">{".".repeat(dotCount)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}