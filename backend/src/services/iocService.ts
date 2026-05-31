export type IocType = "ip" | "domain" | "url" | "hash" | "email";
export type EnrichmentVerdict = "malicious" | "suspicious" | "clean" | "unknown";

export type Indicator = {
  value: string;
  type: IocType;
};

export type EnrichmentSource = {
  name: string;
  status: "ok" | "skipped" | "error";
  verdict: EnrichmentVerdict;
  score: number;
  summary: string;
  raw?: unknown;
};

export type EnrichedIndicator = Indicator & {
  verdict: EnrichmentVerdict;
  score: number;
  priority: "critical" | "high" | "medium" | "low";
  sources: EnrichmentSource[];
};

function envString(name: string) {
  return process.env[name]?.trim() || "";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isPrivateIp(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    parts[0] >= 224;
}

function normalizeUrl(value: string) {
  return value.replace(/[),.;\]}'"]+$/g, "");
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function isLikelyFileName(value: string) {
  return /\.(?:exe|dll|sys|bat|cmd|ps1|vbs|js|jar|zip|rar|7z|gz|tar|iso|doc|docx|xls|xlsx|pdf|png|jpg|jpeg|gif|txt|log)$/i.test(value);
}

export function extractIndicators(text: string): Indicator[] {
  const urlPattern = new RegExp("\\bhttps?://[^\\s<>\"')\\]]+", "gi");
  const urls = unique((text.match(urlPattern) ?? []).map(normalizeUrl));
  const emails = unique(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? []);
  const hashes = unique(text.match(/\b[a-f0-9]{32}\b|\b[a-f0-9]{40}\b|\b[a-f0-9]{64}\b/gi) ?? []);
  const ips = unique(text.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g) ?? [])
    .filter((ip) => !isPrivateIp(ip));
  const urlDomains = new Set(urls.map(domainFromUrl).filter(Boolean));
  const emailDomains = new Set(emails.map((email) => email.split("@").at(-1) ?? "").filter(Boolean));
  const domains = unique(text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) ?? [])
    .map((domain) => domain.replace(/^www\./i, "").toLowerCase())
    .filter((domain) => !urlDomains.has(domain) && !emailDomains.has(domain))
    .filter((domain) => !isLikelyFileName(domain))
    .filter((domain) => !/^\d+\.\d+\.\d+\.\d+$/.test(domain));

  return [
    ...ips.map((value) => ({ type: "ip" as const, value })),
    ...domains.map((value) => ({ type: "domain" as const, value })),
    ...urls.map((value) => ({ type: "url" as const, value })),
    ...hashes.map((value) => ({ type: "hash" as const, value })),
    ...emails.map((value) => ({ type: "email" as const, value }))
  ];
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.ENRICHMENT_TIMEOUT_MS ?? 12000));

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    const body = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function sourceError(name: string, error: unknown): EnrichmentSource {
  return {
    name,
    status: "error",
    verdict: "unknown",
    score: 0,
    summary: error instanceof Error ? error.message : "Lookup failed"
  };
}

function skipped(name: string, reason: string): EnrichmentSource {
  return { name, status: "skipped", verdict: "unknown", score: 0, summary: reason };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function verdictFromScore(score: number): EnrichmentVerdict {
  if (score >= 75) return "malicious";
  if (score >= 35) return "suspicious";
  if (score > 0) return "clean";
  return "unknown";
}

function vtUrlId(url: string) {
  return Buffer.from(url).toString("base64").replace(/=+$/g, "");
}

async function virusTotal(indicator: Indicator): Promise<EnrichmentSource> {
  const key = envString("VIRUSTOTAL_API_KEY");
  if (!key) return skipped("VirusTotal", "VIRUSTOTAL_API_KEY is not configured");
  if (indicator.type === "email") return skipped("VirusTotal", "Email lookup is not supported in this panel");

  const path = indicator.type === "ip"
    ? `ip_addresses/${encodeURIComponent(indicator.value)}`
    : indicator.type === "domain"
      ? `domains/${encodeURIComponent(indicator.value)}`
      : indicator.type === "hash"
        ? `files/${encodeURIComponent(indicator.value)}`
        : `urls/${encodeURIComponent(vtUrlId(indicator.value))}`;

  try {
    const body = await getJson(`https://www.virustotal.com/api/v3/${path}`, { "x-apikey": key });
    const attrs = asRecord(asRecord(body).data ? asRecord(asRecord(body).data).attributes : {});
    const stats = asRecord(attrs.last_analysis_stats);
    const malicious = Number(stats.malicious ?? 0);
    const suspicious = Number(stats.suspicious ?? 0);
    const harmless = Number(stats.harmless ?? 0);
    const score = Math.min(100, malicious * 30 + suspicious * 15);

    return {
      name: "VirusTotal",
      status: "ok",
      verdict: malicious > 0 ? "malicious" : suspicious > 0 ? "suspicious" : harmless > 0 ? "clean" : "unknown",
      score,
      summary: `${malicious} malicious, ${suspicious} suspicious, ${harmless} harmless detections`,
      raw: body
    };
  } catch (error) {
    return sourceError("VirusTotal", error);
  }
}

async function abuseIpDb(indicator: Indicator): Promise<EnrichmentSource> {
  const key = envString("ABUSEIPDB_API_KEY");
  if (!key) return skipped("AbuseIPDB", "ABUSEIPDB_API_KEY is not configured");
  if (indicator.type !== "ip") return skipped("AbuseIPDB", "IP-only source");

  const params = new URLSearchParams({ ipAddress: indicator.value, maxAgeInDays: envString("ABUSEIPDB_MAX_AGE_DAYS") || "90" });
  try {
    const body = await getJson(`https://api.abuseipdb.com/api/v2/check?${params.toString()}`, {
      Key: key,
      Accept: "application/json"
    });
    const data = asRecord(asRecord(body).data);
    const score = Number(data.abuseConfidenceScore ?? 0);
    const reports = Number(data.totalReports ?? 0);
    return {
      name: "AbuseIPDB",
      status: "ok",
      verdict: verdictFromScore(score),
      score,
      summary: `${score}% abuse confidence, ${reports} reports`,
      raw: body
    };
  } catch (error) {
    return sourceError("AbuseIPDB", error);
  }
}

async function alienVaultOtx(indicator: Indicator): Promise<EnrichmentSource> {
  const key = envString("OTX_API_KEY") || envString("ALIENVAULT_OTX_API_KEY");
  if (indicator.type === "email") return skipped("AlienVault OTX", "Email lookup is not supported in this panel");

  const type = indicator.type === "ip" ? "IPv4" : indicator.type === "hash" ? "file" : indicator.type;
  const headers: Record<string, string> = key ? { "X-OTX-API-KEY": key } : {};

  try {
    const body = await getJson(`https://otx.alienvault.com/api/v1/indicators/${type}/${encodeURIComponent(indicator.value)}/general`, headers);
    const pulseInfo = asRecord(asRecord(body).pulse_info);
    const count = Number(pulseInfo.count ?? 0);
    const score = Math.min(100, count * 25);
    return {
      name: "AlienVault OTX",
      status: "ok",
      verdict: count > 0 ? "suspicious" : "clean",
      score,
      summary: `${count} OTX pulse matches`,
      raw: body
    };
  } catch (error) {
    return sourceError("AlienVault OTX", error);
  }
}

function aggregate(indicator: Indicator, sources: EnrichmentSource[]): EnrichedIndicator {
  const score = Math.max(...sources.map((source) => source.score), 0);
  const okSources = sources.filter((source) => source.status === "ok");
  const hasMalicious = okSources.some((source) => source.verdict === "malicious");
  const hasSuspicious = okSources.some((source) => source.verdict === "suspicious");
  const hasClean = okSources.some((source) => source.verdict === "clean");
  const verdict = hasMalicious ? "malicious" : hasSuspicious ? "suspicious" : hasClean ? "clean" : "unknown";

  return {
    ...indicator,
    verdict,
    score,
    priority: score >= 75 || verdict === "malicious" ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low",
    sources
  };
}

export async function enrichIndicators(indicators: Indicator[]) {
  const limited = indicators.slice(0, Number(process.env.ENRICHMENT_MAX_IOCS ?? 25));
  const enriched = await Promise.all(limited.map(async (indicator) => aggregate(indicator, await Promise.all([
    virusTotal(indicator),
    abuseIpDb(indicator),
    alienVaultOtx(indicator)
  ]))));

  return enriched.sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
}

export function enrichmentComment(indicators: EnrichedIndicator[]) {
  const rows = indicators.map((indicator) => {
    const sources = indicator.sources
      .filter((source) => source.status === "ok")
      .map((source) => `${source.name}: ${source.summary}`)
      .join("; ") || "No successful source lookup";
    return `- [${indicator.priority.toUpperCase()}] ${indicator.type.toUpperCase()} ${indicator.value} -> ${indicator.verdict.toUpperCase()} (${indicator.score}/100). ${sources}`;
  });

  return [
    "## IOC Enrichment",
    "",
    rows.length ? rows.join("\n") : "No IOCs enriched."
  ].join("\n");
}
