import { db } from "../../db/client";
import { agentUsage } from "../../db/schema";
import { baseLogger } from "../../observability/logger";

const logger = baseLogger.child({ component: "TaskRegisterUsage" });

export interface TaskRegisterUsagePayload {
  agentId: string;
  model: string;
  totalTokens: number;
  totalCost: number;
}

export const taskRegisterUsage = async (
  payload: TaskRegisterUsagePayload,
): Promise<void> => {
  const { agentId, model, totalTokens, totalCost } = payload;

  logger.debug({ agentId, model, totalTokens, totalCost }, "Registering usage");

  try {
    await db.insert(agentUsage).values({
      agentId,
      model,
      totalTokens,
      cost: totalCost.toFixed(4),
    });
  } catch (error) {
    throw new Error(`Failed to register usage`);
  }
};
