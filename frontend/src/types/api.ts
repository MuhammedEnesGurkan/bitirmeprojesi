export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type EventStatus = "NEW" | "ANALYZING" | "ANALYZED" | "FAILED" | "ARCHIVED";
export type AnalysisStatus = "RUNNING" | "COMPLETED" | "FAILED" | "ARCHIVED";
export type SourceType = "SHUFFLE" | "THEHIVE" | "WAZUH" | "MANUAL" | "MODEL" | "OTHER";
export type SourceStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  baseUrl?: string | null;
  status: SourceStatus;
  createdAt: string;
};

export type EventRecord = {
  id: string;
  sourceId?: string | null;
  externalId?: string | null;
  title: string;
  rawEvent: unknown;
  severity: Severity;
  status: EventStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source?: Source | null;
  analyses?: Analysis[];
};

export type RecommendationItem = {
  id: string;
  category: string;
  text: string;
  done: boolean;
};

export type TriageVerdict = "possible_true_positive" | "possible_false_positive" | "needs_review";

export type TriageDecision = {
  verdict: TriageVerdict;
  confidence: number;
  riskLevel: Severity;
  needsLlm: boolean;
  llmSkipped?: boolean;
  reasons: string[];
  signals?: {
    truePositive?: string[];
    falsePositive?: string[];
    indicators?: Record<string, string[]>;
  };
};

export type Analysis = {
  id: string;
  eventId?: string | null;
  inputText: string;
  analysisSummary?: string | null;
  rawAnalysis?: string | null;
  riskLevel?: Severity | null;
  attackType?: string | null;
  mitreTactics: string[];
  mitreTechniques: string[];
  recommendedActions: string[];
  iocs?: Record<string, string[]> | null;
  triageJson?: TriageDecision | null;
  recommendationsJson?: RecommendationItem[] | null;
  immediateActions: string[];
  investigationSteps: string[];
  containmentSteps: string[];
  preventionSteps: string[];
  analystNotes?: string | null;
  modelEndpoint?: string | null;
  latencyMs?: number | null;
  status: AnalysisStatus;
  errorMessage?: string | null;
  createdAt: string;
  event?: EventRecord | null;
};

export type DashboardStats = {
  totalAnalyses: number;
  severityCounts: Partial<Record<Severity, number>>;
  statusCounts: Partial<Record<EventStatus, number>>;
  latestEvents: EventRecord[];
  latestAnalyses: Analysis[];
  sources: Source[];
  averageLatencyMs: number;
};

export type Integration = {
  id: string;
  name: string;
  type: SourceType;
  configJson: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
};

export type TheHiveCase = {
  id: string;
  number?: number | string;
  title: string;
  description?: string;
  severity?: number;
  severityLabel: Severity;
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

export type AilaCaseAnalysisResult = {
  case: TheHiveCase;
  comment: TheHiveComment;
  analysis: {
    summary: string;
    riskLevel?: Severity | null;
    attackType?: string | null;
    recommendedActions: string[];
    immediateActions: string[];
    investigationSteps: string[];
    containmentSteps: string[];
    preventionSteps: string[];
    mitreTactics: string[];
    mitreTechniques: string[];
    iocs?: Record<string, string[]> | null;
    modelEndpoint: string;
    latencyMs: number;
  };
};

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
};

export type EnrichedIndicator = Indicator & {
  verdict: EnrichmentVerdict;
  score: number;
  priority: "critical" | "high" | "medium" | "low";
  sources: EnrichmentSource[];
};
