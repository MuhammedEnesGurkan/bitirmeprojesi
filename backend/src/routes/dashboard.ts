import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", async (_req, res, next) => {
  try {
    const [
      totalAnalyses,
      eventsBySeverity,
      eventsByStatus,
      latestEvents,
      latestAnalyses,
      sources,
      latency
    ] = await Promise.all([
      prisma.analysis.count(),
      prisma.event.groupBy({ by: ["severity"], _count: true }),
      prisma.event.groupBy({ by: ["status"], _count: true }),
      prisma.event.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { source: true, analyses: { orderBy: { createdAt: "desc" }, take: 1 } }
      }),
      prisma.analysis.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { event: { include: { source: true } } }
      }),
      prisma.source.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.analysis.aggregate({ _avg: { latencyMs: true } })
    ]);

    const severityCounts = Object.fromEntries(eventsBySeverity.map((row) => [row.severity, row._count]));
    const statusCounts = Object.fromEntries(eventsByStatus.map((row) => [row.status, row._count]));

    res.json({
      totalAnalyses,
      severityCounts,
      statusCounts,
      latestEvents,
      latestAnalyses,
      sources,
      averageLatencyMs: Math.round(latency._avg.latencyMs ?? 0)
    });
  } catch (error) {
    next(error);
  }
});
