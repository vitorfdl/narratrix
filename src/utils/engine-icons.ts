import type { IconType } from "react-icons";
import { LuCpu, LuRoute, LuServer } from "react-icons/lu";
import { SiAmazonwebservices, SiAnthropic, SiGoogle, SiOllama, SiOpenai } from "react-icons/si";
import type { Engine } from "@/schema/model-manifest-schema";

interface EngineIconConfig {
  icon: IconType;
  /** Brand hex color. Undefined means fall back to the theme's primary color. */
  color?: string;
}

const ENGINE_CONFIG: Record<Engine, EngineIconConfig> = {
  openai: { icon: SiOpenai, color: "#10a37f" },
  anthropic: { icon: SiAnthropic, color: "#d97757" },
  google: { icon: SiGoogle, color: "#4285F4" },
  aws_bedrock: { icon: SiAmazonwebservices, color: "#FF9900" },
  openrouter: { icon: LuRoute, color: "#6467f2" },
  runpod: { icon: LuServer, color: "#6c4de7" },
  ollama: { icon: SiOllama },
  openai_compatible: { icon: LuCpu },
};

export function getEngineIcon(engine: Engine | undefined): IconType {
  if (!engine) {
    return LuCpu;
  }
  return ENGINE_CONFIG[engine]?.icon ?? LuCpu;
}

export function getEngineColor(engine: Engine | undefined): string | undefined {
  if (!engine) {
    return undefined;
  }
  return ENGINE_CONFIG[engine]?.color;
}
