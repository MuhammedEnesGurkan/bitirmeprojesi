import { AnalysisStatus, EventStatus, Severity, SourceStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/httpError.js";
import { prisma } from "../lib/prisma.js";
import { eventToText, normalizeSeverity, normalizeSourceType, normalizeStatus } from "../lib/normalizers.js";
import { createCompletedAnalysis } from "../services/modelService.js";
import { getModelEndpoint } from "../services/settingsService.js";

export const eventsRouter = Router();

const createEventSchema = z.object({
  source: z.string().optional(),
  source_id: z.string().optional(),
  external_id: z.string().optional(),
  title: z.string().min(1),
  raw_event: z.unknown(),
  severity: z.unknown().optional(),
  status: z.unknown().optional(),
  tags: z.array(z.string()).optional()
});

eventsRouter.get("/", async (req, res, next) => {
  try {
    const { source, severity, status, search, dateFrom, dateTo } = req.query;
    const where: Record<string, unknown> = {};

    if (severity) where.severity = normalizeSeverity(severity);
    if (status) where.status = normalizeStatus(status);
    if (source) {
      const sourceType = normalizeSourceType(source);
      where.source = { type: sourceType };
    }
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: "insensitive" } },
        { externalId: { contains: String(search), mode: "insensitive" } }
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
        ...(dateTo ? { lte: new Date(String(dateTo)) } : {})
      };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { source: true, analyses: { orderBy: { createdAt: "desc" }, take: 1 } }
    });

    res.json(events);
  } catch (error) {
    next(error);
  }
});

eventsRouter.get("/:id", async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        source: true,
        analyses: { orderBy: { createdAt: "desc" }, include: { user: true } }
      }
    });

    if (!event) throw new HttpError(404, "Event not found");
    res.json(event);
  } catch (error) {
    next(error);
  }
});

eventsRouter.post("/", async (req, res, next) => {
  try {
    const payload = createEventSchema.parse(req.body);
    const sourceType = normalizeSourceType(payload.source);
    const source = payload.source_id
      ? await prisma.source.findUnique({ where: { id: payload.source_id } })
      : await prisma.source.upsert({
          where: { name_type: { name: payload.source ?? "Manual", type: sourceType } },
          update: { status: SourceStatus.ONLINE },
          create: { name: payload.source ?? "Manual", type: sourceType, status: SourceStatus.ONLINE }
        });

    const event = await prisma.event.create({
      data: {
        sourceId: source?.id,
        externalId: payload.external_id,
        title: payload.title,
        rawEvent: payload.raw_event as object,
        severity: normalizeSeverity(payload.severity),
        status: normalizeStatus(payload.status),
        tags: payload.tags ?? []
      },
      include: { source: true }
    });

    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

eventsRouter.post("/:id/analyze", async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new HttpError(404, "Event not found");

    await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.ANALYZING } });
    const inputText = req.body?.input_text ? String(req.body.input_text) : eventToText(event.rawEvent);

    try {
      const analysis = await createCompletedAnalysis({
        eventId: event.id,
        userId: req.body?.user_id ?? null,
        inputText,
        sourceSeverity: event.severity
      });
      await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.ANALYZED } });
      res.status(201).json(analysis);
    } catch (error) {
      await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.FAILED } });
      const failed = await prisma.analysis.create({
        data: {
          eventId: event.id,
          inputText,
          modelEndpoint: await getModelEndpoint(),
          status: AnalysisStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Model analysis failed"
        }
      });
      res.status(201).json(failed);
    }
  } catch (error) {
    next(error);
  }
});
