import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalizeSourceType } from "../lib/normalizers.js";

export const integrationsRouter = Router();

const integrationSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  config_json: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional()
});

integrationsRouter.get("/", async (_req, res, next) => {
  try {
    const [integrations, sources] = await Promise.all([
      prisma.integration.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.source.findMany({ orderBy: { createdAt: "asc" } })
    ]);

    res.json({ integrations, sources });
  } catch (error) {
    next(error);
  }
});

integrationsRouter.post("/", async (req, res, next) => {
  try {
    const payload = integrationSchema.parse(req.body);
    const type = normalizeSourceType(payload.type);
    const integration = await prisma.integration.upsert({
      where: { name_type: { name: payload.name, type } },
      update: {
        configJson: (payload.config_json ?? {}) as Prisma.InputJsonValue,
        enabled: payload.enabled ?? true
      },
      create: {
        name: payload.name,
        type,
        configJson: (payload.config_json ?? {}) as Prisma.InputJsonValue,
        enabled: payload.enabled ?? true
      }
    });

    res.status(201).json(integration);
  } catch (error) {
    next(error);
  }
});
