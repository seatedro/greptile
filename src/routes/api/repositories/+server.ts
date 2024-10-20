import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/db";
import { changelogs } from "$lib/db/schema";

export const GET: RequestHandler = async () => {
	const repositories = await db
		.select({ repository: changelogs.repository })
		.from(changelogs)
		.groupBy(changelogs.repository);

	return json(repositories.map((r) => r.repository));
};
