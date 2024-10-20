import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { Octokit } from "octokit";
import { env } from "$env/dynamic/private";

const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

export const GET: RequestHandler = async ({ url }) => {
	const repository = url.searchParams.get("repository");
	const page = parseInt(url.searchParams.get("page") || "1");
	const perPage = parseInt(url.searchParams.get("per_page") || "100");

	if (!repository) {
		return json({ error: "Repository is required" }, { status: 400 });
	}

	const [owner, repo] = repository.split("/");

	try {
		const { data } = await octokit.rest.repos.listCommits({
			owner,
			repo,
			per_page: perPage,
			page: page
		});

		const commits = data.map((commit) => ({
			sha: commit.sha,
			message: commit.commit.message.split("\n")[0], // First line of commit message
			date: commit.commit.author?.date,
			author: commit.commit.author?.name
		}));

		return json({ commits });
	} catch (error) {
		console.error(error);
		return json({ error: "An error occurred while fetching commits" }, { status: 500 });
	}
};
