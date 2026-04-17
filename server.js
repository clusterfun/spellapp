import express from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY;

// Logging startup info
console.log(`Starting server on port ${PORT}...`);
if (!API_KEY) {
  console.warn('WARNING: API_KEY is not set. API endpoints will return 500.');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint - MUST return 200 for Cloud Run to succeed
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint to list available Gemini models
app.get('/api/models', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'API_KEY not configured on server' });
  }

  try {
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`);
    res.json(response.data);
  } catch (error) {
    console.error('Models API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch models' });
  }
});

// Endpoint to extract text from an image
app.post('/api/extract/:model', async (req, res) => {
  const { model } = req.params;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API_KEY not configured on server' });
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_KEY}`,
      req.body,
      { headers: { 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Extract API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Extraction failed' });
  }
});

// Serve static React files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback to index.html for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start listening - using 0.0.0.0 is mandatory for Cloud Run
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server successfully started and listening on 0.0.0.0:${PORT}`);
});
