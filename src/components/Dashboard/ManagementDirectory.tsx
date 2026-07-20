"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, Gauge, LoaderCircle, Pencil, Users, X } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";

type DirectoryView = "roles" | "kpis" | "departments" | "employees";

const DIRECTORY_BUTTONS: Array<{ id: DirectoryView; label: string; icon: typeof Users }> = [
  { id: "roles", label: "View roles", icon: BriefcaseBusiness },
  { id: "kpis", label: "View KPIs", icon: Gauge },
  { id: "departments", label: "View departments", icon: Building2 },
  { id: "employees", label: "View employees", icon: Users },
];

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Karachi",
});
const NUMBER_FORMATTER = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function ManagementDirectory({
  data,
  onMessage,
}: {
  data: DashboardData;
  onMessage: (message: string) => void;
}) {
  const router = useRouter();
  const isAdmin = data.actor.accessLevel === "ADMIN";
  const [activeView, setActiveView] = useState<DirectoryView | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [employeeAccess, setEmployeeAccess] = useState<"EMPLOYEE" | "MANAGER">("EMPLOYEE");

  const editingRole = activeView === "roles" ? data.roles.find((role) => role.id === editingId) : undefined;
  const editingKpi = activeView === "kpis" ? data.kpis.find((kpi) => kpi.id === editingId) : undefined;
  const editingDepartment =
    activeView === "departments" ? data.departments.find((department) => department.id === editingId) : undefined;
  const editingEmployee = activeView === "employees" ? data.users.find((user) => user.id === editingId) : undefined;
  const managers = data.users.filter((user) => user.accessLevel === "MANAGER");

  function openView(view: DirectoryView) {
    setActiveView((current) => (current === view ? null : view));
    setEditingId(null);
  }

  function editEmployee(id: string) {
    const employee = data.users.find((user) => user.id === id);
    setEmployeeAccess(employee?.accessLevel === "MANAGER" ? "MANAGER" : "EMPLOYEE");
    setEditingId(id);
  }

  async function request(url: string, body: Record<string, unknown>) {
    if (pending) return;
    setPending(true);
    onMessage("");
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onMessage(result.data.message || "Saved successfully");
      setEditingId(null);
      router.refresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setPending(false);
    }
  }

  function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void request(`/api/roles/${editingRole?.id}`, {
      title: String(form.get("title") || ""),
      nextRoleId: form.get("nextRoleId") || null,
    });
  }

  function submitKpi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void request(`/api/kpis/${editingKpi?.id}`, {
      name: String(form.get("name") || ""),
      description: form.get("description") || null,
      unit: form.get("unit") || null,
    });
  }

  function submitDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void request(`/api/departments/${editingDepartment?.id}`, {
      name: String(form.get("name") || ""),
      managerIds: form.getAll("managerIds").map(String),
    });
  }

  function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { roleId: String(form.get("roleId") || "") };
    if (isAdmin) {
      body.name = String(form.get("name") || "");
      body.accessLevel = employeeAccess;
      body.status = String(form.get("status") || "active");
      if (employeeAccess === "MANAGER") body.departmentIds = form.getAll("departmentIds").map(String);
      else body.departmentId = form.get("departmentId") || null;
    }
    void request(`/api/users/${editingEmployee?.id}`, body);
  }

  return (
    <section className="management-directory" aria-label="Management records">
      <div className="management-directory-heading">
        <div>
          <h3>Management records</h3>
          <p>Open a complete table to review details and make changes.</p>
        </div>
        <div className="management-directory-actions">
          {DIRECTORY_BUTTONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeView === id ? "active" : ""}
              aria-pressed={activeView === id}
              onClick={() => openView(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeView ? (
        <div className="management-records-panel">
          <div className="management-records-title">
            <div>
              <span>Directory</span>
              <h4>{directoryTitle(activeView)}</h4>
            </div>
            <button
              type="button"
              className="management-close"
              onClick={() => openView(activeView)}
              aria-label="Close table"
            >
              <X size={18} />
            </button>
          </div>

          {editingRole ? (
            <form key={editingRole.id} className="management-inline-editor" onSubmit={submitRole}>
              <EditorHeading title="Edit role" onClose={() => setEditingId(null)} />
              <label>
                Role title
                <input name="title" required minLength={2} defaultValue={editingRole.title} />
              </label>
              <label>
                Subsequent role
                <select name="nextRoleId" defaultValue={editingRole.nextRoleId ?? ""}>
                  <option value="">No subsequent role</option>
                  {data.roles
                    .filter((role) => role.id !== editingRole.id)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                </select>
              </label>
              <SaveButton pending={pending} />
            </form>
          ) : null}

          {editingKpi ? (
            <form key={editingKpi.id} className="management-inline-editor" onSubmit={submitKpi}>
              <EditorHeading title="Edit KPI" onClose={() => setEditingId(null)} />
              <label>
                KPI name
                <input name="name" required minLength={2} defaultValue={editingKpi.name} />
              </label>
              <label>
                Unit
                <input name="unit" defaultValue={editingKpi.unit ?? ""} />
              </label>
              <label className="management-editor-wide">
                Description
                <textarea name="description" rows={3} defaultValue={editingKpi.description ?? ""} />
              </label>
              <SaveButton pending={pending} />
            </form>
          ) : null}

          {editingDepartment ? (
            <form key={editingDepartment.id} className="management-inline-editor" onSubmit={submitDepartment}>
              <EditorHeading title="Edit department" onClose={() => setEditingId(null)} />
              <label>
                Department name
                <input name="name" required minLength={2} defaultValue={editingDepartment.name} />
              </label>
              <label className="management-editor-wide">
                Managers
                <select
                  name="managerIds"
                  multiple
                  size={Math.min(Math.max(managers.length, 2), 6)}
                  defaultValue={editingDepartment.managers.map((manager) => manager.id)}
                >
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} · {manager.email}
                    </option>
                  ))}
                </select>
                <small>Hold Ctrl or Cmd to select multiple managers.</small>
              </label>
              <SaveButton pending={pending} />
            </form>
          ) : null}

          {editingEmployee ? (
            <form key={editingEmployee.id} className="management-inline-editor" onSubmit={submitEmployee}>
              <EditorHeading title={`Edit ${editingEmployee.name}`} onClose={() => setEditingId(null)} />
              {isAdmin ? (
                <label>
                  Name
                  <input name="name" required minLength={2} defaultValue={editingEmployee.name} />
                </label>
              ) : null}
              <label>
                Role
                <select name="roleId" required defaultValue={editingEmployee.roleId}>
                  {data.roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title}
                    </option>
                  ))}
                </select>
              </label>
              {isAdmin ? (
                <>
                  <label>
                    Access
                    <select
                      name="accessLevel"
                      value={employeeAccess}
                      onChange={(event) => setEmployeeAccess(event.target.value as "EMPLOYEE" | "MANAGER")}
                    >
                      <option value="EMPLOYEE">Employee</option>
                      <option value="MANAGER">Manager</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={editingEmployee.status}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  {employeeAccess === "MANAGER" ? (
                    <label className="management-editor-wide">
                      Managed departments
                      <select
                        name="departmentIds"
                        multiple
                        required
                        size={Math.min(Math.max(data.departments.length, 2), 6)}
                        defaultValue={editingEmployee.managedDepartments.map((department) => department.id)}
                      >
                        {data.departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                      <small>Hold Ctrl or Cmd to select multiple departments.</small>
                    </label>
                  ) : (
                    <label>
                      Department
                      <select name="departmentId" required defaultValue={editingEmployee.departmentId ?? ""}>
                        <option value="" disabled>
                          Select department
                        </option>
                        {data.departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              ) : null}
              <SaveButton pending={pending} />
            </form>
          ) : null}

          <div className="management-table-scroll">
            {activeView === "roles" ? <RolesTable data={data} canEdit={isAdmin} onEdit={setEditingId} /> : null}
            {activeView === "kpis" ? <KpisTable data={data} onEdit={setEditingId} /> : null}
            {activeView === "departments" ? (
              <DepartmentsTable data={data} canEdit={isAdmin} onEdit={setEditingId} />
            ) : null}
            {activeView === "employees" ? <EmployeesTable data={data} onEdit={editEmployee} /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RolesTable({
  data,
  canEdit,
  onEdit,
}: {
  data: DashboardData;
  canEdit: boolean;
  onEdit: (id: string) => void;
}) {
  return (
    <table className="management-data-table">
      <thead>
        <tr>
          <th>Role</th>
          <th>Next role</th>
          <th>Assigned KPIs</th>
          <th>Employees</th>
          <th>Created</th>
          <th>Updated</th>
          <th>ID</th>
          {canEdit ? <th>Action</th> : null}
        </tr>
      </thead>
      <tbody>
        {data.roles.map((role) => (
          <tr key={role.id}>
            <td className="management-primary-cell">{role.title}</td>
            <td>{role.nextRoleTitle ?? "—"}</td>
            <td>
              <Tags
                values={role.kpis.map(
                  (kpi) => `${kpi.name}: ${formatNumber(kpi.target)}${kpi.unit ? ` ${kpi.unit}` : ""}`,
                )}
              />
            </td>
            <td>
              <Tags values={role.employees.map((employee) => `${employee.name} · ${employee.email}`)} />
            </td>
            <td>{formatDate(role.createdAt)}</td>
            <td>{formatDate(role.updatedAt)}</td>
            <td>
              <code title={role.id}>{role.id}</code>
            </td>
            {canEdit ? (
              <td>
                <EditButton onClick={() => onEdit(role.id)} />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KpisTable({ data, onEdit }: { data: DashboardData; onEdit: (id: string) => void }) {
  return (
    <table className="management-data-table">
      <thead>
        <tr>
          <th>KPI</th>
          <th>Description</th>
          <th>Unit</th>
          <th>Role targets</th>
          <th>Created</th>
          <th>Updated</th>
          <th>ID</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {data.kpis.map((kpi) => (
          <tr key={kpi.id}>
            <td className="management-primary-cell">{kpi.name}</td>
            <td className="management-description-cell">{kpi.description ?? "—"}</td>
            <td>{kpi.unit ?? "—"}</td>
            <td>
              <Tags
                values={kpi.roleAssignments.map(
                  (assignment) =>
                    `${assignment.roleTitle}: ${formatNumber(assignment.target)}${kpi.unit ? ` ${kpi.unit}` : ""}`,
                )}
              />
            </td>
            <td>{formatDate(kpi.createdAt)}</td>
            <td>{formatDate(kpi.updatedAt)}</td>
            <td>
              <code title={kpi.id}>{kpi.id}</code>
            </td>
            <td>
              <EditButton onClick={() => onEdit(kpi.id)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DepartmentsTable({
  data,
  canEdit,
  onEdit,
}: {
  data: DashboardData;
  canEdit: boolean;
  onEdit: (id: string) => void;
}) {
  return (
    <table className="management-data-table">
      <thead>
        <tr>
          <th>Department</th>
          <th>Managers</th>
          <th>Members</th>
          <th>Categories</th>
          <th>Created</th>
          <th>Updated</th>
          <th>ID</th>
          {canEdit ? <th>Action</th> : null}
        </tr>
      </thead>
      <tbody>
        {data.departments.map((department) => (
          <tr key={department.id}>
            <td className="management-primary-cell">{department.name}</td>
            <td>
              <Tags values={department.managers.map((manager) => `${manager.name} · ${manager.email}`)} />
            </td>
            <td>
              <Tags values={department.members.map((member) => `${member.name} · ${member.email}`)} />
            </td>
            <td>
              <Tags values={department.categories.map((category) => category.name)} />
            </td>
            <td>{formatDate(department.createdAt)}</td>
            <td>{formatDate(department.updatedAt)}</td>
            <td>
              <code title={department.id}>{department.id}</code>
            </td>
            {canEdit ? (
              <td>
                <EditButton onClick={() => onEdit(department.id)} />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmployeesTable({ data, onEdit }: { data: DashboardData; onEdit: (id: string) => void }) {
  const isAdmin = data.actor.accessLevel === "ADMIN";
  return (
    <table className="management-data-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Email</th>
          <th>Verified</th>
          <th>Role</th>
          <th>Department / managed departments</th>
          <th>Access</th>
          <th>Status</th>
          <th>Created</th>
          <th>Updated</th>
          <th>ID</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {data.users.map((user) => {
          const canEdit =
            user.id !== data.actor.id && user.accessLevel !== "ADMIN" && (isAdmin || user.accessLevel === "EMPLOYEE");
          const departments =
            user.accessLevel === "MANAGER"
              ? user.managedDepartments.map((department) => department.name)
              : user.departmentName
                ? [user.departmentName]
                : [];
          return (
            <tr key={user.id}>
              <td className="management-primary-cell">{user.name}</td>
              <td>{user.email}</td>
              <td>
                <StatusBadge value={user.emailVerified ? "Verified" : "Pending"} positive={user.emailVerified} />
              </td>
              <td>{user.roleTitle}</td>
              <td>
                <Tags values={departments} />
              </td>
              <td>{titleCase(user.accessLevel)}</td>
              <td>
                <StatusBadge value={titleCase(user.status)} positive={user.status === "active"} />
              </td>
              <td>{formatDate(user.createdAt)}</td>
              <td>{formatDate(user.updatedAt)}</td>
              <td>
                <code title={user.id}>{user.id}</code>
              </td>
              <td>
                {canEdit ? (
                  <EditButton onClick={() => onEdit(user.id)} />
                ) : (
                  <span className="management-read-only">Read only</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EditorHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="management-editor-heading">
      <div>
        <span>Editing record</span>
        <h5>{title}</h5>
      </div>
      <button type="button" onClick={onClose} aria-label="Close editor">
        <X size={16} />
      </button>
    </div>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button className="management-save" disabled={pending}>
      {pending ? <LoaderCircle className="management-spinner" size={16} /> : null}
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="management-edit" onClick={onClick}>
      <Pencil size={13} />
      Edit
    </button>
  );
}

function Tags({ values }: { values: string[] }) {
  return values.length ? (
    <div className="management-tags">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  ) : (
    <span className="management-empty-value">None</span>
  );
}

function StatusBadge({ value, positive }: { value: string; positive: boolean }) {
  return <span className={`management-status ${positive ? "positive" : "neutral"}`}>{value}</span>;
}

function directoryTitle(view: DirectoryView) {
  if (view === "roles") return "Roles";
  if (view === "kpis") return "KPIs";
  if (view === "departments") return "Departments";
  return "Employees and managers";
}

function formatDate(value: string) {
  return DATE_TIME_FORMATTER.format(new Date(value));
}

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
