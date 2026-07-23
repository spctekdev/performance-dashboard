import { HttpError } from "@/lib/http";

const noArgumentTools = new Set(["get_my_dashboard_context", "list_my_department_categories"]);

export function parsePulseToolArguments(name: string, rawArguments: string): Record<string, unknown> {
  let args: unknown;
  try {
    args = JSON.parse(rawArguments || "{}");
  } catch {
    throw new HttpError(422, `Invalid arguments for ${name}`);
  }
  if (args === null && noArgumentTools.has(name)) return {};
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new HttpError(422, `Invalid arguments for ${name}`);
  return args as Record<string, unknown>;
}
