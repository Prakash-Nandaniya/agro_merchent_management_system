import "./loading.css";
import ErrorDisplay from "../errors/errordisplay";
import { useEffect, useState } from "react";

export default function OpaqueLoading() {
  const [showContent, setShowContent] = useState(false);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showContent) return;
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 4) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, [showContent]);

  return (
    <>
      <ErrorDisplay />
      <div className="opaque-loading-screen">
        {showContent && (
          <>
            <div className="opaque-loading-glow">
              <img
                src="/apple-touch-icon.png"
                alt="Karma Trading"
                className="opaque-loading-logo"
              />
            </div>
            <div className="opaque-loading-text">
              Loading
              <span className="opaque-loading-dots">
                {".".repeat(dotCount)}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
