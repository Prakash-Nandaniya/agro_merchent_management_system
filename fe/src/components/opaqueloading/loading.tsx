import "./loading.css";
import ErrorDisplay from "../errors/errordisplay";
import { useEffect, useState } from "react";

export default function OpaqueLoading() {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1000);

    return () => clearTimeout(timer); 
  }, []);

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
            <div className="opaque-loading-text">Loading...</div>
          </>
        )}
      </div>
    </>
  );
}