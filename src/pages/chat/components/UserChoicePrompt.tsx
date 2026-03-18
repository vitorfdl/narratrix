import { ListChecks, X } from "lucide-react";
import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAgentWorkflowStore } from "@/hooks/agentWorkflowStore";
import { usePendingChoices, useUserChoiceActions } from "@/hooks/userChoiceStore";
import { cn } from "@/lib/utils";
import { cancelWorkflow } from "@/services/agent-workflow/runner";

const UserChoicePrompt: React.FC = memo(() => {
  const pendingChoices = usePendingChoices();
  const { resolveChoice, cancelChoicesForAgent } = useUserChoiceActions();
  const setAgentState = useAgentWorkflowStore((s) => s.setAgentState);

  const handleCancel = useCallback(
    (agentId: string) => {
      cancelWorkflow(agentId);
      setAgentState(agentId, { isRunning: false, executedNodes: [] });
      cancelChoicesForAgent(agentId);
    },
    [cancelChoicesForAgent, setAgentState],
  );

  if (pendingChoices.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      {pendingChoices.map((choice) => (
        <div
          key={choice.id}
          className={cn("relative rounded-lg border border-pink-400/40 dark:border-pink-500/40 bg-pink-50/60 dark:bg-pink-950/40", "shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300")}
        >
          <div className="flex items-start gap-2.5 px-4 pt-3 pb-2">
            <ListChecks className="h-4 w-4 text-pink-500 dark:text-pink-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground leading-relaxed flex-1">{choice.prompt}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 -mt-0.5 -mr-1"
              onClick={() => handleCancel(choice.agentId)}
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {choice.choices.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs font-medium border-pink-300/60 dark:border-pink-500/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 hover:border-pink-400 dark:hover:border-pink-400 transition-colors"
                onClick={() => resolveChoice(choice.id, option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

UserChoicePrompt.displayName = "UserChoicePrompt";

export default UserChoicePrompt;
