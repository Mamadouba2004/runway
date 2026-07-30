ALTER TABLE "plaid_items" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD COLUMN "webhook_url" text;