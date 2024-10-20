<script lang="ts">
	import { onMount } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { goto } from "$app/navigation";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from "$lib/components/ui/card";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";

	let changelogs: any[] = [];
	let currentPage = 1;
	let totalPages = 1;
	let loading = false;
	let error = "";
	let repository = "";
	let repositories: string[] = [];

	async function loadChangelogs() {
		loading = true;
		error = "";
		try {
			const response = await fetch(`/api/changelogs?repository=${repository}&page=${currentPage}`);
			if (!response.ok) throw new Error("Failed to fetch changelogs");
			const data = await response.json();
			changelogs = data.changelogs;
			totalPages = data.totalPages;
			currentPage = data.currentPage;
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	async function loadRepositories() {
		try {
			const response = await fetch("/api/repositories");
			if (!response.ok) throw new Error("Failed to fetch repositories");
			repositories = await response.json();
		} catch (e) {
			error = e.message;
		}
	}

	function changePage(newPage: number) {
		if (newPage >= 1 && newPage <= totalPages) {
			currentPage = newPage;
			loadChangelogs();
		}
	}

	function changeRepository() {
		currentPage = 1;
		loadChangelogs();
	}

	onMount(() => {
		loadRepositories();
		loadChangelogs();
	});

	function navigateToGenerate() {
		goto("/generate");
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
			<h1 class="text-4xl font-bold text-blue-400">Changelog</h1>
			<Button on:click={navigateToGenerate} class="bg-blue-500 hover:bg-blue-600"
				>Generate New Changelog</Button
			>
		</div>

		{#if error}
			<Alert variant="destructive" class="mb-6 border-red-700 bg-red-900">
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{/if}

		<div class="mb-6">
			<label for="repository" class="mb-2 block text-sm font-medium text-gray-300"
				>Select Repository</label
			>
			<select
				id="repository"
				bind:value={repository}
				on:change={changeRepository}
				class="w-full rounded-md border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:ring-blue-500"
			>
				<option value="">All Repositories</option>
				{#each repositories as repo}
					<option value={repo}>{repo}</option>
				{/each}
			</select>
		</div>

		{#if loading}
			<p class="text-center text-gray-400">Loading changelogs...</p>
		{:else if changelogs.length === 0}
			<p class="text-center text-gray-400">No changelogs found.</p>
		{:else}
			{#each changelogs as changelog}
				<Card class="mb-8 border-gray-700 bg-gray-800">
					<CardHeader>
						<CardTitle class="text-2xl text-blue-400"
							>{changelog.content.version} - {changelog.content.date}</CardTitle
						>
						<CardDescription class="text-gray-400">{changelog.repository}</CardDescription>
					</CardHeader>
					<CardContent>
						<p class="mb-4 text-xl font-semibold text-gray-200">{changelog.content.title}</p>
						{#each Object.entries(changelog.content.changes) as [category, changes]}
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

			<div class="mt-8 flex justify-center space-x-4">
				<Button
					on:click={() => changePage(currentPage - 1)}
					disabled={currentPage === 1}
					class="bg-gray-700 hover:bg-gray-600"
				>
					Previous
				</Button>
				<span class="rounded-md bg-gray-800 px-4 py-2">Page {currentPage} of {totalPages}</span>
				<Button
					on:click={() => changePage(currentPage + 1)}
					disabled={currentPage === totalPages}
					class="bg-gray-700 hover:bg-gray-600"
				>
					Next
				</Button>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		font-family: "Inter", sans-serif;
	}
</style>
