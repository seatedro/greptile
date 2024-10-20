import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";

export const changelogs = pgTable("changelogs", {
	id: uuid("id").primaryKey(),
	repository: text("repository").notNull(),
	content: jsonb("content").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull()
});
