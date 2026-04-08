import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDownIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  onEditMessage?: (message: ChatMessage) => void;
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  isLoading,
  selectedModelId: _selectedModelId,
  onEditMessage,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
    reset,
  } = useMessages({
    status,
  });

  useDataStream();

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  return (
    <div className="relative flex-1 bg-background">
    {messages.length === 0 && !isLoading && (
  <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
    <div className="w-full max-w-3xl rounded-2xl border border-border/60 bg-card/70 p-8 shadow-[var(--shadow-float)] backdrop-blur">
      <div className="mb-6 flex items-center gap-4">
        <img
          src="/boreas-executives-logo.png"
          alt="Boreas Executives"
          className="h-12 w-12 object-contain"
        />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Boreas Executives
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-powered IQF fruits negotiation simulator
          </p>
        </div>
      </div>

<div className="space-y-4">
  <p className="text-xs uppercase tracking-wider text-muted-foreground text-center max-w-3xl mx-auto">
    <span className="text-foreground font-medium">Product:</span> IQF strawberries
    <span className="mx-2 opacity-40">|</span>
    <span className="text-foreground font-medium">Origin:</span> Egypt
    <span className="mx-2 opacity-40">|</span>
    <span className="text-foreground font-medium">Buyer:</span> French Jam manufacturer
    <span className="mx-2 opacity-40">|</span>
    <span className="text-foreground font-medium">Style:</span> demanding, concise, risk-focused
  </p>
</div>
    </div>
  </div>
)}      <div
        className={cn(
          "absolute inset-0 touch-pan-y overflow-y-auto",
          messages.length > 0 ? "bg-background" : "bg-transparent"
        )}
        ref={messagesContainerRef}
        style={isArtifactVisible ? { scrollbarWidth: "none" } : undefined}
      >
        <div className="mx-auto flex min-h-full min-w-0 max-w-5xl flex-col gap-6 px-4 py-8 md:gap-8 md:px-6">
          {messages.map((message, index) => (
            <PreviewMessage
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isLoading={
                status === "streaming" && messages.length - 1 === index
              }
              isReadonly={isReadonly}
              key={message.id}
              message={message}
              onEdit={onEditMessage}
              regenerate={regenerate}
              requiresScrollPadding={
                hasSentMessage && index === messages.length - 1
              }
              setMessages={setMessages}
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
            />
          ))}

          {status === "submitted" && messages.at(-1)?.role !== "assistant" && (
            <ThinkingMessage />
          )}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </div>
      </div>

<button
  aria-label="Scroll to bottom"
  className={`absolute bottom-5 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border border-border/50 bg-card/90 px-4 text-[11px] text-muted-foreground shadow-[var(--shadow-float)] backdrop-blur-lg transition-all duration-200 ${
    isAtBottom
      ? "pointer-events-none scale-90 opacity-0"
      : "pointer-events-auto scale-100 opacity-100 hover:text-foreground"
  }`}
  onClick={() => scrollToBottom("smooth")}
  type="button"
>
  <ArrowDownIcon className="size-3" />
  <span>Latest exchange</span>
</button>
    </div>
  );
}

export const Messages = PureMessages;
