# NarratrixAI

[![Latest Stable](https://img.shields.io/github/v/release/vitorfdl/narratrix?label=latest%20stable)](https://github.com/vitorfdl/narratrix/releases/latest)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)](https://narratrixai.com/#download)
[![Code Quality](https://github.com/vitorfdl/narratrix/actions/workflows/code-quality.yml/badge.svg)](https://github.com/vitorfdl/narratrix/actions/workflows/code-quality.yml)
[![Discord](https://img.shields.io/discord/1340496503441199146?logo=discord&logoColor=white&label=Discord)](https://discord.gg/Q69R4aWCFR)

NarratrixAI is a native AI storytelling workstation for custom tabletop roleplaying boards. It brings models, characters, agents, lorebooks, memory, prompts, and board widgets into one fast desktop app for campaigns that need more than a linear chat window.

[Download NarratrixAI](https://narratrixai.com/#download) | [Documentation](https://github.com/vitorfdl/narratrix/wiki) | [Releases](https://github.com/vitorfdl/narratrix/releases) | [Discord](https://discord.gg/Q69R4aWCFR)

<p align="center">
  <img src="https://github.com/user-attachments/assets/d88144a3-a24b-4d58-82ae-d195af0c9854" alt="NarratrixAI story board interface" width="85%"/>
</p>

## What NarratrixAI Does

NarratrixAI helps you run AI-assisted roleplay with the structure of a real table: persistent characters, reusable lore, configurable models, branching chapters, visible automation, and a board layout you can adapt to your campaign. Use it for character chat, solo play, world simulation, or a full tabletop RPG session with custom rules and agents.

The app is built with [Tauri](https://tauri.app/), [React](https://react.dev/), TypeScript, SQLite, and a manifest-driven inference layer. It runs locally as a desktop application while letting you connect the AI providers and models that fit your table.

## Highlights

- **Story board workspace**: organize chat, generation controls, participants, expressions, scripts, memories, chapters, and character sheets in a grid-based table.
- **Model management**: configure cloud, local, and OpenAI-compatible providers through editable manifests and provider cards.
- **Agent workflows**: build node-based automations that can route prompts, inspect context, call tools, run JavaScript, search lorebooks, and shape chat output.
- **Character system**: manage character profiles, avatars, expression packs, impersonation, memories, and import/export workflows.
- **Lorebooks and context**: keep reusable setting facts, rules, character knowledge, and campaign references close to the scenes that need them.
- **Prompt and template tooling**: customize chat formats, inference templates, quick actions, censorship rules, placeholders, and prompt assembly.
- **Profiles and privacy boundaries**: keep app data and API keys scoped per profile, with local storage and native encryption helpers.

## Supported AI Providers

NarratrixAI ships with model manifests for:

- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- AWS Bedrock
- Ollama
- OpenAI-compatible APIs

Embedding manifests are also available for OpenAI, Gemini, AWS Bedrock, Ollama, and OpenAI-compatible providers.

## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/5cb26b4d-6027-4671-9b0e-97ff5faef2f2" alt="NarratrixAI model management interface" width="85%"/>
</p>

## Platform Support

NarratrixAI publishes desktop builds for:

- Windows
- macOS on Apple Silicon and Intel
- Linux

Download the latest release from [narratrixai.com](https://narratrixai.com/#download) or the [GitHub releases page](https://github.com/vitorfdl/narratrix/releases).

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) `>=24.15.0`
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) stable
- Tauri system dependencies for your operating system

### Setup

```bash
git clone https://github.com/vitorfdl/narratrix.git
cd narratrix
pnpm install
pnpm tauri dev
```

### Common Commands

```bash
pnpm dev          # Start the Vite frontend only
pnpm tauri dev    # Start the full Tauri desktop app
pnpm build        # Type-check and build the frontend
pnpm test         # Run the Vitest suite
pnpm lint         # Run Biome checks
pnpm lint:fix     # Apply Biome formatting and safe fixes
```

## Project Structure

```text
src/
  components/      Shared UI, layout, markdown, and inspector components
  hooks/           App state stores and reusable React hooks
  pages/           Main product areas: models, characters, agents, lorebooks, chat, settings
  schema/          Zod schemas and typed validation contracts
  services/        Inference, agents, imports, exports, persistence, and provider integrations
  utils/           Cross-cutting helpers

src-tauri/
  resources/       Built-in model, embedding, character, and template manifests
  src/             Tauri entrypoint, SQLite migrations, native utilities, and token counting
```

## Contributing

Contributions are welcome. For a smooth review, keep changes focused, match the existing TypeScript and Tauri patterns, and include tests when touching shared behavior.

Before opening a pull request, run:

```bash
pnpm lint:fix
pnpm build
pnpm test
```

Security note: never commit API keys, tokens, credentials, or local profile data. API keys should remain per-profile and inside the app's storage/encryption flow.

## Community

- [Join Discord](https://discord.gg/Q69R4aWCFR) to discuss campaigns, report issues, request nodes, and share setups.
- [Support development on Patreon](https://www.patreon.com/NarratrixAI).
- [Read the wiki](https://github.com/vitorfdl/narratrix/wiki) for setup and usage documentation.

## License

The source code in this repository is licensed under the [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html). Binaries and executable releases are licensed under the [NarratrixAI End User License Agreement](LICENSE_2).
