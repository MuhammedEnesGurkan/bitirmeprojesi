import { AnalysisStatus } from "@prisma/client";
import { HttpError } from "../lib/httpError.js";
import { prisma } from "../lib/prisma.js";
import { parseAnalysis } from "./analysisParser.js";
import { runPostAnalysisAutomation } from "./automationService.js";
import { getModelEndpoint } from "./settingsService.js";

function buildModelUrl(endpoint: string) {
  const normalized = endpoint.replace(/\/+$/, "");
  if (/\/(?:analyze|ask)$/i.test(normalized)) return normalized;
  return `${normalized}/analyze`;
}

export async function callModel(inputText: string) {
  const endpoint = await getModelEndpoint();
  if (!endpoint) {
    throw new HttpError(503, "MODEL_API_URL is not configured");
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(buildModelUrl(endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ event_data: inputText, question: inputText }),
      signal: controller.signal
    });

    const body = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, body || `Model request failed with ${response.status}`);
    }

    let summary = body;
    try {
      const json = JSON.parse(body) as {
        analysis_summary?: string;
        answer?: string;
        response?: string;
        result?: string;
        message?: string;
      };
      summary = json.analysis_summary ?? json.answer ?? json.response ?? json.result ?? json.message ?? body;
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

  const analysis = await prisma.analysis.create({
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

  await runPostAnalysisAutomation(analysis);
  return analysis;
}
