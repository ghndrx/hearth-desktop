<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { polls, pollsLoading, pollActions, type Poll, type CreatePollRequest } from '$lib/stores/polls';

	// Props
	let {
		channelId = 'general',
		currentUserId = 'local-user'
	}: { channelId?: string; currentUserId?: string } = $props();

	let showCreate = $state(false);
	let question = $state('');
	let optionInputs = $state(['', '']);
	let multiVote = $state(false);
	let anonymous = $state(false);
	let filter = $state<'active' | 'closed' | 'all'>('active');

	const filteredPolls = $derived(
		($polls).filter((p) => {
			if (filter === 'active') return !p.closed;
			if (filter === 'closed') return p.closed;
			return true;
		})
	);

	onMount(async () => {
		await pollActions.init();
		await pollActions.load(channelId, true);
	});

	onDestroy(() => {
		pollActions.cleanup();
	});

	function addOption() {
		if (optionInputs.length < 10) {
			optionInputs = [...optionInputs, ''];
		}
	}

	function removeOption(index: number) {
		if (optionInputs.length > 2) {
			optionInputs = optionInputs.filter((_, i) => i !== index);
		}
	}

	async function handleCreate() {
		const validOptions = optionInputs.filter((o) => o.trim());
		if (!question.trim() || validOptions.length < 2) return;

		const request: CreatePollRequest = {
			channel_id: channelId,
			creator_id: currentUserId,
			question: question.trim(),
			options: validOptions,
			multi_vote: multiVote,
			anonymous
		};

		const result = await pollActions.create(request);
		if (result) {
			question = '';
			optionInputs = ['', ''];
			multiVote = false;
			anonymous = false;
			showCreate = false;
		}
	}

	async function handleVote(pollId: string, optionId: number) {
		await pollActions.vote(pollId, optionId, currentUserId);
	}

	async function handleClose(pollId: string) {
		await pollActions.close(pollId);
	}

	async function handleDelete(pollId: string) {
		await pollActions.delete(pollId);
	}

	function hasVoted(poll: Poll, optionId: number): boolean {
		const opt = poll.options.find((o) => o.id === optionId);
		return opt?.voter_ids.includes(currentUserId) ?? false;
	}

	function getPercentage(votes: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((votes / total) * 100);
	}

	function formatTime(ms: number): string {
		const date = new Date(ms);
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function isExpired(poll: Poll): boolean {
		if (!poll.expires_at) return false;
		return Date.now() > poll.expires_at;
	}
</script>

<div class="flex flex-col gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Polls</h3>
		<button
			class="rounded bg-[var(--brand-500)] px-2.5 py-1 text-[10px] font-medium text-white hover:bg-[var(--brand-560)]"
			onclick={() => (showCreate = !showCreate)}
		>
			{showCreate ? 'Cancel' : 'New Poll'}
		</button>
	</div>

	<!-- Create Form -->
	{#if showCreate}
		<div class="space-y-2 border-t border-[var(--bg-tertiary)] pt-3">
			<input
				type="text"
				placeholder="Ask a question..."
				class="w-full rounded bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
				bind:value={question}
			/>

			<div class="space-y-1.5">
				{#each optionInputs as opt, i}
					<div class="flex items-center gap-1.5">
						<input
							type="text"
							placeholder="Option {i + 1}"
							class="flex-1 rounded bg-[var(--bg-tertiary)] px-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
							bind:value={optionInputs[i]}
						/>
						{#if optionInputs.length > 2}
							<button
								class="text-xs text-[var(--text-muted)] hover:text-red-400"
								onclick={() => removeOption(i)}
							>
								x
							</button>
						{/if}
					</div>
				{/each}
			</div>

			{#if optionInputs.length < 10}
				<button
					class="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
					onclick={addOption}
				>
					+ Add option
				</button>
			{/if}

			<div class="flex gap-3">
				<label class="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={multiVote} />
					Multi-vote
				</label>
				<label class="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={anonymous} />
					Anonymous
				</label>
			</div>

			<button
				class="w-full rounded bg-[var(--brand-500)] py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-560)] disabled:opacity-50"
				disabled={!question.trim() || optionInputs.filter((o) => o.trim()).length < 2}
				onclick={handleCreate}
			>
				Create Poll
			</button>
		</div>
	{/if}

	<!-- Filter Tabs -->
	<div class="flex gap-1 rounded-md bg-[var(--bg-tertiary)] p-0.5">
		{#each ['active', 'closed', 'all'] as f}
			<button
				class="flex-1 rounded px-2 py-1 text-[10px] font-medium capitalize transition-colors {filter === f
					? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
					: 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
				onclick={() => (filter = f as 'active' | 'closed' | 'all')}
			>
				{f}
			</button>
		{/each}
	</div>

	<!-- Polls List -->
	{#if $pollsLoading}
		<div class="py-4 text-center text-xs text-[var(--text-muted)]">Loading polls...</div>
	{:else if filteredPolls.length === 0}
		<div class="py-4 text-center text-xs text-[var(--text-muted)]">
			{filter === 'active' ? 'No active polls' : filter === 'closed' ? 'No closed polls' : 'No polls yet'}
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each filteredPolls as poll (poll.id)}
				{@const expired = isExpired(poll)}
				{@const isClosed = poll.closed || expired}
				<div class="rounded-lg bg-[var(--bg-tertiary)] p-3">
					<div class="mb-2 flex items-start justify-between gap-2">
						<div>
							<p class="text-xs font-medium text-[var(--text-primary)]">{poll.question}</p>
							<p class="text-[10px] text-[var(--text-muted)]">
								{formatTime(poll.created_at)}
								{#if poll.multi_vote}
									<span class="ml-1 text-[var(--text-muted)]">multi-vote</span>
								{/if}
								{#if poll.anonymous}
									<span class="ml-1 text-[var(--text-muted)]">anonymous</span>
								{/if}
							</p>
						</div>
						{#if poll.creator_id === currentUserId && !isClosed}
							<div class="flex gap-1">
								<button
									class="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]"
									onclick={() => handleClose(poll.id)}
								>
									Close
								</button>
								<button
									class="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-red-400"
									onclick={() => handleDelete(poll.id)}
								>
									Delete
								</button>
							</div>
						{/if}
					</div>

					{#if isClosed}
						<div class="mb-2 rounded bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
							{expired ? 'Expired' : 'Closed'} - {poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}
						</div>
					{/if}

					<!-- Options -->
					<div class="space-y-1.5">
						{#each poll.options as opt (opt.id)}
							{@const pct = getPercentage(opt.votes, poll.total_votes)}
							{@const voted = hasVoted(poll, opt.id)}
							<button
								class="group relative w-full overflow-hidden rounded bg-[var(--bg-secondary)] text-left transition-colors {!isClosed ? 'hover:bg-[var(--bg-modifier-hover)]' : ''}"
								disabled={isClosed}
								onclick={() => handleVote(poll.id, opt.id)}
							>
								<!-- Progress bar -->
								<div
									class="absolute inset-y-0 left-0 transition-all duration-300 {voted
										? 'bg-[var(--brand-500)]/20'
										: 'bg-[var(--bg-tertiary)]'}"
									style="width: {pct}%"
								></div>
								<div class="relative flex items-center justify-between px-2.5 py-1.5">
									<span class="text-[11px] {voted ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}">
										{#if voted}
											<span class="mr-1">&#10003;</span>
										{/if}
										{opt.label}
									</span>
									<span class="text-[10px] tabular-nums text-[var(--text-muted)]">
										{pct}%
									</span>
								</div>
							</button>
						{/each}
					</div>

					<p class="mt-1.5 text-[10px] text-[var(--text-muted)]">
						{poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
