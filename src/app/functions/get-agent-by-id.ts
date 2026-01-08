import { err, ok } from "neverthrow";

import { cacheKeys } from "../cache/keys";
import { getCacheJSON, setCacheJSON } from "../cache";
import { Agent } from "../../db/schema";
import { getAgentByIdQuery } from "../../db/queries";
import { db } from "../../db/client";

export async function getAgentById(id: string) {
  try {
    const agentFound = await getCacheJSON<Agent>(cacheKeys.agent(id));

    if (!agentFound) {
      const result = await getAgentByIdQuery(db, id);
      if (!result) {
        return ok(null);
      }

      await setCacheJSON(id, result, {
        ttl: 60 * 60 * 4,
      });
      return ok(result);
    }

    return ok(agentFound);
  } catch (error) {
    return err(
      new Error(error instanceof Error ? error.message : "Unknown error"),
    );
  }
}
