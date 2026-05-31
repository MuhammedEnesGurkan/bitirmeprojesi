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

export type TheHiveComment = {
  id: string;
  message: string;
  author?: string;
  createdAt?: string;
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

type ClosePayload = {
  summary?: string;
  impactStatus?: string;
  resolutionStatus?: string;
};

type CommentPayload = {
  message: string;
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

function authHeaders(includeOrganisation = true) {
  const header = envString("THEHIVE_AUTH_HEADER") || "Authorization";
  const scheme = envString("THEHIVE_AUTH_SCHEME") || "Bearer";
  const value = scheme ? `${scheme} ${apiKey()}` : apiKey();
  const organisation = envString("THEHIVE_ORGANISATION") || envString("THEHIVE_ORGANIZATION");

  const headers: Record<string, string> = {
    [header]: value
  };

  if (includeOrganisation && organisation) {
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
  const sortByNewest = (items: TheHiveCase[]) => items.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  if (Array.isArray(value)) return sortByNewest(value.map(normalizeCase).filter((item) => item.id));
  const record = asRecord(value);
  for (const key of ["data", "items", "cases", "results", "entities"]) {
    if (Array.isArray(record[key])) return sortByNewest(record[key].map(normalizeCase).filter((item) => item.id));
  }
  return [];
}

function normalizeComment(value: unknown): TheHiveComment {
  const item = asRecord(value);
  const id = String(item._id ?? item.id ?? item.commentId ?? item.createdAt ?? item.created_at ?? "");
  const message = String(item.message ?? item.text ?? item.content ?? item.description ?? "");
  const user = asRecord(item.user);

  return {
    id,
    message,
    author: typeof item.createdBy === "string" ? item.createdBy : typeof item.author === "string" ? item.author : typeof user.name === "string" ? user.name : undefined,
    createdAt: toIso(item.createdAt ?? item.created_at),
    raw: value
  };
}

function normalizeCommentList(value: unknown) {
  if (Array.isArray(value)) return value.map(normalizeComment).filter((item) => item.id || item.message);
  const record = asRecord(value);
  for (const key of ["data", "items", "comments", "results"]) {
    if (Array.isArray(record[key])) return record[key].map(normalizeComment).filter((item) => item.id || item.message);
  }
  return [];
}

async function requestTheHive(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.THEHIVE_TIMEOUT_MS ?? 15000));

  try {
    const makeRequest = async (includeOrganisation = true) => {
      const response = await fetch(`${baseUrl()}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(includeOrganisation),
          ...(init.headers ?? {})
        },
        signal: controller.signal
      });

      return { response, text: await response.text() };
    };

    let { response, text } = await makeRequest();
    if (!response.ok && authHeaders()["X-Organisation"] && /Organisation not found/i.test(text)) {
      ({ response, text } = await makeRequest(false));
    }

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

async function requestTheHiveWithoutOrganisation(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.THEHIVE_TIMEOUT_MS ?? 15000));

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(false),
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

async function tryCaseListRequests(requests: Array<() => Promise<unknown>>) {
  const errors: unknown[] = [];
  let sawEmptyResponse = false;

  for (const request of requests) {
    try {
      const cases = normalizeCaseList(await request());
      if (cases.length > 0) return cases;
      sawEmptyResponse = true;
    } catch (error) {
      errors.push(error);
    }
  }

  if (sawEmptyResponse) return [];

  const last = errors.at(-1);
  if (last instanceof Error) throw last;
  throw new HttpError(502, "TheHive case list failed");
}

export async function listTheHiveCases(search = "") {
  const query = search.trim();
  const searchEndpointBody = {
    query: query ? { _string: query } : {},
    range: "all",
    sort: ["-createdAt"]
  };
  const queryBody = {
    query: [{ _name: "listCase" }],
    range: "0-100",
    sort: ["-createdAt"]
  };

  const cases = await tryCaseListRequests([
    () => requestTheHiveWithoutOrganisation(`${caseEndpoint()}?range=all`),
    () => requestTheHiveWithoutOrganisation("/api/case?range=all"),
    () => requestTheHiveWithoutOrganisation("/api/v1/query", {
      method: "POST",
      body: JSON.stringify(queryBody)
    }),
    () => requestTheHiveWithoutOrganisation(envString("THEHIVE_CASE_SEARCH_ENDPOINT") || "/api/case/_search", {
      method: "POST",
      body: JSON.stringify(searchEndpointBody)
    }),
    () => requestTheHive(`${caseEndpoint()}?range=all`),
    () => requestTheHive("/api/v1/query", {
      method: "POST",
      body: JSON.stringify(queryBody)
    }),
    () => requestTheHive(envString("THEHIVE_CASE_SEARCH_ENDPOINT") || "/api/case/_search", {
      method: "POST",
      body: JSON.stringify(searchEndpointBody)
    })
  ]);

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
    () => requestTheHiveWithoutOrganisation(`${caseEndpoint()}/${encodeURIComponent(id)}`),
    () => requestTheHiveWithoutOrganisation(`/api/case/${encodeURIComponent(id)}`),
    () => requestTheHiveWithoutOrganisation(`/api/v1/case/${encodeURIComponent(id)}`),
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

export async function closeTheHiveCase(id: string, payload: ClosePayload = {}) {
  const now = Date.now();
  const closePayload = {
    status: "Resolved",
    stage: "Closed",
    endDate: now,
    summary: payload.summary || "Closed from SOC AI Analysis Panel.",
    impactStatus: payload.impactStatus || "NoImpact",
    resolutionStatus: payload.resolutionStatus || "TruePositive"
  };

  const body = await tryRequests([
    () => requestTheHive(`${caseEndpoint()}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(closePayload) }),
    () => requestTheHive(`/api/case/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(closePayload) }),
    () => requestTheHive(`/api/v1/case/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(closePayload) }),
    () => requestTheHive(`${caseEndpoint()}/${encodeURIComponent(id)}/close`, { method: "POST", body: JSON.stringify(closePayload) }),
    () => requestTheHive(`/api/case/${encodeURIComponent(id)}/close`, { method: "POST", body: JSON.stringify(closePayload) })
  ]);

  return normalizeCase(body);
}

function commentCreatePaths(id: string) {
  const encoded = encodeURIComponent(id);
  return [
    `${caseEndpoint()}/${encoded}/comment`,
    `/api/case/${encoded}/comment`,
    `/api/v1/case/${encoded}/comment`
  ];
}

function commentListPaths(id: string) {
  const encoded = encodeURIComponent(id);
  return [
    `${caseEndpoint()}/${encoded}/comments`,
    `/api/case/${encoded}/comments`,
    `/api/v1/case/${encoded}/comments`
  ];
}

export async function listTheHiveCaseComments(id: string) {
  try {
    const body = await tryRequests([
      ...commentListPaths(id).map((path) => () => requestTheHiveWithoutOrganisation(path)),
      ...commentListPaths(id).map((path) => () => requestTheHive(path))
    ]);
    return normalizeCommentList(body);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 404) return [];
    throw error;
  }
}

export async function addTheHiveCaseComment(id: string, payload: CommentPayload) {
  const requestPayload = { message: payload.message };
  const body = await tryRequests([
    ...commentCreatePaths(id).map((path) => () => requestTheHiveWithoutOrganisation(path, {
      method: "POST",
      body: JSON.stringify(requestPayload)
    })),
    ...commentCreatePaths(id).map((path) => () => requestTheHive(path, {
      method: "POST",
      body: JSON.stringify(requestPayload)
    }))
  ]);

  return normalizeComment(body);
}
