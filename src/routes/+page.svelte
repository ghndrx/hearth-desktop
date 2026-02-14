<script lang="ts">
	import { Sidebar, ChannelList, MessageArea, MemberList, currentServer } from '$lib';
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<!-- Server sidebar (72px) -->
	<Sidebar />

	<!-- Channel list (240px) - shows channels or DMs -->
	<ChannelList />

	<!-- Main message area (flexible) -->
	<MessageArea />

	<!-- Member list (240px) - only show when server selected -->
	{#if $currentServer}
		<MemberList />
	{/if}
</div>
