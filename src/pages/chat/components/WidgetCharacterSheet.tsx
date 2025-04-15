import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { CharacterForm } from "@/pages/characters/components/AddCharacterForm";
import { Character, CharacterUnion } from "@/schema/characters-schema";
import { motion } from "framer-motion";
import { UserCircle, UserPlus, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";
import AddParticipantPopover from "./AddParticipantPopover";

const WidgetCharacterSheet = () => {
  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const characters = useCharacters();
  const { updateSelectedChat } = useChatActions();
  const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState<CharacterUnion | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Use the hook to get the image URL for the current character
  const { url: avatarUrl, isLoading: isLoadingAvatar } = useImageUrl(currentCharacter?.avatar_path || null);

  // Get the current character data based on ID
  useEffect(() => {
    if (currentChatUserCharacterID) {
      const character = characters.find((char) => char.id === currentChatUserCharacterID);
      setCurrentCharacter(character || null);
    } else {
      setCurrentCharacter(null);
    }
  }, [currentChatUserCharacterID, characters]);

  // Handle character selection
  const handleSelectCharacter = async (characterId: string) => {
    try {
      // Only select characters (not agents)
      const selectedCharacter = characters.find((char) => char.id === characterId);
      if (selectedCharacter && selectedCharacter.type === "character") {
        await updateSelectedChat({ user_character_id: characterId });
        setCurrentCharacter(selectedCharacter);
      }
    } catch (error) {
      console.error("Failed to update character:", error);
    } finally {
      setIsSelectingCharacter(false);
    }
  };

  // Handle character removal
  const handleRemoveCharacter = async () => {
    try {
      await updateSelectedChat({ user_character_id: null });
      setCurrentCharacter(null);
    } catch (error) {
      console.error("Failed to remove character:", error);
    }
  };

  return (
    <Card className="w-full border border-border bg-transparent border-none backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Your Character</CardTitle>
        </div>
        <CardDescription className="text-sm">Set the character you'll play in this chat</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        {currentCharacter ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <div className="relative">
              {currentCharacter.avatar_path ? (
                <img
                  src={avatarUrl || "/avatars/default.jpg"}
                  alt={currentCharacter.name}
                  className={`h-24 w-24 rounded-full object-cover border-2 border-primary/30 ${isLoadingAvatar ? "opacity-70" : "opacity-100"} transition-opacity duration-200 cursor-pointer`}
                  onClick={() => {
                    setIsEditModalOpen(true);
                  }}
                />
              ) : (
                <div
                  className="h-24 w-24 rounded-full bg-accent flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    setIsEditModalOpen(true);
                  }}
                >
                  <UserRound className="h-12 w-12 text-primary/80" strokeWidth={1.5} />
                </div>
              )}
            </div>

            <div className="text-center space-y-2 max-w-md">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-base font-medium">{currentCharacter.name}</h3>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Character
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs line-clamp-3">
                You can access tags of the character in prompts using <span className="font-light italic text-primary">{"{{user.personality}}"}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <motion.div
              animate={{
                rotate: [0, 5, -5, 5, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3.5,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse",
              }}
              className="relative"
            >
              <UserRound className="h-24 w-24 text-primary/80" strokeWidth={1.5} />
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/10"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{
                  duration: 2.8,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                }}
              />
            </motion.div>

            <div className="text-center space-y-2 max-w-md">
              <h3 className="text-lg font-medium">No Character Selected</h3>
              <p className="text-muted-foreground text-sm">Select a character to represent you in this chat conversation</p>
            </div>
          </div>
        )}
      </CardContent>
      <Separator className="my-1" />
      <CardFooter className="flex justify-between pt-3">
        {currentCharacter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveCharacter}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="mr-1 h-4 w-4" />
            Remove
          </Button>
        )}
        <AddParticipantPopover
          isOpen={isSelectingCharacter}
          onOpenChange={setIsSelectingCharacter}
          onSelectCharacter={handleSelectCharacter}
          existingParticipantIds={[]}
          title="Change Character"
        >
          <Button variant="outline" size="sm" className="ml-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Change Character
          </Button>
        </AddParticipantPopover>
      </CardFooter>

      {/* Edit Character Dialog */}
      <CharacterForm
        open={isEditModalOpen}
        onOpenChange={(open: boolean) => setIsEditModalOpen(open ? isEditModalOpen : false)}
        mode="edit"
        initialData={currentCharacter as Character}
        setIsEditing={() => {}}
        onSuccess={() => {
          setIsEditModalOpen(false);
          // Optionally refresh the character data
        }}
      />
    </Card>
  );
};

export default WidgetCharacterSheet;
