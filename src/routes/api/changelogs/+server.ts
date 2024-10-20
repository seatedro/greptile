import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/db";
import { changelogs } from "$lib/db/schema";
import { desc, eq, count } from "drizzle-orm";

export const GET: RequestHandler = async ({ url }) => {
	const repository = url.searchParams.get("repository");
	const page = parseInt(url.searchParams.get("page") || "1");
	const limit = 10;
	const offset = (page - 1) * limit;

	let query = db
		.select()
		.from(changelogs)
		.orderBy(desc(changelogs.createdAt))
		.limit(limit)
		.offset(offset);

	let results;
	if (repository) {
		results = await query.where(eq(changelogs.repository, repository));
	} else {
		results = await query;
	}

	// Parse the content field for each changelog
	const parsedResults = results.map((changelog) => ({
		...changelog
	}));

	// Sort the changelogs by date in descending order
	parsedResults.sort(
		(a, b) => new Date(b.content.date).getTime() - new Date(a.content.date).getTime()
	);

	// Get the total count of changelogs for the repository (or all if no repository specified)
	const countQuery = db.select({ count: count() }).from(changelogs);
	let cnt = 0;
	if (repository) {
		cnt = (await countQuery.where(eq(changelogs.repository, repository)))[0].count;
	} else {
		cnt = (await countQuery)[0].count;
	}

	return json({
		changelogs: parsedResults,
		totalPages: Math.ceil(cnt / limit),
		currentPage: page
	});
};
