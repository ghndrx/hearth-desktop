# Hearth Desktop

A native desktop client for [Hearth](https://github.com/greghendrickson/hearth) chat platform, built with Tauri + Svelte.

## Features

- 🚀 **Native Performance** — Rust-powered, tiny binary (~10MB)
- 🖥️ **Cross-Platform** — Windows, macOS, Linux
- 🔔 **System Notifications** — Native OS notifications
- 📌 **System Tray** — Minimize to tray, quick access
- 🔄 **Auto Updates** — Built-in update mechanism
- ⌨️ **Global Shortcuts** — Quick toggle, mute, etc.
- 🎨 **Native Window Controls** — OS-native titlebar option

## Tech Stack

- **Framework:** [Tauri 2.x](https://tauri.app/)
- **Frontend:** Svelte 5 + TypeScript + Tailwind CSS
- **Backend:** Rust (Tauri core)
- **Build:** Vite

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) (recommended)

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Project Structure

```
hearth-desktop/
├── src/                    # Svelte frontend
│   ├── lib/
│   │   ├── components/     # UI components
│   │   ├── stores/         # Svelte stores
│   │   └── api/            # API client
│   ├── routes/             # Pages
│   └── app.html
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── commands.rs     # Tauri commands
│   │   └── tray.rs         # System tray
│   ├── Cargo.toml
│   └── tauri.conf.json     # Tauri config
├── package.json
└── vite.config.ts
```

## Related

- [Hearth](https://github.com/greghendrickson/hearth) — Backend + Web client
- [Hearth Mobile](https://github.com/greghendrickson/hearth-mobile) — iOS/Android app

## License

MIT
