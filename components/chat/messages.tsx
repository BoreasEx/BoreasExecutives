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
        <div className="absolute inset-0 z-10 flex items-start justify-center pt-6 px-4 sm:px-6">
          <div className="w-full max-w-3xl rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-6 md:p-10 shadow-[var(--shadow-float)] backdrop-blur">
            <div className="flex flex-col items-center text-center">
              <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-center md:gap-5">
                <img
                  src="/boreas-executives-logo.png"
                  alt="Boreas Executives"
                  className="h-10 w-auto max-w-[110px] object-contain sm:h-12 sm:max-w-[130px] md:h-16 md:max-w-[170px] shrink-0"
                />

                <div className="text-center md:text-left">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                    Boreas Executives
                  </h1>

                  <p className="mt-1 text-sm leading-5 text-muted-foreground sm:mt-2 md:text-base">
                    AI-powered IQF fruit negotiation simulator
                  </p>
                </div>
              </div>

              <div className="mt-5 sm:mt-6 md:mt-8 max-w-2xl rounded-2xl border border-white/10 bg-white/5 px-4 py-4 sm:px-5 sm:py-6">
                <p className="text-base leading-7 text-foreground sm:text-lg">
                  <span className="font-semibold">Scenario:</span>{" "}
                  You are an Egyptian IQF strawberry supplier negotiating with a
                  European jam manufacturer.
                </p>

                <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
                  Start with your offer. Expect pressure on consistency,
                  traceability, and risk.
                </p>
              </div>
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