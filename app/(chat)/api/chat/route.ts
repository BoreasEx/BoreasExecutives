execute: async ({ writer: dataStream }) => {
  const shouldTriggerEvaluation =
    currentStep >= 5 && isConversationEnded(lastUserMessageText);

  if (shouldTriggerEvaluation) {
    dataStream.write({
      type: "data-clear",
      data: null,
    } as any);

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
    system: `${systemPrompt({ requestHints, supportsTools })}

${boreasContext}

${supplierContext}`.trim(),
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    experimental_activeTools:
      isReasoningModel && !supportsTools
        ? []
        : [
            "getWeather",
            "createDocument",
            "editDocument",
            "updateDocument",
            "requestSuggestions",
          ],
    providerOptions: {},
    tools: {
      getWeather,
      createDocument: createDocument({
        session,
        dataStream,
        modelId: chatModel,
      }),
      editDocument: editDocument({ dataStream, session }),
      updateDocument: updateDocument({
        session,
        dataStream,
        modelId: chatModel,
      }),
      requestSuggestions: requestSuggestions({
        session,
        dataStream,
        modelId: chatModel,
      }),
    },
    experimental_telemetry: {
      isEnabled: isProductionEnvironment,
      functionId: "stream-text",
    },
  });

  dataStream.merge(
    result.toUIMessageStream({ sendReasoning: isReasoningModel })
  );

  if (titlePromise) {
    const title = await titlePromise;
    dataStream.write({ type: "data-chat-title", data: title });
    updateChatTitleById({ chatId: id, title });
  }
},