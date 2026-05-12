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
