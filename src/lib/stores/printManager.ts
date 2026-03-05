import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface PrintSettings {
	paper_size: string;
	orientation: string;
	margins: { top: number; bottom: number; left: number; right: number };
	include_avatars: boolean;
	include_timestamps: boolean;
	include_reactions: boolean;
	theme: 'light' | 'dark' | 'high_contrast';
	font_size: number;
	header_text: string | null;
	footer_text: string | null;
}

export interface PrintJob {
	id: string;
	title: string;
	content_type: string;
	status: string;
	created_at: string;
	page_count: number | null;
}

export interface PrintPreview {
	html: string;
	estimated_pages: number;
	settings: PrintSettings;
}

function createPrintManagerStore() {
	const settings = writable<PrintSettings>({
		paper_size: 'A4',
		orientation: 'portrait',
		margins: { top: 20, bottom: 20, left: 15, right: 15 },
		include_avatars: true,
		include_timestamps: true,
		include_reactions: false,
		theme: 'light',
		font_size: 12,
		header_text: null,
		footer_text: null
	});

	const jobs = writable<PrintJob[]>([]);
	const preview = writable<PrintPreview | null>(null);
	const isGenerating = writable(false);

	const activeJobs = derived(jobs, ($jobs) =>
		$jobs.filter((j) => j.status === 'queued' || j.status === 'printing')
	);

	return {
		settings,
		jobs,
		preview,
		isGenerating,
		activeJobs,

		async loadSettings() {
			try {
				const s = await invoke<PrintSettings>('print_get_settings');
				settings.set(s);
			} catch {
				// Use defaults
			}
		},

		async updateSettings(newSettings: PrintSettings) {
			const s = await invoke<PrintSettings>('print_update_settings', { settings: newSettings });
			settings.set(s);
			return s;
		},

		async generatePreview(contentHtml: string, overrideSettings?: PrintSettings) {
			isGenerating.set(true);
			try {
				const p = await invoke<PrintPreview>('print_generate_preview', {
					contentHtml,
					settings: overrideSettings ?? null
				});
				preview.set(p);
				return p;
			} finally {
				isGenerating.set(false);
			}
		},

		async createJob(title: string, contentType: string) {
			const job = await invoke<PrintJob>('print_create_job', { title, contentType });
			jobs.update((j) => [...j, job]);
			return job;
		},

		async cancelJob(jobId: string) {
			await invoke('print_cancel_job', { jobId });
			jobs.update((j) => j.map((job) => (job.id === jobId ? { ...job, status: 'cancelled' } : job)));
		},

		async loadJobs() {
			const j = await invoke<PrintJob[]>('print_get_jobs');
			jobs.set(j);
		},

		async clearJobs() {
			await invoke('print_clear_jobs');
			jobs.update((j) => j.filter((job) => job.status === 'queued' || job.status === 'printing'));
		},

		async exportPdf(contentHtml: string, outputPath: string, overrideSettings?: PrintSettings) {
			return invoke<string>('print_export_pdf', {
				contentHtml,
				outputPath,
				settings: overrideSettings ?? null
			});
		},

		printWindow() {
			window.print();
		}
	};
}

export const printManager = createPrintManagerStore();
