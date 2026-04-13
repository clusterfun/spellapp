import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image data

// Endpoint to list available Gemini models
app.get('/api/models', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'API_KEY not configured on server' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch available models' });
  }
});

// Endpoint to extract text from an image
app.post('/api/extract/:model', async (req, res) => {
  const { model } = req.params;
  const payload = req.body;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API_KEY not configured on server' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Gemini API Error: ${errorText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error during text extraction:', error);
    res.status(500).json({ error: 'Internal server error during extraction' });
  }
});

// Serve static React files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
