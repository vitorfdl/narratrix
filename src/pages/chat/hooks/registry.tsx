import WidgetChapters from "@/pages/chat/components/WidgetChapters";
import WidgetCharacterSheet from "@/pages/chat/components/WidgetCharacterSheet";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import WidgetDatabase from "@/pages/chat/components/WidgetDatabase";
import WidgetGenerate from "@/pages/chat/components/WidgetGenerate";
import WidgetMemory from "@/pages/chat/components/WidgetMemory";
import WidgetMessages from "@/pages/chat/components/WidgetMessages";
import WidgetParticipants from "@/pages/chat/components/WidgetParticipants";
import WidgetScript from "@/pages/chat/components/WidgetScript";
import { BookOpen, Brain, Database, FileTextIcon, MessageSquare, Settings, Smile, Sparkles, User, Users } from "lucide-react";
import React from "react";
import WidgetExpressions from "../components/WidgetExpressions";

// Import types for props if available

export type WidgetId =
  | "messages"
  | "config"
  | "generate"
  | "participants"
  | "scripts"
  | "character_sheet"
  | "memory"
  | "database"
  | "chapters"
  | "expressions";

export const widgetTitles: Record<WidgetId, string> = {
  messages: "Messages",
  config: "Config",
  generate: "Generate",
  participants: "Participants",
  scripts: "Scripts",
  character_sheet: "Character Sheet",
  memory: "Memory",
  database: "Database",
  chapters: "Chapters",
  expressions: "Expressions",
};

interface WidgetConfiguration<T = unknown> {
  id: WidgetId;
  title: string;
  component: React.FC<T>;
  defaultProps?: T;
  icon: React.ReactNode;
}

// Define widget configurations for each widget id
export const widgetConfigurations: Record<WidgetId, WidgetConfiguration<any>> = {
  messages: {
    id: "messages",
    title: widgetTitles.messages,
    component: WidgetMessages,
    defaultProps: {},
    icon: <MessageSquare className="w-4 h-4" />,
  },
  config: {
    id: "config",
    title: widgetTitles.config,
    component: WidgetConfig,
    defaultProps: {},
    icon: <Settings className="w-4 h-4" />,
  },
  generate: {
    id: "generate",
    title: widgetTitles.generate,
    component: WidgetGenerate,
    defaultProps: {},
    icon: <Sparkles className="w-4 h-4" />,
  },
  participants: {
    id: "participants",
    title: widgetTitles.participants,
    component: WidgetParticipants,
    defaultProps: {},
    icon: <Users className="w-4 h-4" />,
  },
  scripts: {
    id: "scripts",
    title: widgetTitles.scripts,
    component: WidgetScript,
    defaultProps: {},
    icon: <FileTextIcon className="w-4 h-4" />,
  },
  character_sheet: {
    id: "character_sheet",
    title: widgetTitles.character_sheet,
    component: WidgetCharacterSheet,
    defaultProps: {},
    icon: <User className="w-4 h-4" />,
  },
  memory: {
    id: "memory",
    title: widgetTitles.memory,
    component: WidgetMemory,
    defaultProps: {},
    icon: <Brain className="w-4 h-4" />,
  },
  database: {
    id: "database",
    title: widgetTitles.database,
    component: WidgetDatabase,
    defaultProps: {},
    icon: <Database className="w-4 h-4" />,
  },
  chapters: {
    id: "chapters",
    title: widgetTitles.chapters,
    component: WidgetChapters,
    defaultProps: {},
    icon: <BookOpen className="w-4 h-4" />,
  },
  expressions: {
    id: "expressions",
    title: widgetTitles.expressions,
    component: WidgetExpressions,
    defaultProps: {},
    icon: <Smile className="w-4 h-4" />,
  },
};

/**
 * Helper function to render the proper widget.
 * This function now accepts the tabId so that dynamic props can be merged.
 */
export function renderWidget(widgetId: WidgetId, tabId: string, extraProps?: Partial<any>): JSX.Element | null {
  const config = widgetConfigurations[widgetId];
  if (!config) {
    console.error(`No widget configuration found for widget id: ${widgetId}`);
    return null;
  }
  const Component = config.component;

  // Merge default props, dynamically fetched extra props (e.g., from SQL), and any override extra props.
  const props = { ...(config.defaultProps || {}), ...extraProps, tabId };

  return <Component {...props} />;
}
