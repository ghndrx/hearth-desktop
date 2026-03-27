<script lang="ts">
	import { Sidebar } from '$lib';
	import { invoke } from '@tauri-apps/api/core';
	import { voiceActions, isVoiceConnected } from '$lib/stores/voice';
	import type { VoiceParticipant } from '$lib/voice/types';

	// Test functions for PiP development
	async function togglePiP() {
		try {
			const isVisible = await invoke('toggle_pip_window');
			console.log('PiP window toggled:', isVisible);
		} catch (error) {
			console.error('Failed to toggle PiP:', error);
		}
	}

	function addTestParticipants() {
		// Simulate connecting to a voice channel
		voiceActions.setConnecting();
		voiceActions.setChannelInfo('test-channel', 'test-server');
		voiceActions.setConnected();

		// Add some mock participants for testing
		const testParticipants: VoiceParticipant[] = [
			{
				userId: 'user1',
				username: 'Alice',
				displayName: 'Alice Cooper',
				avatarUrl: '',
				isSpeaking: false,
				isMuted: false,
				isDeafened: false,
				connectionState: 'connected',
				joinedAt: new Date()
			},
			{
				userId: 'user2',
				username: 'Bob',
				displayName: 'Bob Smith',
				avatarUrl: '',
				isSpeaking: true,
				isMuted: false,
				isDeafened: false,
				connectionState: 'connected',
				joinedAt: new Date()
			},
			{
				userId: 'user3',
				username: 'Charlie',
				displayName: 'Charlie Brown',
				avatarUrl: '',
				isSpeaking: false,
				isMuted: true,
				isDeafened: false,
				connectionState: 'connected',
				joinedAt: new Date()
			}
		];

		testParticipants.forEach(participant => {
			voiceActions.addParticipant(participant);
		});
	}

	function clearTestData() {
		voiceActions.setDisconnected();
		voiceActions.clearParticipants();
	}

	// Simulate speaking changes for demo
	function toggleSpeaking(userId: string) {
		// This would normally come from the WebRTC system
		voiceActions.setParticipantSpeaking(userId, Math.random() > 0.5, Math.random());
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-dark-800 overflow-hidden">
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<h1 class="text-2xl font-bold text-gray-100 mb-2">Welcome to Hearth</h1>
				<p class="text-gray-400 mb-8">Select a server or start a conversation</p>

				<!-- PiP Testing Section -->
				<div class="bg-dark-700 rounded-lg p-6 max-w-md mx-auto">
					<h2 class="text-lg font-semibold text-gray-100 mb-4">Voice Channel PiP Testing</h2>

					<div class="flex flex-col gap-3">
						<button
							class="px-4 py-2 bg-hearth-500 hover:bg-hearth-600 text-white rounded-md transition-colors"
							on:click={togglePiP}
						>
							Toggle PiP Window
						</button>

						<button
							class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
							on:click={addTestParticipants}
						>
							Add Test Participants
						</button>

						<button
							class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
							on:click={clearTestData}
						>
							Clear Voice Data
						</button>

						{#if $isVoiceConnected}
							<div class="text-sm text-green-400 mt-2">
								✓ Connected to voice channel
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</main>
</div>
