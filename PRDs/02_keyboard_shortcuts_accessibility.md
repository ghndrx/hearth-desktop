# PRD #02: Comprehensive Keyboard Shortcuts & Accessibility

**Status:** Draft  
**Priority:** P0 - Critical  
**Owner:** Desktop Team  
**Created:** 2026-04-06  

## Problem Statement

Hearth Desktop currently lacks keyboard navigation and accessibility features that are essential for power users and required for accessibility compliance. Discord provides 40+ keyboard shortcuts and comprehensive screen reader support, making it accessible to users with disabilities and highly efficient for keyboard-first users.

The absence of these features creates barriers to adoption among:
- Power users who rely on keyboard navigation for efficiency
- Users with motor disabilities who cannot use a mouse effectively  
- Visually impaired users who require screen reader support
- Enterprise users who need accessibility compliance

## Success Criteria

- [ ] Complete keyboard navigation without requiring mouse interaction
- [ ] WCAG 2.1 AA compliance for accessibility standards
- [ ] 40+ keyboard shortcuts covering all major functions
- [ ] Global hotkeys that work system-wide (push-to-talk, mute/deafen)
- [ ] Customizable keybind system with conflict detection
- [ ] Full screen reader support with proper ARIA annotations
- [ ] High contrast mode and reduced motion options

## User Stories

### As a power user, I want...
- Keyboard shortcuts for all common actions so I can work efficiently
- Customizable keybinds so I can match my workflow preferences
- Global push-to-talk that works in any application

### As a user with motor disabilities, I want...
- Complete keyboard navigation so I don't need a mouse
- Sticky keys and modifier key alternatives
- Voice control integration for hands-free operation

### As a visually impaired user, I want...
- Screen reader support with proper announcements
- High contrast themes for better visibility  
- Clear focus indicators and logical tab order

### As an enterprise admin, I want...
- Accessibility compliance for legal requirements
- Keyboard shortcuts that don't conflict with business applications
- Audit trail of accessibility features used

## Technical Requirements

### Core Keyboard Shortcuts

**Navigation & UI**
- `Ctrl/Cmd+K` - Quick switcher (servers/channels/DMs)
- `Ctrl/Cmd+/` - Toggle shortcuts help overlay
- `Ctrl/Cmd+Shift+A` - Mark server as read
- `Alt+Up/Down` - Navigate channels
- `Alt+Shift+Up/Down` - Navigate servers
- `Escape` - Close modals/overlays
- `Tab/Shift+Tab` - Navigate UI elements
- `Enter` - Activate focused element
- `Ctrl/Cmd+,` - Open settings

**Messaging**
- `Tab` - Focus message input
- `@` + `Tab` - Mention autocomplete
- `#` + `Tab` - Channel reference autocomplete  
- `:` + `Tab` - Emoji autocomplete
- `Ctrl/Cmd+Enter` - Send message
- `Shift+Enter` - New line in message
- `Up Arrow` - Edit last message (in empty input)
- `Ctrl/Cmd+A` - Select all messages (when focused on chat)

**Voice & Video**
- `Ctrl/Cmd+Shift+M` - Toggle mute
- `Ctrl/Cmd+Shift+D` - Toggle deafen
- `Ctrl/Cmd+Shift+V` - Toggle video
- `Ctrl/Cmd+Shift+S` - Start screen share
- `Ctrl/Cmd+Shift+C` - Toggle camera
- Global push-to-talk (customizable, default: `` ` ``)

**Window Management**
- `Ctrl/Cmd+Shift+I` - Toggle developer tools
- `Ctrl/Cmd+Plus` - Zoom in
- `Ctrl/Cmd+Minus` - Zoom out  
- `Ctrl/Cmd+0` - Reset zoom
- `F11` - Toggle fullscreen

### Accessibility Features

**Screen Reader Support**
```typescript
// ARIA live regions for dynamic content
interface AriaLiveRegions {
  messageAnnouncements: HTMLElement; // aria-live="polite"
  statusUpdates: HTMLElement; // aria-live="assertive" 
  errorAlerts: HTMLElement; // aria-live="assertive"
}

// Screen reader announcements
function announceMessage(message: Message) {
  const announcement = `New message from ${message.author.name} in ${message.channel.name}: ${message.content}`;
  ariaLiveRegions.messageAnnouncements.textContent = announcement;
}
```

**Focus Management**
- Visible focus indicators with 3:1 contrast ratio
- Logical tab order following visual flow
- Focus trapping in modals and overlays
- Skip links for main content areas
- Focus restoration when closing overlays

**Visual Accessibility**
- High contrast mode (4.5:1 minimum contrast ratio)
- Reduced motion preferences respect
- Customizable font sizes (100% to 200%)
- Color-blind friendly color schemes
- Focus indicators visible in all themes

### Technical Implementation

**Backend (Rust/Tauri):**
```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[derive(Serialize, Deserialize)]
struct KeybindSettings {
    global_push_to_talk: Option<String>,
    global_mute_toggle: Option<String>,
    global_deafen_toggle: Option<String>,
    local_shortcuts: HashMap<String, String>,
}

// Global hotkey registration
#[tauri::command]
async fn register_global_shortcuts(
    app: tauri::AppHandle,
    shortcuts: KeybindSettings
) -> Result<(), String> {
    if let Some(ptk_key) = shortcuts.global_push_to_talk {
        let shortcut: Shortcut = ptk_key.parse().map_err(|e| format!("Invalid shortcut: {}", e))?;
        app.global_shortcut().register(shortcut, move || {
            // Send push-to-talk event to frontend
            app.emit_all("push-to-talk-pressed", {}).unwrap();
        }).map_err(|e| format!("Failed to register shortcut: {}", e))?;
    }
    Ok(())
}
```

**Frontend (Svelte):**
```typescript
// Keyboard shortcut manager
interface KeyboardShortcut {
  key: string;
  modifiers: string[];
  action: () => void;
  description: string;
  global?: boolean;
  customizable?: boolean;
}

class ShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private customKeybinds: Map<string, string> = new Map();

  register(shortcut: KeyboardShortcut) {
    const key = this.normalizeKey(shortcut.key, shortcut.modifiers);
    this.shortcuts.set(key, shortcut);
  }

  handleKeydown(event: KeyboardEvent) {
    const key = this.normalizeKey(event.key, this.getModifiers(event));
    const shortcut = this.shortcuts.get(key);
    
    if (shortcut) {
      event.preventDefault();
      shortcut.action();
      this.announceShortcut(shortcut.description);
    }
  }

  private announceShortcut(description: string) {
    // Announce to screen readers
    const announcement = `Activated: ${description}`;
    this.updateAriaLiveRegion(announcement);
  }
}
```

**Accessibility Components:**
```svelte
<!-- Screen reader announcements -->
<div class="sr-only" aria-live="polite" bind:this={politeRegion}></div>
<div class="sr-only" aria-live="assertive" bind:this={assertiveRegion}></div>

<!-- Skip navigation -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Focus trap for modals -->
<div 
  role="dialog" 
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  tabindex="-1"
  use:focusTrap>
  <!-- modal content -->
</div>
```

### Data Storage
- Keybind preferences in user settings (local SQLite + cloud sync)
- Accessibility preferences (high contrast, reduced motion, etc.)
- Usage analytics for accessibility feature adoption

### Platform Integration
- Windows: Windows Accessibility API
- macOS: NSAccessibility and VoiceOver integration  
- Linux: ATK/AT-SPI accessibility framework

## Testing Strategy

### Automated Testing
```javascript
// Keyboard navigation tests
describe('Keyboard Navigation', () => {
  test('Tab key navigates through all interactive elements', async () => {
    const focusableElements = await page.$$('[tabindex]:not([tabindex="-1"]), button, input, select, textarea, a[href]');
    
    for (let i = 0; i < focusableElements.length; i++) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluateHandle(() => document.activeElement);
      expect(focusedElement).toBe(focusableElements[i]);
    }
  });

  test('All keyboard shortcuts work as expected', async () => {
    await page.keyboard.press('Control+Shift+M');
    await expect(page.locator('[data-testid="mute-indicator"]')).toBeVisible();
  });
});

// Screen reader tests
describe('Screen Reader Support', () => {
  test('New messages are announced', async () => {
    const ariaLiveRegion = page.locator('[aria-live="polite"]');
    
    // Simulate new message
    await simulateIncomingMessage();
    
    await expect(ariaLiveRegion).toHaveText(/New message from .* in .*/);
  });
});
```

### Manual Testing
- Test with actual screen readers (NVDA, JAWS, VoiceOver)
- Keyboard-only navigation testing
- High contrast mode verification
- Voice control testing (Windows Speech Recognition, macOS Voice Control)

### Compliance Testing
- WCAG 2.1 AA automated scanning
- Color contrast ratio verification
- Focus indicator visibility testing
- Screen reader compatibility testing

## Rollout Plan

### Phase 1 (Core Shortcuts)
- Essential navigation shortcuts (Ctrl+K, Tab navigation)
- Basic voice controls (mute, deafen)
- Focus management and screen reader announcements

### Phase 2 (Advanced Shortcuts)
- Global hotkeys (push-to-talk)
- Message editing and autocomplete shortcuts
- Customizable keybind system

### Phase 3 (Full Accessibility)
- High contrast themes
- Complete WCAG 2.1 AA compliance
- Voice control integration
- Advanced screen reader features

## Success Metrics

- **Accessibility Compliance:** 100% WCAG 2.1 AA compliance
- **Adoption:** 60% of users use at least one keyboard shortcut weekly
- **Efficiency:** 30% faster task completion for power users
- **Accessibility Usage:** 5% of users enable high contrast or screen reader features
- **Support Reduction:** 80% reduction in accessibility-related support tickets

## Dependencies & Risks

### Dependencies
- `tauri-plugin-global-shortcut` for system-wide hotkeys
- Platform accessibility APIs
- Screen reader testing tools
- WCAG compliance scanning tools

### Risks
- **OS Limitations:** Some global shortcuts might conflict with system shortcuts
- **Performance:** Accessibility features could impact application performance  
- **Complexity:** Large number of shortcuts might overwhelm new users
- **Testing Burden:** Comprehensive accessibility testing is time-consuming

### Mitigation
- Shortcut conflict detection and user warnings
- Performance profiling with accessibility features enabled
- Progressive disclosure of advanced shortcuts
- Automated accessibility testing in CI/CD pipeline

## Open Questions

1. Should we support voice commands for all keyboard shortcuts?
2. How should we handle shortcut conflicts with other applications?
3. What level of customization should we allow for accessibility features?
4. Should we provide accessibility onboarding for new users?

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Discord Keyboard Shortcuts Reference](https://support.discord.com/hc/en-us/articles/225977308)
- [Tauri Accessibility Documentation](https://tauri.app/v1/guides/features/accessibility)
- [Web Accessibility Initiative](https://www.w3.org/WAI/)
- [Screen Reader Testing Guide](https://webaim.org/articles/screenreader_testing/)