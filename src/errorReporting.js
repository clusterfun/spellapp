import StackdriverErrorReporter from 'stackdriver-errors-js';

const projectId = import.meta.env.VITE_PROJECT_ID;
const apiKey = import.meta.env.VITE_API_KEY;

let errorHandler;

// Only initialize in production or if we have the required keys
if (import.meta.env.PROD && projectId && apiKey) {
  errorHandler = new StackdriverErrorReporter();
  errorHandler.start({
    key: apiKey,
    projectId: projectId,
    service: 'spelling-app',
    version: '1.0.0'
  });
} else {
  // Mock during development
  errorHandler = {
    report: (err) => console.error('[Error Reporting Mock]:', err),
  };
}

export default errorHandler;
