import { Severity } from "@prisma/client";

export type TriageVerdict = "possible_true_positive" | "possible_false_positive" | "needs_review";

export type TriageDecision = {
  verdict: TriageVerdict;
  confidence: number;
  riskLevel: Severity;
  needsLlm: boolean;
  reasons: string[];
  signals: {
    truePositive: string[];
    falsePositive: string[];
    indicators: {
      ips: string[];
      domains: string[];
      urls: string[];
      hashes: string[];
      emails: string[];
    };
  };
};

const severityRank: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const tpRules: Array<{ pattern: RegExp; label: string; weight: number; severity?: Severity }> = [
  { pattern: /\b(ransomware|encrypt(?:ed|ion)?|decryptor)\b/i, label: "Ransomware wording detected", weight: 5, severity: Severity.CRITICAL },
  { pattern: /\b(exfiltration|data leak|large outbound|unauthorized transfer)\b/i, label: "Possible data exfiltration indicator", weight: 5, severity: Severity.CRITICAL },
  { pattern: /\b(credential dump|mimikatz|lsass|pass[- ]the[- ]hash)\b/i, label: "Credential theft indicator detected", weight: 5, severity: Severity.HIGH },
  { pattern: /\b(malware|trojan|backdoor|c2|command and control|beacon)\b/i, label: "Malware or C2 indicator detected", weight: 4, severity: Severity.HIGH },
  { pattern: /\b(brute force|password spray|multiple failed|failed login|authentication failure)\b/i, label: "Suspicious authentication failure pattern", weight: 3, severity: Severity.MEDIUM },
  { pattern: /\b(powershell|encodedcommand|invoke-webrequest|download cradle)\b/i, label: "Suspicious scripting indicator detected", weight: 3, severity: Severity.MEDIUM },
  { pattern: /\b(admin|administrator|root|domain admin)\b/i, label: "Privileged account mentioned", weight: 2, severity: Severity.MEDIUM },
  { pattern: /\b(blocked|quarantined|denied|prevented)\b/i, label: "Security control action detected", weight: 1, severity: Severity.LOW }
];

const fpRules: Array<{ pattern: RegExp; label: string; weight: number }> = [
  { pattern: /\b(healthcheck|heartbeat|keepalive|liveness|readiness)\b/i, label: "Operational healthcheck wording detected", weight: 4 },
  { pattern: /\b(test|demo|lab|simulation|benign|known good)\b/i, label: "Test or known benign wording detected", weight: 3 },
  { pattern: /\b(backup job|scheduled task|cron|maintenance)\b/i, label: "Scheduled operational activity detected", weight: 3 },
  { pattern: /\b(single failed|failed once|one failure|retry succeeded)\b/i, label: "Single transient failure wording detected", weight: 2 },
  { pattern: /\b(internal service|localhost|127\.0\.0\.1|::1)\b/i, label: "Internal or local service context detected", weight: 2 }
];

function envFlag(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractIndicators(raw: string) {
  const ips = raw.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g) ?? [];
  const urls = raw.match(/\bhttps?:\/\/[^\s"']+/gi) ?? [];
  const emails = raw.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? [];
  const hashes = raw.match(/\b[a-f0-9]{32}\b|\b[a-f0-9]{40}\b|\b[a-f0-9]{64}\b/gi) ?? [];
  const domains = raw.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) ?? [];

  return {
    ips: unique(ips),
    domains: unique(domains.filter((domain) => !emails.some((email) => email.includes(domain)))),
    urls: unique(urls),
    hashes: unique(hashes),
    emails: unique(emails)
  };
}

function severityFromScore(score: number, fallback: Severity) {
  if (score >= 8) return Severity.CRITICAL;
  if (score >= 5) return Severity.HIGH;
  if (score >= 3) return Severity.MEDIUM;
  if (score >= 1) return Severity.LOW;
  return fallback;
}

function maxSeverity(values: Severity[]) {
  return values.reduce((best, current) => severityRank[current] > severityRank[best] ? current : best, Severity.INFO);
}

function roundConfidence(value: number) {
  return Math.max(0.1, Math.min(0.98, Number(value.toFixed(2))));
}

export function triageEnabled() {
  return envFlag("TRIAGE_ENGINE_ENABLED", true);
}

export function analyzeTriage(inputText: string, sourceSeverity: Severity = Severity.INFO): TriageDecision {
  const text = inputText || "";
  const indicators = extractIndicators(text);
  const tpMatches = tpRules.filter((rule) => rule.pattern.test(text));
  const fpMatches = fpRules.filter((rule) => rule.pattern.test(text));
  const indicatorScore = indicators.ips.length + indicators.domains.length + indicators.urls.length + indicators.hashes.length >= 2 ? 1 : 0;
  const tpScore = tpMatches.reduce((sum, rule) => sum + rule.weight, 0) + indicatorScore;
  const fpScore = fpMatches.reduce((sum, rule) => sum + rule.weight, 0);
  const difference = Math.abs(tpScore - fpScore);
  const total = tpScore + fpScore + 1;

  let verdict: TriageVerdict = "needs_review";
  if (tpScore >= fpScore + 2) verdict = "possible_true_positive";
  if (fpScore >= tpScore + 2) verdict = "possible_false_positive";

  const ruleSeverity = maxSeverity(tpMatches.map((rule) => rule.severity ?? Severity.LOW));
  const riskLevel = verdict === "possible_false_positive"
    ? sourceSeverity
    : maxSeverity([sourceSeverity, ruleSeverity, severityFromScore(tpScore, Severity.INFO)]);
  const confidence = roundConfidence(0.45 + Math.min(0.45, difference / total));
  const skipThreshold = envNumber("TRIAGE_SKIP_LLM_CONFIDENCE_THRESHOLD", 0.72);
  const canSkipLlm = envFlag("TRIAGE_SKIP_LLM_FOR_LOW_RISK_FP", true)
    && verdict === "possible_false_positive"
    && confidence >= skipThreshold
    && severityRank[riskLevel] <= severityRank[Severity.LOW];

  const reasons = [
    ...tpMatches.map((rule) => rule.label),
    ...fpMatches.map((rule) => rule.label)
  ];
  if (indicatorScore > 0) reasons.push("Multiple IOC-like values detected");
  if (reasons.length === 0) reasons.push("No strong triage rule matched; analyst or model review is recommended");

  return {
    verdict,
    confidence,
    riskLevel,
    needsLlm: !canSkipLlm,
    reasons,
    signals: {
      truePositive: tpMatches.map((rule) => rule.label),
      falsePositive: fpMatches.map((rule) => rule.label),
      indicators
    }
  };
}

export function triageSummary(decision: TriageDecision) {
  const verdict = decision.verdict.replace(/_/g, " ");
  const confidence = Math.round(decision.confidence * 100);
  return `Rule-based pre-triage marked this event as ${verdict} with ${confidence}% confidence.`;
}
