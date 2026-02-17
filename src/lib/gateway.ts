// Re-export from stores/gateway for backward compatibility
// This file exists to maintain backward compatibility with imports from '$lib/gateway'
// All new code should import from '$lib/stores/gateway' instead

export { 
  gateway, 
  gatewayState, 
  onGatewayEvent,
  isConnected,
  isConnecting,
  gatewayLatency,
  Op
} from './stores/gateway';

// Re-export type for backward compatibility
export type { GatewayState } from './stores/gateway';
