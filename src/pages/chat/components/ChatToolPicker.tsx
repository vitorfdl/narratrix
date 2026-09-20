import { Bot, ChevronDown, ClipboardList, ClipboardPen, Dices, DoorOpen, type LucideIcon, MessageCircleQuestionMark, UserRoundSearch, Users, Wrench, XIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ChatTemplateTool } from "@/schema/template-chat-schema";
import { type ChatToolGroup, type ChatToolOption, toolRefKey } from "@/services/agent-tools";

const GROUP_ORDER: ChatToolGroup[] = ["agents", "story", "participants", "sheets"];

const GROUP_LABEL: Record<ChatToolGroup, string> = {
  agents: "Your Agents",
  story: "Story",
  participants: "Participants",
  sheets: "Character Sheets",
};

const NODE_ICON: Record<string, LucideIcon> = {
  userChoice: MessageCircleQuestionMark,
  listParticipants: Users,
  setParticipantEnabled: DoorOpen,
  getParticipantData: UserRoundSearch,
  getCharacterSheet: ClipboardList,
  updateCharacterSheet: ClipboardPen,
  rollDice: Dices,
};

function getOptionIcon(option: ChatToolOption): LucideIcon {
  if (option.kind === "agent") {
    return Bot;
  }
  return (option.nodeType && NODE_ICON[option.nodeType]) || Wrench;
}

interface ChatToolPickerProps {
  options: ChatToolOption[];
  selected: ChatTemplateTool[];
  onChange: (next: ChatTemplateTool[]) => void;
  disabled?: boolean;
}

export function ChatToolPicker({ options, selected, onChange, disabled }: ChatToolPickerProps) {
  const groups = useMemo(() => GROUP_ORDER.map((group) => ({ group, items: options.filter((o) => o.group === group) })).filter((g) => g.items.length > 0), [options]);

  const selectedKeys = useMemo(() => new Set(selected.map(toolRefKey)), [selected]);

  const toggle = (option: ChatToolOption) => {
    if (selectedKeys.has(option.key)) {
      onChange(selected.filter((ref) => toolRefKey(ref) !== option.key));
    } else {
      onChange([...selected, option.ref]);
    }
  };

  const remove = (key: string) => onChange(selected.filter((ref) => toolRefKey(ref) !== key));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-xs px-2 h-auto min-h-7" disabled={disabled}>
          <div className="flex gap-1 flex-wrap items-center">
            {selected.length > 0 ? (
              selected.map((ref) => {
                const key = toolRefKey(ref);
                const option = options.find((o) => o.key === key);
                const Icon = option ? getOptionIcon(option) : Wrench;
                return (
                  <Badge
                    variant="default"
                    key={key}
                    className="px-1 py-0 rounded-sm text-[10px] flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(key);
                    }}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {option?.label ?? "Missing tool"}
                    <XIcon className="h-2 w-2" />
                  </Badge>
                );
              })
            ) : (
              <span className="text-muted-foreground">Give the AI abilities...</span>
            )}
          </div>
          <ChevronDown className="ml-auto !h-3 !w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search abilities..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No matching ability.</CommandEmpty>
            {groups.map(({ group, items }) => (
              <CommandGroup key={group} heading={GROUP_LABEL[group]}>
                {items.map((option) => {
                  const isSelected = selectedKeys.has(option.key);
                  const Icon = getOptionIcon(option);
                  return (
                    <CommandItem key={option.key} value={`${option.label} ${option.summary ?? ""} ${option.name}`} className="text-xs items-center gap-2 py-1.5" onSelect={() => toggle(option)}>
                      <Checkbox checked={isSelected} className="h-4 w-4 shrink-0" />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{option.label}</span>
                        {option.summary && <span className="text-xxs text-muted-foreground truncate">{option.summary}</span>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
