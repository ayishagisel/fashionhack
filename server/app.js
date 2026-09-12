import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeFashion from './routes/analyze-fashion.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Vonage camera snapshots can be large base64 payloads.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'StyleRoom AI' }));
app.use('/', analyzeFashion);

app.listen(port, () => console.log(`StyleRoom AI server listening on ${port}`));
