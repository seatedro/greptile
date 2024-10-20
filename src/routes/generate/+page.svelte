<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from "$lib/components/ui/card";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";

	let repository = "";
	let loading = false;
	let error = "";
	let changelogs: any[] = [];
	let hasReleases = true;
	let baseSHA = "";
	let headSHA = "";

	onMount(async () => {
		const urlParams = new URLSearchParams(window.location.search);
		repository = urlParams.get("repository") || "";
	});

	async function checkReleases() {
		if (!repository) return;

		loading = true;
		try {
			const response = await fetch(`/api/releases?repository=${repository}`);
			if (!response.ok) throw new Error("Failed to check releases");
			const releases = await response.json();
			hasReleases = releases.length > 0;
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	async function generateChangelog() {
		loading = true;
		error = "";
		try {
			const body = hasReleases ? { repository } : { repository, baseSHA, headSHA };

			const response = await fetch("/api/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});
			if (!response.ok) throw new Error("Failed to generate changelog");
			const data = await response.json();
			changelogs = data.changes || [];
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	function navigateToHome() {
		goto("/");
	}
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="font-inter min-h-screen bg-gray-900 text-white">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-4xl font-bold text-blue-400">Generate Changelog</h1>
			<Button on:click={navigateToHome} class="bg-blue-500 hover:bg-blue-600"
				>Back to Changelogs</Button
			>
		</div>

		{#if error}
			<Alert variant="destructive" class="mb-6 border-red-700 bg-red-900">
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{/if}

		<Card class="mb-8 border-gray-700 bg-gray-800">
			<CardHeader>
				<CardTitle class="text-2xl text-blue-400">Changelog Generator</CardTitle>
				<CardDescription class="text-gray-400"
					>Enter repository details to generate a changelog</CardDescription
				>
			</CardHeader>
			<CardContent>
				<form on:submit|preventDefault={generateChangelog} class="space-y-4">
					<div class="space-y-2">
						<Label for="repository" class="text-gray-300">Repository (owner/repo)</Label>
						<Input
							id="repository"
							bind:value={repository}
							on:blur={checkReleases}
							required
							class="border-gray-600 bg-gray-700 text-white"
						/>
					</div>

					{#if !hasReleases}
						<div class="space-y-2">
							<Label for="baseSHA" class="text-gray-300">Base SHA</Label>
							<Input
								id="baseSHA"
								bind:value={baseSHA}
								required
								class="border-gray-600 bg-gray-700 text-white"
							/>
						</div>
						<div class="space-y-2">
							<Label for="headSHA" class="text-gray-300">Head SHA</Label>
							<Input
								id="headSHA"
								bind:value={headSHA}
								required
								class="border-gray-600 bg-gray-700 text-white"
							/>
						</div>
					{/if}

					<Button type="submit" disabled={loading} class="w-full bg-blue-500 hover:bg-blue-600">
						{loading ? "Generating..." : "Generate Changelog"}
					</Button>
				</form>
			</CardContent>
		</Card>

		{#if changelogs.length > 0}
			<h2 class="mb-4 text-2xl font-bold text-blue-400">Generated Changelogs</h2>
			{#each changelogs as changelog}
				<Card class="mb-8 border-gray-700 bg-gray-800">
					<CardHeader>
						<CardTitle class="text-2xl text-blue-400"
							>{changelog.version} - {changelog.date}</CardTitle
						>
					</CardHeader>
					<CardContent>
						<p class="mb-4 text-xl font-semibold text-gray-200">{changelog.title}</p>
						{#each Object.entries(changelog.changes) as [category, changes]}
							{#if changes.length > 0}
								<h4 class="mt-4 text-lg font-semibold text-blue-300">{category}:</h4>
								<ul class="list-disc pl-5 text-gray-300">
									{#each changes as change}
										<li class="mb-1">{change}</li>
									{/each}
								</ul>
							{/if}
						{/each}
					</CardContent>
				</Card>
			{/each}
		{/if}
	</div>
</div>

<style>
	:global(body) {
		font-family: "Inter", sans-serif;
	}
</style>
