import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { uuidv7 } from "uuidv7";

export const contacts = pgTable("contacts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  refId: text("ref_id").notNull(),
  name: text("name"),
  picture: text("picture"),
  phone: text("phone"),
  active: boolean("active").default(true),
  agentId: text("agent_id").references(() => agents.id),
  // userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}).enableRLS();

export type Contact = typeof contacts.$inferSelect;
