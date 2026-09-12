#!/usr/bin/env bash
set -euo pipefail

mkdir -p routes
curl -fsSL https://raw.githubusercontent.com/ayishagisel/fashionhack/main/server/routes/analyze-fashion.js -o routes/analyze-fashion.js

python - <<'PY'
from pathlib import Path
p = Path('app.js')
s = p.read_text()
if "./routes/analyze-fashion.js" not in s:
    anchor = "import cors from 'cors';"
    s = s.replace(anchor, anchor + "\nimport analyzeFashion from './routes/analyze-fashion.js';")
s = s.replace("app.use(bodyParser.json());", "app.use(bodyParser.json({ limit: '10mb' }));")
if "app.use('/', analyzeFashion);" not in s:
    anchor = "app.use('/', index);"
    s = s.replace(anchor, anchor + "\napp.use('/', analyzeFashion);")
p.write_text(s)
PY

echo "StyleRoom AI Gemini route installed into the Vonage sample server."
echo "Next: add GEMINI_API_KEY to .env and restart npm start."
