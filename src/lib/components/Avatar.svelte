<script lang="ts">
	interface Props {
		src?: string | null;
		alt?: string;
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		username?: string | null;
		showPresence?: boolean;
		status?: 'online' | 'idle' | 'dnd' | 'offline';
	}

	let {
		src = null,
		alt = 'Avatar',
		size = 'md',
		username = null,
		showPresence = false,
		status = 'offline'
	}: Props = $props();

	const sizes = {
		xs: 24,
		sm: 32,
		md: 40,
		lg: 80,
		xl: 128
	};

	const statusColors = {
		online: '#23a559',
		idle: '#f0b232',
		dnd: '#f23f43',
		offline: '#80848e'
	};

	let sizeValue = $derived(sizes[size]);
	let statusColor = $derived(statusColors[status]);

	function getColorFromString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = str.charCodeAt(i) + ((hash << 5) - hash);
		}
		const colors = [
			'#7289da',
			'#3498db',
			'#1abc9c',
			'#2ecc71',
			'#f1c40f',
			'#e67e22',
			'#e74c3c',
			'#9b59b6',
			'#e91e63',
			'#607d8b'
		];
		return colors[Math.abs(hash) % colors.length];
	}

	let fallbackColor = $derived(username ? getColorFromString(username) : '#7289da');
	let initials = $derived(username ? username.slice(0, 2).toUpperCase() : '?');
</script>

<div
	class="avatar-wrapper"
	class:xs={size === 'xs'}
	class:sm={size === 'sm'}
	class:md={size === 'md'}
	class:lg={size === 'lg'}
	class:xl={size === 'xl'}
	style="--size: {sizeValue}px;"
>
	{#if src}
		<img class="avatar" {src} {alt} width={sizeValue} height={sizeValue} loading="lazy" />
	{:else}
		<div class="avatar fallback" style="background-color: {fallbackColor};">
			<span class="initials">{initials}</span>
		</div>
	{/if}

	{#if showPresence}
		<div class="presence-dot" style="background-color: {statusColor};"></div>
	{/if}
</div>

<style>
	.avatar-wrapper {
		position: relative;
		width: var(--size);
		height: var(--size);
		flex-shrink: 0;
	}

	.avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.fallback {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.initials {
		color: white;
		font-weight: 600;
		font-size: calc(var(--size) * 0.4);
		text-transform: uppercase;
		user-select: none;
	}

	.presence-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 3px solid #2b2d31;
		box-sizing: content-box;
	}

	.xl .presence-dot {
		bottom: 4px;
		right: 4px;
		width: 16px;
		height: 16px;
	}

	.lg .presence-dot {
		bottom: 0;
		right: 0;
		width: 14px;
		height: 14px;
	}

	.sm .presence-dot,
	.xs .presence-dot {
		width: 8px;
		height: 8px;
		border-width: 2px;
	}
</style>
