import type { DashboardData } from "@/lib/dashboard";
import { buildRoleProgressionForest, type RoleProgressionNode } from "@/lib/role-progression";

type Role = DashboardData["roles"][number];

export function RoleProgressionTree({ roles }: { roles: Role[] }) {
  const forest = buildRoleProgressionForest(roles);
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
        <div className="role-tree-forest">
          {forest.map((root) => <RoleBranch key={root.id} node={root} depth={0} />)}
        </div>
      </div>
    </section>
  );
}

function RoleBranch({ node, depth }: { node: RoleProgressionNode; depth: number }) {
  return (
    <div className="role-tree-branch">
      <div className={`role-tree-node depth-${Math.min(depth, 4)}`}>
        <span>Level {depth + 1}</span>
        <strong>{node.title}</strong>
      </div>
      {node.children.length > 0 && (
        <div className="role-tree-children">
          {node.children.map((child) => <RoleBranch key={child.id} node={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}
