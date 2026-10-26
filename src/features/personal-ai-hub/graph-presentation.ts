export const nodePresentation = {
  source: {
    name: "资料",
    description: "原始文件、网页或聊天来源",
    color: "#2563eb",
    shape: "round-rectangle",
  },
  summary: {
    name: "摘要",
    description: "资料摘要",
    color: "#0891b2",
    shape: "ellipse",
  },
  chunk: {
    name: "片段",
    description: "可引用的原文片段",
    color: "#64748b",
    shape: "rectangle",
  },
  asset: {
    name: "资源",
    description: "资料中的资源文字",
    color: "#d97706",
    shape: "diamond",
  },
  concept: {
    name: "概念",
    description: "专业术语与概念",
    color: "#7c3aed",
    shape: "ellipse",
  },
  entity: {
    name: "实体",
    description: "人物、组织、设备",
    color: "#059669",
    shape: "hexagon",
  },
  method: {
    name: "方法",
    description: "方法与可复用经验",
    color: "#ea580c",
    shape: "round-rectangle",
  },
  project: {
    name: "项目",
    description: "项目背景和结论",
    color: "#db2777",
    shape: "rectangle",
  },
  preference: {
    name: "偏好",
    description: "用户确认的偏好",
    color: "#c026d3",
    shape: "diamond",
  },
  rule: {
    name: "规则",
    description: "用户确认的长期规则",
    color: "#dc2626",
    shape: "octagon",
  },
} as const;
