<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		globalShortcuts,
		setupShortcutListeners,
		cleanupShortcutListeners,
	} from '$lib/stores/globalShortcuts';
	import { toggleMute, toggleDeafen } from '$lib/stores/voice';
	import { pttActions } from '$lib/stores/ptt';
	import { get } from 'svelte/store';

	async function registerAllShortcuts() {
		const state = get(globalShortcuts);
		globalShortcuts.setLoading(true);

		for (const binding of state.bindings) {
			await globalShortcuts.registerShortcut(binding);
		}

		globalShortcuts.setLoading(false);
	}

	function handleShortcutTriggered(id: string) {
		switch (id) {
			case 'global-toggle-mute':
				toggleMute();
				break;
			case 'global-toggle-deafen':
				toggleDeafen();
				break;
			// PTT press is handled via ptt:start/ptt:stop events
		}
	}

	function handlePTTStart() {
		pttActions.startTransmission();
	}

	function handlePTTStop() {
		pttActions.stopTransmission();
	}

	onMount(async () => {
		await setupShortcutListeners(handleShortcutTriggered, handlePTTStart, handlePTTStop);
		await registerAllShortcuts();
	});

	onDestroy(async () => {
		await cleanupShortcutListeners();
		await globalShortcuts.unregisterAll();
	});
</script>
