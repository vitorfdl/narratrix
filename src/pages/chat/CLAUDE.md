---
description: Guidance for Claude/claude.ai/code on working with the chat module (React, Zustand, react-grid-layout, inference services)
alwaysApply: true
---

# CLAUDE.md - Chat Module Architecture

This file provides guidance to Claude Code (claude.ai/code) when working with the chat module in this repository.

## Core Architecture

### Grid-Based Widget System

The chat interface uses a responsive drag-and-drop grid layout powered by `react-grid-layout`:

- **GridLayout.tsx**: Core grid engine with responsive breakpoints (`lg: 12, md: 10, sm: 6, xs: 6, xxs: 2` columns)
- **hooks/registry.tsx**: Widget registration system - add new widgets here
- **GridSidebar.tsx**: Widget palette for toggling widgets on/off

### Key Components

- **ChatPage.tsx**: Main orchestrator handling tab management and chat lifecycle
- **WidgetMessages.tsx**: Message display with NextChat-style pagination and streaming
- **WidgetGenerate.tsx**: Message input interface

### Inference Service Integration

The chat system is heavily dependent on the inference service for AI interactions:

- **Streaming State**: Many widgets (Messages, Generate) subscribe to `inferenceService.subscribeToStateChanges()`
- **Message Generation**: WidgetGenerate triggers `inferenceService.generateMessage()`
- **Regeneration**: WidgetMessages handles `inferenceService.regenerateMessage()` with version control
- **Real-time Updates**: Streaming responses update UI immediately via state subscriptions
- **Provider Abstraction**: Supports OpenAI, Claude, Ollama, etc. through unified interface
- **Context Building**: Service formats message history for different AI providers
- **Queue Management**: Handles request queuing and cancellation across widgets

### Important Patterns

#### Message Streaming
- Auto-scroll respects user interaction during streaming
- `streamingMessageId` state prevents concurrent operations
- Reasoning data streamed separately for AI transparency

#### Grid System
- Widget positions persisted per profile in localStorage
- `sanitizeWidgetPositions()` prevents out-of-bounds placement
- Dynamic row calculation based on container height

#### State Management
- ChatStore (Zustand) for global chat state
- Local component state for UI interactions
- Streaming state managed by inference service

### Development Guidelines

#### Adding Widgets
1. Create component in `components/`
2. Register in `hooks/registry.tsx` with unique ID
3. Handle inference service integration if needed
4. Test drag/resize behavior across breakpoints

#### Working with Inference
- Subscribe to streaming state for real-time updates
- Handle `streamingMessageId` to prevent concurrent operations  
- Use `onStreamingStateChange` callbacks for custom behavior
- Implement proper cleanup in useEffect returns
