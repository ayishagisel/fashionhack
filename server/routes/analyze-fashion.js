import express from 'express';

const router = express.Router();

router.post('/analyze-fashion', async (req, res) => {
  try {
    const { image, occasion = 'Everyday', goal = 'polished and confident', constraint = 'None' } = req.body || {};
    if (!image) return res.status(400).json({ error: 'A camera image is required.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });

    const rawImage = String(image).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const prompt = `You are StyleRoom AI, a warm, experienced fashion stylist helping someone during a live styling session. Analyze ONLY visible clothing, footwear and accessories. Never infer or discuss body, weight, age, ethnicity, gender, attractiveness, health or socioeconomic status. If no outfit is visible, say so. If uncertain, say what you can and cannot see.\n\nContext:\nOccasion: ${occasion}\nStyle goal: ${goal}\nConstraint: ${constraint}\n\nReturn ONLY valid JSON with exactly these string keys: theLook, keep, change, quickWin, why. Keep the entire response concise enough to discuss live.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: rawImage } }
        ] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.5 }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error('Gemini error:', payload);
      return res.status(response.status).json({ error: payload?.error?.message || 'Gemini request failed.' });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'Gemini returned no analysis.' });

    let result;
    try { result = JSON.parse(text); }
    catch { return res.status(502).json({ error: 'Gemini returned an unexpected response.', raw: text }); }

    res.json({
      theLook: result.theLook || '',
      keep: result.keep || '',
      change: result.change || '',
      quickWin: result.quickWin || '',
      why: result.why || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fashion analysis failed.' });
  }
});

export default router;
