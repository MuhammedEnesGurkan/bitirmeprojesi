import { Router } from "express";
import { callModel } from "../services/modelService.js";
import { getModelEndpoint } from "../services/settingsService.js";

export const healthRouter = Router();

healthRouter.get("/model", async (_req, res) => {
  const endpoint = await getModelEndpoint();
  if (!endpoint) {
    res.status(503).json({ status: "offline", endpoint: "", error: "Model endpoint is not configured" });
    return;
  }

  try {
    const result = await callModel("health_check: respond with a short status only");
    res.json({ status: "online", endpoint, latencyMs: result.latencyMs });
  } catch (error) {
    res.status(503).json({
      status: "offline",
      endpoint,
      error: error instanceof Error ? error.message : "Model health check failed"
    });
  }
});
