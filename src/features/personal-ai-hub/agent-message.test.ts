import { expect, it } from "vitest";
import { agentMessageText } from "./agent-message";

it("extracts visible text from opencode parts without exposing tool payloads", () => {
  expect(
    agentMessageText({
      parts: [
        { type: "text", text: "answer" },
        { type: "tool", input: { private: "value" } },
      ],
    }),
  ).toBe("answer");
});
it("renders a Codex answer", () => {
  expect(agentMessageText({ text: "Codex answer", status: "completed" })).toBe(
    "Codex answer",
  );
});
