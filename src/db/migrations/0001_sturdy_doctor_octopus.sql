CREATE TABLE "agent_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text,
	"model" text,
	"total_tokens" integer,
	"cost" numeric(10, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_usage" ADD CONSTRAINT "agent_usage_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;