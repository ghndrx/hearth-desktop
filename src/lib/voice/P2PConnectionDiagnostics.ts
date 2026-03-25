import { browser } from '$app/environment';
import type { WebRTCConnectionManager } from './WebRTCConnectionManager';

export interface ConnectionStats {
	userId: string;
	connectionState: RTCPeerConnectionState;
	iceConnectionState: RTCIceConnectionState;
	iceGatheringState: RTCIceGatheringState;
	bytesReceived: number;
	bytesSent: number;
	packetsReceived: number;
	packetsSent: number;
	packetsLost: number;
	jitter: number;
	roundTripTime: number;
	audioLevel: number;
	timestamp: number;
}

export interface NetworkQuality {
	rating: 'excellent' | 'good' | 'poor' | 'very-poor' | 'unknown';
	score: number; // 0-100
	latency: number; // ms
	packetLoss: number; // percentage
	jitter: number; // ms
	bandwidth: number; // kbps
}

export interface DiagnosticEvent {
	type: 'connection-quality' | 'network-change' | 'stats-update' | 'warning' | 'error';
	timestamp: number;
	data: any;
}

/**
 * P2P Connection Diagnostics and Monitoring
 * Provides detailed monitoring and diagnostics for WebRTC peer connections
 */
export class P2PConnectionDiagnostics {
	private webrtcManager: WebRTCConnectionManager;
	private statsInterval: ReturnType<typeof setInterval> | null = null;
	private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	private connectionStats = new Map<string, ConnectionStats[]>();
	private networkQuality = new Map<string, NetworkQuality>();
	private isMonitoring = false;

	// Configuration
	private readonly STATS_INTERVAL = 1000; // 1 second
	private readonly MAX_STATS_HISTORY = 60; // Keep 1 minute of stats
	private readonly QUALITY_THRESHOLDS = {
		excellent: { latency: 50, packetLoss: 0.5, jitter: 10 },
		good: { latency: 150, packetLoss: 2.0, jitter: 30 },
		poor: { latency: 300, packetLoss: 5.0, jitter: 50 }
	};

	constructor(webrtcManager: WebRTCConnectionManager) {
		this.webrtcManager = webrtcManager;

		if (!browser) return;
		this.setupEventListeners();
	}

	/**
	 * Start monitoring connections
	 */
	startMonitoring(): void {
		if (!browser || this.isMonitoring) return;

		this.isMonitoring = true;
		this.statsInterval = setInterval(() => {
			this.collectStats();
		}, this.STATS_INTERVAL);

		console.log('[P2P Diagnostics] Started monitoring');
	}

	/**
	 * Stop monitoring connections
	 */
	stopMonitoring(): void {
		if (!this.isMonitoring) return;

		this.isMonitoring = false;
		if (this.statsInterval) {
			clearInterval(this.statsInterval);
			this.statsInterval = null;
		}

		console.log('[P2P Diagnostics] Stopped monitoring');
	}

	/**
	 * Get current connection stats for a peer
	 */
	getConnectionStats(userId: string): ConnectionStats | null {
		const stats = this.connectionStats.get(userId);
		return stats ? stats[stats.length - 1] : null;
	}

	/**
	 * Get historical connection stats for a peer
	 */
	getConnectionHistory(userId: string): ConnectionStats[] {
		return this.connectionStats.get(userId) || [];
	}

	/**
	 * Get current network quality for a peer
	 */
	getNetworkQuality(userId: string): NetworkQuality | null {
		return this.networkQuality.get(userId) || null;
	}

	/**
	 * Get all current network qualities
	 */
	getAllNetworkQualities(): Map<string, NetworkQuality> {
		return new Map(this.networkQuality);
	}

	/**
	 * Get connection diagnostic summary
	 */
	getDiagnosticSummary(): {
		totalConnections: number;
		activeConnections: number;
		averageQuality: number;
		issues: string[];
	} {
		const peers = this.webrtcManager.getPeers();
		const activeConnections = Array.from(peers.values()).filter(
			peer => peer.connectionState === 'connected'
		).length;

		const qualities = Array.from(this.networkQuality.values());
		const averageQuality = qualities.length > 0
			? qualities.reduce((sum, q) => sum + q.score, 0) / qualities.length
			: 0;

		const issues: string[] = [];
		qualities.forEach((quality, index) => {
			if (quality.rating === 'poor' || quality.rating === 'very-poor') {
				const userId = Array.from(this.networkQuality.keys())[index];
				issues.push(`Poor connection quality with ${userId}`);
			}
		});

		// Check for high latency
		qualities.forEach((quality, index) => {
			if (quality.latency > this.QUALITY_THRESHOLDS.poor.latency) {
				const userId = Array.from(this.networkQuality.keys())[index];
				issues.push(`High latency (${quality.latency}ms) with ${userId}`);
			}
		});

		// Check for packet loss
		qualities.forEach((quality, index) => {
			if (quality.packetLoss > this.QUALITY_THRESHOLDS.poor.packetLoss) {
				const userId = Array.from(this.networkQuality.keys())[index];
				issues.push(`Packet loss (${quality.packetLoss.toFixed(1)}%) with ${userId}`);
			}
		});

		return {
			totalConnections: peers.size,
			activeConnections,
			averageQuality,
			issues
		};
	}

	/**
	 * Run connection diagnostics and return recommendations
	 */
	async runDiagnostics(userId?: string): Promise<{
		userId?: string;
		issues: string[];
		recommendations: string[];
		connectionStats: ConnectionStats | null;
		networkQuality: NetworkQuality | null;
	}> {
		const results = {
			userId,
			issues: [] as string[],
			recommendations: [] as string[],
			connectionStats: null as ConnectionStats | null,
			networkQuality: null as NetworkQuality | null
		};

		if (userId) {
			// Diagnose specific connection
			results.connectionStats = this.getConnectionStats(userId);
			results.networkQuality = this.getNetworkQuality(userId);

			if (!results.connectionStats) {
				results.issues.push('No connection statistics available');
				results.recommendations.push('Ensure connection is established and monitoring is active');
				return results;
			}

			// Check connection state
			if (results.connectionStats.connectionState !== 'connected') {
				results.issues.push(`Connection state is ${results.connectionStats.connectionState}`);
				if (results.connectionStats.connectionState === 'failed') {
					results.recommendations.push('Try reconnecting to this user');
				}
			}

			// Check ICE connection state
			if (results.connectionStats.iceConnectionState === 'disconnected' ||
				results.connectionStats.iceConnectionState === 'failed') {
				results.issues.push(`ICE connection state is ${results.connectionStats.iceConnectionState}`);
				results.recommendations.push('Check network connectivity and firewall settings');
			}

			// Check network quality
			if (results.networkQuality) {
				if (results.networkQuality.rating === 'poor' || results.networkQuality.rating === 'very-poor') {
					results.issues.push(`Poor network quality (${results.networkQuality.rating})`);
				}

				if (results.networkQuality.latency > this.QUALITY_THRESHOLDS.good.latency) {
					results.issues.push(`High latency: ${results.networkQuality.latency}ms`);
					results.recommendations.push('Consider using a different network or check for network congestion');
				}

				if (results.networkQuality.packetLoss > this.QUALITY_THRESHOLDS.good.packetLoss) {
					results.issues.push(`Packet loss: ${results.networkQuality.packetLoss.toFixed(1)}%`);
					results.recommendations.push('Check network stability and consider using a wired connection');
				}

				if (results.networkQuality.jitter > this.QUALITY_THRESHOLDS.good.jitter) {
					results.issues.push(`High jitter: ${results.networkQuality.jitter}ms`);
					results.recommendations.push('Network jitter may cause audio quality issues');
				}
			}
		} else {
			// Diagnose all connections
			const summary = this.getDiagnosticSummary();
			results.issues.push(...summary.issues);

			if (summary.activeConnections === 0) {
				results.recommendations.push('No active voice connections');
			} else if (summary.averageQuality < 50) {
				results.recommendations.push('Overall connection quality is poor - check network settings');
			}
		}

		return results;
	}

	/**
	 * Register an event listener
	 */
	on(event: string, callback: (...args: unknown[]) => void): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);
		return () => {
			this.listeners.get(event)?.delete(callback);
		};
	}

	/**
	 * Collect stats from all peer connections
	 */
	private async collectStats(): Promise<void> {
		const peers = this.webrtcManager.getPeers();

		for (const [userId, peer] of peers) {
			try {
				const stats = await peer.connection.getStats();
				const connectionStats = this.processRTCStats(userId, stats);
				this.updateConnectionStats(userId, connectionStats);
				this.updateNetworkQuality(userId, connectionStats);
			} catch (error) {
				console.error(`[P2P Diagnostics] Failed to collect stats for ${userId}:`, error);
			}
		}
	}

	/**
	 * Process RTCStatsReport into our ConnectionStats format
	 */
	private processRTCStats(userId: string, stats: RTCStatsReport): ConnectionStats {
		let bytesReceived = 0;
		let bytesSent = 0;
		let packetsReceived = 0;
		let packetsSent = 0;
		let packetsLost = 0;
		let jitter = 0;
		let roundTripTime = 0;
		let audioLevel = 0;

		stats.forEach(stat => {
			if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
				bytesReceived = stat.bytesReceived || 0;
				packetsReceived = stat.packetsReceived || 0;
				packetsLost = stat.packetsLost || 0;
				jitter = (stat.jitter || 0) * 1000; // Convert to ms
				audioLevel = stat.audioLevel || 0;
			} else if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
				bytesSent = stat.bytesSent || 0;
				packetsSent = stat.packetsSent || 0;
			} else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
				roundTripTime = (stat.currentRoundTripTime || 0) * 1000; // Convert to ms
			}
		});

		const peer = this.webrtcManager.getPeer(userId);
		return {
			userId,
			connectionState: peer?.connectionState || 'new',
			iceConnectionState: peer?.connection.iceConnectionState || 'new',
			iceGatheringState: peer?.connection.iceGatheringState || 'new',
			bytesReceived,
			bytesSent,
			packetsReceived,
			packetsSent,
			packetsLost,
			jitter,
			roundTripTime,
			audioLevel,
			timestamp: Date.now()
		};
	}

	/**
	 * Update connection stats history
	 */
	private updateConnectionStats(userId: string, stats: ConnectionStats): void {
		if (!this.connectionStats.has(userId)) {
			this.connectionStats.set(userId, []);
		}

		const history = this.connectionStats.get(userId)!;
		history.push(stats);

		// Limit history size
		if (history.length > this.MAX_STATS_HISTORY) {
			history.splice(0, history.length - this.MAX_STATS_HISTORY);
		}

		this.emit('stats-update', userId, stats);
	}

	/**
	 * Calculate and update network quality
	 */
	private updateNetworkQuality(userId: string, stats: ConnectionStats): void {
		const history = this.connectionStats.get(userId) || [];

		// Calculate packet loss rate
		let packetLossRate = 0;
		if (history.length >= 2) {
			const current = stats;
			const previous = history[history.length - 2];
			const receivedDelta = current.packetsReceived - previous.packetsReceived;
			const lostDelta = current.packetsLost - previous.packetsLost;
			if (receivedDelta + lostDelta > 0) {
				packetLossRate = (lostDelta / (receivedDelta + lostDelta)) * 100;
			}
		}

		// Calculate bandwidth (approximate)
		let bandwidth = 0;
		if (history.length >= 2) {
			const current = stats;
			const previous = history[history.length - 2];
			const timeDelta = (current.timestamp - previous.timestamp) / 1000; // seconds
			const bytesDelta = (current.bytesReceived - previous.bytesReceived) +
							  (current.bytesSent - previous.bytesSent);
			bandwidth = (bytesDelta * 8) / timeDelta / 1000; // kbps
		}

		// Determine quality rating
		let rating: NetworkQuality['rating'] = 'unknown';
		let score = 0;

		if (stats.connectionState === 'connected') {
			const { latency, packetLoss, jitter: jitterThreshold } = this.QUALITY_THRESHOLDS.excellent;

			if (stats.roundTripTime <= latency &&
				packetLossRate <= packetLoss &&
				stats.jitter <= jitterThreshold) {
				rating = 'excellent';
				score = 90 + Math.min(10, 10 - stats.roundTripTime / latency * 10);
			} else if (stats.roundTripTime <= this.QUALITY_THRESHOLDS.good.latency &&
					   packetLossRate <= this.QUALITY_THRESHOLDS.good.packetLoss &&
					   stats.jitter <= this.QUALITY_THRESHOLDS.good.jitter) {
				rating = 'good';
				score = 70 + Math.min(20, 20 - stats.roundTripTime / this.QUALITY_THRESHOLDS.good.latency * 20);
			} else if (stats.roundTripTime <= this.QUALITY_THRESHOLDS.poor.latency &&
					   packetLossRate <= this.QUALITY_THRESHOLDS.poor.packetLoss &&
					   stats.jitter <= this.QUALITY_THRESHOLDS.poor.jitter) {
				rating = 'poor';
				score = 40 + Math.min(30, 30 - stats.roundTripTime / this.QUALITY_THRESHOLDS.poor.latency * 30);
			} else {
				rating = 'very-poor';
				score = Math.max(0, 40 - stats.roundTripTime / this.QUALITY_THRESHOLDS.poor.latency * 40);
			}
		}

		const quality: NetworkQuality = {
			rating,
			score,
			latency: stats.roundTripTime,
			packetLoss: packetLossRate,
			jitter: stats.jitter,
			bandwidth
		};

		const previousQuality = this.networkQuality.get(userId);
		this.networkQuality.set(userId, quality);

		// Emit quality change event if rating changed
		if (previousQuality?.rating !== quality.rating) {
			this.emit('connection-quality', userId, quality, previousQuality);

			if (quality.rating === 'poor' || quality.rating === 'very-poor') {
				this.emit('warning', userId, `Connection quality degraded to ${quality.rating}`);
			}
		}
	}

	/**
	 * Setup event listeners for connection changes
	 */
	private setupEventListeners(): void {
		// Listen for peer connections/disconnections
		this.webrtcManager.on('peer-connected', (userId: string) => {
			console.log(`[P2P Diagnostics] Peer connected: ${userId}`);
			this.emit('network-change', { type: 'peer-connected', userId });
		});

		this.webrtcManager.on('peer-disconnected', (userId: string) => {
			console.log(`[P2P Diagnostics] Peer disconnected: ${userId}`);

			// Clean up stats for disconnected peer
			this.connectionStats.delete(userId);
			this.networkQuality.delete(userId);

			this.emit('network-change', { type: 'peer-disconnected', userId });
		});

		this.webrtcManager.on('connection-state-changed', (state: RTCPeerConnectionState, userId: string) => {
			console.log(`[P2P Diagnostics] Connection state changed for ${userId}: ${state}`);

			if (state === 'failed') {
				this.emit('error', userId, 'Connection failed');
			} else if (state === 'disconnected') {
				this.emit('warning', userId, 'Connection disconnected');
			}

			this.emit('network-change', { type: 'connection-state-change', userId, state });
		});
	}

	/**
	 * Emit an event to listeners
	 */
	private emit(event: string, ...args: unknown[]): void {
		this.listeners.get(event)?.forEach(callback => {
			try {
				callback(...args);
			} catch (error) {
				console.error(`[P2P Diagnostics] Error in event listener for ${event}:`, error);
			}
		});
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.stopMonitoring();
		this.listeners.clear();
		this.connectionStats.clear();
		this.networkQuality.clear();
		console.log('[P2P Diagnostics] Destroyed');
	}
}