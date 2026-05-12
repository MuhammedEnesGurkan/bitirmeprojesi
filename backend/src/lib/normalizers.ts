import { EventStatus, Severity, SourceType } from "@prisma/client";

export function normalizeSeverity(value: unknown): Severity {
  if (typeof value === "number") {
    if (value >= 4) return Severity.CRITICAL;
    if (value === 3) return Severity.HIGH;
    if (value === 2) return Severity.MEDIUM;
    if (value === 1) return Severity.LOW;
    return Severity.INFO;
  }

  const normalized = String(value ?? "INFO").trim().toUpperCase();
  if (normalized.includes("CRIT")) return Severity.CRITICAL;
  if (normalized === "3" || normalized.includes("HIGH")) return Severity.HIGH;
  if (normalized === "2" || normalized.includes("MED")) return Severity.MEDIUM;
  if (normalized === "1" || normalized.includes("LOW")) return Severity.LOW;
  return Severity.INFO;
}

export function normalizeStatus(value: unknown): EventStatus {
  const normalized = String(value ?? "NEW").trim().toUpperCase();
  if (normalized.includes("ANALYZING")) return EventStatus.ANALYZING;
  if (normalized.includes("ANALYZED") || normalized.includes("CLOSED")) return EventStatus.ANALYZED;
  if (normalized.includes("FAIL")) return EventStatus.FAILED;
  if (normalized.includes("ARCH")) return EventStatus.ARCHIVED;
  return EventStatus.NEW;
}

export function normalizeSourceType(value: unknown): SourceType {
  const normalized = String(value ?? "MANUAL").trim().toUpperCase();
  if (normalized.includes("SHUFFLE")) return SourceType.SHUFFLE;
  if (normalized.includes("HIVE")) return SourceType.THEHIVE;
  if (normalized.includes("WAZUH") || normalized.includes("SIEM")) return SourceType.WAZUH;
  if (normalized.includes("MODEL")) return SourceType.MODEL;
  if (normalized.includes("MANUAL")) return SourceType.MANUAL;
  return SourceType.OTHER;
}

export function eventToText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}
