export { auth, isAuthenticated, user, user as currentUser } from './auth';
export { gateway, gatewayState, onGatewayEvent } from './gateway';
export { servers, currentServer, currentServer as activeServer } from './servers';
export { channels, currentChannel, currentChannel as activeChannel, loadServerChannels } from './channels';
export { messages } from './messages';
export { settings, isSettingsOpen, appSettings, currentTheme } from './settings';
export { typingStore, formatTypingText, setCurrentUserId } from './typing';
export { popoutStore, isPopoutOpen } from './popout';
export { threadStore, currentThread, threadMessages, threadLoading } from './thread';
export { voiceCallStore, voiceCall, isInVoiceCall, voiceCallParticipants, voiceCallChannel, formatCallDuration, formatDuration } from './voiceCall';
export { isPTTPressed, isPTTRecording, isCapturingPTTKey, pushToTalk } from './pushToTalk';
export { screenShare, isScreenSharing, isScreenShareModalOpen, isPreviewing, screenShareStream, screenShareError } from './screenShare';
export { voiceSettings } from './settings';
export { pinnedMessagesStore, pinnedMessagesOpen, pinnedMessages, pinnedMessagesLoading } from './pinnedMessages';
export { searchStore, isSearchOpen, searchResults, searchLoading, searchError, searchTotalCount, searchHasMore } from './search';
export { getServerRoles, loadServerRoles, createRole, updateRole, deleteRole, reorderRoles, rolesLoading, rolesError, PERMISSIONS, hasPermission, getPermissionList } from './roles';
export { imagePreviewStore } from './imagePreview';
export {
	splitViewStore,
	splitViewPanels,
	splitViewConfig,
	splitViewEnabled,
	splitViewResizing,
	splitViewPanelCount,
	canAddSplitPanel,
	splitViewTotalWidth,
	type PinnedPanel,
	type PanelType,
	type SplitViewConfig
} from './splitView';
export {
	notifications,
	unreadCount,
	hasUnread,
	isLoading as notificationsLoading,
	readState,
	requestNotificationPermission,
	getNotificationPermission
} from './notifications';
export {
	mentions,
	unreadMentions,
	unreadMentionCount,
	mentionsByChannel,
	mentionsByServer,
	type MentionContext,
	type MentionStats
} from './mentions';
export {
	digest,
	digestEnabled,
	digestFrequency,
	digestPendingCount,
	digestLoading,
	digestError,
	formatDigestFrequency,
	formatDigestMode,
	formatDigestStatus,
	getNextDigestText,
	TIMEZONE_OPTIONS,
	DAY_OPTIONS,
	HOUR_OPTIONS,
	type DigestFrequency,
	type DigestAggregationMode,
	type DigestMode,
	type DigestStatus,
	type DigestPreferences,
	type DigestChannelPreference,
	type DigestServerPreference,
	type DigestPreview,
	type DigestHistory,
	type UpdateDigestPreferencesRequest
} from './digest';
export {
	aiProviders,
	userCredentials,
	modelRoutings,
	availableModels,
	providerTypes,
	featureTypes,
	providerHealth,
	aiLoading,
	aiError,
	enabledProviders,
	defaultProvider,
	providersByType,
	modelsByProvider,
	fetchProviders,
	fetchUserCredentials,
	fetchProviderTypes,
	fetchFeatureTypes,
	fetchAvailableModels,
	fetchProviderHealth,
	fetchModelRoutings,
	createProvider,
	updateProvider,
	deleteProvider,
	setUserCredentials,
	deleteUserCredential,
	setModelRouting,
	deleteModelRouting,
	chat,
	generateEmbeddings,
	initializeAI,
	type AIProvider,
	type UserAICredential,
	type ModelRouting,
	type ModelInfo,
	type ProviderInfo,
	type FeatureInfo,
	type ProviderHealth,
	type ProviderType,
	type FeatureType,
	type ChatMessage,
	type ChatResponse,
	type EmbeddingResponse
} from './ai';

// Desktop-specific stores
export {
	systemThemeInfo,
	themePreferences,
	effectiveTheme,
	effectiveAccentColor,
	prefersReducedMotion,
	prefersHighContrast,
	initializeTheme,
	setThemeMode,
	setThemePreferences,
	toggleTheme,
	useSystemTheme,
	isDarkMode,
	cleanupTheme,
	type SystemTheme,
	type ThemeInfo,
	type ThemePreferences,
} from './systemTheme';
export { aiChatOpen, aiChatMinimized, openAIChat, closeAIChat, toggleAIChat, minimizeAIChat, restoreAIChat, aiChatVisible } from './aiChatUI';
export { windowBehavior, minimizeToTray, closeToTray, startMinimized, alwaysOnTop, rememberWindowState, showInTaskbar, singleClickTrayToggle, type WindowBehaviorSettings } from './windowBehavior';
export { secureKeychain, keychainAvailable, keychainLoading } from './secureKeychain';
export { sessionTimer, elapsedFormatted, elapsedHuman, type SessionTimerState } from './sessionTimer';
