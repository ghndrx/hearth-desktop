import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import DigestSettings from './DigestSettings.svelte';
import { digest } from '$lib/stores/digest';
import type { DigestPreferences, DigestPreview, DigestHistory } from '$lib/stores/digest';

// Mock the stores
vi.mock('$lib/stores/digest', () => {
	const mockDigest = {
		subscribe: vi.fn((callback) => {
			callback({
				preferences: null,
				channelPreferences: [],
				serverPreferences: [],
				preview: null,
				history: [],
				loading: false,
				error: null
			});
			return () => {};
		}),
		loadPreferences: vi.fn(),
		updatePreferences: vi.fn(),
		loadChannelPreferences: vi.fn(),
		updateChannelPreference: vi.fn(),
		loadServerPreferences: vi.fn(),
		updateServerPreference: vi.fn(),
		loadPreview: vi.fn(),
		clearQueue: vi.fn(),
		loadHistory: vi.fn(),
		getDigest: vi.fn(),
		generateDigestNow: vi.fn(),
		reset: vi.fn()
	};

	return {
		digest: mockDigest,
		digestEnabled: { subscribe: vi.fn((cb) => { cb(false); return () => {}; }) },
		digestFrequency: { subscribe: vi.fn((cb) => { cb('daily'); return () => {}; }) },
		digestPendingCount: { subscribe: vi.fn((cb) => { cb(0); return () => {}; }) },
		digestLoading: { subscribe: vi.fn((cb) => { cb(false); return () => {}; }) },
		formatDigestFrequency: (f: string) => f.charAt(0).toUpperCase() + f.slice(1),
		formatDigestStatus: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
		getNextDigestText: () => 'in 2h 30m',
		TIMEZONE_OPTIONS: [
			{ value: 'UTC', label: 'UTC' },
			{ value: 'America/New_York', label: 'Eastern Time (US)' }
		],
		DAY_OPTIONS: [
			{ value: 0, label: 'Sunday' },
			{ value: 1, label: 'Monday' }
		],
		HOUR_OPTIONS: Array.from({ length: 24 }, (_, i) => ({
			value: i,
			label: `${i.toString().padStart(2, '0')}:00`
		}))
	};
});

// Mock app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('DigestSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the component title', () => {
		render(DigestSettings);
		expect(screen.getByText('Digest Notifications')).toBeInTheDocument();
	});

	it('renders the enable toggle', () => {
		render(DigestSettings);
		expect(screen.getByText('Enable Digest Notifications')).toBeInTheDocument();
	});

	it('renders frequency options', () => {
		render(DigestSettings);
		expect(screen.getByText('Hourly')).toBeInTheDocument();
		expect(screen.getByText('Daily')).toBeInTheDocument();
		expect(screen.getByText('Weekly')).toBeInTheDocument();
	});

	it('renders aggregation mode options', () => {
		render(DigestSettings);
		expect(screen.getByText('By Server')).toBeInTheDocument();
		expect(screen.getByText('By Channel')).toBeInTheDocument();
	});

	it('renders muted channels only toggle', () => {
		render(DigestSettings);
		expect(screen.getByText('Muted Channels Only')).toBeInTheDocument();
	});

	it('renders max messages slider', () => {
		render(DigestSettings);
		expect(screen.getByText('Max Messages Per Source')).toBeInTheDocument();
	});

	it('renders recent digests section', () => {
		render(DigestSettings);
		expect(screen.getByText('Recent Digests')).toBeInTheDocument();
	});

	it('shows no digests message when history is empty', () => {
		render(DigestSettings);
		expect(screen.getByText('No digests sent yet')).toBeInTheDocument();
	});

	it('loads data on mount', async () => {
		render(DigestSettings);
		
		await waitFor(() => {
			expect(digest.loadPreferences).toHaveBeenCalled();
			expect(digest.loadPreview).toHaveBeenCalled();
			expect(digest.loadHistory).toHaveBeenCalledWith(5);
		});
	});

	it('hides title when embedded', () => {
		render(DigestSettings, { props: { embedded: true } });
		expect(screen.queryByText('Digest Notifications')).not.toBeInTheDocument();
	});
});

describe('formatDigestFrequency', () => {
	it('formats frequency correctly', async () => {
		const { formatDigestFrequency } = await import('$lib/stores/digest');
		
		expect(formatDigestFrequency('hourly' as any)).toBe('Hourly');
		expect(formatDigestFrequency('daily' as any)).toBe('Daily');
		expect(formatDigestFrequency('weekly' as any)).toBe('Weekly');
	});
});

describe('formatDigestStatus', () => {
	it('formats status correctly', async () => {
		const { formatDigestStatus } = await import('$lib/stores/digest');
		
		expect(formatDigestStatus('pending' as any)).toBe('Pending');
		expect(formatDigestStatus('sent' as any)).toBe('Sent');
		expect(formatDigestStatus('failed' as any)).toBe('Failed');
		expect(formatDigestStatus('skipped' as any)).toBe('Skipped');
	});
});
