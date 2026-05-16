# SOC AI Analysis Panel

Modern dark-theme SOC dashboard for collecting events from Shuffle, TheHive, Wazuh/SIEM or manual input, sending them to the existing Colab/ngrok FastAPI AI endpoint, and preserving the full analysis history in PostgreSQL.

## Stack

- Frontend: React + TypeScript + Vite + TailwindCSS
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- AI endpoint: `POST ${MODEL_API_URL}/analyze`

## Environment

Copy the backend example env:

```bash
cp backend/.env.example backend/.env
```

Required values:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/soc_ai_panel?schema=public"
MODEL_API_URL="https://your-ngrok-url.ngrok-free.app"
PORT=4000
FRONTEND_ORIGIN="http://localhost:5173"
```

The model URL can also be changed later from the Settings page. The backend stores the UI-updated URL in the `integrations` table and falls back to `MODEL_API_URL` when no saved setting exists.

## Install

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

## AI Contract

The backend calls your existing Colab/ngrok FastAPI service:

```http
POST ${MODEL_API_URL}/analyze
Content-Type: application/json

{
  "event_data": "log or alert content"
}
```

Expected response:

```json
{
  "analysis_summary": "LLM generated analysis"
}
```

If the model returns structured JSON inside `analysis_summary`, the backend extracts fields such as risk level, MITRE mapping, IOCs, recommended actions, containment, investigation and prevention steps. If it returns plain text, the raw response is stored as `raw_analysis` and the UI still displays it in readable analysis and recommendations cards.

## Post-Analysis Automation

After an analysis is completed, the backend can trigger Shuffle and create a TheHive case based on the model risk level. By default, automation only runs for `MEDIUM`, `HIGH` and `CRITICAL` results.

Configure `backend/.env`:

```env
AUTOMATION_ENABLED=true
AUTOMATION_MIN_SEVERITY="MEDIUM"

SHUFFLE_AUTOMATION_WEBHOOK_URL="http://100.77.24.25:3001/api/v1/hooks/YOUR_SHUFFLE_WEBHOOK"

THEHIVE_API_URL="http://100.77.24.25:9000"
THEHIVE_API_KEY="YOUR_THEHIVE_API_KEY"
THEHIVE_CASE_ENDPOINT="/api/v1/case"
THEHIVE_ASSIGNEE_CRITICAL="critical.responder"
THEHIVE_ASSIGNEE_HIGH="tier2.analyst"
THEHIVE_ASSIGNEE_MEDIUM="tier1.analyst"
THEHIVE_ASSIGNEE_DEFAULT="soc.queue"
```

Manual setup needed:

- In Shuffle, create a workflow with a Webhook trigger. Copy the full webhook URL into `SHUFFLE_AUTOMATION_WEBHOOK_URL`.
- In TheHive, create or copy an API key for a user that can create cases. Put it in `THEHIVE_API_KEY`.
- If your TheHive version uses the older case path, change `THEHIVE_CASE_ENDPOINT` to `/api/case`.
- Restart the backend after changing `.env`.

## Native TheHive Cases UI

The app can render TheHive cases inside its own UI instead of embedding TheHive in an iframe.

- Frontend page: `/thehive/cases`
- Backend proxy: `/api/thehive/cases`
- Required env values: `THEHIVE_API_URL` and `THEHIVE_API_KEY`

The backend keeps the TheHive API key server-side and exposes a small case-management API to the frontend:

```http
GET    /api/thehive/cases
POST   /api/thehive/cases
GET    /api/thehive/cases/:id
PATCH  /api/thehive/cases/:id
```

If case listing fails because your TheHive version uses a different search endpoint, set:

```env
THEHIVE_CASE_SEARCH_ENDPOINT="/api/case/_search"
THEHIVE_AUTH_HEADER="Authorization"
THEHIVE_AUTH_SCHEME="Bearer"
```

## Main API Endpoints

```http
GET    /api/dashboard/stats
GET    /api/events
GET    /api/events/:id
POST   /api/events
POST   /api/events/:id/analyze
GET    /api/analyses
GET    /api/analyses/:id
POST   /api/analyses/manual
POST   /api/analyses/:id/reanalyze
POST   /api/analyses/:id/archive
PATCH  /api/analyses/:id/recommendations/:recommendationId
DELETE /api/analyses/:id
GET    /api/integrations
PUT    /api/settings/model-endpoint
GET    /api/settings/model-endpoint
POST   /webhooks/shuffle
POST   /webhooks/thehive
GET    /api/health/model
```

## Webhook Examples

Shuffle:

```bash
curl -X POST http://localhost:4000/webhooks/shuffle \
  -H "Content-Type: application/json" \
  -d '{"title":"Suspicious PowerShell","severity":"high","workflow":"EDR triage","event_data":"powershell encoded command detected","auto_analyze":true}'
```

TheHive:

```bash
curl -X POST http://localhost:4000/webhooks/thehive \
  -H "Content-Type: application/json" \
  -d '{"caseId":"CASE-42","title":"Phishing investigation","description":"User reported suspicious mail","severity":3,"tags":["phishing"],"observables":[{"type":"domain","data":"example.com"}]}'
```

## Pages

- `/dashboard`
- `/events`
- `/events/:id`
- `/analyze`
- `/history`
- `/integrations`
- `/settings`

## Database

Prisma models cover:

- `users`
- `sources`
- `events`
- `analyses`
- `integrations`

Run Prisma Studio if needed:

```bash
npx prisma studio --schema backend/prisma/schema.prisma
```
