import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface PollOption {
  id: number;
  label: string;
  votes: number;
  voter_ids: string[];
}

export interface Poll {
  id: string;
  channel_id: string;
  creator_id: string;
  question: string;
  options: PollOption[];
  multi_vote: boolean;
  anonymous: boolean;
  expires_at: number | null;
  created_at: number;
  closed: boolean;
  total_votes: number;
}

export interface CreatePollRequest {
  channel_id: string;
  creator_id: string;
  question: string;
  options: string[];
  multi_vote?: boolean;
  anonymous?: boolean;
  expires_at?: number | null;
}

const pollsStore = writable<Poll[]>([]);
const loadingStore = writable(false);
const errorStore = writable<string | null>(null);

let unlisteners: UnlistenFn[] = [];

async function setupListeners() {
  unlisteners.push(
    await listen<Poll>('poll:created', (event) => {
      pollsStore.update(polls => [event.payload, ...polls]);
    }),
    await listen<Poll>('poll:updated', (event) => {
      pollsStore.update(polls =>
        polls.map(p => p.id === event.payload.id ? event.payload : p)
      );
    }),
    await listen<Poll>('poll:closed', (event) => {
      pollsStore.update(polls =>
        polls.map(p => p.id === event.payload.id ? event.payload : p)
      );
    }),
    await listen<string>('poll:deleted', (event) => {
      pollsStore.update(polls => polls.filter(p => p.id !== event.payload));
    })
  );
}

function cleanup() {
  unlisteners.forEach(fn => fn());
  unlisteners = [];
}

async function loadPolls(channelId: string, includeClosed = true) {
  loadingStore.set(true);
  errorStore.set(null);
  try {
    const polls = await invoke<Poll[]>('poll_list_by_channel', {
      channelId,
      includeClosed
    });
    pollsStore.set(polls);
  } catch (e) {
    errorStore.set(String(e));
  } finally {
    loadingStore.set(false);
  }
}

async function createPoll(request: CreatePollRequest): Promise<Poll | null> {
  errorStore.set(null);
  try {
    const poll = await invoke<Poll>('poll_create', { request });
    return poll;
  } catch (e) {
    errorStore.set(String(e));
    return null;
  }
}

async function vote(pollId: string, optionId: number, voterId: string): Promise<Poll | null> {
  errorStore.set(null);
  try {
    const poll = await invoke<Poll>('poll_vote', { pollId, optionId, voterId });
    return poll;
  } catch (e) {
    errorStore.set(String(e));
    return null;
  }
}

async function closePoll(pollId: string): Promise<Poll | null> {
  errorStore.set(null);
  try {
    const poll = await invoke<Poll>('poll_close', { pollId });
    return poll;
  } catch (e) {
    errorStore.set(String(e));
    return null;
  }
}

async function deletePoll(pollId: string): Promise<boolean> {
  errorStore.set(null);
  try {
    return await invoke<boolean>('poll_delete', { pollId });
  } catch (e) {
    errorStore.set(String(e));
    return false;
  }
}

export const polls = pollsStore;
export const pollsLoading = loadingStore;
export const pollsError = errorStore;

export const pollActions = {
  init: setupListeners,
  cleanup,
  load: loadPolls,
  create: createPoll,
  vote,
  close: closePoll,
  delete: deletePoll,
};
