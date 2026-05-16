import { AnalysisStatus, Severity } from "@prisma/client";
import type { Analysis, Event, Source } from "@prisma/client";

type AnalysisWithEvent = Analysis & {
  event?: (Event & { source?: Source | null }) | null;
};

type AutomationPayload = {
  analysis_id: string;
  event_id?: string | null;
  source?: string | null;
  title: string;
  severity: Severity;
  attack_type?: string | null;
  summary?: string | null;
  raw_analysis?: string | null;
  input_text: string;
  recommended_actions: string[];
  immediate_actions: string[];
  containment_steps: string[];
  investigation_steps: string[];
  prevention_steps: string[];
  mitre_tactics: string[];
  mitre_techniques: string[];
  iocs: unknown;
  created_at: string;
};

const severityRank: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const theHiveSeverity: Record<Severity, number> = {
  INFO: 1,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

function envFlag(name: string, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function envString(name: string) {
  return process.env[name]?.trim() || "";
}

function minSeverity() {
  const configured = envString("AUTOMATION_MIN_SEVERITY").toUpperCase();
  if (configured in severityRank) return configured as Severity;
  return Severity.MEDIUM;
}

function shouldAutomate(analysis: AnalysisWithEvent) {
  if (!envFlag("AUTOMATION_ENABLED")) return false;
  if (analysis.status !== AnalysisStatus.COMPLETED) return false;
  const severity = analysis.riskLevel ?? analysis.event?.severity ?? Severity.INFO;
  return severityRank[severity] >= severityRank[minSeverity()];
}

function titleFor(analysis: AnalysisWithEvent) {
  return analysis.event?.title ?? analysis.attackType ?? "SOC AI analysis";
}

function buildPayload(analysis: AnalysisWithEvent): AutomationPayload {
  const severity = analysis.riskLevel ?? analysis.event?.severity ?? Severity.INFO;

  return {
    analysis_id: analysis.id,
    event_id: analysis.eventId,
    source: analysis.event?.source?.name ?? null,
    title: titleFor(analysis),
    severity,
    attack_type: analysis.attackType,
    summary: analysis.analysisSummary,
    raw_analysis: analysis.rawAnalysis,
    input_text: analysis.inputText,
    recommended_actions: analysis.recommendedActions,
    immediate_actions: analysis.immediateActions,
    containment_steps: analysis.containmentSteps,
    investigation_steps: analysis.investigationSteps,
    prevention_steps: analysis.preventionSteps,
    mitre_tactics: analysis.mitreTactics,
    mitre_techniques: analysis.mitreTechniques,
    iocs: analysis.iocs,
    created_at: analysis.createdAt.toISOString()
  };
}

function assigneeFor(severity: Severity) {
  return (
    envString(`THEHIVE_ASSIGNEE_${severity}`) ||
    envString("THEHIVE_ASSIGNEE_DEFAULT") ||
    undefined
  );
}

function theHiveHeaders(apiKey: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  const organisation = envString("THEHIVE_ORGANISATION") || envString("THEHIVE_ORGANIZATION");
  if (organisation) headers["X-Organisation"] = organisation;
  return headers;
}

function descriptionFor(payload: AutomationPayload) {
  const lines = [
    `Analysis ID: ${payload.analysis_id}`,
    payload.event_id ? `Event ID: ${payload.event_id}` : "",
    "",
    `AI Summary: ${payload.summary ?? "No summary returned."}`,
    "",
    `Severity: ${payload.severity}`,
    payload.attack_type ? `Attack type: ${payload.attack_type}` : "",
    payload.mitre_tactics.length ? `MITRE tactics: ${payload.mitre_tactics.join(", ")}` : "",
    payload.mitre_techniques.length ? `MITRE techniques: ${payload.mitre_techniques.join(", ")}` : "",
    "",
    "Recommended actions:",
    ...(payload.recommended_actions.length ? payload.recommended_actions.map((item) => `- ${item}`) : ["- Review the alert context."]),
    "",
    "Original input:",
    payload.input_text
  ];

  return lines.filter((line) => line !== "").join("\n");
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AUTOMATION_TIMEOUT_MS ?? 15000));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function triggerShuffle(payload: AutomationPayload) {
  const url = envString("SHUFFLE_AUTOMATION_WEBHOOK_URL");
  if (!url) return;

  await postJson(url, {
    ...payload,
    automation_action: "triage_from_ai_analysis"
  });
}

async function createTheHiveCase(payload: AutomationPayload) {
  const baseUrl = envString("THEHIVE_API_URL").replace(/\/+$/, "");
  const apiKey = envString("THEHIVE_API_KEY");
  if (!baseUrl || !apiKey) return;

  const endpoint = envString("THEHIVE_CASE_ENDPOINT") || "/api/v1/case";
  const severity = payload.severity;
  const assignee = assigneeFor(severity);
  const casePayload = {
    title: `[${severity}] ${payload.title}`,
    description: descriptionFor(payload),
    severity: theHiveSeverity[severity],
    tags: [
      "soc-ai",
      "auto-created",
      payload.source,
      payload.attack_type,
      ...payload.mitre_tactics,
      ...payload.mitre_techniques
    ].filter(Boolean),
    assignee,
    owner: assignee,
    tlp: Number(process.env.THEHIVE_DEFAULT_TLP ?? 2),
    pap: Number(process.env.THEHIVE_DEFAULT_PAP ?? 2)
  };

  const headers = theHiveHeaders(apiKey);
  const endpoints = Array.from(new Set([endpoint, "/api/case", "/api/v1/case"]));
  let lastError: unknown = null;

  for (const casePath of endpoints) {
    try {
      await postJson(`${baseUrl}${casePath}`, casePayload, headers);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("TheHive case creation failed");
}

export async function runPostAnalysisAutomation(analysis: AnalysisWithEvent) {
  if (!shouldAutomate(analysis)) return;

  const payload = buildPayload(analysis);
  const tasks: Array<Promise<{ name: string; ok: true } | { name: string; ok: false; error: unknown }>> = [
    triggerShuffle(payload).then(() => ({ name: "shuffle", ok: true as const })).catch((error: unknown) => ({ name: "shuffle", ok: false as const, error })),
    createTheHiveCase(payload).then(() => ({ name: "thehive", ok: true as const })).catch((error: unknown) => ({ name: "thehive", ok: false as const, error }))
  ];

  const results = await Promise.all(tasks);
  for (const result of results) {
    if (!result.ok) {
      console.error(`Automation ${result.name} failed`, result.error);
    }
  }
}
