ALTER TABLE "income_modes" ALTER COLUMN "amount_per_paycheck" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "income_modes" ALTER COLUMN "pay_day_of_month" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "income_modes" ALTER COLUMN "pay_day_of_month" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "income_modes" ADD COLUMN "cadence" text DEFAULT 'biweekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "income_modes" ADD COLUMN "pay_anchor_date" date;--> statement-breakpoint
ALTER TABLE "income_modes" ADD COLUMN "source_pattern" text;--> statement-breakpoint
ALTER TABLE "income_modes" ADD COLUMN "hourly_rate" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "income_modes" ADD COLUMN "max_hours_per_week" numeric(5, 2);