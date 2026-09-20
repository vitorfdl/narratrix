import { Check, ListChecks } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
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

const rowBase = "group flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors";
const rowIdle = "border-transparent hover:bg-pink-100/70 dark:hover:bg-pink-900/30";
const rowActive = "border-pink-400/60 bg-pink-100 dark:border-pink-400/50 dark:bg-pink-900/40";

const badgeBase = "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[11px] font-semibold leading-none";
const badgeIdle = "border border-pink-300/60 text-pink-600 dark:border-pink-500/40 dark:text-pink-300";
const badgeActive = "bg-pink-500 text-white dark:bg-pink-400 dark:text-pink-950";

const ChoiceCard = memo<ChoiceCardProps>(({ choice, onResolve, onCancel }) => {
  const { choices, allowCustom, allowMultiple } = choice;
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedCustom = custom.trim();
  const hasCustom = !!allowCustom && trimmedCustom.length > 0;

  const selectedValues = useMemo(() => {
    const values = [...picked];
    if (hasCustom) {
      values.push(trimmedCustom);
    }
    return values;
  }, [picked, hasCustom, trimmedCustom]);

  const canSubmit = selectedValues.length > 0;

  const toggleOption = useCallback(
    (value: string) => {
      setPicked((prev) => {
        if (allowMultiple) {
          return prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
        }
        return prev.includes(value) ? [] : [value];
      });
      // Single-select: choosing a predefined option clears any custom answer.
      if (!allowMultiple) {
        setCustom("");
      }
    },
    [allowMultiple],
  );

  const handleCustomChange = useCallback(
    (value: string) => {
      setCustom(value);
      // Single-select: typing a custom answer deselects the predefined options.
      if (!allowMultiple && value.trim()) {
        setPicked([]);
      }
    },
    [allowMultiple],
  );

  const submit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    const value = allowMultiple ? JSON.stringify(selectedValues) : selectedValues[0];
    onResolve(choice.id, value);
  }, [allowMultiple, canSubmit, selectedValues, onResolve, choice.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
        return;
      }
      // Number selection is disabled while the custom field has focus so typing digits works.
      if (document.activeElement === inputRef.current) {
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n)) {
        return;
      }
      if (n >= 1 && n <= choices.length) {
        e.preventDefault();
        toggleOption(choices[n - 1].value);
      } else if (allowCustom && n === choices.length + 1) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    },
    [submit, choices, allowCustom, toggleOption],
  );

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn("relative rounded-lg border border-pink-400/40 dark:border-pink-500/40 bg-pink-50/60 dark:bg-pink-950/40", "shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300")}
    >
      <div className="flex items-start gap-2.5 px-4 pt-3 pb-2">
        <ListChecks className="h-4 w-4 text-pink-500 dark:text-pink-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium text-foreground leading-relaxed flex-1 min-w-0 break-words">{choice.prompt}</p>
        {allowMultiple && <span className="flex-shrink-0 rounded bg-pink-400/15 px-1.5 py-0.5 text-xxs font-medium text-pink-600 dark:text-pink-300">Select all that apply</span>}
      </div>

      <div className="flex flex-col gap-1 px-3 pb-2">
        {choices.map((option, index) => {
          const selected = picked.includes(option.value);
          return (
            <button key={option.value} type="button" onClick={() => toggleOption(option.value)} className={cn(rowBase, selected ? rowActive : rowIdle)}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground break-words">
                  {selected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-pink-500 dark:text-pink-400" />}
                  <span className="min-w-0 break-words">{option.label}</span>
                </div>
                {option.description && <p className="mt-0.5 text-xs text-muted-foreground leading-snug break-words">{option.description}</p>}
              </div>
              <span className={cn(badgeBase, selected ? badgeActive : badgeIdle)}>{index + 1}</span>
            </button>
          );
        })}

        {allowCustom && (
          <div className={cn(rowBase, hasCustom ? rowActive : "border-transparent")}>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">Other</div>
              <Input ref={inputRef} value={custom} onChange={(e) => handleCustomChange(e.target.value)} placeholder="Type your own answer here" className="mt-1 h-7 flex-1 text-xs" />
            </div>
            <span className={cn(badgeBase, hasCustom ? badgeActive : badgeIdle)}>{choices.length + 1}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-pink-400/20 dark:border-pink-500/20 px-4 py-2">
        <span className="text-xxs text-muted-foreground">{allowMultiple && canSubmit ? `${selectedValues.length} selected` : ""}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={() => onCancel(choice)}>
            Cancel
          </Button>
          <Button variant="default" size="sm" className="h-7 px-3 text-xs" disabled={!canSubmit} onClick={submit}>
            Submit
          </Button>
        </div>
      </div>
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
