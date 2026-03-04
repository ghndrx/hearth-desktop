// Layout components
export { default as Sidebar } from './Sidebar.svelte';
export { default as ChannelList } from './ChannelList.svelte';
export { default as ChannelHeader } from './ChannelHeader.svelte';
export { default as ChannelCategory } from './ChannelCategory.svelte';
export { default as ChannelItem } from './ChannelItem.svelte';
export { default as MessageArea } from './MessageArea.svelte';
export { default as MemberList } from './MemberList.svelte';
export { default as MemberSection } from './MemberSection.svelte';
export { default as MemberItem } from './MemberItem.svelte';
export { default as TypingIndicator } from './TypingIndicator.svelte';

// Server components
export { default as ServerIcon } from './ServerIcon.svelte';
export { default as ServerFolder } from './ServerFolder.svelte';
export { default as ServerList } from './ServerList.svelte';
export { default as ServerHeader } from './ServerHeader.svelte';

// Message components
export { default as Message } from './Message.svelte';
export { default as MessageGroup } from './MessageGroup.svelte';
export { default as MessageInput } from './MessageInput.svelte';
export { default as MessageList } from './MessageList.svelte';
export { default as ReplyPreview } from './ReplyPreview.svelte';
export { default as Reactions } from './Reactions.svelte';
export { default as EmojiPicker } from './EmojiPicker.svelte';
export { default as GifPicker } from './GifPicker.svelte';
export { default as ReactionPicker } from './ReactionPicker.svelte';
export { default as MarkdownRenderer } from './MarkdownRenderer.svelte';
export { default as MentionAutocomplete } from './MentionAutocomplete.svelte';
export { default as MentionHighlight } from './MentionHighlight.svelte';

// Notification components
export { default as NotificationBell } from './NotificationBell.svelte';
export { default as NotificationHistoryPanel } from './NotificationHistoryPanel.svelte';
export { default as DigestIndicator } from './DigestIndicator.svelte';
export { default as DigestSettings } from './DigestSettings.svelte';
export { default as MentionsPanel } from './MentionsPanel.svelte';

// Media components
export { default as MediaPlayer } from './MediaPlayer.svelte';
export { default as MediaSessionManager } from './MediaSessionManager.svelte';
export { default as MediaKeyHandler } from './MediaKeyHandler.svelte';
export { default as FileUploadZone } from './FileUploadZone.svelte';
export { default as FileQuickPreview } from './FileQuickPreview.svelte';
export { default as NativeFileDrop } from './NativeFileDrop.svelte';
export { default as NativeNotificationManager } from './NativeNotificationManager.svelte';
export { default as UploadProgress } from './UploadProgress.svelte';
export { default as CustomEmojiManager } from './CustomEmojiManager.svelte';
// FEAT-001: Thread components
export { default as ThreadView } from './ThreadView.svelte';
export { default as ThreadSidebar } from './ThreadSidebar.svelte';
export { default as ThreadParticipants } from './ThreadParticipants.svelte';
export { default as ThreadReplyIndicator } from './ThreadReplyIndicator.svelte';

// FEAT-003: Split View components
export { default as SplitView } from './SplitView.svelte';
export { default as SplitViewContainer } from './SplitViewContainer.svelte';
export { default as PinnedPanel } from './PinnedPanel.svelte';
export { default as SplitViewPinButton } from './SplitViewPinButton.svelte';
export { default as ResizeHandle } from './ResizeHandle.svelte';

// User components
export { default as Avatar } from './Avatar.svelte';
export { default as UserPopout } from './UserPopout.svelte';
export { default as UserPanel } from './UserPanel.svelte';
export { default as PresenceIndicator } from './PresenceIndicator.svelte';
export { default as UserStatusPicker } from './UserStatusPicker.svelte';
export { default as FullProfileModal } from './FullProfileModal.svelte';
export { default as ProfileSettings } from './ProfileSettings.svelte';
export { default as ImageCropModal } from './ImageCropModal.svelte';

// Settings components
export { default as SettingsLayout } from './SettingsLayout.svelte';
export { default as UserSettings } from './UserSettings.svelte';
export { default as ServerSettings } from './ServerSettings.svelte';
export { default as NotificationSettings } from './NotificationSettings.svelte';
export { default as DeviceManagement } from './DeviceManagement.svelte';
export { default as RoleEditor } from './RoleEditor.svelte';
export { default as AutoModerationSettings } from './AutoModerationSettings.svelte';
export { default as AuditLogViewer } from './AuditLogViewer.svelte';
export { default as AISettings } from './AISettings.svelte';

// AI Chat components
export { default as AIChat } from './AIChat.svelte';

// Skeleton loading components
export { default as SkeletonBase } from './SkeletonBase.svelte';
export { default as SkeletonMessage } from './SkeletonMessage.svelte';
export { default as SkeletonChannel } from './SkeletonChannel.svelte';
export { default as SkeletonUser } from './SkeletonUser.svelte';

export { default as ThemeSettings } from './ThemeSettings.svelte';
export { default as AutoLaunchSettings } from './AutoLaunchSettings.svelte';
export { default as KeyboardShortcutsSettings } from './KeyboardShortcutsSettings.svelte';
export { default as SpellcheckSettings } from './SpellcheckSettings.svelte';

// Channel management components
export { default as SortableChannelList } from './SortableChannelList.svelte';
export { default as ChannelPermissionsModal } from './ChannelPermissionsModal.svelte';

// Modal components
export { default as Modal } from './Modal.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as CreateServerModal } from './CreateServerModal.svelte';
export { default as CreateChannelModal } from './CreateChannelModal.svelte';
export { default as InviteModal } from './InviteModal.svelte';
export { default as InviteLink } from './InviteLink.svelte';
export { default as ServerSettingsModal } from './ServerSettingsModal.svelte';
export { default as BanListModal } from './BanListModal.svelte';
export { default as BanListSection } from './BanListSection.svelte';
export { default as MemberBanModal } from './MemberBanModal.svelte';
export { default as MemberRolesModal } from './MemberRolesModal.svelte';
export { default as ImagePreviewModal } from './ImagePreviewModal.svelte';
export { default as NewDMModal } from './NewDMModal.svelte';
export { default as KeyboardShortcutsModal } from './KeyboardShortcutsModal.svelte';

// Search components
export { default as QuickSwitcher } from './QuickSwitcher.svelte';
export { default as SearchResults } from './SearchResults.svelte';
export { default as CommandPalette } from './CommandPalette.svelte';
export { default as SessionManager } from './SessionManager.svelte';

// Context menu components
export { default as ContextMenu } from './ContextMenu.svelte';
export { default as ContextMenuItem } from './ContextMenuItem.svelte';

// UI components
export { default as Button } from './Button.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as LoadingSpinner } from './LoadingSpinner.svelte';
export { default as LazyImage } from './LazyImage.svelte';
export { default as NetworkStatus } from './NetworkStatus.svelte';
export { default as BatteryIndicator } from './BatteryIndicator.svelte';
export { default as PerformanceMonitor } from './PerformanceMonitor.svelte';
export { default as ConnectionStatusIndicator } from './ConnectionStatusIndicator.svelte';
export { default as ZoomControl } from './ZoomControl.svelte';
export { default as SystemInfoPanel } from './SystemInfoPanel.svelte';
export { default as PowerManager } from './PowerManager.svelte';

// Voice components
export { default as VoiceCallOverlay } from './VoiceCallOverlay.svelte';
export { default as VoiceMiniPlayer } from './VoiceMiniPlayer.svelte';
export { default as VoiceConnectedBar } from './VoiceConnectedBar.svelte';
export { default as VoiceParticipant } from './VoiceParticipant.svelte';
export { default as VoiceDictationManager } from './VoiceDictationManager.svelte';
export { default as FileUpload } from './FileUpload.svelte';
export { default as QuickActionsPanel } from './QuickActionsPanel.svelte';
export { default as WindowStateManager } from './WindowStateManager.svelte';
export { default as UpdateManager } from './UpdateManager.svelte';
export { default as BadgeManager } from './BadgeManager.svelte';
export { default as DeepLinkHandler } from './DeepLinkHandler.svelte';
export { default as ClipboardManager } from './ClipboardManager.svelte';
export { default as PasteHistoryManager } from './PasteHistoryManager.svelte';
export { default as ReadReceiptIndicator } from './ReadReceiptIndicator.svelte';
export { default as RecentFilesManager } from './RecentFilesManager.svelte';
export { default as WhatsNewModal } from './WhatsNewModal.svelte';
export { default as WindowBehaviorSettings } from './WindowBehaviorSettings.svelte';
export { default as TrayMenuManager } from './TrayMenuManager.svelte';
export { default as SystemTrayContextMenu } from './SystemTrayContextMenu.svelte';
export { default as SystemTrayBadgeManager } from './SystemTrayBadgeManager.svelte';
export { default as SystemMonitorWidget } from './SystemMonitorWidget.svelte';
export { default as ClockWidget } from './ClockWidget.svelte';
export { default as QuickNotesWidget } from './QuickNotesWidget.svelte';
export { default as ToastManager } from './ToastManager.svelte';
export { default as PrintManager } from './PrintManager.svelte';
export { default as BookmarksManager } from './BookmarksManager.svelte';
export { default as TaskbarProgressManager } from './TaskbarProgressManager.svelte';
export { default as StartupLoadingScreen } from './StartupLoadingScreen.svelte';
export { default as StartupRestoreManager } from './StartupRestoreManager.svelte';
export { default as NativeFileWatcher } from './NativeFileWatcher.svelte';
export { default as DesktopIntegration } from './DesktopIntegration.svelte';
export { default as DesktopIntegrationDiagnostics } from './DesktopIntegrationDiagnostics.svelte';
export { default as FocusTimer } from './FocusTimer.svelte';
export { default as PomodoroWidget } from './PomodoroWidget.svelte';
export { default as ScreenDimmingManager } from './ScreenDimmingManager.svelte';
export { default as MultiMonitorManager } from './MultiMonitorManager.svelte';
export { default as LocaleManager } from './LocaleManager.svelte';
export { default as BackupManager } from './BackupManager.svelte';
export { default as TTSManager } from './TTSManager.svelte';
export { default as WindowArrangement } from './WindowArrangement.svelte';
export { default as ProxySettingsManager } from './ProxySettingsManager.svelte';
export { default as SessionStatsPanel } from './SessionStatsPanel.svelte';
export { default as LogViewer } from './LogViewer.svelte';
export { default as AboutDialog } from './AboutDialog.svelte';
export { default as ActivityTimeline } from './ActivityTimeline.svelte';
export { default as WorkspaceProfilesManager } from './WorkspaceProfilesManager.svelte';
export { default as WindowTitleManager } from './WindowTitleManager.svelte';
export { default as ReadingListManager } from './ReadingListManager.svelte';
export { default as CrashReporter } from './CrashReporter.svelte';
export { default as SystemUsageMonitor } from './SystemUsageMonitor.svelte';
export { default as FloatingResourceBubble } from './FloatingResourceBubble.svelte';
export { default as NetworkQualityIndicator } from './NetworkQualityIndicator.svelte';
export { default as DataExporter } from './DataExporter.svelte';
export { default as ScreenColorPicker } from './ScreenColorPicker.svelte';
export { default as SnoozeManager } from './SnoozeManager.svelte';
export { default as AmbientSoundManager } from './AmbientSoundManager.svelte';
export { default as DockBadgeManager } from './DockBadgeManager.svelte';
export { default as WindowTabsManager } from './WindowTabsManager.svelte';
export { default as PictureInPictureManager } from './PictureInPictureManager.svelte';
export { default as TextSnippetsManager } from './TextSnippetsManager.svelte';
export { default as GestureManager } from './GestureManager.svelte';
export { default as VibrancyManager } from './VibrancyManager.svelte';
export { default as QuickCaptureWidget } from './QuickCaptureWidget.svelte';
export { default as DraftsManager } from './DraftsManager.svelte';
export { default as TouchBarManager } from './TouchBarManager.svelte';
export { default as TabSwitcher } from './TabSwitcher.svelte';
export { default as FloatingToolbar } from './FloatingToolbar.svelte';
export { default as HotkeyOverlay } from './HotkeyOverlay.svelte';
export { default as QuickReplyManager } from './QuickReplyManager.svelte';
export { default as ScreenTimeTracker } from './ScreenTimeTracker.svelte';
export { default as SecureStorageManager } from './SecureStorageManager.svelte';
export { default as UnreadSummaryWidget } from './UnreadSummaryWidget.svelte';

// Native feature components
export { default as BandwidthMonitor } from './BandwidthMonitor.svelte';
export { default as CalendarStatus } from './CalendarStatus.svelte';
export { default as NativeAuthManager } from './NativeAuthManager.svelte';

// Screenshot components
export { default as ScreenshotGallery } from './ScreenshotGallery.svelte';

// Timer and wellness components
export { default as SleepTimerManager } from './SleepTimerManager.svelte';

// Message scheduling components
export { default as MessageScheduler } from './MessageScheduler.svelte';
export { default as MessageReminderManager } from './MessageReminderManager.svelte';

// Quick access components
export { default as QuickActionsWheel } from './QuickActionsWheel.svelte';

// Desktop automation components
export { default as HotCornersManager } from './HotCornersManager.svelte';

// Help and onboarding components
export { default as ContextualHelpPanel } from './ContextualHelpPanel.svelte';

// Typing experience components
export { default as TypingSoundEffects } from './TypingSoundEffects.svelte';

// Performance monitoring components
export { default as StartupPerformanceProfiler } from './StartupPerformanceProfiler.svelte';

// Clipboard and text expansion components
export { default as ClipboardHistoryManager } from './ClipboardHistoryManager.svelte';
export { default as TextExpander } from './TextExpander.svelte';

// Auto-reply components
export { default as AutoReplyManager } from './AutoReplyManager.svelte';

// Native share components
export { default as NativeShareSheet } from './NativeShareSheet.svelte';

// World clock components
export { default as TimezoneWidget } from './TimezoneWidget.svelte';

// Password components
export { default as PasswordGeneratorWidget } from './PasswordGeneratorWidget.svelte';

// Currency components
export { default as CurrencyConverterWidget } from './CurrencyConverterWidget.svelte';

// Color picker components
export { default as ColorPickerWidget } from './ColorPickerWidget.svelte';

// Developer tools widgets
export { default as RegexTesterWidget } from './RegexTesterWidget.svelte';
export { default as RandomPickerWidget } from './RandomPickerWidget.svelte';
export { default as NumberBaseConverterWidget } from './NumberBaseConverterWidget.svelte';
export { default as LoremIpsumGeneratorWidget } from './LoremIpsumGeneratorWidget.svelte';
export { default as UrlEncoderWidget } from './UrlEncoderWidget.svelte';

// Form components (synced from frontend)
export { default as Dropdown } from './Dropdown.svelte';
export { default as FileUploadPreview } from './FileUploadPreview.svelte';
export { default as FriendsList } from './FriendsList.svelte';
export { default as NotificationBadge } from './NotificationBadge.svelte';
export { default as Skeleton } from './Skeleton.svelte';
export { default as TextInput } from './TextInput.svelte';
export { default as Toggle } from './Toggle.svelte';

// Native disk usage widget
export { default as DiskUsageWidget } from './DiskUsageWidget.svelte';

// Text diff widget
export { default as TextDiffWidget } from './TextDiffWidget.svelte';

// Unix timestamp converter widget
export { default as TimestampConverterWidget } from './TimestampConverterWidget.svelte';

// HTTP status code reference widget
export { default as HttpStatusWidget } from './HttpStatusWidget.svelte';

// MIME type lookup widget
export { default as MimeTypeLookupWidget } from './MimeTypeLookupWidget.svelte';
export { default as ChmodCalculatorWidget } from './ChmodCalculatorWidget.svelte';
export { default as RegexTesterWidget } from './RegexTesterWidget.svelte';

// Daily digest widget - provides morning/evening summary of notifications, focus time, and events
export { default as DailyDigestWidget } from './DailyDigestWidget.svelte';

// Custom titlebar - native window controls with connection status and quick menu
export { default as CustomTitlebar } from './CustomTitlebar.svelte';
