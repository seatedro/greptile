import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export const GET: RequestHandler = async ({ url }) => {
	const repository = url.searchParams.get("repository");

	if (!repository) {
		return json({ error: "Repository is required" }, { status: 400 });
	}

	const [owner, repo] = repository.split("/");

	try {
		const { data: releases } = await octokit.rest.repos.listReleases({
			owner,
			repo,
			per_page: 10 // Adjust this number as needed
		});

		return json(releases);
	} catch (error) {
		console.error(error);
		return json({ error: "An error occurred while fetching releases" }, { status: 500 });
	}
};
