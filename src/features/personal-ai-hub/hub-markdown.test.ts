// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { HubMarkdown } from "./components/hub-markdown";

afterEach(cleanup);

it("copies the complete code text and reports clipboard errors explicitly", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy },
  });
  try {
    render(
      createElement(HubMarkdown, {
        content: "```python\n  print('知识库')\n```",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() =>
      expect(copy).toHaveBeenCalledWith("  print('知识库')\n"),
    );
    expect(screen.getByRole("button", { name: "已复制" })).toBeTruthy();
    copy.mockRejectedValueOnce(new Error("denied"));
    fireEvent.click(screen.getByRole("button", { name: "已复制" }));
    await screen.findByText("复制失败，请检查浏览器剪贴板权限。");
  } finally {
    if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("renders paragraphs, emphasis and Chinese tables without executing raw HTML or dangerous URLs", () => {
  render(
    createElement(HubMarkdown, {
      content:
        "你好，**知识库**。\n\n|名称|内容|\n|---|---|\n|模型|本地|\n\n<script>alert(1)</script>\n\n[坏链接](javascript:alert(1)) ![追踪](https://tracker.test/a.png)",
    }),
  );
  expect(screen.getByText("知识库").tagName).toBe("STRONG");
  expect(screen.getByRole("table")).toBeTruthy();
  expect(
    document.querySelector("script,img,a[href^='javascript:']"),
  ).toBeNull();
});

it("opens only resolved wiki links and leaves links inside code literal", () => {
  const open = vi.fn();
  render(
    createElement(HubMarkdown, {
      content: "[[Alpha|概念 A]]\n\n`[[Alpha]]`",
      links: [{ target_id: "wiki:a", label: "Alpha" }],
      onNode: open,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "概念 A" }));
  expect(open).toHaveBeenCalledWith("wiki:a");
  expect(screen.getByText("[[Alpha]]").tagName).toBe("CODE");
});

it("keeps long code in a collapsed bounded block without nested code tags", () => {
  render(
    createElement(HubMarkdown, {
      content: "```text\n" + "long line\n".repeat(1500) + "```",
    }),
  );
  expect(document.querySelectorAll("pre code").length).toBe(1);
  expect(document.querySelector("details")?.open).toBe(false);
});
