import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

export type AgentRuntime = {
  model?: string;
  instructions?: string;
};

export const mainAgent = new Agent({
  name: "Main Agent",
  instructions: ({ runtimeContext }) =>
    runtimeContext.get("instructions") || `You are a helpful assistant`,
  model: ({ runtimeContext }) =>
    runtimeContext.get("model") || "openrouter/openai/gpt-4.1-mini",
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: process.env.DATABASE_URL!,
      schemaName: "mastra",
    }),
    options: {
      lastMessages: 10,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: `# User Profile
          - **Name**:
        `,
      },
    },
  }),
});
