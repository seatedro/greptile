import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { Octokit } from "octokit";
import { db } from "$lib/db";
import { changelogs } from "$lib/db/schema";
import { z } from "zod";
import { v4 } from "uuid";
import { env } from "$env/dynamic/private";

const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
const GREPTILE_API_KEY = env.GREPTILE_API_KEY;

const ChangelogSchema = z.object({
	version: z.string(),
	date: z.string(),
	title: z.string(),
	changes: z.record(z.array(z.string()))
});

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
		return false; // Repository not indexed
	}

	if (!response.ok) {
		throw new Error(`Failed to check repository index status: ${response.statusText}`);
	}

	const data = await response.json();
	return data.status === "COMPLETED";
}

async function indexRepository(repository: string) {
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

	return await response.json();
}

async function queryGreptile(repository: string, diffSummary: string) {
	const response = await fetch("https://api.greptile.com/v2/query", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${GREPTILE_API_KEY}`,
			"X-GitHub-Token": env.GITHUB_TOKEN!,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			messages: [
				{
					content: `Generate a detailed changelog based on the following diff information. Focus on user-facing changes, new features, bug fixes, and significant internal improvements. Organize the changes into the following categories:

1. UI/UX: Changes related to user interface and user experience
2. Features: New features or significant improvements to existing features
3. Bug Fixes: Corrections to existing functionality
4. Performance: Improvements in speed, efficiency, or resource usage
5. Security: Security-related changes or improvements
6. Documentation: Changes to documentation or comments
7. Internal: Significant internal changes that don't fit into other categories

If a category has no changes, omit it from the response. Return the response as a JSON object with the following structure:
{
    "title": "Brief summary of the overall changes",
    "version": "Custom version or commit range",
    "date": "Current date",
    "changes": {
        "UI/UX": ["Change 1", "Change 2", ...],
        "Features": ["Feature 1", "Feature 2", ...],
        "Bug Fixes": ["Fix 1", "Fix 2", ...],
        "Performance": ["Improvement 1", "Improvement 2", ...],
        "Security": ["Update 1", "Update 2", ...],
        "Documentation": ["Change 1", "Change 2", ...],
        "Internal": ["Change 1", "Change 2", ...]
    }
}

Please return valid JSON only. Skip the preamble.

Here is the diff summary as context:
${diffSummary}`,
					role: "user"
				},
				{
					role: "assistant",
					content: "Here is the JSON requested:\n{"
				}
			],
			repositories: [{ repository, branch: "main", remote: "github" }],
			stream: false,
			genius: false
		})
	});

	if (!response.ok) {
		throw new Error(`Failed to query Greptile: ${response.statusText}`);
	}

	const greptileResponse = await response.json();
	console.log(greptileResponse);
	return ChangelogSchema.parse(JSON.parse("{" + greptileResponse.message));
}

async function getRepoReleases(owner: string, repo: string, perPage: number = 3) {
	const { data: releases } = await octokit.rest.repos.listReleases({
		owner,
		repo,
		per_page: perPage
	});

	return releases;
}

async function getCommitComparison(owner: string, repo: string, base: string, head: string) {
	const { data: diffData } = await octokit.rest.repos.compareCommits({
		owner,
		repo,
		base,
		head
	});

	return diffData;
}

export const POST: RequestHandler = async ({ request }) => {
	const { repository, baseSHA, headSHA } = await request.json();
	const [owner, repo] = repository.split("/");

	try {
		// Check if the repository is already indexed
		const isIndexed = await checkRepositoryIndexed(repository);

		if (!isIndexed) {
			await indexRepository(repository);
			return json(
				{ message: "Repository indexing has started. Please try again in a few minutes." },
				{ status: 202 }
			);
		}

		let changes = [];

		if (baseSHA && headSHA) {
			// Compare the two specified commits
			const diffData = await getCommitComparison(owner, repo, baseSHA, headSHA);

			// Process the diff data
			const processedDiff = diffData.files.map((file) => ({
				filename: file.filename,
				status: file.status,
				additions: file.additions,
				deletions: file.deletions,
				patch: file.patch
			}));

			// Prepare the diff summary for Greptile
			const diffSummary = processedDiff
				.map(
					(file) =>
						`File: ${file.filename}\nStatus: ${file.status}\nAdditions: ${file.additions}, Deletions: ${file.deletions}\n\nPatch:\n${file.patch}`
				)
				.join("\n\n---\n\n");

			// Query Greptile API
			const changelogContent = await queryGreptile(repository, diffSummary);

			// Add custom version information
			const versionedChangelog = {
				...changelogContent,
				version: `${baseSHA.slice(0, 7)}...${headSHA.slice(0, 7)}`,
				date: new Date().toISOString().split("T")[0]
			};

			changes.push(versionedChangelog);
		} else {
			// Get releases
			const releases = await getRepoReleases(owner, repo, 3);

			if (releases.length > 1) {
				for (let i = 0; i < Math.min(3, releases.length - 1); i++) {
					const currentRelease = releases[i];
					const previousRelease = releases[i + 1];

					const diffData = await getCommitComparison(
						owner,
						repo,
						previousRelease.tag_name,
						currentRelease.tag_name
					);

					// Process the diff data
					const processedDiff = diffData.files.map((file) => ({
						filename: file.filename,
						status: file.status,
						additions: file.additions,
						deletions: file.deletions,
						patch: file.patch
					}));

					// Prepare the diff summary for Greptile
					const diffSummary = processedDiff
						.map(
							(file) =>
								`File: ${file.filename}\nStatus: ${file.status}\nAdditions: ${file.additions}, Deletions: ${file.deletions}\n\nPatch:\n${file.patch}`
						)
						.join("\n\n---\n\n");

					// Query Greptile API
					const changelogContent = await queryGreptile(repository, diffSummary);

					// Add version information to each changelog
					const versionedChangelog = {
						...changelogContent,
						version: currentRelease.tag_name,
						date: new Date(currentRelease.published_at!).toISOString().split("T")[0]
					};

					changes.push(versionedChangelog);
				}
			} else {
				// For repositories with one or no releases, use the latest commit as head
				const { data: latestCommit } = await octokit.rest.repos.getCommit({
					owner,
					repo,
					ref: "HEAD"
				});

				// Use the commit from 30 days ago as the base
				const thirtyDaysAgo = new Date();
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
				const { data: commitsInLast30Days } = await octokit.rest.repos.listCommits({
					owner,
					repo,
					since: thirtyDaysAgo.toISOString()
				});

				const oldestCommit = commitsInLast30Days[commitsInLast30Days.length - 1];

				const diffData = await getCommitComparison(owner, repo, oldestCommit.sha, latestCommit.sha);

				// Process the diff data
				const processedDiff = diffData.files.map((file) => ({
					filename: file.filename,
					status: file.status,
					additions: file.additions,
					deletions: file.deletions,
					patch: file.patch
				}));

				// Prepare the diff summary for Greptile
				const diffSummary = processedDiff
					.map(
						(file) =>
							`File: ${file.filename}\nStatus: ${file.status}\nAdditions: ${file.additions}, Deletions: ${file.deletions}\n\nPatch:\n${file.patch}`
					)
					.join("\n\n---\n\n");

				// Query Greptile API
				const changelogContent = await queryGreptile(repository, diffSummary);

				// Add version information
				const versionedChangelog = {
					...changelogContent,
					version: `${oldestCommit.sha.slice(0, 7)}...${latestCommit.sha.slice(0, 7)}`,
					date: new Date().toISOString().split("T")[0]
				};

				changes.push(versionedChangelog);
			}
		}

		// Store in database
		for (const changelog of changes) {
			await db.insert(changelogs).values({
				id: v4(),
				repository,
				content: JSON.stringify(changelog)
			});
		}

		return json({ changes });
	} catch (error) {
		console.error(error);
		return json({ error: "An error occurred while generating the changelog" }, { status: 500 });
	}
};
