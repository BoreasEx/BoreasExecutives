export function isConversationEnded(lastMessage: string): boolean {
  const text = lastMessage.toLowerCase();

  return (
    text.includes("we will not proceed") ||
    text.includes("i refuse") ||
    text.includes("we can move forward under conditions") ||
    text.includes("we can proceed under conditions") ||
    text.includes("we can move forward") ||
    text.includes("we proceed") ||
    text.includes("deal") ||
    text.includes("agreement")
  );
}