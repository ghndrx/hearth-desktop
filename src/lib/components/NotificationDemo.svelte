<script lang="ts">
  import {
    sendMessage,
    sendMention,
    sendVoiceCall,
    sendSystemNotification,
    sendFriendRequest,
    sendServerUpdate,
    pendingNotificationCount,
    pendingNotificationsByCategory,
    notificationStore
  } from '$lib/notifications';

  function testMessage() {
    sendMessage(
      'New Message',
      'Hey there! This is a test message notification.',
      {
        channelId: 'test-channel-1',
        serverId: 'test-server-1',
        userId: 'test-user-1'
      }
    );
  }

  function testBatchedMessages() {
    // Send multiple messages to the same channel for batching
    setTimeout(() => sendMessage('Alice', 'Hey everyone!', { channelId: 'general', serverId: 'test-server' }), 0);
    setTimeout(() => sendMessage('Bob', 'How is everyone doing?', { channelId: 'general', serverId: 'test-server' }), 100);
    setTimeout(() => sendMessage('Carol', 'Great to see you all!', { channelId: 'general', serverId: 'test-server' }), 200);
  }

  function testMention() {
    sendMention(
      '@you in #general',
      'Someone mentioned you in the general channel.',
      {
        channelId: 'general',
        serverId: 'test-server',
        userId: 'mentioner-123'
      }
    );
  }

  function testVoiceCall() {
    sendVoiceCall(
      'Incoming Call',
      'Alice is calling you',
      {
        userId: 'alice-123',
        actions: [
          { id: 'accept', title: 'Accept' },
          { id: 'decline', title: 'Decline' }
        ]
      }
    );
  }

  function testSystem() {
    sendSystemNotification(
      'System Update',
      'A new version of Hearth is available for download.',
      { priority: 'normal', sound: true }
    );
  }

  function testFriendRequest() {
    sendFriendRequest(
      'Friend Request',
      'Bob wants to be your friend',
      {
        userId: 'bob-123',
        actions: [
          { id: 'accept', title: 'Accept' },
          { id: 'decline', title: 'Decline' }
        ]
      }
    );
  }

  function testServerUpdate() {
    sendServerUpdate(
      'Server Update',
      'New channels have been created in the Gaming server.',
      { serverId: 'gaming-server' }
    );
  }

  function testPriorityQueue() {
    // Test priority ordering by sending in reverse priority order
    setTimeout(() => sendSystemNotification('Low Priority', 'This is a low priority notification', { priority: 'low' }), 0);
    setTimeout(() => sendMessage('Normal Priority', 'This is a normal priority message'), 50);
    setTimeout(() => sendMention('High Priority', 'This is a high priority mention'), 100);
    setTimeout(() => sendVoiceCall('Urgent Priority', 'This is an urgent voice call'), 150);
  }

  function clearAll() {
    notificationStore.clearAll();
  }
</script>

<div class="notification-demo p-6 max-w-2xl mx-auto">
  <h2 class="text-2xl font-bold mb-6">Notification System Demo</h2>

  <!-- Status Display -->
  <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
    <h3 class="font-semibold mb-2">Current Status</h3>
    <p class="text-sm">
      Pending notifications: <span class="font-mono">{$pendingNotificationCount}</span>
    </p>
    <div class="mt-2 text-xs space-y-1">
      <div>Messages: {$pendingNotificationsByCategory.message}</div>
      <div>Mentions: {$pendingNotificationsByCategory.mention}</div>
      <div>Voice Calls: {$pendingNotificationsByCategory.voice_call}</div>
      <div>System: {$pendingNotificationsByCategory.system}</div>
      <div>Friend Requests: {$pendingNotificationsByCategory.friend_request}</div>
      <div>Server Updates: {$pendingNotificationsByCategory.server_update}</div>
    </div>
  </div>

  <!-- Demo Controls -->
  <div class="space-y-4">
    <h3 class="text-lg font-semibold">Test Individual Notifications</h3>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button
        type="button"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        on:click={testMessage}
      >
        Test Message
      </button>

      <button
        type="button"
        class="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
        on:click={testMention}
      >
        Test Mention
      </button>

      <button
        type="button"
        class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        on:click={testVoiceCall}
      >
        Test Voice Call
      </button>

      <button
        type="button"
        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        on:click={testSystem}
      >
        Test System
      </button>

      <button
        type="button"
        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        on:click={testFriendRequest}
      >
        Test Friend Request
      </button>

      <button
        type="button"
        class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        on:click={testServerUpdate}
      >
        Test Server Update
      </button>
    </div>

    <h3 class="text-lg font-semibold pt-4">Test Advanced Features</h3>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button
        type="button"
        class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        on:click={testBatchedMessages}
      >
        Test Smart Batching
        <span class="block text-xs text-indigo-200">Sends 3 messages quickly</span>
      </button>

      <button
        type="button"
        class="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition-colors"
        on:click={testPriorityQueue}
      >
        Test Priority Queue
        <span class="block text-xs text-pink-200">Sends mixed priorities</span>
      </button>
    </div>

    <div class="pt-4">
      <button
        type="button"
        class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        on:click={clearAll}
      >
        Clear All Pending
      </button>
    </div>
  </div>

  <!-- Instructions -->
  <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <h4 class="font-semibold mb-2">Instructions</h4>
    <ul class="text-sm space-y-1 text-gray-700 dark:text-gray-300">
      <li>• Click buttons to test different notification types</li>
      <li>• Watch the pending count update in real-time</li>
      <li>• Smart batching will group similar notifications (try the batching test)</li>
      <li>• Priority queue ensures urgent notifications are sent immediately</li>
      <li>• Notifications will appear as native system notifications</li>
      <li>• Configure settings in the Settings panel</li>
    </ul>
  </div>
</div>