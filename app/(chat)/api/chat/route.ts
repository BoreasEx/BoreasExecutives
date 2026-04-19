// ⚠️ SEULEMENT les parties modifiées sont commentées pour rester lisible

// ... TOUS VOS IMPORTS INCHANGÉS ...

export const maxDuration = 60;

// ... TOUT VOTRE CODE EXISTANT INCHANGÉ ...

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    // ✅ FIX TS
    const user = session.user;

    // ✅ DEBUG ROUTE HIT
    console.log("TEST_BOREAS_ROUTE_HIT");

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = user.type;

    const messageCount = await getMessageCountByUserId({
      id: user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);

      uiMessages = dbMessages as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelMessages = await convertToModelMessages(uiMessages);

    const lastUserMessageText =
      message?.role === "user"
        ? extractTextFromParts(message.parts as any)
        : "";

    // ✅ NOUVEAU : last assistant
    const lastAssistantMessageText = getLastMessageTextByRole(
      uiMessages,
      "assistant"
    );

    const userTurns = countMessagesByRole(uiMessages, "user");
    const assistantTurns = countMessagesByRole(uiMessages, "assistant");

    const boreasScores = scoreConversation(uiMessages, lastUserMessageText);
    const currentStep = getCurrentStep(boreasScores, uiMessages);
    const certificationResult = buildCertificationResult(boreasScores);

    // ✅ FIX MAJEUR : FIN = assistant (buyer)
    const ended = isConversationEnded(lastAssistantMessageText);

    // ✅ TRIGGER SÉCURISÉ
    const shouldTriggerEvaluation =
      currentStep === 5 &&
      ended &&
      userTurns >= 5 &&
      assistantTurns >= 4;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        dataStream.write({
          type: "data-clear",
          data: null,
        } as any);

        // ✅ DEBUG COMPLET
        console.log("BOREAS_TRIGGER_DEBUG", {
          chatId: id,
          currentStep,
          userTurns,
          assistantTurns,
          lastUserMessageText,
          lastAssistantMessageText,
          ended,
          scores: boreasScores,
          shouldTriggerEvaluation,
        });

        if (shouldTriggerEvaluation) {
          console.log("BOREAS_TRIGGER_FIRED");

          dataStream.write({
            type: "data-id",
            data: "certification-result",
          } as any);

          dataStream.write({
            type: "data-kind",
            data: "certification",
          } as any);

          dataStream.write({
            type: "data-title",
            data: "Certification Result",
          } as any);

          dataStream.write({
            type: "data-certification",
            data: certificationResult,
          } as any);

          dataStream.write({
            type: "data-finish",
            data: null,
          } as any);

          return;
        }

        const result = streamText({
          model: getLanguageModel(chatModel),
          system: systemPrompt({}),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
        });

        dataStream.merge(result.toUIMessageStream());

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },

      generateId: generateUUID,
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Chat error:", error);
    return new ChatbotError("offline:chat").toResponse();
  }
}