import express from 'express';

const router = express.Router();

router.post('/analyze-fashion', async (req, res) => {
  try {
    const { image, occasion = 'Everyday', goal = 'polished and confident', constraint = 'None' } = req.body || {};
    if (!image) return res.status(400).json({ error: 'A camera image is required.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });

    const rawImage = String(image).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
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

router.post('/visualize-fashion', async (req, res) => {
  try {
    const { image, analysis = {}, occasion = 'Everyday', goal = '', constraint = '' } = req.body || {};
    if (!image) return res.status(400).json({ error: 'A camera image is required.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });

    const rawImage = String(image).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const prompt = `Create a photorealistic fashion try-on visualization using the provided photo as the reference. Preserve the same person, face, skin tone, hair/headwear, glasses, pose, camera angle and background. Do not alter physical features. Change ONLY visible clothing and accessories needed to demonstrate the styling recommendations. Do not invent unseen parts of the body or outfit outside the original crop. Keep the result believable, wearable, and realistic rather than editorial fantasy.\n\nOccasion: ${occasion}\nStyle goal: ${goal || 'Not specified'}\nConstraint: ${constraint || 'None'}\nKeep: ${analysis.keep || ''}\nChange: ${analysis.change || ''}\nQuick win: ${analysis.quickWin || analysis.quick_win || ''}\n\nProduce a realistic visual preview of the recommended look.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-image',
        input: [
          { type: 'text', text: prompt },
          { type: 'image', mime_type: 'image/png', data: rawImage }
        ],
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '4:3',
          image_size: '1K'
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error('Gemini image error:', payload);
      return res.status(response.status).json({ error: payload?.error?.message || 'Gemini image request failed.' });
    }

    let imagePart = null;
    for (const step of payload?.steps || []) {
      for (const part of step?.content || []) {
        if (part?.type === 'image' && part?.data) imagePart = part;
      }
    }

    if (!imagePart) return res.status(502).json({ error: 'Gemini returned no visualization image.' });
    const mimeType = imagePart.mime_type || 'image/jpeg';
    return res.json({ image: `data:${mimeType};base64,${imagePart.data}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fashion visualization failed.' });
  }
});

export default router;
