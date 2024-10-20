import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";

const GREPTILE_API_KEY = env.GREPTILE_API_KEY;

async function checkRepositoryIndexed(repository: string) {
	const repoId = `github:main:${repository}`;
	const response = await fetch(
		`https://api.greptile.com/v2/repositories/${encodeURIComponent(repoId)}`,
		{
			headers: {
				Authorization: `Bearer ${GREPTILE_API_KEY}`
			}
		}
	);

	if (response.status === 404) {
		return { indexed: false, status: "NOT_FOUND" };
	}

	if (!response.ok) {
		throw new Error(`Failed to check repository index status: ${response.statusText}`);
	}

	const data = await response.json();
	return { indexed: data.status === "COMPLETED", status: data.status };
}

export const POST: RequestHandler = async ({ fetch, request }) => {
	const { repository } = await request.json();
	try {
		const response = await fetch("https://api.greptile.com/v2/repositories", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${GREPTILE_API_KEY}`,
				"X-GitHub-Token": env.GITHUB_TOKEN!,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ repository, reload: true, remote: "github", branch: "main" })
		});

		if (!response.ok) {
			throw new Error(`Failed to index repository: ${response.statusText}`);
		}

		const body = await response.json();

		return json(body);
	} catch (err) {
		console.error(err);
		return json({ error: "An error occurred while checking indexing status" }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const repository = url.searchParams.get("repository");

	if (!repository) {
		return json({ error: "Repository is required" }, { status: 400 });
	}

	try {
		const indexStatus = await checkRepositoryIndexed(repository);
		return json(indexStatus);
	} catch (error) {
		console.error(error);
		return json({ error: "An error occurred while checking indexing status" }, { status: 500 });
	}
};
