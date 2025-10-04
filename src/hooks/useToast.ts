import { useCallback } from "react";

export interface ToastOptions {
  title: string;
  message?: string;
  duration?: number;
}

export function useToast() {
  const showToast = useCallback((options: ToastOptions) => {
    console.log("Toast:", options);
    // TODO: Implement toast functionality with Redux
  }, []);

  const showSuccessToast = useCallback((message: string) => {
    showToast({ title: "Success", message, duration: 3000 });
  }, [showToast]);

  const showErrorToast = useCallback((message: string) => {
    showToast({ title: "Error", message, duration: 5000 });
  }, [showToast]);

  return {
    showToast,
    showSuccessToast,
    showErrorToast,
  };
}

