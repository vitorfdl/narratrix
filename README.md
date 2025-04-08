# NarratrixAI

[![Build](https://github.com/vitorfdl/Narratrix/actions/workflows/tauri-deploy.yml/badge.svg)](https://github.com/vitorfdl/Narratrix/actions/workflows/tauri-deploy.yml)
[![Latest Stable](https://img.shields.io/github/v/release/vitorfdl/Narratrix?label=Latest%20Stable&link=https%3A%2F%2Fgithub.com%2Fvitorfdl%2FNarratrix%2Freleases%2Flatest)](https://github.com/vitorfdl/Narratrix/releases/latest)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)](https://github.com/vitorfdl/Narratrix/releases)
[![Discord](https://img.shields.io/discord/1340496503441199146?logo=discord&logoColor=white&label=Discord%20Server)](https://discord.gg/NAMqeYNh)

<p align="center">
  <img src="/public/full_logo.png" width="250px" alt="Narratrix"></img>
</p>

> 🎲 **The AI-Powered Tabletop Roleplaying Platform** 🎲\
> Where your imagination meets artificial intelligence to create endless
> adventures.

## ✨ Overview

Narratrix transforms how we experience tabletop roleplaying games by leveraging
AI to create dynamic, responsive, and immersive storytelling experiences.
Whether you're a seasoned dungeon master looking for a comprehensive tool or a
solo player seeking adventures, Narratrix empowers you to create and share your
own stories.

<p align="center">
  <img src="path/to/narratrix-screenshot.png" alt="Narratrix Interface" width="80%"/>
</p>

## 🚀 Key Features

### 🤖 Flexible AI Integration

- Connect to multiple AI providers (OpenAI, Claude, local models) through an
  intuitive manifest system
- Customize model behavior without waiting for app updates
- Optimize different models for different tasks (storytelling, character
  portrayal, combat)

### 🎭 Rich Character Management

- Detailed character sheets with AI-aware attributes
- Expression packs for visual character reactions
- Persistent character memory (short and long-term)

### 📝 Powerful Storytelling Tools

- Create branching narrative chapters
- Dynamic scenario generation based on player choices
- Achievement tracking for campaign progression
- Dice rolling and RPG system rule integration

### 🔧 Developer-Friendly

- Create custom scripts to manipulate the story engine
- Access local database tables for advanced customization
- Design reusable templates for characters and scenarios
- Share your creations with the community

## 💻 Platform Support

Narratrix is built with Tauri, providing native performance across platforms:

- **Windows**: Windows 10 or newer
- **macOS**: 10.15+ (Intel & Apple Silicon)
- **Linux**: Ubuntu 20.04+, Fedora 35+, or other modern distributions

## 📋 Development Status

### ✅ Completed Features

- [x] Profile Management
- [x] Inference Queue
- [x] Models Management
- [x] Chat Management
- [x] Characters Management
- [x] Templates Management
- [x] Chapter Creation

### 🛠️ Features In Development

- [ ] Agents Customization
- [ ] Database Management
- [ ] Scripting System
- [ ] Lorebooks
- [ ] Import/Export (Chats, Templates, Characters)
- [ ] Memory Management
- [ ] Image Generation
- [ ] Multiplayer Support
- [ ] Embedding Model Support
- [ ] Audio TTS Support
- [ ] Mobile Support
- [ ] Cloud Save/Sync
- [ ] Documentation

<p align="center">
  <img src="path/to/narratrix-feature-demo.gif" alt="Feature Demo" width="80%"/>
</p>

## 🚩 Getting Started

```bash
# Clone the repository
git clone https://github.com/vitorfdl/Narratrix.git

# Navigate to the project directory
cd Narratrix

# Install dependencies
npm install

# Start the development server
npm run tauri dev
```

## 🌐 AI Models Support

Narratrix uses a flexible manifest system to support various AI providers:

- **Cloud-based**: OpenAI GPT models, Anthropic Claude, Azure OpenAI
- **Local**: LlamaCPP, KoboldCPP, Ollama, RunPod
- **Specialized**: Image generation models, embedding models

Each model can be configured through JSON manifests that specify parameters,
endpoints, and behaviors—no coding required!

<p align="center">
  <img src="path/to/model-management-screenshot.png" alt="Model Management" width="80%"/>
</p>

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, or
improving documentation, please feel free to make a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This repository maintains the latest source code release for Narratrix, and is
licensed under the
[GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html).
Binaries and executable releases are licensed under the
[End User License Agreement](LICENSE).

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape Narratrix
- Inspired by classic tabletop RPGs and modern AI storytelling systems
- Built with [Tauri](https://tauri.app/), and [React](https://react.dev/)

---

<p align="center">
  <a href="https://github.com/vitorfdl/Narratrix/releases/latest">Download Latest Release</a> •
  <!-- <a href="https://narratrix.ai/docs">Documentation</a> • -->
  <a href="https://discord.gg/NAMqeYNh">Join Discord</a>
</p>
