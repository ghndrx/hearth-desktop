<script lang="ts">
	import { trayStatus, type AppStatus } from '$lib/stores/window';

	let {
		showDropdown = false,
		size = 'sm'
	}: {
		showDropdown?: boolean;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	let dropdownOpen = $state(false);

	const statusOptions: { value: AppStatus; label: string; color: string; }[] = [
		{ value: 'online', label: 'Online', color: 'bg-green-500' },
		{ value: 'away', label: 'Away', color: 'bg-yellow-500' },
		{ value: 'busy', label: 'Busy', color: 'bg-red-500' },
		{ value: 'offline', label: 'Offline', color: 'bg-gray-500' }
	];

	function getStatusInfo(status: AppStatus) {
		return statusOptions.find(option => option.value === status) || statusOptions[3];
	}

	function handleStatusChange(newStatus: AppStatus) {
		trayStatus.setStatus(newStatus);
		dropdownOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			dropdownOpen = false;
		}
	}

	$effect(() => {
		if (dropdownOpen) {
			document.addEventListener('keydown', handleKeydown);
			return () => document.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<div class="status-indicator" class:size-sm={size === 'sm'} class:size-md={size === 'md'} class:size-lg={size === 'lg'}>
	{#if showDropdown}
		<div class="dropdown-container">
			<button
				class="status-button"
				onclick={() => dropdownOpen = !dropdownOpen}
				aria-expanded={dropdownOpen}
				aria-haspopup="true"
			>
				<div class="status-dot {getStatusInfo($trayStatus).color}"></div>
				<span class="status-label">{getStatusInfo($trayStatus).label}</span>
				<svg class="dropdown-arrow" class:rotated={dropdownOpen} width="12" height="12" viewBox="0 0 12 12">
					<path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>

			{#if dropdownOpen}
				<div class="dropdown-menu">
					{#each statusOptions as option}
						<button
							class="dropdown-item"
							class:active={$trayStatus === option.value}
							onclick={() => handleStatusChange(option.value)}
						>
							<div class="status-dot {option.color}"></div>
							<span>{option.label}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="status-display">
			<div class="status-dot {getStatusInfo($trayStatus).color}"></div>
			<span class="status-label">{getStatusInfo($trayStatus).label}</span>
		</div>
	{/if}
</div>

<style>
	.status-indicator {
		display: flex;
		align-items: center;
		position: relative;
	}

	.status-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dropdown-container {
		position: relative;
	}

	.status-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border-primary);
		border-radius: 0.375rem;
		background: var(--bg-primary);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.875rem;
	}

	.status-button:hover {
		background: var(--bg-hover);
		border-color: var(--border-hover);
	}

	.status-button:focus {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
	}

	.status-dot {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.size-sm .status-dot {
		width: 0.5rem;
		height: 0.5rem;
	}

	.size-lg .status-dot {
		width: 1rem;
		height: 1rem;
	}

	.status-label {
		font-weight: 500;
	}

	.size-sm .status-label {
		font-size: 0.75rem;
	}

	.size-lg .status-label {
		font-size: 1rem;
	}

	.dropdown-arrow {
		transition: transform 0.2s ease;
		color: var(--text-secondary);
	}

	.dropdown-arrow.rotated {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.25rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		z-index: 50;
		overflow: hidden;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color 0.2s ease;
		font-size: 0.875rem;
	}

	.dropdown-item:hover {
		background: var(--bg-hover);
	}

	.dropdown-item.active {
		background: var(--bg-modifier-accent);
		color: var(--brand-primary);
	}

	.dropdown-item:focus {
		outline: none;
		background: var(--bg-hover);
	}
</style>