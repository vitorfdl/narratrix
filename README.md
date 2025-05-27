# NarratrixAI

[![Latest Stable](https://img.shields.io/github/v/release/vitorfdl/Narratrix?label=Latest%20Stable&link=https%3A%2F%2Fgithub.com%2Fvitorfdl%2FNarratrix%2Freleases%2Flatest)](https://github.com/vitorfdl/Narratrix/releases/latest)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)](https://narratrixai.com/#download)
[![Discord](https://img.shields.io/discord/1340496503441199146?logo=discord&logoColor=white&label=Discord%20Server)](https://discord.gg/Q69R4aWCFR)

<p align="center">
  <img src="/public/full_logo.png" width="250px" alt="Narratrix"></img>
</p>

> 🎲 **The AI-Powered Tabletop Roleplaying Platform** 🎲\
> Where your imagination meets artificial intelligence to create endless
> adventures.

## ✨ Overview

Narratrix transforms how we experience tabletop roleplaying games by leveraging
AI to create dynamic, responsive, and immersive storytelling experiences. You
should be able to create your own stores, use it as Character chat or as full
Tabletop RPG experience. Narratrix will empower you to create and share your
experiences.

<p align="center">
  <img src="https://github.com/user-attachments/assets/d88144a3-a24b-4d58-82ae-d195af0c9854" alt="Narratrix Interface" width="80%"/>
</p>

## 🚀 Key Features

### 💬 Powerful Chat System

- Organize all elements in your screen with a grid based layout
- Use powerful actions to manipulate the story, create summary breakpoints and
  more
- Create chats with multiple characters at once, with a simple click
- Chat with your characters in a beautiful and immersive chat interface

### 🤖 Flexible AI Integration

- Connect to multiple AI providers (OpenAI, Claude, local models) through an
  intuitive manifest system
- Customize model behavior without waiting for app updates
- Optimize different models for different tasks (storytelling, character
  portrayal, combat)

### 🎭 Rich Character Management

- Organize your characters with a beautiful character management screen
- Detailed character sheets with AI-aware attributes (In-Development)
- Expression packs for visual character reactions
- Persistent character memory (short and long-term)

### 📝 Powerful Storytelling Tools

- Create branching narrative chapters
- Dynamic scenario generation based on player choices
- Achievement tracking for campaign progression
- Dice rolling and RPG system rule integration (In-Development)

### 🔧 Developer-Friendly

- Create custom scripts to manipulate the story engine (In-Development)
- Access local database tables for advanced customization (In-Development)
- Design reusable templates for characters and scenarios
- Share your creations with the community (In-Development)

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
- [x] Lorebooks
- [x] Text Completion Support
- [x] Import/Export (Chats, Templates, Characters, Lorebooks)

### 🛠️ Features In Development

- [ ] Agents Customization (Tool-calling, JSON Response, etc)
- [ ] Database Management
- [ ] Scripting System
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

## 🌐 AI Models Support

Narratrix uses a flexible manifest system to support various AI providers:

- **Cloud-based**: OpenAI GPT models, Anthropic Claude, Azure OpenAI, Google
  Gemini, OpenRouter...
- **Local**: LlamaCPP, KoboldCPP, Ollama, RunPod, Mistralrs
- **OpenAI Compatible API**: Any OpenAI compatible provider
- **Specialized**: ~~Image generation models, embedding models~~
  (In-Development)

Each model can be configured through JSON manifests that specify parameters,
endpoints, and behaviors—no coding required!

<p align="center">
  <img src="https://github.com/user-attachments/assets/5cb26b4d-6027-4671-9b0e-97ff5faef2f2" alt="Model Management" width="80%"/>
</p>

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, or
improving documentation, please feel free to make a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

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

## 📄 License

This repository maintains the latest source code release for Narratrix, and is
licensed under the
[GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html).
Binaries and executable releases are licensed under the
[End User License Agreement](LICENSE_2).

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape Narratrix
- Inspired by classic tabletop RPGs and modern AI storytelling systems
- Built with [Tauri](https://tauri.app/), and [React](https://react.dev/)

---

<p align="center">
  <a href="https://narratrixai.com/#download">Download Latest Release</a> •
  <!-- <a href="https://narratrix.ai/docs">Documentation</a> • -->
  <a href="https://discord.gg/Q69R4aWCFR">Join Discord</a>
</p>
