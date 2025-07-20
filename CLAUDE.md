# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Build and Development

- **Development**: `npm run dev` - Starts Vite development server
- **Build**: `npm run build` - TypeScript compilation + Vite build
- **Preview**: `npm run preview` - Preview built application
- **Test**: `npm run test` - Run Vitest tests

### Tauri Commands

- **Development**: `npm run tauri dev` - Start Tauri development environment
- **Build**: `npm run tauri build` - Build Tauri application for production

### Code Quality

- **Linting**: Use Biome for linting and formatting (`@biomejs/biome`)
- **Type Checking**: TypeScript strict mode is enabled
- **Auto-formatting**: Biome format and lint are automatically applied after every file edit

### Important Testing Note

⚠️ **NEVER** run the program using `npm run start` or `cargo tauri`. All
realtime tests must be done exclusively by asking the user to perform these
actions.

## Project Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Rust + Tauri v2
- **Database**: SQLite with Tauri SQL plugin
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand + Jotai
- **UI Components**: Radix UI primitives via shadcn/ui
- **Code Editor**: CodeMirror 6 for markdown editing

### Core Application Structure

#### Frontend Architecture (`src/`)

- **Main Entry**: `App.tsx` handles profile authentication and theme
  initialization
- **Layout**: `components/layout/` contains `Sidebar.tsx` and `Content.tsx`
- **Pages**: Feature-specific pages in `pages/` (agents, characters, chat,
  models, etc.)
- **State Management**: Global stores in `hooks/` using Zustand pattern
- **Services**: Business logic in `services/` for API calls and data processing
- **Schemas**: Zod schemas in `schema/` for type validation

#### Backend Architecture (`src-tauri/`)

- **Database**: SQLite with migrations in `database/migrations/`
- **Inference**: LLM integration in `inference/` supporting multiple providers
- **Filesystem**: File operations in `filesystem/`
- **Security**: Encryption utilities in `utils/`

### Key Features & Components

#### Profile System

- Multi-profile support with authentication
- Profile switching and synchronization
- Settings management per profile

#### Chat System

- Grid-based layout with draggable/resizable widgets
- Message virtualization for performance
- Real-time inference with streaming responses
- Chapter-based conversation organization

#### Character Management

- Character creation with AI-aware attributes
- Expression packs for visual reactions
- Import/export functionality

#### Model Integration

- Flexible manifest system for AI providers
- Support for OpenAI, Claude, local models (Ollama, KoboldCPP)
- Configurable parameters and templates

#### Inference Engine

- Queue-based processing
- Context management and token counting
- Response formatting and censorship
- Template-based prompt formatting

### State Management Patterns

#### Global Stores (Zustand)

- `ProfileStore`: User profiles and authentication
- `ChatStore`: Chat management and messages
- `CharacterStore`: Character data and management
- `ModelStore`: AI model configurations
- `UIStore`: UI state and layout

#### Component-Level State

- React hooks for local state
- Form state with `react-hook-form`
- Theme management with `next-themes`

### Database Schema

- **Profiles**: User profiles with encrypted passwords
- **Characters**: Character definitions and metadata
- **Chats**: Conversation threads with participants
- **Messages**: Chat messages with versioning
- **Models**: AI model configurations
- **Templates**: Reusable prompt templates
- **Lorebooks**: World-building knowledge bases

### Security Considerations

- Profile passwords encrypted with Argon2
- Secure file operations through Tauri
- CSP configured for web content
- API keys stored securely per profile

### Development Patterns

- Functional React components with hooks
- TypeScript strict mode with explicit typing
- Error boundaries for graceful error handling
- Async/await patterns for API calls
- Immer for immutable state updates

## Code Writing Guidelines

While working in this repository, Claude Code adheres to the following patterns
and guidelines:

### Defensive Programming

- **Input Validation**: Always validate inputs with proper type checking and
  bounds validation
- **Error Handling**: Implement comprehensive error handling with try-catch
  blocks and error boundaries
- **Null Safety**: Use optional chaining (`?.`) and nullish coalescing (`??`)
  operators
- **Type Safety**: Leverage TypeScript strict mode and avoid `any` types
- **Resource Management**: Properly handle cleanup in useEffect hooks and async
  operations
- **Graceful Degradation**: Provide fallbacks for failed operations and missing
  data

### Modular Code Architecture

- **Single Responsibility**: Each function/component should have one clear
  purpose
- **Pure Functions**: Prefer pure functions that don't cause side effects
- **Reusable Components**: Create generic, configurable components that can be
  reused
- **Service Layer**: Abstract business logic into separate service modules
- **Hook Abstraction**: Extract complex logic into custom hooks
- **Interface Segregation**: Define specific interfaces rather than large,
  monolithic ones
- **Dependency Injection**: Use dependency injection patterns for testability

## AI Code Generation Best Practices

- **Suggestion Capabilities**: When creating plans or implementing features, suggest relevant npm packages that can significantly reduce implementation complexity