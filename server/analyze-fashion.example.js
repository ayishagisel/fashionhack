/*
 * Drop-in Express route for the Vonage Node learning server.
 * Requires Node 18+ (global fetch) and GEMINI_API_KEY in the server environment.
 * Mount with: app.use(require('./routes/analyze-fashion'))
 * If your server uses a routes folder, this file can be copied there as analyze-fashion.js.
 */
const express = require('express');
const router = express.Router();

router.post('/analyze-fashion', async (req, res) => {
  try {
    const { image, occasion, goal, constraint } = req.body || {};
    if (!image) return res.status(400).json({ error: 'No image supplied.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
    const prompt = `You are a warm, experienced personal stylist conducting a quick live consultation.
Comment ONLY on visible clothing, accessories, colors, fabrics, silhouettes, and styling. Never comment on or infer body type, weight, age, ethnicity, gender, attractiveness, income, health, or other personal traits. If no outfit is visible, say so. Do not invent details.

Occasion: ${occasion || 'not specified'}
Desired style goal: ${goal || 'not specified'}
Constraint: ${constraint || 'use what is visible / keep suggestions practical'}

Return ONLY valid JSON with exactly these string keys:
{"theLook":"brief specific read of the visible outfit","keep":"what is already working for the goal","change":"one useful adjustment","quickWin":"one immediate actionable styling move","why":"why these recommendations fit the occasion and goal"}
Keep the entire response concise and constructive.`;

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } }
        ] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
      })
    });

    const payload = await geminiResponse.json();
    if (!geminiResponse.ok) return res.status(geminiResponse.status).json({ error: payload?.error?.message || 'Gemini request failed.' });

    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'Gemini returned no analysis.' });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Fashion analysis error:', error);
    res.status(500).json({ error: 'Fashion analysis failed.' });
  }
});

module.exports = router;
