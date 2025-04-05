import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useChatActions, useCurrentChatActiveChapterID, useCurrentChatChapters } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import { ChatChapter } from "@/schema/chat-chapter-schema";
import { BookOpen, ChevronRight, Edit, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

const WidgetChapters = () => {
  const chapters = useCurrentChatChapters();
  const activeChapterId = useCurrentChatActiveChapterID();
  const { switchChatChapter, addChatChapter, deleteChatChapter, updateChatChapter } = useChatActions();

  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [isEditingChapter, setIsEditingChapter] = useState(false);
  const [editingChapter, setEditingChapter] = useState<ChatChapter | null>(null);
  const [newChapterData, setNewChapterData] = useState({
    title: "",
    scenario: "",
    instructions: "",
    start_message: "",
    custom: { auto_start_message: false },
  });

  const sortedChapters = [...(chapters || [])].sort((a, b) => a.sequence - b.sequence);

  const handleSwitchChapter = (chapterId: string) => {
    switchChatChapter(chapterId);
  };

  const handleCreateChapter = () => {
    if (!newChapterData.title.trim()) {
      return;
    }

    const newSequence = sortedChapters.length > 0 ? Math.max(...sortedChapters.map((c) => c.sequence)) + 1 : 1;

    addChatChapter({
      title: newChapterData.title,
      sequence: newSequence,
      scenario: newChapterData.scenario || null,
      instructions: newChapterData.instructions || null,
      start_message: newChapterData.start_message || null,
      custom: newChapterData.custom,
    });

    setNewChapterData({
      title: "",
      scenario: "",
      instructions: "",
      start_message: "",
      custom: { auto_start_message: false },
    });
    setIsCreatingChapter(false);
  };

  const handleUpdateChapter = () => {
    if (!editingChapter) {
      return;
    }

    updateChatChapter(editingChapter.id, {
      title: editingChapter.title,
      sequence: editingChapter.sequence,
      scenario: editingChapter.scenario,
      instructions: editingChapter.instructions,
    });

    setIsEditingChapter(false);
    setEditingChapter(null);
  };

  const handleDeleteChapter = (chapterId: string) => {
    deleteChatChapter(chapterId);
  };

  const startEditChapter = (chapter: ChatChapter) => {
    setEditingChapter({ ...chapter });
    setIsEditingChapter(true);
  };

  return (
    <Card className="w-full h-full border-none p-0 m-0 backdrop-blur-sm flex flex-col">
      <CardHeader className="space-y-0.5 pb-1 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-normal italic">Organize your narrative into chapters</CardTitle>
          </div>
          <Button variant="outline" size="sm" className="mr-0.5" onClick={() => setIsCreatingChapter(true)}>
            <Plus className="!h-4 !w-4" />
            New
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-grow overflow-hidden p-0 m-0">
        {sortedChapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm max-w-[200px]">No chapters yet. Create your first chapter to organize your story.</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-4">
            <div className="space-y-2 py-1 pr-0 pl-4">
              {sortedChapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className={cn(
                    "group flex items-center p-0.5 rounded-lg transition-colors",
                    chapter.id === activeChapterId ? "bg-primary/10 text-primary" : "hover:bg-accent",
                  )}
                >
                  <div className="flex items-center flex-1 cursor-pointer" onClick={() => handleSwitchChapter(chapter.id)}>
                    <GripVertical className="h-4 w-4 text-muted-foreground mr-2 cursor-grab" />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="font-medium text-sm sm:text-xs">{chapter.title}</span>
                        {chapter.id === activeChapterId && (
                          <Badge variant="outline" className="font-mono ml-2 border-primary p-0.5 text-primary text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      {chapter.scenario && <p className="text-xs text-muted-foreground line-clamp-1">{chapter.scenario}</p>}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEditChapter(chapter)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteChapter(chapter.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Create Chapter Dialog */}
      <Dialog open={isCreatingChapter} onOpenChange={setIsCreatingChapter}>
        <DialogContent className="sm:max-w-[30vw]">
          <DialogHeader>
            <DialogTitle>Create New Chapter</DialogTitle>
            <DialogDescription>Add a new chapter to your narrative. You can configure additional settings after creation.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newChapterData.title}
                onChange={(e) => setNewChapterData({ ...newChapterData, title: e.target.value })}
                placeholder="Chapter Title"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scenario">Scenario (optional)</Label>
              <Textarea
                id="scenario"
                value={newChapterData.scenario}
                onChange={(e) => setNewChapterData({ ...newChapterData, scenario: e.target.value })}
                placeholder="Describe the scenario of this chapter"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="start-message">Start Message (optional)</Label>
              <Textarea
                id="start-message"
                value={newChapterData.start_message}
                onChange={(e) => setNewChapterData({ ...newChapterData, start_message: e.target.value })}
                placeholder="Initial message when chapter starts"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-start">Auto Start Message</Label>
              <Switch
                id="auto-start"
                checked={newChapterData.custom.auto_start_message}
                onCheckedChange={(checked) =>
                  setNewChapterData({
                    ...newChapterData,
                    custom: { ...newChapterData.custom, auto_start_message: checked },
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingChapter(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateChapter}>Create Chapter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Chapter Dialog */}
      <Dialog open={isEditingChapter} onOpenChange={setIsEditingChapter}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Chapter</DialogTitle>
            <DialogDescription>Update chapter details and settings.</DialogDescription>
          </DialogHeader>

          {editingChapter && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingChapter.title}
                  onChange={(e) => setEditingChapter({ ...editingChapter, title: e.target.value })}
                  placeholder="Chapter Title"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-scenario">Scenario</Label>
                <Textarea
                  id="edit-scenario"
                  value={editingChapter.scenario || ""}
                  onChange={(e) => setEditingChapter({ ...editingChapter, scenario: e.target.value })}
                  placeholder="Describe the scenario of this chapter"
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-instructions">Instructions</Label>
                <Textarea
                  id="edit-instructions"
                  value={editingChapter.instructions || ""}
                  onChange={(e) => setEditingChapter({ ...editingChapter, instructions: e.target.value })}
                  placeholder="Special instructions for this chapter"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-auto-start">Auto Start Message</Label>
                <Switch
                  id="edit-auto-start"
                  checked={editingChapter.custom?.auto_start_message || false}
                  onCheckedChange={(checked) =>
                    setEditingChapter({
                      ...editingChapter,
                      custom: { ...(editingChapter.custom || {}), auto_start_message: checked },
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingChapter(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateChapter}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default WidgetChapters;
