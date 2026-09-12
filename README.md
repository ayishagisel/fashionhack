# StyleRoom AI — Fashion Hackathon MVP

**Live fashion decisions, powered by Gemini + Vonage Video API.**

StyleRoom AI turns a live video room into a collaborative AI styling consultation. A participant shows a look on camera, selects the occasion and desired style, and Gemini analyzes a still captured directly from the Vonage publisher. The recommendation can then be signaled to everyone in the room.

## Demo flow

1. Join the Vonage live room.
2. Choose an occasion, style goal, and constraint.
3. Click **Analyze My Look**.
4. The app captures the current Vonage video frame.
5. Gemini returns **The Look / Keep / Change / Quick Win / Why**.
6. The result is displayed and broadcast to the live room.

## Fast setup

### 1. Connect the existing Vonage sample server

Open `js/config.js` and set `SAMPLE_SERVER_BASE_URL` to the HTTPS URL of the Node learning server already running at the hackathon. Do **not** include a trailing slash.

The client expects `GET /session` to return:

```json
{ "applicationId": "...", "sessionId": "...", "token": "..." }
```

Do not commit the Vonage private key, Gemini API key, session token, or other secrets.

### 2. Add Gemini to the Node server

`server/analyze-fashion.example.js` contains a ready-to-use Express route. Copy it into the existing Node learning server (for example as `routes/analyze-fashion.js`) and mount it from `app.js`:

```js
app.use(express.json({ limit: '10mb' }));
app.use(require('./routes/analyze-fashion'));
```

Set this environment variable **on the server**, not in this browser repo:

```bash
GEMINI_API_KEY=your_key_here
```

Optional:

```bash
GEMINI_MODEL=gemini-2.5-flash
```

Restart the Node server after adding the route/environment variable.

### 3. Run this client over HTTPS

Open this repository in StackBlitz, Codespaces, or another HTTPS host. Camera access requires localhost or HTTPS.

## Architecture

`Vonage Video → live frame capture → server → Gemini multimodal analysis → structured fashion recommendation → Vonage signal → shared result`

## Product principle

AI handles the immediate, scalable first styling pass. The live room keeps human taste, judgment, trust, and collaboration in the experience.

> AI doesn't replace the stylist. It gives every stylist a superpower — and gives more people access to one.

## Safety by design

The styling prompt is restricted to visible clothing and styling. It explicitly avoids judgments or inferences about body type, weight, age, ethnicity, gender, attractiveness, income, health, or other personal traits.

## Stretch features

After the core demo works: compare two looks, multilingual live consultations/captions, and a post-session Style Recap.
