import { ListChecks, Send, X } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelAgentWorkflow } from "@/hooks/agentWorkflowStore";
import { type PendingChoice, usePendingChoices, useUserChoiceActions } from "@/hooks/userChoiceStore";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  choice: PendingChoice;
  onResolve: (id: string, value: string) => void;
  onCancel: (choice: PendingChoice) => void;
}

const ChoiceCard = memo<ChoiceCardProps>(({ choice, onResolve, onCancel }) => {
  const [custom, setCustom] = useState("");

  const submitCustom = () => {
    const trimmed = custom.trim();
    if (trimmed) {
      onResolve(choice.id, trimmed);
    }
  };

  return (
    <div className={cn("relative rounded-lg border border-pink-400/40 dark:border-pink-500/40 bg-pink-50/60 dark:bg-pink-950/40", "shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300")}>
      <div className="flex items-start gap-2.5 px-4 pt-3 pb-2">
        <ListChecks className="h-4 w-4 text-pink-500 dark:text-pink-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-foreground leading-relaxed flex-1 min-w-0 break-words">{choice.prompt}</p>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 -mt-0.5 -mr-1" onClick={() => onCancel(choice)} title="Cancel">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {choice.choices.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {choice.choices.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              className="h-auto min-h-8 max-w-full whitespace-normal break-words text-left py-1.5 px-3 text-xs font-medium border-pink-300/60 dark:border-pink-500/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 hover:border-pink-400 dark:hover:border-pink-400 transition-colors"
              onClick={() => onResolve(choice.id, option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
      {choice.allowCustom && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCustom();
              }
            }}
            placeholder="Type your own answer…"
            className="h-8 flex-1 text-xs"
          />
          <Button variant="default" size="sm" className="h-8 shrink-0 px-2.5 text-xs" disabled={!custom.trim()} onClick={submitCustom} title="Send answer">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
});

ChoiceCard.displayName = "ChoiceCard";

const UserChoicePrompt: React.FC = memo(() => {
  const pendingChoices = usePendingChoices();
  const { resolveChoice } = useUserChoiceActions();

  const handleCancel = useCallback(
    (choice: PendingChoice) => {
      // Resolve this choice directly so standalone built-in tools (which have no registered
      // workflow cancel fn) don't hang; then signal the owning workflow to stop if there is one.
      resolveChoice(choice.id, null);
      cancelAgentWorkflow(choice.runKey);
    },
    [resolveChoice],
  );

  if (pendingChoices.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      {pendingChoices.map((choice) => (
        <ChoiceCard key={choice.id} choice={choice} onResolve={resolveChoice} onCancel={handleCancel} />
      ))}
    </div>
  );
});

UserChoicePrompt.displayName = "UserChoicePrompt";

export default UserChoicePrompt;
