CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"document_number" varchar(11) NOT NULL UNIQUE,
	"email" varchar(55) NOT NULL UNIQUE,
	"phone" varchar(9) NOT NULL UNIQUE,
	"birth_date" date NOT NULL,
	"password_hash" text NOT NULL
);
