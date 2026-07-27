import { useContext, useEffect } from "react";
import { ErrorContext } from "./errorcontext";
import ErrorRaw from "./errorraw";
import './errordisplay.css'; 

export default function ErrorDisplay() {
  const { errors, removeError } = useContext(ErrorContext);

  if (errors.length === 0) return null;

  return (
    <div className="error-display-container">
      {errors.map((err) => (
        <ErrorTimer key={err.id} id={err.id} message={err.message} removeError={removeError} />
      ))}
    </div>
  );
}

function ErrorTimer({
  id,
  message,
  removeError,
}: {
  id: string;
  message: string;
  removeError: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeError(id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, removeError]);

  return <ErrorRaw message={message} onExpire={() => removeError(id)} />;
}