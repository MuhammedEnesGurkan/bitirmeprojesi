CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'VIEWER');
CREATE TYPE "SourceType" AS ENUM ('SHUFFLE', 'THEHIVE', 'WAZUH', 'MANUAL', 'MODEL', 'OTHER');
CREATE TYPE "SourceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN');
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
CREATE TYPE "EventStatus" AS ENUM ('NEW', 'ANALYZING', 'ANALYZED', 'FAILED', 'ARCHIVED');
CREATE TYPE "AnalysisStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'ARCHIVED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sources" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "SourceType" NOT NULL,
  "base_url" TEXT,
  "status" "SourceStatus" NOT NULL DEFAULT 'UNKNOWN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "events" (
  "id" TEXT NOT NULL,
  "source_id" TEXT,
  "external_id" TEXT,
  "title" TEXT NOT NULL,
  "raw_event" JSONB NOT NULL,
  "severity" "Severity" NOT NULL DEFAULT 'INFO',
  "status" "EventStatus" NOT NULL DEFAULT 'NEW',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analyses" (
  "id" TEXT NOT NULL,
  "event_id" TEXT,
  "user_id" TEXT,
  "input_text" TEXT NOT NULL,
  "analysis_summary" TEXT,
  "raw_analysis" TEXT,
  "risk_level" "Severity",
  "attack_type" TEXT,
  "mitre_tactics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "mitre_techniques" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "recommended_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "iocs" JSONB,
  "recommendations_json" JSONB,
  "immediate_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "investigation_steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "containment_steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "prevention_steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "analyst_notes" TEXT,
  "model_endpoint" TEXT,
  "latency_ms" INTEGER,
  "status" "AnalysisStatus" NOT NULL DEFAULT 'RUNNING',
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integrations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "SourceType" NOT NULL,
  "config_json" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "sources_name_type_key" ON "sources"("name", "type");
CREATE INDEX "events_severity_idx" ON "events"("severity");
CREATE INDEX "events_status_idx" ON "events"("status");
CREATE INDEX "events_created_at_idx" ON "events"("created_at");
CREATE INDEX "analyses_status_idx" ON "analyses"("status");
CREATE INDEX "analyses_created_at_idx" ON "analyses"("created_at");
CREATE UNIQUE INDEX "integrations_name_type_key" ON "integrations"("name", "type");

ALTER TABLE "events" ADD CONSTRAINT "events_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
