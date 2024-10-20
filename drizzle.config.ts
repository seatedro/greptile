import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({
	path: "./.env.development.local"
});

export default defineConfig({
	schema: "./src/lib/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.POSTGRES_URL!
	}
});
