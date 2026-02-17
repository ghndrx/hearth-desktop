import { writable, get } from 'svelte/store';
import { api } from '$lib/api';

export interface UploadItem {
	id: string;
	file: File;
	channelId: string;
	progress: number;
	status: 'pending' | 'uploading' | 'completed' | 'error';
	error?: string;
	url?: string;
	attachmentId?: string;
	abortController?: AbortController;
}

interface UploadStore {
	uploads: UploadItem[];
	showProgress: boolean;
}

function createUploadStore() {
	const { subscribe, update, set } = writable<UploadStore>({
		uploads: [],
		showProgress: false
	});

	let uploadCounter = 0;

	function generateId(): string {
		return `upload-${Date.now()}-${uploadCounter++}`;
	}

	async function uploadFile(
		file: File,
		channelId: string,
		altText?: string
	): Promise<{ url: string; attachmentId: string } | null> {
		const id = generateId();
		const abortController = new AbortController();

		const uploadItem: UploadItem = {
			id,
			file,
			channelId,
			progress: 0,
			status: 'pending',
			abortController
		};

		// Add to store
		update(state => ({
			...state,
			uploads: [...state.uploads, uploadItem],
			showProgress: true
		}));

		try {
			// Update status to uploading
			update(state => ({
				...state,
				uploads: state.uploads.map(u =>
					u.id === id ? { ...u, status: 'uploading' as const } : u
				)
			}));

			// Create FormData
			const formData = new FormData();
			formData.append('file', file);
			if (altText) {
				formData.append('alt_text', altText);
			}

			// Upload with progress tracking
			const result = await uploadWithProgress(
				`/channels/${channelId}/attachments`,
				formData,
				(progress) => {
					update(state => ({
						...state,
						uploads: state.uploads.map(u =>
							u.id === id ? { ...u, progress } : u
						)
					}));
				},
				abortController.signal
			);

			// Mark as completed
			update(state => ({
				...state,
				uploads: state.uploads.map(u =>
					u.id === id
						? { ...u, status: 'completed' as const, progress: 100, url: result.url, attachmentId: result.id }
						: u
				)
			}));

			return { url: result.url, attachmentId: result.id };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Upload failed';
			
			// Don't mark as error if aborted
			if (error instanceof DOMException && error.name === 'AbortError') {
				update(state => ({
					...state,
					uploads: state.uploads.filter(u => u.id !== id)
				}));
				return null;
			}

			update(state => ({
				...state,
				uploads: state.uploads.map(u =>
					u.id === id ? { ...u, status: 'error' as const, error: errorMessage } : u
				)
			}));

			return null;
		}
	}

	async function uploadMultiple(
		files: File[],
		channelId: string,
		altTexts?: Record<string, string>
	): Promise<Array<{ url: string; attachmentId: string } | null>> {
		const results = await Promise.all(
			files.map(file => uploadFile(file, channelId, altTexts?.[file.name]))
		);
		return results;
	}

	function cancelUpload(id: string) {
		const state = get({ subscribe });
		const upload = state.uploads.find(u => u.id === id);
		
		if (upload?.abortController) {
			upload.abortController.abort();
		}

		update(state => ({
			...state,
			uploads: state.uploads.filter(u => u.id !== id)
		}));
	}

	function retryUpload(id: string) {
		update(state => {
			const upload = state.uploads.find(u => u.id === id);
			if (!upload) return state;

			// Remove old upload
			const newUploads = state.uploads.filter(u => u.id !== id);
			
			return {
				...state,
				uploads: newUploads
			};
		});

		// Get the upload to retry
		const state = get({ subscribe });
		const oldUpload = state.uploads.find(u => u.id === id);
		if (oldUpload) {
			uploadFile(oldUpload.file, oldUpload.channelId);
		}
	}

	function removeUpload(id: string) {
		update(state => ({
			...state,
			uploads: state.uploads.filter(u => u.id !== id)
		}));

		// Hide progress if no more uploads
		const state = get({ subscribe });
		if (state.uploads.length === 0) {
			update(state => ({ ...state, showProgress: false }));
		}
	}

	function clearCompleted() {
		update(state => ({
			...state,
			uploads: state.uploads.filter(u => u.status !== 'completed')
		}));
	}

	function hideProgress() {
		update(state => ({ ...state, showProgress: false }));
	}

	function showProgressPanel() {
		update(state => ({ ...state, showProgress: true }));
	}

	return {
		subscribe,
		uploadFile,
		uploadMultiple,
		cancelUpload,
		retryUpload,
		removeUpload,
		clearCompleted,
		hideProgress,
		showProgressPanel
	};
}

// Helper function to upload with XMLHttpRequest for progress tracking
async function uploadWithProgress(
	url: string,
	formData: FormData,
	onProgress: (progress: number) => void,
	signal?: AbortSignal
): Promise<{ id: string; url: string }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		// Get base URL from api module
		const baseUrl = '/api/v1';
		const fullUrl = `${baseUrl}${url}`;

		xhr.open('POST', fullUrl);

		// Get auth token from localStorage
		const token = localStorage.getItem('token');
		if (token) {
			xhr.setRequestHeader('Authorization', `Bearer ${token}`);
		}

		// Track progress
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				const progress = Math.round((e.loaded / e.total) * 100);
				onProgress(progress);
			}
		};

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const response = JSON.parse(xhr.responseText);
					resolve(response);
				} catch {
					reject(new Error('Invalid response'));
				}
			} else {
				try {
					const error = JSON.parse(xhr.responseText);
					reject(new Error(error.error || `Upload failed: ${xhr.status}`));
				} catch {
					reject(new Error(`Upload failed: ${xhr.status}`));
				}
			}
		};

		xhr.onerror = () => {
			reject(new Error('Network error'));
		};

		xhr.ontimeout = () => {
			reject(new Error('Upload timed out'));
		};

		// Handle abort signal
		if (signal) {
			signal.addEventListener('abort', () => {
				xhr.abort();
				reject(new DOMException('Upload cancelled', 'AbortError'));
			});
		}

		xhr.send(formData);
	});
}

export const uploadStore = createUploadStore();

// Derived stores for convenience
export const activeUploads = {
	subscribe: (callback: (value: UploadItem[]) => void) => {
		return uploadStore.subscribe(state => {
			callback(state.uploads.filter(u => u.status === 'uploading' || u.status === 'pending'));
		});
	}
};

export const hasActiveUploads = {
	subscribe: (callback: (value: boolean) => void) => {
		return uploadStore.subscribe(state => {
			callback(state.uploads.some(u => u.status === 'uploading' || u.status === 'pending'));
		});
	}
};
