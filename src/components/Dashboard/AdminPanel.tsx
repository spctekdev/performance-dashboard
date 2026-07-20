"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, Gauge, LoaderCircle, Plus, UserPlus } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { ManagementDirectory } from "./ManagementDirectory";

export function AdminPanel({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const isAdmin = data.actor.accessLevel === "ADMIN";
  const managers = data.users.filter((user) => user.accessLevel === "MANAGER");
  const [newUserAccessLevel, setNewUserAccessLevel] = useState<"EMPLOYEE" | "MANAGER">("EMPLOYEE");

  async function submit(event: FormEvent<HTMLFormElement>, url: string, action: string, method = "POST") {
    event.preventDefault();
    if (pendingAction) return;
    setMessage("");
    setPendingAction(action);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body: Record<string, unknown> = {};
    form.forEach((value, key) => (body[key] = value || null));
    if (form.has("departmentIds")) body.departmentIds = form.getAll("departmentIds").map(String);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(result.data.message || "Saved successfully");
      formElement.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <ManagementDirectory data={data} onMessage={setMessage} />
      <div className="admin-grid">
        <section className="admin-card management-combined-card">
          <div className="management-card-header">
            <div className="admin-icon purple">
              <BriefcaseBusiness />
            </div>
            <h3>Roles</h3>
            <p>Create roles, then define which role follows each one.</p>
          </div>
          <div className="management-sections">
            <form className="management-section" onSubmit={(event) => submit(event, "/api/roles", "role")}>
              <h4>Create a role</h4>
              <label>
                Role title
                <input name="title" required placeholder="Amazon Account Manager" />
              </label>
              <ActionButton active={pendingAction === "role"} disabled={pendingAction !== null} label="Create role" />
            </form>
            {isAdmin && (
              <form
                className="management-section"
                onSubmit={(event) => {
                  const roleId = String(new FormData(event.currentTarget).get("roleId"));
                  void submit(event, `/api/roles/${roleId}`, "role-progression", "PATCH");
                }}
              >
                <h4>Assign a subsequent role</h4>
                <label>
                  Current role
                  <select name="roleId" required defaultValue="">
                    <option value="" disabled>
                      Select role
                    </option>
                    {data.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Subsequent role
                  <select name="nextRoleId" defaultValue="">
                    <option value="">No subsequent role</option>
                    {data.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                </label>
                <ActionButton
                  active={pendingAction === "role-progression"}
                  disabled={pendingAction !== null}
                  label="Assign subsequent role"
                  icon="building"
                />
              </form>
            )}
          </div>
        </section>

        <section className="admin-card management-combined-card">
          <div className="management-card-header">
            <div className="admin-icon teal">
              <Gauge />
            </div>
            <h3>KPIs</h3>
            <p>Create metrics, then assign an expected target to a role.</p>
          </div>
          <div className="management-sections">
            <form className="management-section" onSubmit={(event) => submit(event, "/api/kpis", "kpi")}>
              <h4>Create a KPI</h4>
              <label>
                KPI name
                <input name="name" required placeholder="Revenue Generated" />
              </label>
              <div className="two-fields">
                <label>
                  Unit
                  <input name="unit" placeholder="PKR" />
                </label>
                <label>
                  Description
                  <input name="description" placeholder="Monthly revenue" />
                </label>
              </div>
              <ActionButton active={pendingAction === "kpi"} disabled={pendingAction !== null} label="Create KPI" />
            </form>
            <form
              className="management-section"
              onSubmit={(event) => {
                const roleId = String(new FormData(event.currentTarget).get("roleId"));
                void submit(event, `/api/roles/${roleId}/kpis`, "assignment");
              }}
            >
              <h4>Assign a KPI to a role</h4>
              <label>
                Role
                <select name="roleId" required defaultValue="">
                  <option value="" disabled>
                    Select role
                  </option>
                  {data.roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="two-fields">
                <label>
                  KPI
                  <select name="kpiId" required defaultValue="">
                    <option value="" disabled>
                      Select KPI
                    </option>
                    {data.kpis.map((kpi) => (
                      <option key={kpi.id} value={kpi.id}>
                        {kpi.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Target
                  <input type="number" name="target" min="0" step=".01" required />
                </label>
              </div>
              <ActionButton
                active={pendingAction === "assignment"}
                disabled={pendingAction !== null}
                label="Assign KPI to role"
              />
            </form>
          </div>
        </section>

        {isAdmin && (
          <section className="admin-card management-combined-card">
            <div className="management-card-header">
              <div className="admin-icon blue">
                <Building2 />
              </div>
              <h3>Departments</h3>
              <p>Create departments here; use the department directory to review or edit them.</p>
            </div>
            <div className="management-sections">
              <form
                className="management-section"
                onSubmit={(event) => submit(event, "/api/departments", "department-create")}
              >
                <h4>Create a department</h4>
                <label>
                  New department name
                  <input name="name" required minLength={2} placeholder="Growth" />
                </label>
                <ActionButton
                  active={pendingAction === "department-create"}
                  disabled={pendingAction !== null}
                  label="Create department"
                />
              </form>
            </div>
          </section>
        )}

        {isAdmin && (
          <form
            className="admin-card"
            onSubmit={(event) => {
              const departmentId = String(new FormData(event.currentTarget).get("departmentId"));
              void submit(event, `/api/departments/${departmentId}/managers`, "department-manager");
            }}
          >
            <div className="admin-icon teal">
              <UserPlus />
            </div>
            <h3>Assign a department manager</h3>
            <p>Managers can manage every user assigned to this department.</p>
            <label>
              Department
              <select name="departmentId" required defaultValue="">
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
            <label>
              Manager
              <select name="managerId" required defaultValue="">
                <option value="" disabled>
                  Select manager
                </option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </label>
            <ActionButton
              active={pendingAction === "department-manager"}
              disabled={pendingAction !== null}
              label="Assign manager"
              icon="user"
            />
          </form>
        )}

        <form className="admin-card" onSubmit={(event) => submit(event, "/api/users", "employee")}>
          <div className="admin-icon blue">
            <UserPlus />
          </div>
          <h3>Add an employee</h3>
          <p>
            {isAdmin
              ? "Create an account and set its department access."
              : "Create an employee in one of your departments."}
          </p>
          <div className="two-fields">
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Email
              <input type="email" name="email" required />
            </label>
          </div>
          <label>
            Temporary password
            <input name="password" type="password" required minLength={10} />
          </label>
          <div className="two-fields">
            <label>
              Role
              <select name="roleId" required defaultValue="">
                <option value="" disabled>
                  Select role
                </option>
                {data.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </label>
            {(!isAdmin || newUserAccessLevel === "EMPLOYEE") && (
              <label>
                Department
                <select name="departmentId" required defaultValue="">
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
          </div>
          {isAdmin && (
            <label>
              Access
              <select
                name="accessLevel"
                value={newUserAccessLevel}
                onChange={(event) => setNewUserAccessLevel(event.target.value as "EMPLOYEE" | "MANAGER")}
              >
                <option>EMPLOYEE</option>
                <option>MANAGER</option>
              </select>
            </label>
          )}
          {isAdmin && newUserAccessLevel === "MANAGER" && (
            <label>
              Managed departments
              <select name="departmentIds" multiple required size={Math.min(Math.max(data.departments.length, 2), 6)}>
                {data.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <small>Hold Ctrl or Cmd to select multiple departments.</small>
            </label>
          )}
          <input type="hidden" name="status" value="active" />
          <ActionButton
            active={pendingAction === "employee"}
            disabled={pendingAction !== null || !data.departments.length}
            label="Create employee"
            icon="user"
          />
        </form>
      </div>
      {message && (
        <div className="toast-message" role="status">
          {message}
        </div>
      )}
    </>
  );
}

function ActionButton({
  active,
  disabled,
  label,
  icon = "plus",
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  icon?: "plus" | "user" | "building";
}) {
  return (
    <button className="management-action" disabled={disabled}>
      {active ? (
        <LoaderCircle className="management-spinner" size={16} />
      ) : icon === "user" ? (
        <UserPlus size={16} />
      ) : icon === "building" ? (
        <Building2 size={16} />
      ) : (
        <Plus size={16} />
      )}
      {label}
    </button>
  );
}
