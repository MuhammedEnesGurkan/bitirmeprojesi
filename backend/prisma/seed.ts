import { AnalysisStatus, EventStatus, Severity, SourceStatus, SourceType, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const analyst = await prisma.user.upsert({
    where: { email: "analyst@soc.local" },
    update: {},
    create: {
      name: "SOC Analyst",
      email: "analyst@soc.local",
      role: UserRole.ADMIN
    }
  });

  const shuffle = await prisma.source.upsert({
    where: { name_type: { name: "Shuffle", type: SourceType.SHUFFLE } },
    update: { status: SourceStatus.ONLINE },
    create: { name: "Shuffle", type: SourceType.SHUFFLE, status: SourceStatus.ONLINE, baseUrl: "https://shuffle.local" }
  });

  const theHive = await prisma.source.upsert({
    where: { name_type: { name: "TheHive", type: SourceType.THEHIVE } },
    update: { status: SourceStatus.DEGRADED },
    create: { name: "TheHive", type: SourceType.THEHIVE, status: SourceStatus.DEGRADED, baseUrl: "https://thehive.local" }
  });

  const wazuh = await prisma.source.upsert({
    where: { name_type: { name: "Wazuh", type: SourceType.WAZUH } },
    update: { status: SourceStatus.ONLINE },
    create: { name: "Wazuh", type: SourceType.WAZUH, status: SourceStatus.ONLINE, baseUrl: "https://wazuh.local" }
  });

  await prisma.integration.upsert({
    where: { name_type: { name: "AI Model Endpoint", type: SourceType.MODEL } },
    update: {},
    create: {
      name: "AI Model Endpoint",
      type: SourceType.MODEL,
      enabled: true,
      configJson: { endpoint: process.env.MODEL_API_URL ?? "https://your-ngrok-url.ngrok-free.app" }
    }
  });

  await prisma.integration.upsert({
    where: { name_type: { name: "Shuffle Webhook", type: SourceType.SHUFFLE } },
    update: {},
    create: {
      name: "Shuffle Webhook",
      type: SourceType.SHUFFLE,
      enabled: true,
      configJson: { endpoint: "/webhooks/shuffle", autoAnalyze: true }
    }
  });

  const eventA = await prisma.event.create({
    data: {
      sourceId: wazuh.id,
      externalId: "WAZUH-1007",
      title: "Encoded PowerShell spawned by Office process",
      rawEvent: {
        agent: "WIN-EDR-022",
        rule: "Suspicious PowerShell",
        command: "powershell.exe -EncodedCommand SQBFAFgA...",
        user: "finance.user",
        src_ip: "10.20.30.44"
      },
      severity: Severity.HIGH,
      status: EventStatus.ANALYZED,
      tags: ["powershell", "endpoint", "windows"]
    }
  });

  await prisma.analysis.create({
    data: {
      eventId: eventA.id,
      userId: analyst.id,
      inputText: "Encoded PowerShell spawned by Office process on WIN-EDR-022 from finance.user.",
      analysisSummary: "Office spawning encoded PowerShell is consistent with a phishing payload or initial access execution chain. The host should be isolated until process lineage and network callbacks are reviewed.",
      rawAnalysis: "Office spawning encoded PowerShell is consistent with a phishing payload or initial access execution chain.",
      riskLevel: Severity.HIGH,
      attackType: "Suspicious PowerShell Execution",
      mitreTactics: ["Execution", "Defense Evasion"],
      mitreTechniques: ["T1059.001 PowerShell", "T1027 Obfuscated Files or Information"],
      recommendedActions: ["Isolate WIN-EDR-022", "Collect process tree and PowerShell logs", "Review mailbox and attachment source"],
      immediateActions: ["Disable network access for the endpoint", "Preserve volatile evidence"],
      containmentSteps: ["Block observed callback domains", "Quarantine the downloaded attachment"],
      investigationSteps: ["Review Sysmon Event ID 1 and PowerShell Script Block logs", "Check lateral movement attempts from finance.user"],
      preventionSteps: ["Enforce Office child-process blocking", "Harden PowerShell logging and constrained language mode"],
      analystNotes: "Prioritize user mailbox review because the process parent was Office.",
      iocs: { ips: ["10.20.30.44"], domains: [], urls: [], hashes: [], emails: [] },
      recommendationsJson: [
        { id: "immediate_actions-1", category: "immediate_actions", text: "Disable network access for the endpoint", done: false },
        { id: "investigation_steps-1", category: "investigation_steps", text: "Review Sysmon Event ID 1 and PowerShell Script Block logs", done: true },
        { id: "prevention_steps-1", category: "prevention_steps", text: "Enforce Office child-process blocking", done: false }
      ],
      modelEndpoint: process.env.MODEL_API_URL ?? "seeded",
      latencyMs: 1840,
      status: AnalysisStatus.COMPLETED
    }
  });

  await prisma.event.create({
    data: {
      sourceId: theHive.id,
      externalId: "CASE-2026-042",
      title: "Possible phishing campaign targeting finance",
      rawEvent: {
        case_id: "CASE-2026-042",
        title: "Possible phishing campaign targeting finance",
        description: "Multiple users reported invoices with suspicious links.",
        observables: [{ type: "domain", data: "billing-support.example" }],
        case_url: "https://thehive.local/cases/CASE-2026-042"
      },
      severity: Severity.MEDIUM,
      status: EventStatus.NEW,
      tags: ["phishing", "finance"]
    }
  });

  await prisma.event.create({
    data: {
      sourceId: shuffle.id,
      externalId: "EXEC-7788",
      title: "Automated enrichment flagged suspicious IP",
      rawEvent: {
        workflow: "IP enrichment",
        action: "VirusTotal lookup",
        src_ip: "203.0.113.88",
        score: 8
      },
      severity: Severity.LOW,
      status: EventStatus.NEW,
      tags: ["shuffle", "enrichment"]
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
