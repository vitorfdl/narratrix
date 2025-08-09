import { ChatMessage } from "@/schema/chat-message-schema";
import { memo } from "react";
import { MidMessageLayerControl } from "./MidMessageLayerControl";
import { SummarySettings } from "./SummaryDialog";

interface MidMessageLayerWrapperProps {
  messageBefore: ChatMessage;
  messageAfter: ChatMessage;
  onSummarize: (messageId: string, settings: SummarySettings) => void;
}

const MidMessageLayerWrapper = ({ messageBefore, messageAfter, onSummarize }: MidMessageLayerWrapperProps) => {
  return <MidMessageLayerControl messageBefore={messageBefore} messageAfter={messageAfter} onSummarize={(messageId, settings) => onSummarize(messageId, settings)} />;
};

// Memoize component to prevent unnecessary re-renders
export default memo(MidMessageLayerWrapper, (prevProps, nextProps) => {
  return (
    prevProps.messageBefore.id === nextProps.messageBefore.id &&
    prevProps.messageAfter.id === nextProps.messageAfter.id &&
    prevProps.messageBefore.disabled === nextProps.messageBefore.disabled &&
    prevProps.messageAfter.disabled === nextProps.messageAfter.disabled
  );
});
