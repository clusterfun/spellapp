let errorHandler;

// We've removed client-side Stackdriver reporting because it required exposing the API key.
// In a real production app, you would send these to your own /api/log endpoint.
errorHandler = {
  report: (err) => {
    console.error('[App Error]:', err);
    // Optional: fetch('/api/report-error', { method: 'POST', body: JSON.stringify({ error: err.message }) });
  },
};

export default errorHandler;
