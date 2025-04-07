import { AvatarCrop } from "@/components/shared/AvatarCrop";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { Button } from "@/components/ui/button";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { useState } from "react";

export default function LexicalTestPage() {
  const [content, setContent] = useState("# Hello, this is a test for TipTapTextArea!\n\ntest");
  const [editorKey, setEditorKey] = useState(0);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  const handleChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleReset = () => {
    setContent("Reset content!");
    setEditorKey((prev) => prev + 1);
  };

  const handleInsertTemplate = () => {
    setContent("This is a template with {{highlighted text}} in double brackets.");
    setEditorKey((prev) => prev + 1);
  };

  const handleCropComplete = (image: string) => {
    setCroppedImage(image);
  };

  return (
    <div className="container mx-auto py-8 page-container">
      <h1 className="text-2xl font-bold mb-4">TipTap Editor Test</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Avatar Crop Test</h2>
        <AvatarCrop
          onCropComplete={handleCropComplete}
          cropShape="round"
          existingImage={croppedImage}
          className="w-24 h-24 ring-2 ring-border overflow-hidden rounded-full hover:ring-primary"
        />

        {croppedImage && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Cropped Result:</h3>
            <img src={croppedImage} alt="Cropped avatar" className="w-32 h-32 rounded-full border object-cover" />
          </div>
        )}
      </div>

      <div className="mb-4">
        <TipTapTextArea
          key={editorKey}
          initialValue={content}
          onChange={handleChange}
          placeholder="Type something here..."
          label="TipTap Editor"
          className="min-h-[200px]"
          editable={true}
          suggestions={[
            { title: "character.name" },
            { title: "character.age" },
            { title: "character.gender" },
            { title: "character.height" },
            { title: "character.weight" },
            { title: "character.eye_color" },
            { title: "character.hair_color" },
          ]}
        />
      </div>

      <div className="flex gap-4">
        <Button onClick={handleReset}>Reset Content</Button>
        <Button onClick={handleInsertTemplate} variant="secondary">
          Insert Template with Highlights
        </Button>
        <Button variant="outline" onClick={() => console.log("Current content:", content)}>
          Log Current Content
        </Button>
      </div>

      <div className="mt-8 p-4 border rounded-md">
        <h2 className="text-lg font-medium mb-2">Preview (HTML Content):</h2>
        <div className="p-3 bg-muted rounded-md">
          <ResizableTextarea value={content} className="w-full" onChange={() => {}} />
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        <p>
          Note: Try typing text with double curly braces like: <code className="bg-muted px-1">{"{{variable}}"}</code> to see the highlighting
          feature.
        </p>
      </div>
    </div>
  );
}
