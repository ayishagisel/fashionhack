/* global OT SAMPLE_SERVER_BASE_URL APPLICATION_ID SESSION_ID TOKEN GEMINI_ANALYZE_PATH */

let applicationId = APPLICATION_ID;
let sessionId = SESSION_ID;
let token = TOKEN;
let activePublisher = null;
let activeSession = null;
let remoteStreamCount = 0;
let latestAnalysis = null;
let latestImageData = null;

const statusEl = document.querySelector('#connection-status');
const analyzeBtn = document.querySelector('#analyze-look');
const analysisState = document.querySelector('#analysis-state');
const analysisResult = document.querySelector('#analysis-result');
const reportActions = document.querySelector('#report-actions');
const reportContext = document.querySelector('#report-context');
const reportVisuals = document.querySelector('#report-visuals');
const reportSnapshot = document.querySelector('#report-snapshot');
const visualizationFigure = document.querySelector('#visualization-figure');
const visualizationImage = document.querySelector('#visualization-image');
const visualizationState = document.querySelector('#visualization-state');
const visualizeBtn = document.querySelector('#visualize-look');
const printReportBtn = document.querySelector('#print-report');
const publishVideoTrueBtn = document.querySelector('#publish-video-true');
const publishVideoFalseBtn = document.querySelector('#publish-video-false');
const videosEl = document.querySelector('#videos');
const captureCountdownEl = document.querySelector('#capture-countdown');
const countdownNumberEl = document.querySelector('#countdown-number');

function setStatus(text) { statusEl.textContent = text; }

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '\"': '&quot;'
  }[char]));
}

function renderAnalysis(data) {
  latestAnalysis = data;
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
  reportActions.classList.remove('hidden');
  analysisState.textContent = 'Style analysis complete.';
}

function broadcastAnalysis(data) {
  if (!activeSession) return;
  activeSession.signal({ type: 'style-analysis', data: JSON.stringify(data) }, (error) => {
    if (error) console.warn('Analysis signal not sent:', error);
  });
}

function updateVideoLayout() {
  videosEl.classList.toggle('has-subscriber', remoteStreamCount > 0);
}

async function initializeSession() {
  activeSession = OT.initSession(applicationId, sessionId);

  activeSession.on('streamCreated', async (event) => {
    try {
      remoteStreamCount += 1;
      updateVideoLayout();
      await activeSession.subscribe.promise(event.stream, 'subscriber', {
        insertMode: 'append', width: '100%', height: '100%'
      });
    } catch (error) {
      remoteStreamCount = Math.max(0, remoteStreamCount - 1);
      updateVideoLayout();
      console.error(error);
    }
  });

  activeSession.on('streamDestroyed', () => {
    remoteStreamCount = Math.max(0, remoteStreamCount - 1);
    updateVideoLayout();
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

async function captureCountdown(seconds = 5) {
  captureCountdownEl.classList.remove('hidden');
  try {
    for (let remaining = seconds; remaining > 0; remaining -= 1) {
      countdownNumberEl.textContent = remaining;
      analysisState.textContent = `📸 Get into position — capturing in ${remaining}…`;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    countdownNumberEl.textContent = '📸';
    analysisState.textContent = '📸 Capturing now…';
    await new Promise((resolve) => setTimeout(resolve, 300));
  } finally {
    captureCountdownEl.classList.add('hidden');
  }
}

async function analyzeCurrentLook() {
  if (!activePublisher) {
    analysisState.textContent = 'Camera is not ready yet.';
    return;
  }

  analyzeBtn.disabled = true;
  analysisResult.classList.add('hidden');
  reportActions.classList.add('hidden');
  reportContext.classList.add('hidden');
  reportVisuals.classList.add('hidden');
  visualizationFigure.classList.add('hidden');
  visualizationState.classList.add('hidden');
  latestAnalysis = null;
  analysisState.textContent = 'Get ready for your photo…';

  try {
    await captureCountdown(5);

    const imageData = activePublisher.getImgData();
    latestImageData = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
    const occasion = document.querySelector('#occasion').value;
    const goal = document.querySelector('#goal').value.trim();
    const constraint = document.querySelector('#constraint').value;

    reportSnapshot.src = latestImageData;
    reportContext.textContent = `${occasion} • ${goal || 'No style goal entered'} • ${constraint}`;
    reportContext.classList.remove('hidden');
    reportVisuals.classList.remove('hidden');

    analysisState.textContent = 'Gemini is styling your look…';
    const endpoint = SAMPLE_SERVER_BASE_URL.replace(/\/$/, '') + GEMINI_ANALYZE_PATH;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, occasion, goal, constraint })
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Analysis request failed (${response.status})`);
    }

    const data = await response.json();
    renderAnalysis(data);
    broadcastAnalysis(data);
  } catch (error) {
    console.error(error);
    analysisState.textContent = `Style analysis failed: ${error.message}`;
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function visualizeSuggestedLook() {
  if (!latestImageData || !latestAnalysis) {
    visualizationState.textContent = 'Run a style analysis first.';
    visualizationState.classList.remove('hidden');
    return;
  }

  visualizeBtn.disabled = true;
  visualizationState.textContent = 'Creating a photorealistic suggested look…';
  visualizationState.classList.remove('hidden');

  try {
    const occasion = document.querySelector('#occasion').value;
    const goal = document.querySelector('#goal').value.trim();
    const constraint = document.querySelector('#constraint').value;
    const endpoint = SAMPLE_SERVER_BASE_URL.replace(/\/$/, '') + '/visualize-fashion';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: latestImageData,
        analysis: latestAnalysis,
        occasion,
        goal,
        constraint
      })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Visualization request failed (${response.status})`);
    }

    const data = await response.json();
    visualizationImage.src = data.image;
    visualizationFigure.classList.remove('hidden');
    reportVisuals.classList.remove('hidden');
    visualizationState.textContent = 'Suggested look visualization ready.';
  } catch (error) {
    console.error(error);
    visualizationState.textContent = `Visualization failed: ${error.message}`;
  } finally {
    visualizeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener('click', analyzeCurrentLook);
visualizeBtn.addEventListener('click', visualizeSuggestedLook);
printReportBtn.addEventListener('click', () => window.print());

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
