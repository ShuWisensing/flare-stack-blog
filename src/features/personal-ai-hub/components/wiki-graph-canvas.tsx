import type { Core } from "cytoscape";
import { Minus, Plus, Scan } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HubGraph, HubGraphEdge } from "../schema/hub-chat.schema";

type Viewport = {
  zoom: number;
  width: number;
  height: number;
  pan: { x: number; y: number };
  positions: Record<string, { x: number; y: number }>;
};
const viewports = new Map<string, Viewport>();
export function WikiGraphCanvas({
  graph,
  center,
  onNode,
  onEdge,
}: {
  graph: HubGraph;
  center?: string;
  onNode: (id: string) => void;
  onEdge: (edge: HubGraphEdge) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Core | null>(null);
  const callbacks = useRef({ onNode, onEdge });
  callbacks.current = { onNode, onEdge };
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let worker: Worker | undefined;
    let graphInstance: Core | undefined;
    let resize: ResizeObserver | undefined;
    let theme: MutationObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let layoutReady = false;
    const viewKey = `${graph.scope}:${center ?? "global"}:${graph.revision}:${graph.nodes.map((node) => node.id).join(",")}:${graph.edges.map((edge) => edge.id).join(",")}`;
    setLoading(true);
    setError(null);
    const fail = (message: string) => {
      if (!disposed) {
        setLoading(false);
        setError(message);
      }
    };
    async function initialize() {
      try {
        if (!container.current) return;
        const cytoscape = (await import("cytoscape")).default;
        if (disposed || !container.current) return;
        const elements = [
          ...graph.nodes.map((node) => ({
            data: {
              id: node.id,
              label:
                node.title.length > 20
                  ? node.title.slice(0, 19) + "…"
                  : node.title,
              kind: node.kind,
            },
          })),
          ...graph.edges.map((edge) => ({
            data: {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              kind: edge.kind,
            },
          })),
        ];
        graphInstance = cytoscape({
          container: container.current,
          elements,
          layout: { name: "preset" },
          minZoom: 0.15,
          maxZoom: 3,
          wheelSensitivity: 0.22,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          boxSelectionEnabled: false,
        });
        instance.current = graphInstance;
        const style = () => {
          if (!graphInstance || disposed) return;
          const dark =
            document.documentElement.classList.contains("dark") ||
            document.documentElement.dataset.theme === "dark";
          graphInstance.style([
            {
              selector: "node",
              style: {
                label: "data(label)",
                "font-size": 10,
                "font-family": "system-ui, sans-serif",
                color: dark ? "#b5c1d2" : "#677589",
                "text-valign": "bottom",
                "text-margin-y": 10,
                width: 11,
                height: 11,
                "background-color": "#879bb3",
                "border-width": 3,
                "border-color": dark ? "#1d2735" : "#f2f5f9",
              },
            },
            {
              selector: 'node[kind="concept"]',
              style: { "background-color": "#9182bc", width: 16, height: 16 },
            },
            {
              selector: 'node[kind="entity"]',
              style: { "background-color": "#6d9e8b", width: 15, height: 15 },
            },
            {
              selector: 'node[kind="source"]',
              style: {
                "background-color": "#6b8fbe",
                width: 19,
                height: 19,
                "font-size": 11,
              },
            },
            {
              selector: 'node[kind="summary"]',
              style: { "background-color": "#83adb1", width: 12, height: 12 },
            },
            {
              selector: "edge",
              style: {
                width: 0.8,
                "line-color": dark ? "#3a4657" : "#d6dee8",
                "curve-style": "haystack",
                opacity: 0.8,
              },
            },
            { selector: ".hub-muted-node", style: { opacity: 0.15 } },
            {
              selector: ".hub-highlight",
              style: { "border-color": "#7996c2", "border-width": 4 },
            },
          ]);
        };
        style();
        theme = new MutationObserver(style);
        theme.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class", "data-theme"],
        });
        graphInstance.on("tap", "node", (event) =>
          callbacks.current.onNode(event.target.id()),
        );
        graphInstance.on("tap", "edge", (event) => {
          const edge = graph.edges.find(
            (item) => item.id === event.target.id(),
          );
          if (edge) callbacks.current.onEdge(edge);
        });
        graphInstance.on("mouseover", "node", (event) => {
          const neighborhood = event.target.closedNeighborhood();
          graphInstance
            ?.elements()
            .difference(neighborhood)
            .addClass("hub-muted-node");
          event.target.addClass("hub-highlight");
        });
        graphInstance.on("mouseout", "node", () => {
          graphInstance?.elements().removeClass("hub-muted-node hub-highlight");
        });
        let viewportSize = {
          width: graphInstance.width(),
          height: graphInstance.height(),
        };
        resize = new ResizeObserver(() => {
          if (!graphInstance || disposed) return;
          const oldPan = graphInstance.pan();
          graphInstance.resize();
          const nextSize = {
            width: graphInstance.width(),
            height: graphInstance.height(),
          };
          if (layoutReady)
            graphInstance.pan({
              x: oldPan.x + (nextSize.width - viewportSize.width) / 2,
              y: oldPan.y + (nextSize.height - viewportSize.height) / 2,
            });
          viewportSize = nextSize;
        });
        resize.observe(container.current);
        worker = new Worker(
          new URL("../graph-layout.worker.ts", import.meta.url),
          { type: "module" },
        );
        timer = setTimeout(() => {
          worker?.terminate();
          fail("图谱布局超时，请缩小范围后重试");
        }, 15000);
        worker.onerror = () => {
          if (timer) clearTimeout(timer);
          worker?.terminate();
          fail("图谱布局 Worker 无法启动，请重试");
        };
        worker.onmessage = (event) => {
          if (disposed || !graphInstance) return;
          if (timer) clearTimeout(timer);
          worker?.terminate();
          const positions = event.data.positions as
            | Record<string, { x: number; y: number }>
            | undefined;
          if (
            event.data.error ||
            !positions ||
            graph.nodes.some(
              (node) =>
                !positions[node.id] ||
                !Number.isFinite(positions[node.id].x) ||
                !Number.isFinite(positions[node.id].y),
            )
          ) {
            fail("图谱布局未返回有效坐标，请重试");
            return;
          }
          graphInstance.nodes().positions((node) => positions[node.id()]);
          const saved = viewports.get(viewKey);
          if (saved)
            graphInstance.viewport({
              zoom: saved.zoom,
              pan: {
                x: saved.pan.x + (graphInstance.width() - saved.width) / 2,
                y: saved.pan.y + (graphInstance.height() - saved.height) / 2,
              },
            });
          else graphInstance.fit(undefined, 65);
          layoutReady = true;
          setLoading(false);
        };
        worker.postMessage({
          elements,
          saved_positions: viewports.get(viewKey)?.positions,
        });
      } catch {
        fail("当前浏览器无法初始化图谱画布，请重试或使用节点列表浏览");
      }
    }
    void initialize();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      worker?.terminate();
      resize?.disconnect();
      theme?.disconnect();
      if (graphInstance) {
        if (layoutReady) {
          viewports.set(viewKey, {
            zoom: graphInstance.zoom(),
            width: graphInstance.width(),
            height: graphInstance.height(),
            pan: graphInstance.pan(),
            positions: Object.fromEntries(
              graphInstance
                .nodes()
                .map((node) => [node.id(), { ...node.position() }]),
            ),
          });
          if (viewports.size > 20)
            viewports.delete(viewports.keys().next().value as string);
        }
        graphInstance.destroy();
      }
      instance.current = null;
    };
  }, [graph, center, attempt]);
  return (
    <div className="hub-graph-canvas-area">
      <div
        className="hub-graph-canvas"
        ref={container}
        role="img"
        aria-label="知识关系画布；可拖动节点并缩放，也可使用搜索和节点列表浏览"
      />
      {loading && <p className="hub-graph-loading">正在排列关系…</p>}
      {error && (
        <div className="hub-graph-loading hub-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            重试布局
          </button>
        </div>
      )}
      <div className="hub-graph-controls">
        <button
          type="button"
          aria-label="放大图谱"
          onClick={() => instance.current?.zoom(instance.current.zoom() * 1.2)}
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          aria-label="缩小图谱"
          onClick={() => instance.current?.zoom(instance.current.zoom() / 1.2)}
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          aria-label="适应图谱"
          onClick={() => instance.current?.fit(undefined, 60)}
        >
          <Scan size={15} />
        </button>
      </div>
    </div>
  );
}
