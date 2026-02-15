import { writable, derived } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration: number;
	dismissible: boolean;
	createdAt: number;
}

export interface ToastOptions {
	type?: ToastType;
	duration?: number;
	dismissible?: boolean;
}

const DEFAULT_DURATION = 5000;

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	let idCounter = 0;

	function add(message: string, options: ToastOptions = {}): string {
		const id = `toast-${++idCounter}-${Date.now()}`;
		const toast: Toast = {
			id,
			message,
			type: options.type ?? 'info',
			duration: options.duration ?? DEFAULT_DURATION,
			dismissible: options.dismissible ?? true,
			createdAt: Date.now()
		};

		update((toasts) => [...toasts, toast]);

		// Auto-dismiss after duration (unless duration is 0)
		if (toast.duration > 0) {
			setTimeout(() => {
				dismiss(id);
			}, toast.duration);
		}

		return id;
	}

	function dismiss(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	function dismissAll() {
		update(() => []);
	}

	return {
		subscribe,
		add,
		dismiss,
		dismissAll,

		// Convenience methods
		success(message: string, options: Omit<ToastOptions, 'type'> = {}) {
			return add(message, { ...options, type: 'success' });
		},

		error(message: string, options: Omit<ToastOptions, 'type'> = {}) {
			return add(message, { ...options, type: 'error' });
		},

		warning(message: string, options: Omit<ToastOptions, 'type'> = {}) {
			return add(message, { ...options, type: 'warning' });
		},

		info(message: string, options: Omit<ToastOptions, 'type'> = {}) {
			return add(message, { ...options, type: 'info' });
		}
	};
}

export const toasts = createToastStore();

// Derived store for toast count
export const toastCount = derived(toasts, ($toasts) => $toasts.length);
