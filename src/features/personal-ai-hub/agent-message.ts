export function agentMessageText(result: Record<string, unknown>): string {
  if (typeof result.text === "string") return result.text;
  if (Array.isArray(result.parts)) {
    return result.parts
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n\n");
  }
  return "";
}
