import cytoscape from "cytoscape";

export type LayoutInput = {
  elements: cytoscape.ElementDefinition[];
  saved_positions?: Record<string, { x: number; y: number }>;
};
export function layoutGraph(input: LayoutInput) {
  if (input.saved_positions !== undefined) {
    const nodes = input.elements.filter((element) => !element.data.source);
    const positions = input.saved_positions;
    if (
      Object.keys(positions).length !== nodes.length ||
      nodes.some(
        (node) =>
          !node.data.id ||
          !positions[node.data.id] ||
          !Number.isFinite(positions[node.data.id].x) ||
          !Number.isFinite(positions[node.data.id].y),
      )
    )
      throw new Error("保存的布局与当前节点不一致");
    return positions;
  }
  const columns = Math.max(
    1,
    Math.ceil(
      Math.sqrt(
        input.elements.filter((element) => !element.data.source).length,
      ),
    ),
  );
  let index = 0;
  const elements = input.elements.map((element) => {
    if (element.data.source) return element;
    const position = {
      x: (index % columns) * 120,
      y: Math.floor(index / columns) * 120,
    };
    index += 1;
    return { ...element, position };
  });
  const graph = cytoscape({
    headless: true,
    elements,
    styleEnabled: false,
  });
  try {
    graph
      .layout({
        name: "cose",
        animate: false,
        randomize: false,
        nodeRepulsion: () => 220000,
        idealEdgeLength: () => 110,
        numIter: 350,
        componentSpacing: 90,
      })
      .run();
    return Object.fromEntries(
      graph.nodes().map((node) => [node.id(), node.position()]),
    );
  } finally {
    graph.destroy();
  }
}
const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<LayoutInput>) => void) | null;
  postMessage?: (message: unknown) => void;
};
if (typeof document === "undefined" && worker.postMessage) {
  worker.onmessage = (event) => {
    try {
      worker.postMessage?.({ positions: layoutGraph(event.data) });
    } catch {
      worker.postMessage?.({ error: "图谱布局计算失败，请重试" });
    }
  };
}
