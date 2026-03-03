/**
 * Error Boundary - Catches and handles React component errors
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { captureException } from "@/lib/sentry";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string;
  /** When this value changes, the error state is automatically cleared. */
  resetKey?: string | number | null | undefined;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      this.props.resetKey !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, error: null });
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, name } = this.props;
    console.error(
      `[ErrorBoundary${name ? ` ${name}` : ""}] Caught error:`,
      error,
      errorInfo
    );
    captureException(error, {
      componentStack: errorInfo.componentStack,
      boundary: name ?? "unnamed",
    });
    track("error_boundary_caught", {
      error_message: error.message,
      boundary: name ?? "unnamed",
    });
    if (onError) onError(error, errorInfo);
  }

  private readonly handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return typeof fallback === "function"
          ? fallback(error, this.handleReset)
          : fallback;
      }
      return (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-4">
          <h3 className="mb-2 font-semibold text-destructive">
            Something went wrong
          </h3>
          <details className="text-destructive/80 text-sm">
            <summary>Error details</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-destructive/5 p-2 text-xs">
              {error.toString()}
            </pre>
          </details>
        </div>
      );
    }
    return children;
  }
}

interface SimpleErrorBoundaryProps {
  children: ReactNode;
  /** When this value changes, the error state is automatically cleared. */
  resetKey?: string | number | null;
}

export function SimpleErrorBoundary({
  children,
  resetKey,
}: SimpleErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(_, reset) => (
        <div className="flex items-center gap-2 rounded border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm">
          <span className="flex-1">Failed to render content</span>
          <button
            className="rounded bg-destructive/20 px-2 py-0.5 text-xs hover:bg-destructive/30"
            onClick={reset}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
      resetKey={resetKey}
    >
      {children}
    </ErrorBoundary>
  );
}
