import { Router } from "express";
import { z } from "zod";
import { createTheHiveCase, getTheHiveCase, listTheHiveCases, updateTheHiveCase } from "../services/theHiveService.js";

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

theHiveRouter.patch("/cases/:id", async (req, res, next) => {
  try {
    const payload = updateSchema.parse(req.body);
    res.json(await updateTheHiveCase(req.params.id, payload));
  } catch (error) {
    next(error);
  }
});
