import { SourceType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const MODEL_INTEGRATION_NAME = "AI Model Endpoint";

export async function getModelEndpoint(): Promise<string> {
  const saved = await prisma.integration.findUnique({
    where: { name_type: { name: MODEL_INTEGRATION_NAME, type: SourceType.MODEL } }
  });

  const config = saved?.configJson as { endpoint?: string } | undefined;
  return (config?.endpoint || process.env.MODEL_API_URL || "").replace(/\/+$/, "");
}

export async function setModelEndpoint(endpoint: string) {
  const normalized = endpoint.trim().replace(/\/+$/, "");
  return prisma.integration.upsert({
    where: { name_type: { name: MODEL_INTEGRATION_NAME, type: SourceType.MODEL } },
    update: { configJson: { endpoint: normalized }, enabled: true },
    create: {
      name: MODEL_INTEGRATION_NAME,
      type: SourceType.MODEL,
      enabled: true,
      configJson: { endpoint: normalized }
    }
  });
}
