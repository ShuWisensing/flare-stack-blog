import cytoscape from "cytoscape";

export type LayoutInput = {
  elements: cytoscape.ElementDefinition[];
  viewport: { width: number; height: number };
  saved_positions?: Record<string, { x: number; y: number }>;
};
export function layoutGraph(input: LayoutInput) {
  if (
    !input.viewport ||
    !Number.isFinite(input.viewport.width) ||
    !Number.isFinite(input.viewport.height) ||
    input.viewport.width <= 0 ||
    input.viewport.height <= 0
  )
    throw new Error("图谱需要有效的画布尺寸");
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
    const aspect = input.viewport.width / input.viewport.height;
    const components = graph
      .elements()
      .components()
      .map((component) => {
        const nodes = component.nodes();
        const xs = nodes.map((node) => node.position("x")),
          ys = nodes.map((node) => node.position("y"));
        const left = Math.min(...xs),
          top = Math.min(...ys);
        const width = Math.max(...xs) - left + 180,
          height = Math.max(...ys) - top + 110;
        return { nodes, left, top, width, height };
      })
      .sort((a, b) => b.height - a.height);
    const area = components.reduce(
      (sum, component) => sum + component.width * component.height,
      0,
    );
    const largestWidth = Math.max(
      1,
      ...components.map((component) => component.width),
    );
    let best:
      | { score: number; positions: Record<string, { x: number; y: number }> }
      | undefined;
    for (const factor of [0.6, 0.8, 1, 1.2, 1.5, 2]) {
      const target = Math.max(largestWidth, Math.sqrt(area * aspect) * factor);
      let x = 0,
        y = 0,
        rowHeight = 0,
        usedWidth = 0;
      const positions: Record<string, { x: number; y: number }> = {};
      for (const component of components) {
        if (x > 0 && x + component.width > target) {
          y += rowHeight + 40;
          x = 0;
          rowHeight = 0;
        }
        component.nodes.forEach((node) => {
          positions[node.id()] = {
            x: node.position("x") - component.left + x + 90,
            y: node.position("y") - component.top + y + 40,
          };
        });
        usedWidth = Math.max(usedWidth, x + component.width);
        rowHeight = Math.max(rowHeight, component.height);
        x += component.width + 40;
      }
      const usedHeight = y + rowHeight;
      const score =
        Math.abs(Math.log(usedWidth / Math.max(1, usedHeight) / aspect)) +
        Math.max(0, (usedWidth * usedHeight) / Math.max(1, area) - 1) * 0.1;
      if (!best || score < best.score) best = { score, positions };
    }
    if (!best) throw new Error("图谱布局未产生结果");
    return best.positions;
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
