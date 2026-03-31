import React from 'react';
import errorHandler from './errorReporting';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Manually report the error to Google Cloud
    errorHandler.report(error);
    console.error('Caught error in Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h1>
          <p className="text-gray-600 mb-6">A report has been sent to our team. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
