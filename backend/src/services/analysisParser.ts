import { Severity } from "@prisma/client";
import { asStringArray, normalizeSeverity } from "../lib/normalizers.js";

export type RecommendationItem = {
  id: string;
  category:
    | "recommended_actions"
    | "immediate_actions"
    | "containment_steps"
    | "investigation_steps"
    | "prevention_steps"
    | "mitre_mapping"
    | "ioc_list"
    | "risk_explanation"
    | "analyst_notes";
  text: string;
  done: boolean;
};

export type ParsedAnalysis = {
  analysisSummary: string;
  rawAnalysis: string;
  riskLevel: Severity;
  attackType: string | null;
  mitreTactics: string[];
  mitreTechniques: string[];
  recommendedActions: string[];
  immediateActions: string[];
  investigationSteps: string[];
  containmentSteps: string[];
  preventionSteps: string[];
  analystNotes: string | null;
  iocs: Record<string, string[]>;
  recommendationsJson: RecommendationItem[];
};

const emptyIocs = {
  ips: [] as string[],
  domains: [] as string[],
  urls: [] as string[],
  hashes: [] as string[],
  emails: [] as string[]
};

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const entries = Object.entries(obj);
  const match = entries.find(([key]) =>
    keys.includes(key.toLowerCase().replace(/[\s_-]/g, ""))
  );
  return match?.[1];
}

function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```json/i, "").replace(/```$/i, "").trim(),
    trimmed.match(/\{[\s\S]*\}/)?.[0] ?? ""
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractLinesByHeading(raw: string, labels: string[]): string[] {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const start = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:${escaped.join("|")})\\s*:?\\s*\\n`, "i");
  const match = start.exec(raw);
  if (!match || match.index === undefined) return [];

  const after = raw.slice(match.index + match[0].length);
  const stop = after.search(/\n\s*(?:#{1,4}\s*)?[A-Z][A-Za-z /&()'-]{2,45}\s*:?\s*\n/);
  const section = stop >= 0 ? after.slice(0, stop) : after;

  return section
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 2);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function findIocs(raw: string): Record<string, string[]> {
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

function inferAttackType(raw: string): string | null {
  const match = raw.match(/attack type\s*:?\s*([^\n]+)/i);
  if (match?.[1]) return match[1].trim();
  if (/phishing|credential/i.test(raw)) return "Phishing / Credential Access";
  if (/powershell|encodedcommand|living off the land/i.test(raw)) return "Suspicious PowerShell Execution";
  if (/ransom|encrypt/i.test(raw)) return "Ransomware Activity";
  if (/brute force|failed login|password spray/i.test(raw)) return "Brute Force / Password Spraying";
  if (/exfil|data transfer/i.test(raw)) return "Possible Data Exfiltration";
  return null;
}

function inferRisk(raw: string): Severity {
  if (/critical|ransom|domain admin|exfil/i.test(raw)) return Severity.CRITICAL;
  if (/high|credential|powershell|malware|c2|command and control/i.test(raw)) return Severity.HIGH;
  if (/medium|suspicious|anomal/i.test(raw)) return Severity.MEDIUM;
  if (/low/i.test(raw)) return Severity.LOW;
  return Severity.INFO;
}

function toRecommendationItems(parsed: Omit<ParsedAnalysis, "recommendationsJson">): RecommendationItem[] {
  const rows: Array<[RecommendationItem["category"], string[]]> = [
    ["recommended_actions", parsed.recommendedActions],
    ["immediate_actions", parsed.immediateActions],
    ["containment_steps", parsed.containmentSteps],
    ["investigation_steps", parsed.investigationSteps],
    ["prevention_steps", parsed.preventionSteps],
    ["mitre_mapping", [...parsed.mitreTactics, ...parsed.mitreTechniques]],
    ["ioc_list", Object.values(parsed.iocs).flat()],
    ["risk_explanation", parsed.analysisSummary ? [parsed.analysisSummary] : []],
    ["analyst_notes", parsed.analystNotes ? [parsed.analystNotes] : []]
  ];

  return rows.flatMap(([category, values]) =>
    values.map((text, index) => ({
      id: `${category}-${index + 1}`,
      category,
      text,
      done: false
    }))
  );
}

export function parseAnalysis(raw: string): ParsedAnalysis {
  const json = extractJson(raw);

  if (json) {
    const iocsValue = pick(json, ["iocs", "ioclist", "observables"]);
    const iocs = typeof iocsValue === "object" && iocsValue && !Array.isArray(iocsValue)
      ? { ...emptyIocs, ...(iocsValue as Record<string, string[]>) }
      : { ...emptyIocs, urls: asStringArray(iocsValue) };

    const base = {
      analysisSummary: String(pick(json, ["analysissummary", "summary", "overview"]) ?? raw),
      rawAnalysis: raw,
      riskLevel: normalizeSeverity(pick(json, ["risklevel", "risk", "severity"])),
      attackType: String(pick(json, ["attacktype", "attack", "threattype"]) ?? "") || null,
      mitreTactics: asStringArray(pick(json, ["mitretactics", "tactics"])),
      mitreTechniques: asStringArray(pick(json, ["mitretechniques", "techniques"])),
      recommendedActions: asStringArray(pick(json, ["recommendedactions", "recommendations", "actions"])),
      immediateActions: asStringArray(pick(json, ["immediateactions", "immediateresponsesteps", "responsesteps"])),
      investigationSteps: asStringArray(pick(json, ["investigationsteps", "investigation"])),
      containmentSteps: asStringArray(pick(json, ["containmentsteps", "containmentsuggestions", "containment"])),
      preventionSteps: asStringArray(pick(json, ["preventionsteps", "hardening", "preventionhardening"])),
      analystNotes: String(pick(json, ["analystnotes", "notes"]) ?? "") || null,
      iocs
    };

    return { ...base, recommendationsJson: toRecommendationItems(base) };
  }

  const iocs = findIocs(raw);
  const base = {
    analysisSummary: extractLinesByHeading(raw, ["Summary", "Analysis Summary", "Özet"]).join(" ") || raw,
    rawAnalysis: raw,
    riskLevel: inferRisk(raw),
    attackType: inferAttackType(raw),
    mitreTactics: extractLinesByHeading(raw, ["MITRE ATT&CK Tactics", "MITRE Tactics", "Tactics"]),
    mitreTechniques: extractLinesByHeading(raw, ["MITRE ATT&CK Techniques", "MITRE Techniques", "Techniques"]),
    recommendedActions: extractLinesByHeading(raw, ["Recommended Actions", "Recommendations", "Önerilen Aksiyonlar"]),
    immediateActions: extractLinesByHeading(raw, ["Immediate Response Steps", "Immediate Actions"]),
    investigationSteps: extractLinesByHeading(raw, ["Investigation Steps", "Investigation"]),
    containmentSteps: extractLinesByHeading(raw, ["Containment Suggestions", "Containment Steps"]),
    preventionSteps: extractLinesByHeading(raw, ["Prevention / Hardening Suggestions", "Prevention", "Hardening"]),
    analystNotes: extractLinesByHeading(raw, ["Analyst Notes", "Notes"]).join("\n") || null,
    iocs
  };

  if (base.recommendedActions.length === 0) {
    base.recommendedActions = [
      "Validate the alert against endpoint, identity and network telemetry.",
      "Preserve related logs and timeline evidence for analyst review."
    ];
  }

  return { ...base, recommendationsJson: toRecommendationItems(base) };
}
