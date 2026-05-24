import type {
  NodeDefinition,
  ParameterDefinition,
  ParameterValue,
  Project,
  ProjectNode,
  ValidationIssue,
} from "@hello-cam/core";
import { findNodeDefinition, nodeCategoryLabels } from "./nodeCatalog";

interface InspectorProps {
  project: Project;
  selectedNodeId: string | null;
  issues: ValidationIssue[];
  onProjectChange(project: Project): void;
}

export function Inspector({
  project,
  selectedNodeId,
  issues,
  onProjectChange,
}: InspectorProps) {
  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
  const definition = selectedNode ? findNodeDefinition(selectedNode.type) : undefined;

  if (!selectedNode || !definition) {
    return (
      <aside className="inspector" aria-label="Inspector">
        <div className="panel-title">Inspector</div>
        <p className="empty-copy">Select a node to edit its parameters.</p>
        <IssueList issues={issues} />
      </aside>
    );
  }

  const selectedNodeIdSafe = selectedNode.id;

  function updateParameter(parameterId: string, value: ParameterValue): void {
    onProjectChange({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === selectedNodeIdSafe
          ? {
              ...node,
              parameters: { ...node.parameters, [parameterId]: value },
            }
          : node,
      ),
    });
  }

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="panel-title">Inspector</div>
      <div className="node-summary">
        <div className="node-summary-header">
          <strong>{definition.label}</strong>
          <span>{nodeCategoryLabels[definition.category]}</span>
        </div>
        <p>{definition.description}</p>
        <small>{selectedNode.id}</small>
      </div>
      <ParameterFields
        definition={definition}
        node={selectedNode}
        onChange={updateParameter}
      />
      <IssueList issues={issues} />
    </aside>
  );
}

function ParameterFields({
  definition,
  node,
  onChange,
}: {
  definition: NodeDefinition;
  node: ProjectNode;
  onChange(parameterId: string, value: ParameterValue): void;
}) {
  if (definition.parameters.length === 0) {
    return <p className="empty-copy">This node has no editable parameters.</p>;
  }
  return (
    <div className="parameter-list">
      {definition.parameters.map((parameter) => (
        <ParameterField
          key={parameter.id}
          parameter={parameter}
          value={node.parameters[parameter.id] ?? parameter.defaultValue}
          onChange={(value) => onChange(parameter.id, value)}
        />
      ))}
    </div>
  );
}

function ParameterField({
  parameter,
  value,
  onChange,
}: {
  parameter: ParameterDefinition;
  value: ParameterValue;
  onChange(value: ParameterValue): void;
}) {
  if (parameter.type === "textarea") {
    return (
      <label className="field field-textarea">
        <span>{parameter.label}</span>
        <textarea
          spellCheck={false}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  if (parameter.type === "boolean") {
    return (
      <label className="field field-checkbox">
        <input
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>{parameter.label}</span>
      </label>
    );
  }

  if (parameter.type === "number") {
    const numericValue = typeof value === "number" ? value : Number(parameter.defaultValue);
    return (
      <label className="field">
        <span>{parameter.label}</span>
        <div className="number-row">
          <input
            max={parameter.max}
            min={parameter.min}
            step={parameter.step ?? 0.01}
            type="range"
            value={numericValue}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <input
            max={parameter.max}
            min={parameter.min}
            step={parameter.step ?? 0.01}
            type="number"
            value={numericValue}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </div>
      </label>
    );
  }

  if (parameter.type === "select") {
    return (
      <label className="field">
        <span>{parameter.label}</span>
        <select
          value={typeof value === "string" ? value : String(parameter.defaultValue)}
          onChange={(event) => onChange(event.target.value)}
        >
          {(parameter.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="field">
      <span>{parameter.label}</span>
      <input
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        type="text"
      />
    </label>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return <p className="issue-list issue-list-ok">Graph valid</p>;
  }
  return (
    <div className="issue-list">
      <strong>Graph issues</strong>
      {issues.slice(0, 5).map((issue) => (
        <p key={`${issue.code}-${issue.nodeId ?? issue.connectionId ?? issue.message}`}>
          {issue.message}
        </p>
      ))}
    </div>
  );
}
