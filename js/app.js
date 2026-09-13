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
const looksEmpty = document.querySelector('#looks-empty');

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
    setStatus('● Camera On');

    publishVideoTrueBtn.addEventListener('click', async () => {
      await activePublisher.publishVideo.promise(true);
      publishVideoTrueBtn.style.display = 'none';
      publishVideoFalseBtn.style.display = 'block';
      setStatus('● Camera On');
    });
    publishVideoFalseBtn.addEventListener('click', async () => {
      await activePublisher.publishVideo.promise(false);
      publishVideoFalseBtn.style.display = 'none';
      publishVideoTrueBtn.style.display = 'block';
      setStatus('Camera Off');
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
  looksEmpty?.classList.remove('hidden');
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
    looksEmpty?.classList.add('hidden');

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
    looksEmpty?.classList.add('hidden');
    visualizationState.textContent = 'Suggested look visualization ready.';
  } catch (error) {
    console.error(error);
    visualizationState.textContent = `Visualization failed: ${error.message}`;
  } finally {
    visualizeBtn.disabled = false;
  }
}

function openStyleReport() {
  if (!latestImageData || !latestAnalysis) {
    analysisState.textContent = 'Run a style analysis before opening the report.';
    return;
  }

  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    analysisState.textContent = 'Your browser blocked the report tab. Allow pop-ups for StyleRoom and try again.';
    return;
  }

  const occasion = document.querySelector('#occasion').value;
  const goal = document.querySelector('#goal').value.trim();
  const constraint = document.querySelector('#constraint').value;
  const suggestedImage = visualizationFigure.classList.contains('hidden') ? '' : visualizationImage.src;
  const fields = [
    ['The Look', latestAnalysis.theLook || latestAnalysis.look],
    ['Keep', latestAnalysis.keep],
    ['Change', latestAnalysis.change],
    ['Quick Win', latestAnalysis.quickWin || latestAnalysis.quick_win],
    ['Why', latestAnalysis.why]
  ].filter(([, value]) => value);
  const analysisHtml = fields.length
    ? fields.map(([label, value]) => `<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p></section>`).join('')
    : `<section><p>${escapeHtml(latestAnalysis.analysis || '')}</p></section>`;

  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>StyleRoom AI — Style Report</title>
<style>
  *{box-sizing:border-box}body{margin:0;background:#f7f3ee;color:#17151b;font-family:Inter,Arial,sans-serif}.page{width:min(980px,calc(100% - 28px));margin:28px auto;background:white;border:1px solid #ded8e1;border-radius:22px;padding:36px}.topbar{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:24px}.print-btn{border:0;border-radius:12px;background:#6536b6;color:white;font-weight:800;padding:12px 16px;cursor:pointer}.eyebrow{color:#7350a6;font-size:12px;font-weight:800;letter-spacing:.16em;margin:0 0 8px}.title{font-size:clamp(36px,7vw,64px);line-height:.92;letter-spacing:-.055em;margin:0}.subtitle{color:#625d68;margin:12px 0 0}.rule{height:4px;background:#7350a6;border:0;margin:24px 0}.context{background:#f3eef7;border-left:4px solid #7350a6;border-radius:6px;padding:12px 14px;margin-bottom:20px}.report-grid{display:grid;grid-template-columns:minmax(240px,.78fr) minmax(0,1.22fr);gap:22px;align-items:start}.visuals{display:flex;flex-direction:column;gap:16px}.visuals figure{margin:0}.visuals img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border:1px solid #d8d0dc;border-radius:12px}.visuals figcaption{font-size:12px;font-weight:800;letter-spacing:.04em;margin:0 0 7px;color:#5f5864}.analysis{border:1px solid #d8d0dc;border-radius:14px;padding:22px}.analysis section+section{margin-top:18px}.analysis h2{font-size:18px;margin:0 0 6px;color:#5f3594}.analysis p{font-size:16px;line-height:1.55;margin:0}.footer{border-top:1px solid #d8d0dc;margin-top:22px;padding-top:12px;text-align:center;color:#766f7a;font-size:12px}@media(max-width:720px){.page{padding:22px}.topbar{align-items:flex-start;flex-direction:column}.report-grid{grid-template-columns:1fr}.visuals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){.visuals{grid-template-columns:1fr}}@media print{@page{size:letter;margin:.45in}body{background:white}.page{width:100%;margin:0;border:0;border-radius:0;padding:0}.topbar{display:block}.print-btn{display:none}.title{font-size:38pt}.report-grid{grid-template-columns:1fr}.visuals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.visuals img{height:2.65in;aspect-ratio:auto}.analysis{padding:18px}.analysis h2{font-size:13pt}.analysis p{font-size:10.7pt;line-height:1.46}.footer{font-size:8pt}}
</style>
</head>
<body>
<main class="page">
  <div class="topbar"><div><p class="eyebrow">PERSONAL AI STYLE REPORT</p><h1 class="title">StyleRoom AI</h1><p class="subtitle">Powered by Gemini + Vonage Video API</p></div><button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button></div>
  <hr class="rule">
  <div class="context"><strong>${escapeHtml(occasion)}</strong> • ${escapeHtml(goal || 'No style goal entered')} • ${escapeHtml(constraint)}</div>
  <div class="report-grid">
    <div class="visuals">
      <figure><figcaption>Current Look</figcaption><img src="${latestImageData}" alt="Current look"></figure>
      ${suggestedImage ? `<figure><figcaption>AI Suggested Look</figcaption><img src="${suggestedImage}" alt="AI suggested look"></figure>` : ''}
    </div>
    <div class="analysis">${analysisHtml}</div>
  </div>
  <div class="footer">StyleRoom AI • AI-assisted styling guidance • Hackathon MVP</div>
</main>
</body>
</html>`);
  reportWindow.document.close();
  reportWindow.opener = null;
}

analyzeBtn.addEventListener('click', analyzeCurrentLook);
visualizeBtn.addEventListener('click', visualizeSuggestedLook);
printReportBtn.addEventListener('click', openStyleReport);

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
