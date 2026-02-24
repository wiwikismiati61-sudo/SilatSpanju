import express from 'express';
import cors from 'cors';
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const LOCAL_DB_PATH = path.join(process.cwd(), 'data.json');

// Helper to check if KV is configured
const isKvConfigured = () => !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

app.get('/api/data', async (req, res) => {
  try {
    if (isKvConfigured()) {
      const data = await kv.get('absensi_db');
      return res.json(data || {});
    } else {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
        return res.json(JSON.parse(data));
      }
      return res.json({});
    }
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const data = req.body;
    if (isKvConfigured()) {
      await kv.set('absensi_db', data);
    } else {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

export default app;
