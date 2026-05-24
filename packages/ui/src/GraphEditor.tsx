import type { NodeDefinition, Project, ProjectNode } from "@hello-cam/core";
import {
  Activity,
  Camera,
  Clock,
  Code2,
  Hand,
  Hash,
  Mic,
  Monitor,
  PersonStanding,
  ScanFace,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import {
  availableNodeDefinitions,
  createNodeFromDefinition,
  findNodeDefinition,
  nodeCategoryLabels,
} from "./nodeCatalog";

interface GraphEditorProps {
  project: Project;
  selectedNodeId: string | null;
  onProjectChange(project: Project): void;
  onSelectNode(nodeId: string | null): void;
}

interface DragState {
  nodeId: string;
  pointerId: number;
  startPointer: { x: number; y: number };
  startPosition: { x: number; y: number };
}

const nodeWidth = 214;
const nodeHeight = 136;
const nodeCategoryOrder: NodeDefinition["category"][] = [
  "input",
  "signal",
  "visual",
  "output",
];

const nodeIcons: Record<string, LucideIcon> = {
  "audio.audioBands": Activity,
  "audio.micLevel": Mic,
  "core.constant": Hash,
  "core.clamp": SlidersHorizontal,
  "core.curve": SlidersHorizontal,
  "core.deadzone": SlidersHorizontal,
  "core.hold": SlidersHorizontal,
  "core.invert": SlidersHorizontal,
  "core.mapRange": SlidersHorizontal,
  "core.normalize": SlidersHorizontal,
  "core.smooth": SlidersHorizontal,
  "core.threshold": SlidersHorizontal,
  "core.time": Clock,
  "input.camera": Camera,
  "input.face": ScanFace,
  "input.hands": Hand,
  "input.pose": PersonStanding,
  "music.gyeolScore": Code2,
  "render.output": Monitor,
  "render.shader": Code2,
};

export function GraphEditor({
  project,
  selectedNodeId,
  onProjectChange,
  onSelectNode,
}: GraphEditorProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [lastAddedLabel, setLastAddedLabel] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const boardSize = useMemo(() => {
    const maxX = Math.max(960, ...project.nodes.map((node) => node.position.x + nodeWidth + 80));
    const maxY = Math.max(640, ...project.nodes.map((node) => node.position.y + nodeHeight + 80));
    return { width: maxX, height: maxY };
  }, [project.nodes]);
  const groupedDefinitions = useMemo(
    () =>
      nodeCategoryOrder.map((category) => ({
        category,
        definitions: availableNodeDefinitions.filter(
          (definition) => definition.category === category,
        ),
      })),
    [],
  );

  function addNode(definition: NodeDefinition): void {
    const scrollElement = scrollRef.current;
    const position = scrollElement
      ? {
          x: scrollElement.scrollLeft + Math.max(40, scrollElement.clientWidth / 2 - nodeWidth / 2),
          y: scrollElement.scrollTop + Math.max(72, scrollElement.clientHeight / 2 - nodeHeight / 2),
        }
      : {
          x: 160 + project.nodes.length * 24,
          y: 120 + project.nodes.length * 18,
        };
    const node = createNodeFromDefinition(definition, position);
    onProjectChange({
      ...project,
      nodes: [...project.nodes, node],
    });
    onSelectNode(node.id);
    setLastAddedLabel(definition.label);
    window.setTimeout(() => setLastAddedLabel(null), 1200);
  }

  function updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    onProjectChange({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              position: {
                x: Math.max(16, Math.round(position.x)),
                y: Math.max(48, Math.round(position.y)),
              },
            }
          : node,
      ),
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    const nextPosition = {
      x: dragState.startPosition.x + event.clientX - dragState.startPointer.x,
      y: dragState.startPosition.y + event.clientY - dragState.startPointer.y,
    };
    updateNodePosition(dragState.nodeId, nextPosition);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  function fitBoard(): void {
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  return (
    <div className="graph-layout">
      <aside className="node-library" aria-label="Node library">
        <div className="panel-title">Nodes</div>
        {lastAddedLabel && <div className="library-status">Added {lastAddedLabel}</div>}
        {groupedDefinitions.map((group) => (
          <div className="library-group" key={group.category}>
            <div className="library-group-title">
              {nodeCategoryLabels[group.category]}
            </div>
            {group.definitions.map((definition) => {
              const Icon = nodeIcons[definition.type] ?? Activity;
              return (
                <button
                  className="library-item"
                  key={definition.type}
                  onClick={() => addNode(definition)}
                  type="button"
                >
                  <Icon size={15} />
                  <span>
                    <strong>{definition.label}</strong>
                    <small>{definition.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <section className="graph-canvas" aria-label="Graph editor">
        <div className="graph-panel">
          <strong>Graph</strong>
          <span>{project.nodes.length} nodes</span>
          {selectedNodeId && <span>Selected {selectedNodeId}</span>}
          <button onClick={fitBoard} type="button">
            Fit
          </button>
        </div>
        <div
          className="graph-scroll"
          onClick={() => onSelectNode(null)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={scrollRef}
        >
          <div
            className="graph-board"
            style={{ width: boardSize.width, height: boardSize.height }}
          >
            <GraphEdges project={project} />
            {project.nodes.map((node) => (
              <GraphNodeCard
                isSelected={node.id === selectedNodeId}
                key={node.id}
                node={node}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelectNode(node.id);
                  setDragState({
                    nodeId: node.id,
                    pointerId: event.pointerId,
                    startPointer: { x: event.clientX, y: event.clientY },
                    startPosition: node.position,
                  });
                }}
                onSelect={() => onSelectNode(node.id)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function GraphEdges({ project }: { project: Project }) {
  const nodesById = new Map(project.nodes.map((node) => [node.id, node]));

  return (
    <svg className="graph-edges">
      {project.connections.map((connection) => {
        const source = nodesById.get(connection.from.nodeId);
        const target = nodesById.get(connection.to.nodeId);
        if (!source || !target) {
          return null;
        }
        const x1 = source.position.x + nodeWidth;
        const y1 = source.position.y + nodeHeight / 2;
        const x2 = target.position.x;
        const y2 = target.position.y + nodeHeight / 2;
        const curve = Math.max(60, Math.abs(x2 - x1) * 0.42);
        const d = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
        return <path d={d} key={connection.id} />;
      })}
    </svg>
  );
}

function GraphNodeCard({
  isSelected,
  node,
  onPointerDown,
  onSelect,
}: {
  isSelected: boolean;
  node: ProjectNode;
  onPointerDown(event: PointerEvent<HTMLDivElement>): void;
  onSelect(): void;
}) {
  const definition = findNodeDefinition(node.type);
  const categoryLabel = definition
    ? nodeCategoryLabels[definition.category]
    : "Unknown";

  return (
    <div
      className={isSelected ? "flow-node flow-node-selected" : "flow-node"}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: nodeWidth,
      }}
    >
      <div className="flow-node-header" onPointerDown={onPointerDown}>
        <span>{definition?.label ?? node.type}</span>
        <small>{categoryLabel}</small>
      </div>
      {definition && (
        <p className="flow-node-description">{definition.description}</p>
      )}
      <div className="flow-node-body">
        <div className="port-column">
          {definition?.inputs.map((port) => (
            <div className="port-row port-row-input" key={port.id}>
              <span className={`port-dot port-dot-${port.type}`} />
              <span>{port.label}</span>
            </div>
          ))}
        </div>
        <div className="port-column">
          {definition?.outputs.map((port) => (
            <div className="port-row port-row-output" key={port.id}>
              <span>{port.label}</span>
              <span className={`port-dot port-dot-${port.type}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
