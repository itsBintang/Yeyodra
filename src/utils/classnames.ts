import classNames from "classnames";

// Re-export classnames for convenience
export { classNames };

// Helper for conditional classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classNames(...classes);
}






