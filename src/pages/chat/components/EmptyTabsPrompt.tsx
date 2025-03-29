import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface EmptyTabsPromptProps {
  onCreateTab: () => void;
}

export function EmptyTabsPrompt({ onCreateTab }: EmptyTabsPromptProps) {
  return (
    <div className="flex items-center justify-center h-full w-full p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <h3 className="text-lg font-semibold mb-2">No Active Tabs</h3>
          <p className="text-muted-foreground mb-4">Create a new tab to get started with your conversation</p>
          <Button onClick={onCreateTab} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Tab
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
