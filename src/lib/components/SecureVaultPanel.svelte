<script lang="ts">
	import { onMount } from 'svelte';
	import {
		vaultState,
		vaultEntries,
		isVaultLocked,
		vaultCategories,
		loadVaultState,
		setupVaultPin,
		unlockVault,
		lockVault,
		addVaultEntry,
		updateVaultEntry,
		deleteVaultEntry,
		searchVault,
		addVaultCategory,
		exportVault,
		importVault,
		type VaultEntry
	} from '$lib/stores/secureVault';

	let pin = '';
	let pinError = '';
	let isSetup = false;
	let searchQuery = '';
	let searchResults: VaultEntry[] | null = null;
	let showAddForm = false;
	let editingEntry: VaultEntry | null = null;
	let newTitle = '';
	let newContent = '';
	let newCategory = 'Notes';
	let newSensitive = false;
	let showContent: Record<string, boolean> = {};

	onMount(() => {
		loadVaultState();
	});

	async function handlePinSubmit() {
		pinError = '';
		if (pin.length < 4) {
			pinError = 'PIN must be at least 4 characters';
			return;
		}
		if (!isSetup) {
			const ok = await setupVaultPin(pin);
			if (ok) {
				isSetup = true;
				pin = '';
			}
		} else {
			const ok = await unlockVault(pin);
			if (!ok) pinError = 'Incorrect PIN';
			pin = '';
		}
	}

	async function handleAdd() {
		if (!newTitle.trim() || !newContent.trim()) return;
		await addVaultEntry(newTitle.trim(), newContent.trim(), {
			category: newCategory,
			isSensitive: newSensitive
		});
		resetForm();
	}

	async function handleUpdate() {
		if (!editingEntry) return;
		await updateVaultEntry(editingEntry.id, {
			title: newTitle.trim() || undefined,
			content: newContent.trim() || undefined,
			category: newCategory
		});
		resetForm();
	}

	async function handleDelete(id: string) {
		await deleteVaultEntry(id);
	}

	async function handleSearch() {
		if (!searchQuery.trim()) {
			searchResults = null;
			return;
		}
		searchResults = await searchVault(searchQuery);
	}

	async function handleExport() {
		const data = await exportVault();
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'vault-export.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function startEdit(entry: VaultEntry) {
		editingEntry = entry;
		newTitle = entry.title;
		newContent = entry.content;
		newCategory = entry.category;
		showAddForm = true;
	}

	function resetForm() {
		showAddForm = false;
		editingEntry = null;
		newTitle = '';
		newContent = '';
		newCategory = 'Notes';
		newSensitive = false;
	}

	function toggleContent(id: string) {
		showContent = { ...showContent, [id]: !showContent[id] };
	}

	$: displayEntries = searchResults ?? $vaultEntries;
</script>

<div class="flex h-full flex-col bg-dark-800 text-gray-100">
	<div class="flex items-center justify-between border-b border-dark-600 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-hearth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
			</svg>
			<h2 class="text-lg font-semibold">Secure Vault</h2>
		</div>
		{#if !$isVaultLocked}
			<div class="flex gap-2">
				<button
					onclick={() => { showAddForm = true; }}
					class="rounded bg-hearth-500 px-3 py-1 text-sm hover:bg-hearth-600"
				>Add Entry</button>
				<button
					onclick={handleExport}
					class="rounded bg-dark-600 px-3 py-1 text-sm hover:bg-dark-500"
				>Export</button>
				<button
					onclick={lockVault}
					class="rounded bg-red-600 px-3 py-1 text-sm hover:bg-red-700"
				>Lock</button>
			</div>
		{/if}
	</div>

	{#if $isVaultLocked}
		<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
			<svg class="h-16 w-16 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
			</svg>
			<p class="text-dark-300">{$vaultState.totalEntries > 0 ? 'Enter your PIN to unlock' : 'Set up a PIN to get started'}</p>
			<form onsubmit={(e) => { e.preventDefault(); handlePinSubmit(); }} class="flex flex-col gap-2">
				<input
					type="password"
					bind:value={pin}
					placeholder="Enter PIN"
					class="rounded bg-dark-700 px-4 py-2 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-hearth-500"
				/>
				{#if pinError}
					<p class="text-center text-sm text-red-400">{pinError}</p>
				{/if}
				<button type="submit" class="rounded bg-hearth-500 px-6 py-2 hover:bg-hearth-600">
					{$vaultState.totalEntries > 0 ? 'Unlock' : 'Setup PIN'}
				</button>
			</form>
		</div>
	{:else}
		{#if showAddForm}
			<div class="border-b border-dark-600 p-4">
				<h3 class="mb-3 font-medium">{editingEntry ? 'Edit Entry' : 'New Entry'}</h3>
				<form onsubmit={(e) => { e.preventDefault(); editingEntry ? handleUpdate() : handleAdd(); }} class="flex flex-col gap-3">
					<input
						bind:value={newTitle}
						placeholder="Title"
						class="rounded bg-dark-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-hearth-500"
					/>
					<textarea
						bind:value={newContent}
						placeholder="Content (passwords, notes, keys...)"
						rows="3"
						class="rounded bg-dark-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-hearth-500"
					></textarea>
					<div class="flex gap-3">
						<select bind:value={newCategory} class="flex-1 rounded bg-dark-700 px-3 py-2">
							{#each $vaultCategories as cat}
								<option value={cat}>{cat}</option>
							{/each}
						</select>
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" bind:checked={newSensitive} class="rounded" />
							Sensitive
						</label>
					</div>
					<div class="flex justify-end gap-2">
						<button type="button" onclick={resetForm} class="rounded bg-dark-600 px-4 py-2 text-sm hover:bg-dark-500">Cancel</button>
						<button type="submit" class="rounded bg-hearth-500 px-4 py-2 text-sm hover:bg-hearth-600">
							{editingEntry ? 'Update' : 'Save'}
						</button>
					</div>
				</form>
			</div>
		{/if}

		<div class="border-b border-dark-600 p-3">
			<input
				bind:value={searchQuery}
				oninput={handleSearch}
				placeholder="Search vault..."
				class="w-full rounded bg-dark-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
			/>
		</div>

		<div class="flex-1 overflow-y-auto p-4">
			{#if displayEntries.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-dark-400">
					<p>No entries yet</p>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each displayEntries as entry}
						<div class="rounded-lg bg-dark-700 p-4">
							<div class="flex items-start justify-between">
								<div>
									<h4 class="font-medium">{entry.title}</h4>
									<span class="text-xs text-dark-300">{entry.category}</span>
								</div>
								<div class="flex gap-1">
									<button
										onclick={() => toggleContent(entry.id)}
										class="rounded p-1 text-dark-300 hover:bg-dark-600 hover:text-gray-100"
										title={showContent[entry.id] ? 'Hide' : 'Show'}
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											{#if showContent[entry.id]}
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
											{:else}
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
											{/if}
										</svg>
									</button>
									<button
										onclick={() => startEdit(entry)}
										class="rounded p-1 text-dark-300 hover:bg-dark-600 hover:text-gray-100"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
									</button>
									<button
										onclick={() => handleDelete(entry.id)}
										class="rounded p-1 text-dark-300 hover:bg-red-600 hover:text-white"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</div>
							</div>
							{#if showContent[entry.id]}
								<pre class="mt-2 whitespace-pre-wrap rounded bg-dark-900 p-3 text-sm font-mono">{entry.content}</pre>
							{:else if entry.isSensitive}
								<p class="mt-2 text-sm text-dark-400">&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</p>
							{:else}
								<p class="mt-2 text-sm text-dark-300">{entry.content.slice(0, 100)}{entry.content.length > 100 ? '...' : ''}</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
