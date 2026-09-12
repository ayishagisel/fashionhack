/* global OT SAMPLE_SERVER_BASE_URL APPLICATION_ID SESSION_ID TOKEN GEMINI_ANALYZE_PATH */

let applicationId = APPLICATION_ID;
let sessionId = SESSION_ID;
let token = TOKEN;
let activePublisher = null;
let activeSession = null;

const statusEl = document.querySelector('#connection-status');
const analyzeBtn = document.querySelector('#analyze-look');
const analysisState = document.querySelector('#analysis-state');
const analysisResult = document.querySelector('#analysis-result');
const publishVideoTrueBtn = document.querySelector('#publish-video-true');
const publishVideoFalseBtn = document.querySelector('#publish-video-false');

function setStatus(text) { statusEl.textContent = text; }

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

function renderAnalysis(data) {
  const fields = [
    ['The Look', data.theLook || data.look],
    ['Keep', data.keep],
    ['Change', data.change],
    ['Quick Win', data.quickWin || data.quick_win],
    ['Why', data.why]
  ].filter(([, value]) => value);

  if (!fields.length && data.analysis) {
    analysisResult.innerHTML = `<p>${escapeHtml(data.analysis)}</p>`;
  } else {
    analysisResult.innerHTML = fields.map(([label, value]) =>
      `<h3>${label}</h3><p>${escapeHtml(value)}</p>`
    ).join('');
  }
  analysisResult.classList.remove('hidden');
  analysisState.textContent = 'Style analysis complete.';
}

function broadcastAnalysis(data) {
  if (!activeSession) return;
  activeSession.signal({ type: 'style-analysis', data: JSON.stringify(data) }, (error) => {
    if (error) console.warn('Analysis signal not sent:', error);
  });
}

async function initializeSession() {
  activeSession = OT.initSession(applicationId, sessionId);

  activeSession.on('streamCreated', async (event) => {
    try {
      await activeSession.subscribe.promise(event.stream, 'subscriber', {
        insertMode: 'append', width: '100%', height: '100%'
      });
    } catch (error) { console.error(error); }
  });

  activeSession.on('signal:style-analysis', (event) => {
    try { renderAnalysis(JSON.parse(event.data)); } catch (error) { console.warn(error); }
  });

  activeSession.on('sessionDisconnected', () => setStatus('Disconnected'));

  try {
    activePublisher = await OT.initPublisher.promise('publisher', {
      insertMode: 'append', width: '100%', height: '100%', resolution: '1280x720'
    });
    await activeSession.connect.promise(token);
    await activeSession.publish.promise(activePublisher);
    setStatus('● Live room connected');

    publishVideoTrueBtn.addEventListener('click', async () => {
      await activePublisher.publishVideo.promise(true);
      publishVideoTrueBtn.style.display = 'none';
      publishVideoFalseBtn.style.display = 'block';
    });
    publishVideoFalseBtn.addEventListener('click', async () => {
      await activePublisher.publishVideo.promise(false);
      publishVideoFalseBtn.style.display = 'none';
      publishVideoTrueBtn.style.display = 'block';
    });
  } catch (error) {
    console.error(error);
    setStatus('Connection failed');
    analysisState.textContent = 'Could not connect to the live room. Check your Vonage server URL.';
  }
}

async function analyzeCurrentLook() {
  if (!activePublisher) {
    analysisState.textContent = 'Camera is not ready yet.';
    return;
  }

  analyzeBtn.disabled = true;
  analysisResult.classList.add('hidden');
  analysisState.textContent = 'Capturing your live look…';

  try {
    const imageData = activePublisher.getImgData();
    const occasion = document.querySelector('#occasion').value;
    const goal = document.querySelector('#goal').value.trim();
    const constraint = document.querySelector('#constraint').value;

    analysisState.textContent = 'Gemini is styling your look…';
    const endpoint = SAMPLE_SERVER_BASE_URL.replace(/\/$/, '') + GEMINI_ANALYZE_PATH;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, occasion, goal, constraint })
    });
    if (!response.ok) throw new Error(`Analysis request failed (${response.status})`);

    const data = await response.json();
    renderAnalysis(data);
    broadcastAnalysis(data);
  } catch (error) {
    console.error(error);
    analysisState.textContent = 'Analysis is not connected yet. The live room can still be demoed; connect the server-side Gemini endpoint to finish the AI loop.';
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener('click', analyzeCurrentLook);

if (applicationId && token && sessionId) {
  initializeSession();
} else if (SAMPLE_SERVER_BASE_URL && !SAMPLE_SERVER_BASE_URL.includes('PASTE_YOUR')) {
  fetch(SAMPLE_SERVER_BASE_URL.replace(/\/$/, '') + '/session')
    .then((response) => response.json())
    .then((json) => {
      applicationId = json.applicationId;
      sessionId = json.sessionId;
      token = json.token;
      initializeSession();
    })
    .catch((error) => {
      console.error(error);
      setStatus('Server URL needed');
      analysisState.textContent = 'Paste your existing Vonage sample server URL into js/config.js.';
    });
} else {
  setStatus('Server URL needed');
  analysisState.textContent = 'Paste your existing Vonage sample server URL into js/config.js.';
}
