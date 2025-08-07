# DSA Learning App

A comprehensive card-based learning management system for practicing Data Structures and Algorithms (DSA) problems, built with Tauri and React.

## Features

### Core Features ✅
- **Card-based Problem Solving**: Each practice session is tracked as a separate card
- **Session-based Time Tracking**: Monitor time spent on each problem and session
- **SQLite Database**: Embedded database for reliable data persistence
- **Dark/Light Mode**: Fully responsive theme system
- **Cross-platform Desktop App**: Built with Tauri for native performance

### Planned Features 🚧
- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting
- **QuillJS Rich Text Editor**: Rich text notes with markdown support
- **Voice Recording System**: Native audio recording with pause/resume functionality
- **Audio Playback**: Advanced audio player with speed controls
- **Connection System**: Link related problems and build knowledge graphs
- **Analytics Dashboard**: Track progress and study patterns
- **Global Hotkeys**: System-wide shortcuts for recording and timer control
- **Export/Import**: Backup and restore your learning data

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management

### Backend
- **Rust** with Tauri 2.0
- **SQLite** with rusqlite for data persistence
- **cpal** for native audio recording
- **hound** for WAV file processing

## Development Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **Rust** (latest stable)
- **Tauri CLI**

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd DSALearningApp
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Tauri CLI (if not already installed):
```bash
npm install --save-dev @tauri-apps/cli
```

4. Start the development server:
```bash
npm run tauri dev
```

### Building

Build the application for production:
```bash
npm run tauri build
```

## Project Structure

```
DSALearningApp/
├── src/                    # React frontend source
│   ├── components/         # Reusable UI components
│   ├── pages/             # Application pages
│   ├── stores/            # Zustand state stores
│   ├── types/             # TypeScript type definitions
│   └── lib/               # Utility functions
├── src-tauri/             # Rust backend source
│   ├── src/
│   │   ├── audio/         # Audio recording system
│   │   ├── database/      # SQLite database management
│   │   ├── commands/      # Tauri command handlers
│   │   └── models/        # Data models and types
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── public/                # Static assets
└── dist/                  # Built frontend files
```

## Database Schema

The application uses SQLite with the following main entities:

- **Problems**: DSA problems with descriptions, constraints, and examples
- **Cards**: Individual practice sessions for each problem
- **Time Sessions**: Detailed time tracking for each study period
- **Recordings**: Voice recordings linked to cards and sessions
- **Connections**: Relationships between different problems/cards
- **Tags**: Categorization and filtering system

## Contributing

This is currently a learning project, but contributions and suggestions are welcome!

## License

[License to be determined]

---

**Current Status**: Core foundation complete, actively developing editor integrations and advanced features.