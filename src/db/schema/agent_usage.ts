import {
  decimal,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { agents } from "./agents";

export const agentUsage = pgTable("agent_usage", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  agentId: text("agent_id").references(() => agents.id),
  model: text("model"),
  totalTokens: integer("total_tokens"),
  cost: decimal("cost", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
}).enableRLS();
