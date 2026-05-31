import { Router } from "express";
import { z } from "zod";
import { analyzeTheHiveCaseWithAila } from "../services/ailaCaseService.js";
import { addTheHiveCaseComment, closeTheHiveCase, createTheHiveCase, getTheHiveCase, listTheHiveCaseComments, listTheHiveCases, updateTheHiveCase } from "../services/theHiveService.js";

export const theHiveRouter = Router();

const caseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.number().int().min(0).max(4).optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  tlp: z.number().int().min(0).max(4).optional(),
  pap: z.number().int().min(0).max(4).optional()
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  severity: z.number().int().min(0).max(4).optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  assignee: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const closeSchema = z.object({
  summary: z.string().optional(),
  impactStatus: z.string().optional(),
  resolutionStatus: z.string().optional()
});

const commentSchema = z.object({
  message: z.string().min(1)
});

const enrichmentSourceSchema = z.object({
  name: z.string(),
  status: z.enum(["ok", "skipped", "error"]),
  verdict: z.enum(["malicious", "suspicious", "clean", "unknown"]),
  score: z.number(),
  summary: z.string()
});

const ailaAnalysisSchema = z.object({
  enrichment: z.array(z.object({
    type: z.enum(["ip", "domain", "url", "hash", "email"]),
    value: z.string(),
    verdict: z.enum(["malicious", "suspicious", "clean", "unknown"]),
    score: z.number(),
    priority: z.enum(["critical", "high", "medium", "low"]),
    sources: z.array(enrichmentSourceSchema)
  })).optional()
});

theHiveRouter.get("/cases", async (req, res, next) => {
  try {
    res.json(await listTheHiveCases(req.query.search ? String(req.query.search) : ""));
  } catch (error) {
    next(error);
  }
});

theHiveRouter.post("/cases", async (req, res, next) => {
  try {
    const payload = caseSchema.parse(req.body);
    res.status(201).json(await createTheHiveCase(payload));
  } catch (error) {
    next(error);
  }
});

theHiveRouter.get("/cases/:id", async (req, res, next) => {
  try {
    res.json(await getTheHiveCase(req.params.id));
  } catch (error) {
    next(error);
  }
});

theHiveRouter.get("/cases/:id/comments", async (req, res, next) => {
  try {
    res.json(await listTheHiveCaseComments(req.params.id));
  } catch (error) {
    next(error);
  }
});

theHiveRouter.post("/cases/:id/comments", async (req, res, next) => {
  try {
    const payload = commentSchema.parse(req.body);
    res.status(201).json(await addTheHiveCaseComment(req.params.id, payload));
  } catch (error) {
    next(error);
  }
});

theHiveRouter.post("/cases/:id/aila-analysis", async (req, res, next) => {
  try {
    const payload = ailaAnalysisSchema.parse(req.body ?? {});
    res.status(201).json(await analyzeTheHiveCaseWithAila(req.params.id, payload.enrichment));
  } catch (error) {
    next(error);
  }
});

theHiveRouter.patch("/cases/:id", async (req, res, next) => {
  try {
    const payload = updateSchema.parse(req.body);
    res.json(await updateTheHiveCase(req.params.id, payload));
  } catch (error) {
    next(error);
  }
});

theHiveRouter.post("/cases/:id/close", async (req, res, next) => {
  try {
    const payload = closeSchema.parse(req.body ?? {});
    res.json(await closeTheHiveCase(req.params.id, payload));
  } catch (error) {
    next(error);
  }
});
