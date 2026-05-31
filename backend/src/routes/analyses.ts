import { AnalysisStatus, EventStatus, Prisma, SourceStatus, SourceType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/httpError.js";
import { prisma } from "../lib/prisma.js";
import { normalizeSeverity } from "../lib/normalizers.js";
import { createCompletedAnalysis } from "../services/modelService.js";
import { getModelEndpoint } from "../services/settingsService.js";

export const analysesRouter = Router();

const manualSchema = z.object({
  event_data: z.string().min(1),
  title: z.string().optional(),
  source: z.string().optional(),
  severity: z.unknown().optional(),
  user_id: z.string().optional()
});

analysesRouter.get("/", async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where: Record<string, unknown> = {};

    if (status) where.status = String(status).toUpperCase();
    if (search) {
      where.OR = [
        { inputText: { contains: String(search), mode: "insensitive" } },
        { analysisSummary: { contains: String(search), mode: "insensitive" } },
        { attackType: { contains: String(search), mode: "insensitive" } }
      ];
    }

    const analyses = await prisma.analysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { event: { include: { source: true } }, user: true }
    });

    res.json(analyses);
  } catch (error) {
    next(error);
  }
});

analysesRouter.get("/:id", async (req, res, next) => {
  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id: req.params.id },
      include: { event: { include: { source: true } }, user: true }
    });

    if (!analysis) throw new HttpError(404, "Analysis not found");
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

analysesRouter.post("/manual", async (req, res, next) => {
  try {
    const payload = manualSchema.parse(req.body);
    const source = await prisma.source.upsert({
      where: { name_type: { name: payload.source ?? "Manual", type: SourceType.MANUAL } },
      update: { status: SourceStatus.ONLINE },
      create: { name: payload.source ?? "Manual", type: SourceType.MANUAL, status: SourceStatus.ONLINE }
    });

    const event = await prisma.event.create({
      data: {
        sourceId: source.id,
        title: payload.title ?? "Manual AI analysis",
        rawEvent: { message: payload.event_data },
        severity: normalizeSeverity(payload.severity),
        status: EventStatus.ANALYZING,
        tags: ["manual"]
      }
    });

    try {
      const analysis = await createCompletedAnalysis({
        eventId: event.id,
        userId: payload.user_id ?? null,
        inputText: payload.event_data,
        sourceSeverity: event.severity
      });
      await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.ANALYZED } });
      res.status(201).json(analysis);
    } catch (error) {
      await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.FAILED } });
      const failed = await prisma.analysis.create({
        data: {
          eventId: event.id,
          inputText: payload.event_data,
          modelEndpoint: await getModelEndpoint(),
          status: AnalysisStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Model analysis failed"
        },
        include: { event: { include: { source: true } }, user: true }
      });
      res.status(201).json(failed);
    }
  } catch (error) {
    next(error);
  }
});

analysesRouter.post("/:id/reanalyze", async (req, res, next) => {
  try {
    const original = await prisma.analysis.findUnique({ where: { id: req.params.id } });
    if (!original) throw new HttpError(404, "Analysis not found");

    const analysis = await createCompletedAnalysis({
      eventId: original.eventId,
      userId: req.body?.user_id ?? original.userId,
      inputText: req.body?.input_text ? String(req.body.input_text) : original.inputText,
      sourceSeverity: original.riskLevel ?? undefined
    });

    if (analysis.eventId) {
      await prisma.event.update({ where: { id: analysis.eventId }, data: { status: EventStatus.ANALYZED } });
    }

    res.status(201).json(analysis);
  } catch (error) {
    next(error);
  }
});

analysesRouter.post("/:id/archive", async (req, res, next) => {
  try {
    const analysis = await prisma.analysis.update({
      where: { id: req.params.id },
      data: { status: AnalysisStatus.ARCHIVED }
    });
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

analysesRouter.patch("/:id/recommendations/:recommendationId", async (req, res, next) => {
  try {
    const analysis = await prisma.analysis.findUnique({ where: { id: req.params.id } });
    if (!analysis) throw new HttpError(404, "Analysis not found");

    const current = Array.isArray(analysis.recommendationsJson)
      ? analysis.recommendationsJson as Array<Record<string, unknown>>
      : [];
    const updated = current.map((item) =>
      item.id === req.params.recommendationId
        ? { ...item, done: Boolean(req.body?.done) }
        : item
    );

    const saved = await prisma.analysis.update({
      where: { id: req.params.id },
      data: { recommendationsJson: updated as Prisma.InputJsonValue },
      include: { event: { include: { source: true } }, user: true }
    });
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

analysesRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.analysis.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
