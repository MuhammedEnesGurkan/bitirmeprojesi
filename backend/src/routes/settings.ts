import { Router } from "express";
import { z } from "zod";
import { getModelEndpoint, setModelEndpoint } from "../services/settingsService.js";

export const settingsRouter = Router();

settingsRouter.get("/model-endpoint", async (_req, res, next) => {
  try {
    res.json({ endpoint: await getModelEndpoint() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/model-endpoint", async (req, res, next) => {
  try {
    const payload = z.object({ endpoint: z.string().url() }).parse(req.body);
    const integration = await setModelEndpoint(payload.endpoint);
    res.json(integration);
  } catch (error) {
    next(error);
  }
});
