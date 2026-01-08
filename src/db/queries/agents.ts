import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { agents } from "../schema";

export const getAgentByIdQuery = async (db: Database, id: string) => {
  return db.query.agents.findFirst({
    where: eq(agents.id, id),
  });
};
