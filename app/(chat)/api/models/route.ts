import { getActiveModels, getCapabilities, isDemo } from "@/lib/ai/models";

export async function GET() {
  const curatedCapabilities = await getCapabilities();
  const models = getActiveModels();

  return Response.json({
    models: models.map((model) => ({
      ...model,
      capabilities: curatedCapabilities[model.id] ?? {
        tools: false,
        vision: false,
        reasoning: false,
      },
    })),
    isDemo,
  });
}