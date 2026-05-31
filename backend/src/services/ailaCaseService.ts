import { callModel } from "./modelService.js";
import { addTheHiveCaseComment, getTheHiveCase } from "./theHiveService.js";
import type { EnrichedIndicator } from "./iocService.js";

function enrichmentContext(indicators: EnrichedIndicator[] = []) {
  if (!indicators.length) return "";
  const top = indicators
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((indicator) => {
      const sources = indicator.sources
        .filter((source) => source.status === "ok")
        .map((source) => `${source.name}: ${source.summary}`)
        .join("; ");
      return `- [${indicator.priority.toUpperCase()}] ${indicator.type.toUpperCase()} ${indicator.value}: ${indicator.verdict}, score ${indicator.score}/100${sources ? ` (${sources})` : ""}`;
    });

  return ["", "IOC enrichment context, sorted by risk:", ...top].join("\n");
}

function caseInput(caseId: string, title: string, description: string | undefined, severity: string, tags: string[], enrichment?: EnrichedIndicator[]) {
  return [
    "Analyze this TheHive case as Aila, a SOC AI assistant.",
    "Return a concise analyst-ready assessment with risk, likely attack path, important IOCs, recommended investigation steps, containment steps, and false-positive considerations.",
    "Prioritize any IOC enrichment context with malicious or suspicious verdicts before lower-risk observables.",
    "",
    `Case ID: ${caseId}`,
    `Title: ${title}`,
    `Severity: ${severity}`,
    tags.length ? `Tags: ${tags.join(", ")}` : "",
    "",
    "Case description:",
    description || "No description provided.",
    enrichmentContext(enrichment)
  ].filter(Boolean).join("\n");
}

function commentText(summary: string, latencyMs: number | null) {
  return [
    "## Aila Analysis",
    "",
    summary,
    "",
    latencyMs !== null ? `_Model latency: ${latencyMs} ms_` : ""
  ].filter(Boolean).join("\n");
}

export async function analyzeTheHiveCaseWithAila(caseId: string, enrichment?: EnrichedIndicator[]) {
  const theHiveCase = await getTheHiveCase(caseId);
  const modelResult = await callModel(caseInput(
    theHiveCase.id || caseId,
    theHiveCase.title,
    theHiveCase.description,
    theHiveCase.severityLabel,
    theHiveCase.tags,
    enrichment
  ));

  const summary = modelResult.parsed.rawAnalysis || modelResult.parsed.analysisSummary;
  const comment = await addTheHiveCaseComment(caseId, {
    message: commentText(summary, modelResult.latencyMs)
  });

  return {
    case: theHiveCase,
    comment,
    analysis: {
      summary,
      riskLevel: modelResult.parsed.riskLevel,
      attackType: modelResult.parsed.attackType,
      recommendedActions: modelResult.parsed.recommendedActions,
      immediateActions: modelResult.parsed.immediateActions,
      investigationSteps: modelResult.parsed.investigationSteps,
      containmentSteps: modelResult.parsed.containmentSteps,
      preventionSteps: modelResult.parsed.preventionSteps,
      mitreTactics: modelResult.parsed.mitreTactics,
      mitreTechniques: modelResult.parsed.mitreTechniques,
      iocs: modelResult.parsed.iocs,
      modelEndpoint: modelResult.endpoint,
      latencyMs: modelResult.latencyMs
    }
  };
}
