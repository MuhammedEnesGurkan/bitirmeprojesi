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
