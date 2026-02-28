<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { invoke } from '@tauri-apps/api/core';
    import { listen, type UnlistenFn } from '@tauri-apps/api/event';
    import { fade, slide } from 'svelte/transition';

    export let channelId: string = '';
    export let showPanel: boolean = false;

    interface ScheduledMessage {
        id: string;
        channel_id: string;
        content: string;
        scheduled_at: number;
        created_at: number;
        status: 'pending' | 'sent' | 'failed' | 'cancelled';
        attachments: string[];
        reply_to: string | null;
    }

    const dispatch = createEventDispatcher<{
        schedule: { message: ScheduledMessage };
        send: { message: ScheduledMessage };
        close: void;
    }>();

    let scheduledMessages: ScheduledMessage[] = [];
    let newContent: string = '';
    let scheduledDate: string = '';
    let scheduledTime: string = '';
    let isLoading: boolean = false;
    let error: string = '';
    let editingId: string | null = null;
    let editContent: string = '';
    let editDate: string = '';
    let editTime: string = '';

    let unlisteners: UnlistenFn[] = [];

    // Set default scheduled time to 1 hour from now
    function getDefaultDateTime() {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
        now.setSeconds(0);
        
        scheduledDate = now.toISOString().split('T')[0];
        scheduledTime = now.toTimeString().slice(0, 5);
    }

    async function loadScheduledMessages() {
        try {
            isLoading = true;
            if (channelId) {
                scheduledMessages = await invoke<ScheduledMessage[]>('get_channel_scheduled_messages', {
                    channelId
                });
            } else {
                scheduledMessages = await invoke<ScheduledMessage[]>('get_scheduled_messages');
            }
            scheduledMessages = scheduledMessages.filter(m => m.status === 'pending');
        } catch (e) {
            console.error('Failed to load scheduled messages:', e);
        } finally {
            isLoading = false;
        }
    }

    async function scheduleMessage() {
        if (!newContent.trim() || !scheduledDate || !scheduledTime) {
            error = 'Please fill in all fields';
            return;
        }

        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).getTime();
        
        if (scheduledAt <= Date.now()) {
            error = 'Scheduled time must be in the future';
            return;
        }

        try {
            error = '';
            isLoading = true;
            
            const message = await invoke<ScheduledMessage>('schedule_message', {
                request: {
                    channel_id: channelId,
                    content: newContent,
                    scheduled_at: scheduledAt,
                    attachments: [],
                    reply_to: null
                }
            });

            scheduledMessages = [...scheduledMessages, message];
            newContent = '';
            getDefaultDateTime();
            
            dispatch('schedule', { message });
        } catch (e) {
            error = String(e);
        } finally {
            isLoading = false;
        }
    }

    async function cancelMessage(id: string) {
        try {
            await invoke('cancel_scheduled_message', { id });
            scheduledMessages = scheduledMessages.filter(m => m.id !== id);
        } catch (e) {
            error = String(e);
        }
    }

    async function updateMessage(id: string) {
        if (!editContent.trim() || !editDate || !editTime) {
            error = 'Please fill in all fields';
            return;
        }

        const scheduledAt = new Date(`${editDate}T${editTime}`).getTime();
        
        if (scheduledAt <= Date.now()) {
            error = 'Scheduled time must be in the future';
            return;
        }

        try {
            error = '';
            const updated = await invoke<ScheduledMessage>('update_scheduled_message', {
                request: {
                    id,
                    content: editContent,
                    scheduled_at: scheduledAt
                }
            });

            scheduledMessages = scheduledMessages.map(m => 
                m.id === id ? updated : m
            );
            editingId = null;
        } catch (e) {
            error = String(e);
        }
    }

    function startEditing(message: ScheduledMessage) {
        editingId = message.id;
        editContent = message.content;
        const date = new Date(message.scheduled_at);
        editDate = date.toISOString().split('T')[0];
        editTime = date.toTimeString().slice(0, 5);
    }

    function cancelEditing() {
        editingId = null;
        editContent = '';
        editDate = '';
        editTime = '';
    }

    function formatDateTime(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (date.toDateString() === now.toDateString()) {
            return `Today at ${timeStr}`;
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return `Tomorrow at ${timeStr}`;
        } else {
            return date.toLocaleDateString([], { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    function getTimeUntil(timestamp: number): string {
        const diff = timestamp - Date.now();
        if (diff < 0) return 'Now';
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `in ${days}d ${hours % 24}h`;
        if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
        return `in ${minutes}m`;
    }

    async function handleDueMessage(message: ScheduledMessage) {
        // Emit send event for parent to handle actual message sending
        dispatch('send', { message });
        
        // Mark as sent
        try {
            await invoke('mark_scheduled_sent', { id: message.id });
            scheduledMessages = scheduledMessages.filter(m => m.id !== message.id);
        } catch (e) {
            console.error('Failed to mark message as sent:', e);
        }
    }

    onMount(async () => {
        getDefaultDateTime();
        await loadScheduledMessages();

        // Listen for scheduler events
        unlisteners.push(
            await listen<ScheduledMessage>('scheduler:added', (event) => {
                if (!channelId || event.payload.channel_id === channelId) {
                    scheduledMessages = [...scheduledMessages, event.payload];
                }
            }),
            await listen<ScheduledMessage>('scheduler:cancelled', (event) => {
                scheduledMessages = scheduledMessages.filter(m => m.id !== event.payload.id);
            }),
            await listen<ScheduledMessage>('scheduler:updated', (event) => {
                scheduledMessages = scheduledMessages.map(m => 
                    m.id === event.payload.id ? event.payload : m
                );
            }),
            await listen<ScheduledMessage>('scheduler:due', async (event) => {
                if (!channelId || event.payload.channel_id === channelId) {
                    await handleDueMessage(event.payload);
                }
            }),
            await listen<ScheduledMessage>('scheduler:sent', (event) => {
                scheduledMessages = scheduledMessages.filter(m => m.id !== event.payload.id);
            })
        );
    });

    onDestroy(() => {
        unlisteners.forEach(fn => fn());
    });
</script>

{#if showPanel}
    <div class="scheduler-panel" transition:slide={{ duration: 200 }}>
        <div class="scheduler-header">
            <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                Schedule Message
            </h3>
            <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close scheduler">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>

        {#if error}
            <div class="error-banner" transition:fade>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
                <button on:click={() => error = ''}>×</button>
            </div>
        {/if}

        <div class="new-schedule">
            <textarea
                bind:value={newContent}
                placeholder="Type your message..."
                rows="3"
                disabled={isLoading}
            />
            <div class="schedule-controls">
                <div class="datetime-inputs">
                    <input
                        type="date"
                        bind:value={scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        disabled={isLoading}
                    />
                    <input
                        type="time"
                        bind:value={scheduledTime}
                        disabled={isLoading}
                    />
                </div>
                <button 
                    class="schedule-btn"
                    on:click={scheduleMessage}
                    disabled={isLoading || !newContent.trim()}
                >
                    {#if isLoading}
                        <span class="spinner"></span>
                    {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                        Schedule
                    {/if}
                </button>
            </div>
        </div>

        {#if scheduledMessages.length > 0}
            <div class="scheduled-list">
                <h4>Scheduled ({scheduledMessages.length})</h4>
                {#each scheduledMessages as message (message.id)}
                    <div class="scheduled-item" transition:slide={{ duration: 150 }}>
                        {#if editingId === message.id}
                            <div class="edit-form">
                                <textarea
                                    bind:value={editContent}
                                    rows="2"
                                />
                                <div class="edit-controls">
                                    <input type="date" bind:value={editDate} />
                                    <input type="time" bind:value={editTime} />
                                    <button class="save-btn" on:click={() => updateMessage(message.id)}>
                                        Save
                                    </button>
                                    <button class="cancel-btn" on:click={cancelEditing}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        {:else}
                            <div class="message-preview">
                                <p class="content">{message.content}</p>
                                <div class="meta">
                                    <span class="time">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        {formatDateTime(message.scheduled_at)}
                                    </span>
                                    <span class="countdown">{getTimeUntil(message.scheduled_at)}</span>
                                </div>
                            </div>
                            <div class="actions">
                                <button 
                                    class="edit-btn" 
                                    on:click={() => startEditing(message)}
                                    aria-label="Edit message"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                                <button 
                                    class="delete-btn" 
                                    on:click={() => cancelMessage(message.id)}
                                    aria-label="Cancel message"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else if !isLoading}
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p>No scheduled messages</p>
                <span>Messages you schedule will appear here</span>
            </div>
        {/if}
    </div>
{/if}

<!-- Trigger button for inline use -->
<slot name="trigger">
    <button 
        class="scheduler-trigger"
        on:click={() => showPanel = !showPanel}
        class:active={showPanel}
        aria-label="Schedule message"
        title="Schedule message"
    >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
        </svg>
    </button>
</slot>

<style>
    .scheduler-panel {
        background: var(--background-secondary, #2f3136);
        border: 1px solid var(--background-modifier-accent, #40444b);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        max-height: 400px;
        overflow-y: auto;
    }

    .scheduler-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .scheduler-header h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--header-primary, #fff);
    }

    .close-btn {
        background: transparent;
        border: none;
        color: var(--interactive-normal, #b9bbbe);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-btn:hover {
        background: var(--background-modifier-hover, #36393f);
        color: var(--interactive-hover, #dcddde);
    }

    .error-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--status-danger-background, rgba(237, 66, 69, 0.1));
        border: 1px solid var(--status-danger, #ed4245);
        border-radius: 4px;
        color: var(--status-danger, #ed4245);
        font-size: 13px;
        margin-bottom: 12px;
    }

    .error-banner button {
        margin-left: auto;
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 16px;
    }

    .new-schedule textarea {
        width: 100%;
        padding: 10px 12px;
        background: var(--background-tertiary, #202225);
        border: 1px solid var(--background-modifier-accent, #40444b);
        border-radius: 4px;
        color: var(--text-normal, #dcddde);
        font-size: 14px;
        resize: none;
        font-family: inherit;
    }

    .new-schedule textarea:focus {
        outline: none;
        border-color: var(--brand-experiment, #5865f2);
    }

    .schedule-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        gap: 8px;
    }

    .datetime-inputs {
        display: flex;
        gap: 8px;
    }

    .datetime-inputs input {
        padding: 6px 10px;
        background: var(--background-tertiary, #202225);
        border: 1px solid var(--background-modifier-accent, #40444b);
        border-radius: 4px;
        color: var(--text-normal, #dcddde);
        font-size: 13px;
    }

    .datetime-inputs input:focus {
        outline: none;
        border-color: var(--brand-experiment, #5865f2);
    }

    .schedule-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: var(--brand-experiment, #5865f2);
        border: none;
        border-radius: 4px;
        color: white;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .schedule-btn:hover:not(:disabled) {
        background: var(--brand-experiment-560, #4752c4);
    }

    .schedule-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .scheduled-list {
        margin-top: 16px;
    }

    .scheduled-list h4 {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--channels-default, #8e9297);
        margin: 0 0 8px 0;
    }

    .scheduled-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 10px 12px;
        background: var(--background-tertiary, #202225);
        border-radius: 4px;
        margin-bottom: 6px;
    }

    .message-preview {
        flex: 1;
        min-width: 0;
    }

    .message-preview .content {
        margin: 0 0 6px 0;
        font-size: 14px;
        color: var(--text-normal, #dcddde);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .message-preview .meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: var(--text-muted, #72767d);
    }

    .message-preview .time {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .message-preview .countdown {
        color: var(--brand-experiment, #5865f2);
        font-weight: 500;
    }

    .actions {
        display: flex;
        gap: 4px;
        margin-left: 12px;
    }

    .edit-btn, .delete-btn {
        padding: 6px;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: var(--interactive-normal, #b9bbbe);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .edit-btn:hover {
        background: var(--background-modifier-hover, #36393f);
        color: var(--interactive-hover, #dcddde);
    }

    .delete-btn:hover {
        background: rgba(237, 66, 69, 0.1);
        color: var(--status-danger, #ed4245);
    }

    .edit-form {
        width: 100%;
    }

    .edit-form textarea {
        width: 100%;
        padding: 8px 10px;
        background: var(--background-secondary, #2f3136);
        border: 1px solid var(--brand-experiment, #5865f2);
        border-radius: 4px;
        color: var(--text-normal, #dcddde);
        font-size: 13px;
        resize: none;
        font-family: inherit;
        margin-bottom: 8px;
    }

    .edit-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .edit-controls input {
        padding: 5px 8px;
        background: var(--background-secondary, #2f3136);
        border: 1px solid var(--background-modifier-accent, #40444b);
        border-radius: 4px;
        color: var(--text-normal, #dcddde);
        font-size: 12px;
    }

    .save-btn, .cancel-btn {
        padding: 5px 12px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
    }

    .save-btn {
        background: var(--brand-experiment, #5865f2);
        color: white;
    }

    .save-btn:hover {
        background: var(--brand-experiment-560, #4752c4);
    }

    .cancel-btn {
        background: var(--background-modifier-accent, #40444b);
        color: var(--text-normal, #dcddde);
    }

    .cancel-btn:hover {
        background: var(--background-modifier-hover, #36393f);
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        text-align: center;
        color: var(--text-muted, #72767d);
    }

    .empty-state svg {
        opacity: 0.5;
        margin-bottom: 12px;
    }

    .empty-state p {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-normal, #dcddde);
    }

    .empty-state span {
        font-size: 13px;
        margin-top: 4px;
    }

    .scheduler-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: var(--interactive-normal, #b9bbbe);
        cursor: pointer;
        transition: color 0.15s ease;
    }

    .scheduler-trigger:hover {
        color: var(--interactive-hover, #dcddde);
    }

    .scheduler-trigger.active {
        color: var(--brand-experiment, #5865f2);
    }
</style>
