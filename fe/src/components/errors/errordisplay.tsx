import { useContext } from "react";
import { ErrorContext } from "./errorcontext";
import ErrorRaw from "./errorraw";
import './errordisplay.css';

export default function ErrorDisplay() {
  const { errors, removeError } = useContext(ErrorContext);

  if (errors.length === 0) return null;

  return (
    <div className="error-display-container">
      {errors.map((err) => (
        <ErrorRaw
          key={err.id}
          message={err.message}
          onExpire={() => removeError(err.id)}
        />
      ))}
    </div>
  );
}