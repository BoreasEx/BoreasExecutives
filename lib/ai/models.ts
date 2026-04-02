export const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";

export const titleModel = {
  id: "gpt-4.1-mini",
  name: "GPT-4.1 Mini",
  provider: "openai",
  description: "Fast model for title generation",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Fast model for Boreas",
  },
];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return {
    "gpt-4.1-mini": {
      tools: true,
      vision: false,
      reasoning: false,
    },
  };
}

export const isDemo = process.env.IS_DEMO === "1";

export function getAllGatewayModels() {
  return [];
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = {
  openai: chatModels,
};