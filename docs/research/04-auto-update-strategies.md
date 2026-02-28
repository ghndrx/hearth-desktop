# Auto-Update Strategies for Tauri Desktop Apps

**Research Date:** February 28, 2026  
**Focus Area:** #4 - Auto-update strategies (Tauri updater)  
**Relevance:** Critical for Hearth Desktop deployment and user experience

---

## Executive Summary

Auto-updates are essential for desktop apps to deliver security patches, bug fixes, and features without user friction. Tauri 2.x provides a robust, security-first updater plugin that supports both static JSON files and dynamic update servers. This document covers Tauri's approach, compares it to Electron patterns, and analyzes UX strategies from Discord, Slack, and VS Code.

---

## 1. Tauri 2.x Updater Overview

### 1.1 Architecture

Tauri's updater is security-focused by design:
- **Mandatory cryptographic signing** - Updates MUST be signed; this cannot be disabled
- **Public/private key pair** - Ed25519 signatures verify authenticity
- **TLS enforced** - Production mode requires HTTPS (can be bypassed with `dangerousInsecureTransportProtocol`)

### 1.2 Update Distribution Options

#### Static JSON (Recommended for Hearth)
```json
{
  "version": "1.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-02-28T12:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/user/repo/releases/download/v1.2.0/app.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/user/repo/releases/download/v1.2.0/app-aarch64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/user/repo/releases/download/v1.2.0/app-setup.exe"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/user/repo/releases/download/v1.2.0/app.AppImage"
    }
  }
}
```

**Best served from:**
- GitHub Releases (free, CDN-backed)
- CrabNebula Cloud (Tauri-native, recommended)
- S3/CloudFront
- Any static hosting

#### Dynamic Server
Server responds based on request variables:
- `{{current_version}}` - App's current version
- `{{target}}` - OS (linux, windows, darwin)  
- `{{arch}}` - Architecture (x86_64, aarch64, i686, armv7)

Server returns 204 No Content if no update; 200 OK with JSON payload if update available.

### 1.3 Platform-Specific Bundles

| Platform | Bundle | Updater Artifact |
|----------|--------|------------------|
| macOS | `.app` | `.app.tar.gz` + `.sig` |
| Windows | NSIS `.exe` or `.msi` | Same installer + `.sig` |
| Linux | AppImage | `.AppImage` + `.sig` |

### 1.4 Windows Install Modes

```json
{
  "plugins": {
    "updater": {
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

| Mode | UX | Notes |
|------|-----|-------|
| `passive` (default) | Small progress window, no interaction | **Recommended** |
| `basicUi` | Full installer UI, requires clicks | For complex installs |
| `quiet` | No UI at all | Requires existing admin rights |

---

## 2. Implementation Patterns

### 2.1 Basic Check-and-Prompt (JavaScript)

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates(silent = true) {
  try {
    const update = await check();
    
    if (!update) {
      if (!silent) {
        await message('You are on the latest version!', {
          title: 'No Update Available',
          kind: 'info'
        });
      }
      return;
    }
    
    const shouldUpdate = await ask(
      `Version ${update.version} is available!\n\n${update.body}`,
      {
        title: 'Update Available',
        kind: 'info',
        okLabel: 'Update Now',
        cancelLabel: 'Later'
      }
    );
    
    if (shouldUpdate) {
      await update.downloadAndInstall();
      await relaunch();
    }
  } catch (err) {
    console.error('Update check failed:', err);
    if (!silent) {
      await message('Failed to check for updates.', {
        title: 'Error',
        kind: 'error'
      });
    }
  }
}
```

### 2.2 Background Download with Progress

```typescript
import { check } from '@tauri-apps/plugin-updater';

async function downloadWithProgress() {
  const update = await check();
  if (!update) return;
  
  let totalBytes = 0;
  let downloadedBytes = 0;
  
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        totalBytes = event.data.contentLength ?? 0;
        showProgressUI(0, totalBytes);
        break;
      case 'Progress':
        downloadedBytes += event.data.chunkLength;
        updateProgressUI(downloadedBytes, totalBytes);
        break;
      case 'Finished':
        hideProgressUI();
        promptRestart();
        break;
    }
  });
}
```

### 2.3 Advanced: Channel-Based Updates (Rust)

```rust
use tauri_plugin_updater::UpdaterExt;

// Support beta/stable channels
let channel = if is_beta_enabled() { "beta" } else { "stable" };
let update_url = format!(
    "https://updates.hearth.example/{channel}/{{{{target}}}}-{{{{arch}}}}/{{{{current_version}}}}"
);

let update = app
    .updater_builder()
    .endpoints(vec![update_url])?
    .build()?
    .check()
    .await?;
```

### 2.4 Rollback Support

Default behavior prevents downgrades. Override for rollback capability:

```rust
use tauri_plugin_updater::UpdaterExt;

let update = app
    .updater_builder()
    .version_comparator(|current, update| {
        // Allow any version different from current (enables rollbacks)
        update.version != current
    })
    .build()?
    .check()
    .await?;
```

---

## 3. Electron Comparison

### 3.1 electron-updater vs Tauri Updater

| Feature | Tauri Updater | electron-updater |
|---------|---------------|------------------|
| Linux support | ✅ Native | ✅ Native |
| Signature validation | ✅ Ed25519 (mandatory) | ✅ Code signing |
| Staged rollouts | ❌ Manual implementation | ✅ Built-in (`stagingPercentage`) |
| Delta updates | ❌ Full bundle only | ✅ nupkg deltas (Windows) |
| Progress events | ✅ Full control | ✅ Full control |
| Bundle size | ~2MB overhead | ~50MB+ Electron overhead |
| Custom headers | ✅ Runtime config | ✅ Runtime config |

### 3.2 Key Differences

**Tauri Advantages:**
- Smaller update payloads (no Electron runtime)
- Mandatory security (can't skip signing)
- Cross-platform consistency
- Rust-native control layer

**Electron Advantages:**
- Mature ecosystem (Squirrel, update.electronjs.org)
- Staged rollouts built-in
- Delta updates reduce bandwidth
- More hosting integrations

---

## 4. UX Patterns from Major Apps

### 4.1 Discord Pattern

**Strategy:** Silent background + restart prompt
- Checks on launch and periodically
- Downloads silently in background
- Shows banner: "Update ready! Click to restart"
- **No blocking modals** during active use
- Force-updates only for critical security

**Hearth Takeaway:** Non-intrusive is key for communication apps.

### 4.2 Slack Pattern

**Strategy:** Aggressive silent updates
- Updates automatically, often without explicit notification
- Uses refresh mechanisms for web components
- Can force-refresh when critical
- Users report frustration when updates are TOO silent (UI changes unexpectedly)

**Hearth Takeaway:** Balance silence with changelog visibility.

### 4.3 VS Code Pattern

**Strategy:** Background check + install-on-quit
- Checks at startup (configurable)
- Downloads in background
- Installs when user quits
- Enterprise controls: `none`, `manual`, `start`, `default`
- Clear update indicator in status bar

**Hearth Takeaway:** Install-on-quit is seamless for productivity apps.

### 4.4 Recommended Hearth Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  1. App Launch: Silent check (no blocking)                  │
│  2. Update Found: Background download                       │
│  3. Download Complete: Subtle toast notification            │
│     "Hearth 1.2.0 ready - Restart to update"               │
│  4. User Choice: Restart now OR install on quit            │
│  5. Critical Security: Force restart with 24h grace        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Security Considerations

### 5.1 Key Management

**DO:**
- Store private key in secure vault (1Password, HashiCorp Vault)
- Use environment variables in CI (`TAURI_SIGNING_PRIVATE_KEY`)
- Rotate keys periodically (announce via in-app messaging)
- Backup keys securely (losing = can't push updates)

**DON'T:**
- Commit private key to repo
- Store password in plaintext
- Share keys across unrelated projects

### 5.2 CI/CD Integration

```yaml
# GitHub Actions example
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_KEY_PASSWORD }}

steps:
  - name: Build and Sign
    run: npm run tauri build
    
  - name: Upload Release
    uses: softprops/action-gh-release@v1
    with:
      files: |
        src-tauri/target/release/bundle/**/*.tar.gz
        src-tauri/target/release/bundle/**/*.sig
        src-tauri/target/release/bundle/**/*.exe
        src-tauri/target/release/bundle/**/*.AppImage
```

### 5.3 Update Server Security

- Always use HTTPS
- Implement rate limiting
- Consider CDN (CloudFront, Cloudflare) for DDoS protection
- Monitor for anomalous download patterns

---

## 6. Testing Strategies

### 6.1 Local Testing

```bash
# Generate test keys
npm run tauri signer generate -- -w ~/.tauri/test.key

# Build signed artifacts
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/test.key)"
npm run tauri build

# Serve test update manifest
npx serve ./test-updates -l 8080
```

### 6.2 Test Matrix

| Scenario | Test |
|----------|------|
| Fresh install → first update | Version 1.0 → 1.1 |
| Skip version | 1.0 → 1.3 (skip 1.1, 1.2) |
| Same version | No update notification |
| Network failure | Graceful error handling |
| Interrupted download | Resume or clean restart |
| Signature mismatch | Update rejected with clear error |
| Rollback | 1.2 → 1.1 (if enabled) |

### 6.3 Simulating Updates in Dev

```typescript
// For UI/UX testing without packaging
const mockUpdate = {
  version: '99.0.0',
  body: 'Test release notes\n- Feature A\n- Bug fix B',
  date: new Date().toISOString(),
  downloadAndInstall: async () => console.log('Mock install')
};
```

---

## 7. Hosting Options for Hearth

### 7.1 Recommended: GitHub Releases

**Pros:**
- Free for public repos
- Built-in CDN
- Native to dev workflow
- `latest.json` can live in repo or release assets

**Setup:**
1. Generate signing keys
2. Add secrets to GitHub repo
3. Create release workflow
4. Point updater endpoint to raw `latest.json` URL

### 7.2 Alternative: CrabNebula Cloud

**Pros:**
- Tauri-native integration
- Analytics dashboard
- Managed infrastructure
- Easy endpoint configuration

**Cons:**
- Additional service dependency
- Potential cost at scale

### 7.3 Self-Hosted

**When to use:**
- Enterprise requirements
- Air-gapped environments
- Custom analytics needs

**Stack:**
- S3 + CloudFront for artifacts
- Lambda/Edge function for dynamic versioning
- CloudWatch for monitoring

---

## 8. Implementation Checklist for Hearth

### Phase 1: Foundation
- [ ] Generate and securely store signing keys
- [ ] Configure `tauri.conf.json` with updater plugin
- [ ] Add `updater:default` capability
- [ ] Implement basic check-and-prompt flow

### Phase 2: UX Polish
- [ ] Background download with progress indicator
- [ ] Non-blocking toast notifications
- [ ] "Install on quit" option
- [ ] Changelog display from release notes

### Phase 3: Advanced
- [ ] Beta/stable channel support
- [ ] Staged rollouts (manual percentage control)
- [ ] Telemetry for update success rates
- [ ] Rollback capability for emergencies

### Phase 4: CI/CD
- [ ] GitHub Actions release workflow
- [ ] Automated `latest.json` generation
- [ ] Multi-platform build matrix
- [ ] Release signing in CI

---

## 9. References

- [Tauri Updater Plugin Docs](https://v2.tauri.app/plugin/updater/)
- [CrabNebula Cloud Guide](https://docs.crabnebula.dev/cloud/guides/auto-updates-tauri/)
- [electron-builder Auto Update](https://www.electron.build/auto-update.html)
- [VS Code Enterprise Updates](https://code.visualstudio.com/docs/enterprise/updates)
- [Electron Update Tutorial](https://www.electronjs.org/docs/latest/tutorial/updates)

---

*Next research topic: Cross-platform keyboard shortcuts (#5)*
