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
          <div className="w-full max-w-3xl rounded-2xl border border-border/60 bg-card/70 p-8 md:p-10 shadow-[var(--shadow-float)] backdrop-blur">
            <div className="mb-7 flex items-center gap-5">
              <img
                src="/boreas-executives-logo.png"
                alt="Boreas Executives"
                className="h-18 w-18 md:h-24 md:w-24 object-contain shrink-0"
              />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Boreas Executives
                </h1>
                <p className="mt-1 text-sm md:text-base text-muted-foreground">
                  AI-powered IQF fruits negotiation simulator
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="mx-auto max-w-3xl text-center text-sm md:text-[15px] leading-6 uppercase tracking-[0.08em] text-foreground/80">
                <span className="font-semibold text-foreground">Product:</span>
                <span className="ml-1 text-foreground/75">IQF STRAWBERRIES</span>

                <span className="mx-4 text-foreground/30">|</span>

                <span className="font-semibold text-foreground">Origin:</span>
                <span className="ml-1 text-foreground/75">EGYPT</span>

                <span className="mx-4 text-foreground/30">|</span>

                <span className="font-semibold text-foreground">Buyer:</span>
                <span className="ml-1 text-foreground/75">FRENCH JAM MANUFACTURER</span>

                <span className="mx-4 text-foreground/30">|</span>

                <span className="font-semibold text-foreground">Style:</span>
                <span className="ml-1 text-foreground/75">
                  DEMANDING, CONCISE, RISK-FOCUSED
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div
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