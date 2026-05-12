import { AnalysisStatus } from "@prisma/client";
import { HttpError } from "../lib/httpError.js";
import { prisma } from "../lib/prisma.js";
import { parseAnalysis } from "./analysisParser.js";
import { getModelEndpoint } from "./settingsService.js";

export async function callModel(inputText: string) {
  const endpoint = await getModelEndpoint();
  if (!endpoint) {
    throw new HttpError(503, "MODEL_API_URL is not configured");
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${endpoint}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_data: inputText }),
      signal: controller.signal
    });

    const body = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, body || `Model request failed with ${response.status}`);
    }

    let summary = body;
    try {
      const json = JSON.parse(body) as { analysis_summary?: string };
      summary = json.analysis_summary ?? body;
    } catch {
      summary = body;
    }

    return {
      endpoint,
      latencyMs: Date.now() - started,
      parsed: parseAnalysis(summary)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function createCompletedAnalysis(params: {
  eventId?: string | null;
  userId?: string | null;
  inputText: string;
}) {
  const result = await callModel(params.inputText);
  const parsed = result.parsed;

  return prisma.analysis.create({
    data: {
      eventId: params.eventId ?? null,
      userId: params.userId ?? null,
      inputText: params.inputText,
      analysisSummary: parsed.analysisSummary,
      rawAnalysis: parsed.rawAnalysis,
      riskLevel: parsed.riskLevel,
      attackType: parsed.attackType,
      mitreTactics: parsed.mitreTactics,
      mitreTechniques: parsed.mitreTechniques,
      recommendedActions: parsed.recommendedActions,
      iocs: parsed.iocs,
      recommendationsJson: parsed.recommendationsJson,
      immediateActions: parsed.immediateActions,
      investigationSteps: parsed.investigationSteps,
      containmentSteps: parsed.containmentSteps,
      preventionSteps: parsed.preventionSteps,
      analystNotes: parsed.analystNotes,
      modelEndpoint: result.endpoint,
      latencyMs: result.latencyMs,
      status: AnalysisStatus.COMPLETED
    },
    include: { event: { include: { source: true } }, user: true }
  });
}
