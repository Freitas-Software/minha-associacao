CREATE TABLE "login_rate_limits" (
	"key" varchar(64) PRIMARY KEY,
	"count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
