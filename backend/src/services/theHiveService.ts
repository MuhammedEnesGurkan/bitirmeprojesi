import { HttpError } from "../lib/httpError.js";

export type TheHiveCase = {
  id: string;
  number?: number | string;
  title: string;
  description?: string;
  severity?: number;
  severityLabel: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status?: string;
  stage?: string;
  assignee?: string;
  owner?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  raw: unknown;
};

type CasePayload = {
  title: string;
  description?: string;
  severity?: number;
  tags?: string[];
  assignee?: string;
  owner?: string;
  tlp?: number;
  pap?: number;
};

type UpdatePayload = Partial<Pick<TheHiveCase, "title" | "description" | "status" | "stage" | "assignee">> & {
  severity?: number;
  tags?: string[];
  owner?: string;
};

function envString(name: string) {
  return process.env[name]?.trim() || "";
}

function baseUrl() {
  const configured = envString("THEHIVE_API_URL").replace(/\/+$/, "");
  if (!configured) throw new HttpError(503, "THEHIVE_API_URL is not configured");
  return configured;
}

function apiKey() {
  const configured = envString("THEHIVE_API_KEY");
  if (!configured) throw new HttpError(503, "THEHIVE_API_KEY is not configured");
  return configured;
}

function caseEndpoint() {
  return envString("THEHIVE_CASE_ENDPOINT") || "/api/v1/case";
}

function authHeaders() {
  const header = envString("THEHIVE_AUTH_HEADER") || "Authorization";
  const scheme = envString("THEHIVE_AUTH_SCHEME") || "Bearer";
  const value = scheme ? `${scheme} ${apiKey()}` : apiKey();
  const organisation = envString("THEHIVE_ORGANISATION") || envString("THEHIVE_ORGANIZATION");

  const headers: Record<string, string> = {
    [header]: value
  };

  if (organisation) {
    headers["X-Organisation"] = organisation;
  }

  return headers;
}

function toIso(value: unknown) {
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string" && value) return value;
  return undefined;
}

function severityLabel(value: unknown): TheHiveCase["severityLabel"] {
  const severity = typeof value === "number" ? value : Number(value ?? 0);
  if (severity >= 4) return "CRITICAL";
  if (severity === 3) return "HIGH";
  if (severity === 2) return "MEDIUM";
  if (severity === 1) return "LOW";
  return "INFO";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeCase(value: unknown): TheHiveCase {
  const item = asRecord(value);
  const id = String(item._id ?? item.id ?? item.caseId ?? item.number ?? "");
  const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];

  return {
    id,
    number: typeof item.number === "string" || typeof item.number === "number" ? item.number : typeof item.caseId === "string" || typeof item.caseId === "number" ? item.caseId : undefined,
    title: String(item.title ?? item.name ?? "Untitled case"),
    description: typeof item.description === "string" ? item.description : undefined,
    severity: typeof item.severity === "number" ? item.severity : Number(item.severity ?? 0),
    severityLabel: severityLabel(item.severity),
    status: typeof item.status === "string" ? item.status : undefined,
    stage: typeof item.stage === "string" ? item.stage : undefined,
    assignee: typeof item.assignee === "string" ? item.assignee : typeof item.owner === "string" ? item.owner : undefined,
    owner: typeof item.owner === "string" ? item.owner : undefined,
    tags,
    createdAt: toIso(item.createdAt ?? item.created_at),
    updatedAt: toIso(item.updatedAt ?? item.updated_at),
    raw: value
  };
}

function normalizeCaseList(value: unknown) {
  if (Array.isArray(value)) return value.map(normalizeCase).filter((item) => item.id);
  const record = asRecord(value);
  for (const key of ["data", "items", "cases", "results"]) {
    if (Array.isArray(record[key])) return record[key].map(normalizeCase).filter((item) => item.id);
  }
  return [];
}

async function requestTheHive(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.THEHIVE_TIMEOUT_MS ?? 15000));

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(init.headers ?? {})
      },
      signal: controller.signal
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) {
      throw new HttpError(response.status, text || `TheHive request failed with ${response.status}`);
    }

    return body;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new HttpError(502, "TheHive returned invalid JSON");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryRequests<T>(requests: Array<() => Promise<T>>) {
  const errors: unknown[] = [];
  for (const request of requests) {
    try {
      return await request();
    } catch (error) {
      errors.push(error);
    }
  }

  const last = errors.at(-1);
  if (last instanceof Error) throw last;
  throw new HttpError(502, "TheHive request failed");
}

export async function listTheHiveCases(search = "") {
  const query = search.trim();
  const allCases = () => requestTheHive(`${caseEndpoint()}?range=all`);
  const searchBody = {
    query: query
      ? { _name: "listCase", extraData: ["observableStats"], query: { _string: query } }
      : { _name: "listCase", extraData: ["observableStats"] },
    range: "all",
    sort: ["-createdAt"]
  };

  const body = await tryRequests([
    allCases,
    () => requestTheHive("/api/case?range=all"),
    () => requestTheHive("/api/v1/query", {
      method: "POST",
      body: JSON.stringify({
        query: [{ _name: "listCase" }],
        range: "0-100",
        sort: ["-createdAt"]
      })
    }),
    () => requestTheHive(envString("THEHIVE_CASE_SEARCH_ENDPOINT") || "/api/case/_search", {
      method: "POST",
      body: JSON.stringify(searchBody)
    })
  ]);

  const cases = normalizeCaseList(body);
  if (!query) return cases;

  const needle = query.toLowerCase();
  return cases.filter((item) =>
    item.title.toLowerCase().includes(needle) ||
    item.description?.toLowerCase().includes(needle) ||
    item.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
    String(item.number ?? "").toLowerCase().includes(needle)
  );
}

export async function getTheHiveCase(id: string) {
  const body = await tryRequests([
    () => requestTheHive(`${caseEndpoint()}/${encodeURIComponent(id)}`),
    () => requestTheHive(`/api/case/${encodeURIComponent(id)}`),
    () => requestTheHive(`/api/v1/case/${encodeURIComponent(id)}`)
  ]);

  return normalizeCase(body);
}

export async function createTheHiveCase(payload: CasePayload) {
  const requestPayload = payload.assignee && !payload.owner ? { ...payload, owner: payload.assignee } : payload;
  const body = await tryRequests([
    () => requestTheHive(caseEndpoint(), { method: "POST", body: JSON.stringify(requestPayload) }),
    () => requestTheHive("/api/case", { method: "POST", body: JSON.stringify(requestPayload) }),
    () => requestTheHive("/api/v1/case", { method: "POST", body: JSON.stringify(requestPayload) })
  ]);

  return normalizeCase(body);
}

export async function updateTheHiveCase(id: string, payload: UpdatePayload) {
  const requestPayload = payload.assignee && !payload.owner ? { ...payload, owner: payload.assignee } : payload;
  const body = await tryRequests([
    () => requestTheHive(`${caseEndpoint()}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(requestPayload) }),
    () => requestTheHive(`/api/case/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(requestPayload) }),
    () => requestTheHive(`/api/v1/case/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(requestPayload) })
  ]);

  return normalizeCase(body);
}
