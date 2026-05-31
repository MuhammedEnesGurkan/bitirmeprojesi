import { Router } from "express";
import { z } from "zod";
import { addTheHiveCaseComment } from "../services/theHiveService.js";
import { enrichIndicators, enrichmentComment, extractIndicators } from "../services/iocService.js";

export const enrichmentRouter = Router();

const extractSchema = z.object({
  text: z.string().min(1)
});

const indicatorSchema = z.object({
  type: z.enum(["ip", "domain", "url", "hash", "email"]),
  value: z.string().min(1)
});

const enrichSchema = z.object({
  indicators: z.array(indicatorSchema).optional(),
  text: z.string().optional()
});

const commentSchema = z.object({
  caseId: z.string().min(1),
  indicators: z.array(z.object({
    type: z.enum(["ip", "domain", "url", "hash", "email"]),
    value: z.string(),
    verdict: z.enum(["malicious", "suspicious", "clean", "unknown"]),
    score: z.number(),
    priority: z.enum(["critical", "high", "medium", "low"]),
    sources: z.array(z.object({
      name: z.string(),
      status: z.enum(["ok", "skipped", "error"]),
      verdict: z.enum(["malicious", "suspicious", "clean", "unknown"]),
      score: z.number(),
      summary: z.string()
    }))
  }))
});

enrichmentRouter.post("/extract", (req, res, next) => {
  try {
    const payload = extractSchema.parse(req.body);
    res.json({ indicators: extractIndicators(payload.text) });
  } catch (error) {
    next(error);
  }
});

enrichmentRouter.post("/iocs", async (req, res, next) => {
  try {
    const payload = enrichSchema.parse(req.body);
    const indicators = payload.indicators?.length ? payload.indicators : extractIndicators(payload.text ?? "");
    res.json({ indicators: await enrichIndicators(indicators) });
  } catch (error) {
    next(error);
  }
});

enrichmentRouter.post("/thehive-comment", async (req, res, next) => {
  try {
    const payload = commentSchema.parse(req.body);
    res.status(201).json(await addTheHiveCaseComment(payload.caseId, {
      message: enrichmentComment(payload.indicators)
    }));
  } catch (error) {
    next(error);
  }
});
