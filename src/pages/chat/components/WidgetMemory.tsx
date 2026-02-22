import { useCallback, useEffect, useMemo, useState } from "react";
import { LuUser } from "react-icons/lu";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCharacters } from "@/hooks/characterStore";
import { useChatMemoryActions, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";

interface EnrichedScope {
  scope: string;
  label: string;
  avatarPath?: string;
}

interface ScopeAvatarProps {
  scope: EnrichedScope;
  isActive: boolean;
  onClick: () => void;
  getAvatarFallback: (label: string) => string;
}

const ScopeAvatar: React.FC<ScopeAvatarProps> = ({ scope, isActive, onClick, getAvatarFallback }) => {
  const { url: avatarUrl } = useImageUrl(scope.avatarPath);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          className={cn(
            "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 hover:scale-105",
            isActive ? "bg-primary/10 shadow-[0_0_0_1.5px_rgba(99,102,241,0.6)]" : "opacity-75 hover:opacity-100",
          )}
        >
          <Avatar className="h-8 w-8 border border-border/60 shadow-sm">
            <AvatarImage className="object-cover rounded-full" src={avatarUrl} alt={scope.label} />
            <AvatarFallback className="bg-secondary">{scope.scope === "user" ? <LuUser className="h-6 w-6" /> : getAvatarFallback(scope.label)}</AvatarFallback>
          </Avatar>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="text-sm font-medium">{scope.label}</p>
        <p className="text-xs text-muted-foreground">{scope.scope === "user" ? "Your memory" : `${scope.label}'s memory`}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const WidgetMemory: React.FC = () => {
  const { updateShortMemory, getShortMemoryContent, getShortMemoryScopes } = useChatMemoryActions();
  const baseScopes = getShortMemoryScopes();
  const userCharacterId = useCurrentChatUserCharacterID();
  const characterList = useCharacters();

  const [selectedScope, setSelectedScope] = useState<string>("user");
  const [localContent, setLocalContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Enrich scopes with character data
  const enrichedScopes: EnrichedScope[] = useMemo(() => {
    return baseScopes.map((scope) => {
      if (scope.scope === "user") {
        // Get user character info if available
        const userCharacter = userCharacterId ? characterList.find((c) => c.id === userCharacterId) : null;
        return {
          scope: "user",
          label: userCharacter?.name || "You",
          avatarPath: userCharacter?.avatar_path || undefined,
        };
      }

      // Find participant character data
      const character = characterList.find((c) => c.id === scope.scope);
      return {
        scope: scope.scope,
        label: character?.name || "Participant",
        avatarPath: character?.avatar_path || undefined,
      };
    });
  }, [baseScopes, characterList, userCharacterId]);

  // Load content when scope changes
  useEffect(() => {
    const content = getShortMemoryContent(selectedScope);
    setLocalContent(content);
    setIsDirty(false);
  }, [selectedScope, getShortMemoryContent]);

  // Debounced save, only when user edits
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const storeContent = getShortMemoryContent(selectedScope);
    if (localContent === storeContent) {
      setIsDirty(false);
      return;
    }

    setIsSaving(true);
    const timeoutId = setTimeout(() => {
      updateShortMemory(selectedScope, localContent)
        .then(() => {
          setIsDirty(false);
        })
        .catch((error) => {
          console.error("Failed to update memory:", error);
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isDirty, localContent, selectedScope, updateShortMemory, getShortMemoryContent]);

  const handleContentChange = useCallback((content: string): void => {
    setLocalContent(content);
    setIsDirty(true);
  }, []);

  const getAvatarFallback = (label: string): string => {
    return label.slice(0, 2).toUpperCase();
  };

  const activeScope = useMemo(() => {
    return enrichedScopes.find((scope) => scope.scope === selectedScope);
  }, [enrichedScopes, selectedScope]);

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col gap-4 p-4">
        <div className="flex min-h-0 flex-1 gap-4">
          <aside className="flex w-10 flex-col items-center gap-2 pr-1.5 pt-1">
            <ScrollArea className="flex-1">
              <div className="flex flex-col items-center gap-3 mt-1 px-1 pb-2">
                {enrichedScopes.map((scope) => {
                  const isActive = selectedScope === scope.scope;
                  return (
                    <ScopeAvatar
                      key={scope.scope}
                      scope={scope}
                      isActive={isActive}
                      onClick={() => {
                        setSelectedScope(scope.scope);
                      }}
                      getAvatarFallback={getAvatarFallback}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-background/70 backdrop-blur-sm">
            <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold leading-tight">{activeScope?.label || "Participant"}</p>
                <p className="text-[11px] text-muted-foreground">Short-term memory shared in this conversation</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  isSaving ? "bg-primary/10 text-primary" : isDirty ? "bg-amber-500/10 text-amber-600" : "bg-secondary/50 text-muted-foreground",
                )}
              >
                {isSaving ? "Saving…" : isDirty ? "Unsaved changes" : "Synced"}
              </span>
            </header>
            <div className="relative flex-1">
              <MarkdownTextArea
                key={selectedScope}
                initialValue={localContent}
                onChange={handleContentChange}
                placeholder={`Enter memory for ${activeScope?.label || "this participant"}...`}
                className="h-full !ring-0 !rounded-none !border-none !bg-transparent !shadow-none focus-visible:!outline-none"
                editable={true}
                useEditorOnly={true}
              />
            </div>
          </section>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <p className="mt-1 leading-relaxed">
            Use <span className="font-light italic text-primary">{"{{user.memory}}"}</span> or <span className="font-light italic text-primary">{"{{char.memory}}"}</span> inside prompts to pull the
            latest short-term memory.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WidgetMemory;
