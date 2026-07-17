export type RoleProgressionInput = {
  id: string;
  title: string;
  nextRoleId: string | null;
};

export type RoleProgressionNode = {
  id: string;
  title: string;
  children: RoleProgressionNode[];
};

/**
 * Builds career-progression paths from roles that are linked by `nextRoleId`.
 * Roles with no incoming or outgoing progression link are deliberately omitted.
 */
export function buildRoleProgressionForest(roles: RoleProgressionInput[]): RoleProgressionNode[] {
  const byId = new Map(roles.map((role) => [role.id, role]));
  const linkedIds = new Set<string>();
  const precedingRoles = new Map<string, RoleProgressionInput[]>();

  for (const role of roles) {
    if (!role.nextRoleId || !byId.has(role.nextRoleId)) continue;
    linkedIds.add(role.id);
    linkedIds.add(role.nextRoleId);
    const rows = precedingRoles.get(role.nextRoleId) ?? [];
    rows.push(role);
    precedingRoles.set(role.nextRoleId, rows);
  }

  const buildNode = (role: RoleProgressionInput, ancestors: Set<string>): RoleProgressionNode => {
    const children = (precedingRoles.get(role.id) ?? [])
      .filter((child) => !ancestors.has(child.id))
      .map((child) => buildNode(child, new Set([...ancestors, role.id])));
    return { id: role.id, title: role.title, children };
  };

  return roles
    .filter((role) => linkedIds.has(role.id) && !role.nextRoleId)
    .map((role) => buildNode(role, new Set()));
}
