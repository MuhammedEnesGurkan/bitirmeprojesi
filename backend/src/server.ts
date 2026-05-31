import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { analysesRouter } from "./routes/analyses.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { eventsRouter } from "./routes/events.js";
import { enrichmentRouter } from "./routes/enrichment.js";
import { healthRouter } from "./routes/health.js";
import { integrationsRouter } from "./routes/integrations.js";
import { settingsRouter } from "./routes/settings.js";
import { theHiveRouter } from "./routes/thehive.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const allowedDevOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|100\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+):5173$/.test(origin);
    callback(null, allowedDevOrigin);
  }
}));
app.use(express.json({ limit: "5mb" }));

app.get("/", (_req, res) => {
  res.json({ name: "SOC AI Analysis API", status: "ok" });
});

app.use("/api/dashboard", dashboardRouter);
app.use("/api/enrichment", enrichmentRouter);
app.use("/api/events", eventsRouter);
app.use("/api/analyses", analysesRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/thehive", theHiveRouter);
app.use("/api/health", healthRouter);
app.use("/webhooks", webhooksRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`SOC AI API listening on http://localhost:${port}`);
});
