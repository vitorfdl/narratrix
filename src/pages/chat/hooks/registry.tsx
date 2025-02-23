import React from "react";
import WidgetMessages from "@/pages/chat/components/WidgetMessages";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import WidgetGenerate from "@/pages/chat/components/WidgetGenerate";
import WidgetParticipants from "@/pages/chat/components/WidgetParticipants";
import WidgetScript from "@/pages/chat/components/WidgetScript";
import WidgetCharacterSheet from "@/pages/chat/components/WidgetCharacterSheet";
import WidgetMemory from "@/pages/chat/components/WidgetMemory";
import WidgetDatabase from "@/pages/chat/components/WidgetDatabase";
import WidgetChapters from "@/pages/chat/components/WidgetChapters";

// Import types for props if available
import type { MessageRendererProps } from "@/pages/chat/components/WidgetMessages";

export type WidgetId =
  | "messages"
  | "config"
  | "generate"
  | "participants"
  | "scripts"
  | "character_sheet"
  | "memory"
  | "database"
  | "chapters";

interface WidgetConfig<T = unknown> {
  id: WidgetId;
  title: string;
  component: React.FC<T>;
  defaultProps?: T;
}

// Define widget configurations for each widget id
export const widgetConfigurations: Record<WidgetId, WidgetConfig<any>> = {
  messages: {
    id: "messages",
    title: "Messages",
    component: WidgetMessages,
    defaultProps: {
      messages: [], // Default empty array; will be dynamically merged later
      contextCutNumber: 700,
      onEditMessage: (id: string) => console.log("Edit", id),
      onDeleteMessage: (id: string) => console.log("Delete", id),
      onCreateCheckpoint: (id: string) => console.log("Create checkpoint", id),
      onGenerateImage: (id: string) => console.log("Generate image", id),
      onTranslate: (id: string) => console.log("Translate", id),
      onExcludeFromPrompt: (id: string) => console.log("Exclude", id),
    } as MessageRendererProps,
  },
  config: {
    id: "config",
    title: "Config",
    component: WidgetConfig,
    defaultProps: {},
  },
  generate: {
    id: "generate",
    title: "Generate",
    component: WidgetGenerate,
    defaultProps: {},
  },
  participants: {
    id: "participants",
    title: "Participants",
    component: WidgetParticipants,
    defaultProps: {},
  },
  scripts: {
    id: "scripts",
    title: "Scripts",
    component: WidgetScript,
    defaultProps: {},
  },
  character_sheet: {
    id: "character_sheet",
    title: "Character Sheet",
    component: WidgetCharacterSheet,
    defaultProps: {},
  },
  memory: {
    id: "memory",
    title: "Memory",
    component: WidgetMemory,
    defaultProps: {},
  },
  database: {
    id: "database",
    title: "Database",
    component: WidgetDatabase,
    defaultProps: {},
  },
  chapters: {
    id: "chapters",
    title: "Chapters",
    component: WidgetChapters,
    defaultProps: {},
  },
};

/**
 * This function can be extended to fetch dynamic props based on tabId and widgetId.
 * Currently, it optionally injects the mocked messages for testing.
 */
const getDynamicExtraProps = (_tabId: string, widgetId: WidgetId): Partial<any> => {
  // For example, if widget is "messages" we merge in dynamic messages data (from SQL later)
  if (widgetId === "messages") {
    // Here you'd eventually query your SQL database with tabId and fetch the messages.
    // For now, we just return a mock.
    const mockMessages = [
      {
        id: "0",
        content: ["You are a helpful assistant that can answer questions and help with tasks."],
        timestamp: new Date(),
        type: "system",
      },
      {
        id: "1",
        content: ["Hello, how are you?"],
        timestamp: new Date(),
        avatar: "/avatars/vitor.png",
        type: "user",
      },
      {
        id: "2",
        content: ["I'm fine, thank you!"],
        timestamp: new Date(),
        avatar: "/avatars/narratrixav.jpeg",
        type: "assistant",
      },
      {
        id: "3",
        content: ["What is the weather in Tokyo?"],
        timestamp: new Date(),
        avatar: "/avatars/vitor.png",
        type: "user",
      },
      {
        id: "4",
        content: [
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit...",
          "The weather in Tokyo is sunny and warm.",
        ],
        timestamp: new Date(),
        avatar: "/avatars/narratrixav.jpeg",
        type: "assistant",
      },
    ];
    return { messages: mockMessages };
  }
  return {};
};

/**
 * Helper function to render the proper widget.
 * This function now accepts the tabId so that dynamic props can be merged.
 */
export function renderWidget(
  widgetId: WidgetId,
  tabId: string,
  extraProps?: Partial<any>
): JSX.Element | null {
  const config = widgetConfigurations[widgetId];
  if (!config) {
    console.error(`No widget configuration found for widget id: ${widgetId}`);
    return null;
  }
  const Component = config.component;

  // Merge default props, dynamically fetched extra props (e.g., from SQL), and any override extra props.
  const dynamicProps = getDynamicExtraProps(tabId, widgetId);
  const props = { ...(config.defaultProps || {}), ...dynamicProps, ...extraProps };

  return <Component {...props} />;
}