/**
 * GAPAK Global Error Boundary
 * Catches unhandled React runtime errors and provides recovery actions.
 */

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { telemetry } from '../telemetry/telemetry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override props: Props;
  public override state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    telemetry.trackError('React Error Boundary Caught Failure', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] p-6 flex flex-col items-center justify-center text-center bg-surface border border-subtle rounded-[var(--radius-2xl)] m-4">
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-[var(--radius-2xl)] mb-4">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Application Error</h3>
          <p className="text-xs text-tertiary max-w-md mb-4 font-mono bg-app p-3 rounded-[var(--radius-lg)] border border-subtle text-left overflow-x-auto">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[var(--radius-lg)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset View State</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
