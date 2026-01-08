CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"description" text,
	"active" boolean DEFAULT true,
	"system_prompt" text,
	"llm" jsonb,
	"tools" jsonb DEFAULT '[]'::jsonb,
	"runtime" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"ref_id" text NOT NULL,
	"name" text,
	"picture" text,
	"phone" text,
	"active" boolean DEFAULT true,
	"agent_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;