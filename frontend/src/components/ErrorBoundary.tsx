import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: any) {
    // Keep a minimal console log for debugging if devtools are available.
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full rounded-md border border-red-200 bg-white p-6 text-center">
            <h1 className="text-xl font-semibold text-red-700">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-600">
              {this.state.message}
            </p>
            <p className="mt-4 text-xs text-gray-500">
              Try refreshing the page. If it keeps happening, tell me the message above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
