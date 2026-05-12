import { EventStatus, SourceStatus, SourceType } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { eventToText, normalizeSeverity } from "../lib/normalizers.js";
import { createCompletedAnalysis } from "../services/modelService.js";

export const webhooksRouter = Router();

webhooksRouter.post("/shuffle", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const source = await prisma.source.upsert({
      where: { name_type: { name: "Shuffle", type: SourceType.SHUFFLE } },
      update: { status: SourceStatus.ONLINE, baseUrl: body.base_url ?? undefined },
      create: { name: "Shuffle", type: SourceType.SHUFFLE, status: SourceStatus.ONLINE, baseUrl: body.base_url }
    });

    const event = await prisma.event.create({
      data: {
        sourceId: source.id,
        externalId: body.execution_id ?? body.alert_id ?? body.id,
        title: body.title ?? body.name ?? "Shuffle alert",
        rawEvent: body,
        severity: normalizeSeverity(body.severity ?? body.priority),
        status: body.auto_analyze ? EventStatus.ANALYZING : EventStatus.NEW,
        tags: [
          "shuffle",
          body.workflow,
          body.case,
          body.action
        ].filter(Boolean)
      },
      include: { source: true }
    });

    let analysis = null;
    if (body.auto_analyze || req.query.autoAnalyze === "true") {
      analysis = await createCompletedAnalysis({ eventId: event.id, inputText: eventToText(body) });
      await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.ANALYZED } });
    }

    res.status(201).json({ event, analysis });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post("/thehive", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const source = await prisma.source.upsert({
      where: { name_type: { name: "TheHive", type: SourceType.THEHIVE } },
      update: { status: SourceStatus.ONLINE, baseUrl: body.base_url ?? undefined },
      create: { name: "TheHive", type: SourceType.THEHIVE, status: SourceStatus.ONLINE, baseUrl: body.base_url }
    });

    const caseId = body.caseId ?? body.case_id ?? body._id ?? body.id;
    const event = await prisma.event.create({
      data: {
        sourceId: source.id,
        externalId: caseId,
        title: body.title ?? `TheHive case ${caseId ?? ""}`.trim(),
        rawEvent: {
          case_id: caseId,
          title: body.title,
          description: body.description,
          severity: body.severity,
          tags: body.tags ?? [],
          observables: body.observables ?? [],
          case_url: body.case_url ?? body.url,
          original: body
        },
        severity: normalizeSeverity(body.severity),
        status: body.auto_analyze ? EventStatus.ANALYZING : EventStatus.NEW,
        tags: ["thehive", ...(Array.isArray(body.tags) ? body.tags : [])]
      },
      include: { source: true }
    });

    let analysis = null;
    if (body.auto_analyze || req.query.autoAnalyze === "true") {
      analysis = await createCompletedAnalysis({ eventId: event.id, inputText: eventToText(event.rawEvent) });
      await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.ANALYZED } });
    }

    res.status(201).json({ event, analysis });
  } catch (error) {
    next(error);
  }
});
