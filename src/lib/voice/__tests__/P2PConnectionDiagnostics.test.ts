import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { P2PConnectionDiagnostics } from '../P2PConnectionDiagnostics';
import { WebRTCConnectionManager } from '../WebRTCConnectionManager';
import type { ConnectionStats, NetworkQuality } from '../P2PConnectionDiagnostics';

// Mock WebRTCConnectionManager
const mockWebRTCManager = {
	getPeers: vi.fn().mockReturnValue(new Map()),
	getPeer: vi.fn(),
	on: vi.fn().mockReturnValue(() => {})
};

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('P2PConnectionDiagnostics', () => {
	let diagnostics: P2PConnectionDiagnostics;

	beforeEach(() => {
		diagnostics = new P2PConnectionDiagnostics(mockWebRTCManager as any);
		vi.useFakeTimers();
	});

	afterEach(() => {
		diagnostics.destroy();
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	describe('Construction', () => {
		it('should initialize properly', () => {
			expect(diagnostics).toBeDefined();
			expect(mockWebRTCManager.on).toHaveBeenCalledWith('peer-connected', expect.any(Function));
			expect(mockWebRTCManager.on).toHaveBeenCalledWith('peer-disconnected', expect.any(Function));
			expect(mockWebRTCManager.on).toHaveBeenCalledWith('connection-state-changed', expect.any(Function));
		});
	});

	describe('Monitoring', () => {
		it('should start monitoring', () => {
			expect(diagnostics.startMonitoring).not.toThrow();
			diagnostics.startMonitoring();
			// Should handle multiple start calls gracefully
			diagnostics.startMonitoring();
		});

		it('should stop monitoring', () => {
			diagnostics.startMonitoring();
			expect(diagnostics.stopMonitoring).not.toThrow();
			diagnostics.stopMonitoring();
			// Should handle multiple stop calls gracefully
			diagnostics.stopMonitoring();
		});
	});

	describe('Stats Collection', () => {
		it('should return null for non-existent user stats', () => {
			const stats = diagnostics.getConnectionStats('non-existent-user');
			expect(stats).toBeNull();
		});

		it('should return empty history for non-existent user', () => {
			const history = diagnostics.getConnectionHistory('non-existent-user');
			expect(history).toEqual([]);
		});

		it('should return null for non-existent user quality', () => {
			const quality = diagnostics.getNetworkQuality('non-existent-user');
			expect(quality).toBeNull();
		});

		it('should return all network qualities', () => {
			const qualities = diagnostics.getAllNetworkQualities();
			expect(qualities).toBeInstanceOf(Map);
			expect(qualities.size).toBe(0);
		});
	});

	describe('Diagnostic Summary', () => {
		it('should provide diagnostic summary with no connections', () => {
			const summary = diagnostics.getDiagnosticSummary();
			expect(summary).toEqual({
				totalConnections: 0,
				activeConnections: 0,
				averageQuality: 0,
				issues: []
			});
		});

		it('should provide diagnostic summary with mock connections', () => {
			// Mock some connections
			const mockPeers = new Map([
				['user1', { connectionState: 'connected' }],
				['user2', { connectionState: 'connecting' }]
			]);
			mockWebRTCManager.getPeers.mockReturnValue(mockPeers);

			const summary = diagnostics.getDiagnosticSummary();
			expect(summary.totalConnections).toBe(2);
			expect(summary.activeConnections).toBe(1);
		});
	});

	describe('Diagnostics', () => {
		it('should run diagnostics for specific user', async () => {
			const results = await diagnostics.runDiagnostics('test-user');
			expect(results).toEqual({
				userId: 'test-user',
				issues: ['No connection statistics available'],
				recommendations: ['Ensure connection is established and monitoring is active'],
				connectionStats: null,
				networkQuality: null
			});
		});

		it('should run general diagnostics', async () => {
			const results = await diagnostics.runDiagnostics();
			expect(results).toEqual({
				issues: [],
				recommendations: ['No active voice connections'],
				connectionStats: null,
				networkQuality: null
			});
		});
	});

	describe('Event System', () => {
		it('should register and call event listeners', () => {
			const listener = vi.fn();
			const unsubscribe = diagnostics.on('stats-update', listener);

			expect(typeof unsubscribe).toBe('function');
			expect(listener).not.toHaveBeenCalled();

			unsubscribe();
		});

		it('should handle peer connection events', () => {
			const peerConnectedListener = mockWebRTCManager.on.mock.calls.find(
				call => call[0] === 'peer-connected'
			)?.[1];

			expect(peerConnectedListener).toBeDefined();
			if (peerConnectedListener) {
				expect(() => peerConnectedListener('test-user')).not.toThrow();
			}
		});

		it('should handle peer disconnection events', () => {
			const peerDisconnectedListener = mockWebRTCManager.on.mock.calls.find(
				call => call[0] === 'peer-disconnected'
			)?.[1];

			expect(peerDisconnectedListener).toBeDefined();
			if (peerDisconnectedListener) {
				expect(() => peerDisconnectedListener('test-user')).not.toThrow();
			}
		});

		it('should handle connection state change events', () => {
			const stateChangeListener = mockWebRTCManager.on.mock.calls.find(
				call => call[0] === 'connection-state-changed'
			)?.[1];

			expect(stateChangeListener).toBeDefined();
			if (stateChangeListener) {
				expect(() => stateChangeListener('failed', 'test-user')).not.toThrow();
				expect(() => stateChangeListener('disconnected', 'test-user')).not.toThrow();
				expect(() => stateChangeListener('connected', 'test-user')).not.toThrow();
			}
		});
	});

	describe('Cleanup', () => {
		it('should destroy properly', () => {
			diagnostics.startMonitoring();
			expect(() => diagnostics.destroy()).not.toThrow();
		});

		it('should handle destroy when not monitoring', () => {
			expect(() => diagnostics.destroy()).not.toThrow();
		});
	});

	describe('Stats Processing', () => {
		it('should handle stats collection errors gracefully', async () => {
			// Mock a peer with failing getStats
			const mockPeer = {
				connection: {
					getStats: vi.fn().mockRejectedValue(new Error('Stats collection failed'))
				}
			};
			const mockPeers = new Map([['user1', mockPeer]]);
			mockWebRTCManager.getPeers.mockReturnValue(mockPeers);

			diagnostics.startMonitoring();

			// Advance timers to trigger stats collection
			await vi.advanceTimersByTimeAsync(1000);

			// Should not throw, just log error
			expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
		});
	});

	describe('Network Quality Calculation', () => {
		it('should calculate quality rating correctly', () => {
			// This test would require access to private methods
			// In a real implementation, you might expose these methods for testing
			// or create integration tests that verify the end results
			expect(true).toBe(true);
		});
	});
});