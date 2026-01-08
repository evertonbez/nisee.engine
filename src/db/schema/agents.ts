import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

export interface LLM {
  model: string;
  temperature: number;
}

export interface Runtime {
  bufferTimeMs: number;
  maxMemoryMessages: number;
}

export interface Tool {
  id: string;
  enabled: boolean;
}

export const agents = pgTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name"),
  description: text("description"),
  active: boolean("active").default(true),
  systemPrompt: text("system_prompt"),
  llm: jsonb("llm").$type<LLM>(),
  tools: jsonb("tools").$type<Tool[]>().default([]),
  runtime: jsonb("runtime").$type<Runtime>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}).enableRLS();

export type Agent = typeof agents.$inferSelect;
