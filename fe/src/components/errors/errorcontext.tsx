import { createContext, useState, type ReactNode, useCallback } from "react";

type ErrorItem = { id: string; message: string };

type ErrorContextType = {
  errors: ErrorItem[];
  addError: (message: string) => void;
  removeError: (id: string) => void;
};

export const ErrorContext = createContext<ErrorContextType>({
  errors: [],
  addError: () => {},
  removeError: () => {},
});

export const ErrorContextProvider = (props: { children: ReactNode }) => {
  const [errors, setErrors] = useState<ErrorItem[]>([]);

  const addError = useCallback((errorMsg: string) => {
    const id = crypto.randomUUID(); 
    setErrors((prev) => {
      const updated = [...prev, { id, message: errorMsg }];
      return updated.length > 5 ? updated.slice(1) : updated;
    });
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <ErrorContext.Provider value={{ errors, addError, removeError }}>
      {props.children}
    </ErrorContext.Provider>
  );
};