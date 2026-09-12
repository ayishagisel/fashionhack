/* StyleRoom AI configuration
 * Keep credentials OUT of this public repository.
 * Point SAMPLE_SERVER_BASE_URL at the Vonage Node sample server you already have running.
 * The server should expose GET /session returning { applicationId, sessionId, token }.
 */
const SAMPLE_SERVER_BASE_URL = 'PASTE_YOUR_VONAGE_SERVER_URL_HERE';

// Optional direct credentials for disposable/local testing only. Do not commit real values.
const APPLICATION_ID = null;
const SESSION_ID = null;
const TOKEN = null;

// Gemini is intentionally called through a server endpoint so the API key never reaches the browser.
// Fastest integration: add POST /analyze-fashion to the same Node server and leave this as '/analyze-fashion'.
const GEMINI_ANALYZE_PATH = '/analyze-fashion';
