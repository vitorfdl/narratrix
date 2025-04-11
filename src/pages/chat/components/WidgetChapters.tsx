import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatActions, useCurrentChatActiveChapterID, useCurrentChatChapters } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import { ChatChapter } from "@/schema/chat-chapter-schema";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpDown, BookOpen, Copy, Filter, GripVertical, MoreHorizontal, Plus, Search, Settings, Trash2 } from "lucide-react";
import { useState } from "react";

// Define a type for the chapter data structure used in forms
type ChapterFormData = {
  id?: string;
  title: string;
  sequence?: number;
  scenario: string;
  start_message: string;
  custom: {
    auto_start_message: boolean;
    branchingOptions: string[];
  };
};

// Reusable Chapter Form component for both creating and editing
interface ChapterFormProps {
  chapterData: ChapterFormData;
  onChapterDataChange: (data: ChapterFormData) => void;
  isEditMode?: boolean;
}

const ChapterForm = ({ chapterData, onChapterDataChange, isEditMode = false }: ChapterFormProps) => {
  const updateField = (field: keyof ChapterFormData, value: any) => {
    onChapterDataChange({ ...chapterData, [field]: value });
  };

  const updateCustomField = (field: keyof ChapterFormData["custom"], value: any) => {
    onChapterDataChange({
      ...chapterData,
      custom: { ...chapterData.custom, [field]: value },
    });
  };

  const idPrefix = isEditMode ? "edit-" : "";

  return (
    <Tabs defaultValue="basic">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger disabled className="line-through" value="advanced">
          Advanced Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4 py-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}title`} descriptionTag={"{{chapter.title}}"} className="flex items-center gap-1">
              Title
            </Label>
            <Input
              id={`${idPrefix}title`}
              value={chapterData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Chapter Title"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}scenario`} descriptionTag={"{{chapter.scenario}}"}>
              Scenario
            </Label>
            <MarkdownTextArea
              key={`${idPrefix}scenario`}
              initialValue={chapterData.scenario || ""}
              editable={true}
              suggestions={promptReplacementSuggestionList}
              onChange={(value) => updateField("scenario", value)}
              placeholder="Describe the scenario of this chapter"
              className="max-h-[20vh]"
            />
          </div>

          <div className="grid gap-2">
            {chapterData.custom.auto_start_message ? (
              <Label htmlFor={`${idPrefix}start-message`}>Instruction to AI</Label>
            ) : (
              <Label htmlFor={`${idPrefix}start-message`}>Chat Start Message</Label>
            )}
            <MarkdownTextArea
              key={`${idPrefix}start-message`}
              initialValue={chapterData.start_message || ""}
              editable={true}
              suggestions={promptReplacementSuggestionList}
              onChange={(value) => updateField("start_message", value)}
              placeholder={
                chapterData.custom.auto_start_message
                  ? "Enter User instruction to generate the start message"
                  : "Enter the User's first message to begin the chapter."
              }
              className="max-h-[20vh]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id={`${idPrefix}auto-start`}
              checked={chapterData.custom.auto_start_message}
              onCheckedChange={(checked) => updateCustomField("auto_start_message", checked)}
            />
            <Label htmlFor={`${idPrefix}auto-start`}>Use AI to generate the start message</Label>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="advanced" className="space-y-4 py-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Branching Options (optional)</Label>
            <div className="space-y-2">
              {(chapterData.custom.branchingOptions || []).map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...chapterData.custom.branchingOptions];
                      newOptions[index] = e.target.value;
                      updateCustomField("branchingOptions", newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newOptions = [...chapterData.custom.branchingOptions];
                      newOptions.splice(index, 1);
                      updateCustomField("branchingOptions", newOptions.length ? newOptions : isEditMode ? null : []);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentOptions = chapterData.custom.branchingOptions || [];
                  updateCustomField("branchingOptions", [...currentOptions, ""]);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};

const WidgetChapters = () => {
  const chapters = useCurrentChatChapters();
  const activeChapterId = useCurrentChatActiveChapterID();
  const { switchChatChapter, addChatChapter, deleteChatChapter, updateChatChapter } = useChatActions();

  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [isEditingChapter, setIsEditingChapter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"sequence" | "title" | "updated_at">("sequence");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  // Initial state for new chapter
  const [newChapterData, setNewChapterData] = useState<ChapterFormData>({
    title: "",
    scenario: "",
    start_message: "",
    custom: {
      auto_start_message: false,
      branchingOptions: [],
    },
  });

  // State for editing chapter
  const [editingChapter, setEditingChapter] = useState<ChapterFormData | null>(null);

  // Filter chapters based on search query
  const filteredChapters =
    chapters?.filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(searchQuery.toLowerCase()) || chapter.scenario?.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  // Sort chapters
  const sortedChapters = [...filteredChapters].sort((a, b) => {
    let comparison = 0;

    if (sortBy === "sequence") {
      comparison = a.sequence - b.sequence;
    } else if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === "updated_at") {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      comparison = dateA - dateB;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = sortedChapters.findIndex((item) => item.id === active.id);
      const newIndex = sortedChapters.findIndex((item) => item.id === over.id);

      const updatedChapters = [...sortedChapters];
      const [movedItem] = updatedChapters.splice(oldIndex, 1);
      updatedChapters.splice(newIndex, 0, movedItem);

      // Update sequence numbers
      updatedChapters.forEach((chapter, index) => {
        updateChatChapter(chapter.id, { sequence: index + 1 });
      });
    }
  };

  const handleSwitchChapter = (chapterId: string) => {
    switchChatChapter(chapterId);
  };

  const handleCreateChapter = () => {
    if (!newChapterData.title.trim()) {
      return;
    }

    const newSequence = chapters && chapters.length > 0 ? Math.max(...chapters.map((c) => c.sequence)) + 1 : 1;

    addChatChapter({
      title: newChapterData.title,
      sequence: newSequence,
      scenario: newChapterData.scenario || null,
      start_message: newChapterData.start_message || null,
      custom: newChapterData.custom,
    });

    setNewChapterData({
      title: "",
      scenario: "",
      start_message: "",
      custom: {
        auto_start_message: false,
        branchingOptions: [],
      },
    });
    setIsCreatingChapter(false);
  };

  const handleUpdateChapter = () => {
    if (!editingChapter?.id) {
      return;
    }

    updateChatChapter(editingChapter.id, {
      title: editingChapter.title,
      sequence: editingChapter.sequence,
      scenario: editingChapter.scenario,
      custom: editingChapter.custom,
    });

    setIsEditingChapter(false);
    setEditingChapter(null);
  };

  const handleDeleteChapter = (chapterId: string) => {
    deleteChatChapter(chapterId);
  };

  const startEditChapter = (chapter: ChatChapter) => {
    setEditingChapter({
      id: chapter.id,
      title: chapter.title,
      sequence: chapter.sequence,
      scenario: chapter.scenario || "",
      start_message: chapter.start_message || "",
      custom: {
        auto_start_message: chapter.custom?.auto_start_message || false,
        branchingOptions: chapter.custom?.branchingOptions || [],
      },
    });
    setIsEditingChapter(true);
  };

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  };

  // Item component for drag and drop
  const SortableChapterItem = ({ chapter }: { chapter: ChatChapter }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: chapter.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center py-1 px-1 rounded-lg border mb-2",
          chapter.id === activeChapterId ? "bg-primary/10 border-primary" : "bg-card",
        )}
      >
        <div {...attributes} {...listeners} className="mr-2 cursor-grab">
          <GripVertical className="!h-5 !w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 gap-0.5 min-w-0 cursor-pointer" onClick={() => handleSwitchChapter(chapter.id)}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-muted-foreground">#{chapter.sequence}</span>
            <h3 className="font-semibold text-sm truncate">{chapter.title}</h3>
          </div>
          {chapter.scenario && (
            <p className="text-xs italic font-light text-muted-foreground overflow-hidden text-ellipsis line-clamp-1">{chapter.scenario}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {chapter.id === activeChapterId && (
            <Badge variant="outline" className="bg-primary/20 text-primary p-0.5 border-primary">
              Active
            </Badge>
          )}

          <Button variant="ghost" size="icon" onClick={() => startEditChapter(chapter)}>
            <Settings className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  addChatChapter({
                    title: `${chapter.title} (Copy)`,
                    sequence: chapters?.length ? Math.max(...chapters.map((c) => c.sequence)) + 1 : 1,
                    scenario: chapter.scenario,
                    instructions: chapter.instructions,
                    start_message: chapter.start_message,
                    custom: chapter.custom,
                  });
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteChapter(chapter.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full h-full border-none bg-transparent p-0 m-0 flex flex-col">
      <CardHeader className="space-y-0.5 pb-1 py-1 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search chapters..."
                className="w-[200px] pl-8 border-x-transparent/20 border-x-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Filter className="h-4 w-4" />
                  Sort
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuItem
                  onClick={() => {
                    setSortBy("sequence");
                    toggleSortDirection();
                  }}
                  className={sortBy === "sequence" ? "bg-accent" : ""}
                >
                  Order {sortBy === "sequence" && (sortDirection === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSortBy("title");
                    toggleSortDirection();
                  }}
                  className={sortBy === "title" ? "bg-accent" : ""}
                >
                  Title {sortBy === "title" && (sortDirection === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSortBy("updated_at");
                    toggleSortDirection();
                  }}
                  className={sortBy === "updated_at" ? "bg-accent" : ""}
                >
                  Last Updated {sortBy === "updated_at" && (sortDirection === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isCreatingChapter} onOpenChange={setIsCreatingChapter}>
              <DialogTrigger asChild>
                <Button className="gap-1 h-8" size="sm">
                  <Plus className="!h-4 !w-4" />
                  New Chapter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Chapter</DialogTitle>
                  <DialogDescription>Add a new chapter to your narrative. You can configure additional settings after creation.</DialogDescription>
                </DialogHeader>

                <ChapterForm chapterData={newChapterData} onChapterDataChange={setNewChapterData} />

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreatingChapter(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateChapter}>Create Chapter</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow overflow-hidden py-1 px-2">
        {!chapters || chapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="bg-muted rounded-full p-3 mb-4">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No chapters yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Create your first chapter to start organizing your story. Each chapter can have its own settings and configurations.
            </p>
            <Button onClick={() => setIsCreatingChapter(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Chapter
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={sortedChapters.map((chapter) => chapter.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sortedChapters.map((chapter) => (
                    <SortableChapterItem key={chapter.id} chapter={chapter} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>
        )}
      </CardContent>

      {/* Edit Chapter Dialog */}
      <Dialog open={isEditingChapter} onOpenChange={setIsEditingChapter}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Chapter</DialogTitle>
            <DialogDescription>Update your chapter settings and configuration.</DialogDescription>
          </DialogHeader>

          {editingChapter && <ChapterForm chapterData={editingChapter} onChapterDataChange={setEditingChapter} isEditMode={true} />}

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
