"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { buildRoleProgressionForest, type RoleProgressionNode } from "@/lib/role-progression";

type Role = DashboardData["roles"][number];
type Connector = { id: string; path: string };

export function RoleProgressionTree({ roles }: { roles: Role[] }) {
  const forest = useMemo(() => buildRoleProgressionForest(roles), [roles]);
  const { connectors, forestRef, registerNode } = useRoleTreeConnectors(forest);
  if (!forest.length) return null;

  return (
    <section className="card role-progression-tree">
      <div className="card-header compact">
        <div>
          <span className="section-eyebrow">ROLE PROGRESSION</span>
          <h2>Career paths</h2>
          <p>Connected roles arranged from the highest progression role down through its feeder roles.</p>
        </div>
        <span className="role-tree-caption">{roles.length} roles mapped</span>
      </div>
      <div className="role-tree-canvas">
        <div className="role-tree-forest" ref={forestRef}>
          <svg className="role-tree-connectors" aria-hidden="true">
            {connectors.map((connector) => (
              <path key={connector.id} d={connector.path} />
            ))}
          </svg>
          {forest.map((root) => (
            <RoleBranch key={root.id} node={root} depth={0} registerNode={registerNode} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleBranch({
  node,
  depth,
  registerNode,
}: {
  node: RoleProgressionNode;
  depth: number;
  registerNode: (id: string, element: HTMLDivElement | null) => void;
}) {
  return (
    <div className="role-tree-branch">
      <div className={`role-tree-node depth-${Math.min(depth, 4)}`} ref={(element) => registerNode(node.id, element)}>
        <span>Level {depth + 1}</span>
        <strong>{node.title}</strong>
      </div>
      {node.children.length > 0 && (
        <div className="role-tree-children">
          {node.children.map((child) => (
            <RoleBranch key={child.id} node={child} depth={depth + 1} registerNode={registerNode} />
          ))}
        </div>
      )}
    </div>
  );
}

function useRoleTreeConnectors(forest: RoleProgressionNode[]) {
  const forestRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [connectors, setConnectors] = useState<Connector[]>([]);

  const registerNode = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const container = forestRef.current;
    if (!container) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const nextConnectors: Connector[] = [];

        const visit = (parent: RoleProgressionNode) => {
          const parentElement = nodeRefs.current.get(parent.id);
          const parentRect = parentElement?.getBoundingClientRect();

          if (parentRect) {
            const startX = parentRect.left - containerRect.left + parentRect.width / 2;
            const startY = parentRect.bottom - containerRect.top;

            parent.children.forEach((child) => {
              const childRect = nodeRefs.current.get(child.id)?.getBoundingClientRect();
              if (!childRect) return;

              const endX = childRect.left - containerRect.left + childRect.width / 2;
              const endY = childRect.top - containerRect.top;
              const path =
                parent.children.length === 1
                  ? `M ${startX} ${startY} L ${endX} ${endY}`
                  : curvedConnectorPath(startX, startY, endX, endY);

              nextConnectors.push({ id: `${parent.id}-${child.id}`, path });
            });
          }

          parent.children.forEach(visit);
        };

        forest.forEach(visit);
        setConnectors(nextConnectors);
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    nodeRefs.current.forEach((element) => observer.observe(element));

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [forest]);

  return { connectors, forestRef, registerNode };
}

function curvedConnectorPath(startX: number, startY: number, endX: number, endY: number) {
  const midpointY = startY + (endY - startY) / 2;
  return `M ${startX} ${startY} C ${startX} ${midpointY}, ${endX} ${midpointY}, ${endX} ${endY}`;
}
