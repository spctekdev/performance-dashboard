# Version 4 implementation plan

## Release objective

Version 4 adds two support channels to the dashboard:

1. **Pulse** — a secure, streaming assistant that answers only dashboard- and department-knowledge-related questions.
2. **Employee inquiries** — durable, email-notified threads between employees and the managers responsible for their department.

It also enriches every knowledge category with a concise description, which improves discovery for people and gives Pulse a reliable first step for choosing relevant departmental guidance.

## Delivery decisions

- **Assistant name:** Pulse.
- **LLM integration:** use the supplied OpenAI-compatible Groq streaming/tool-calling pattern, but keep the credential server-only. Replace `NEXT_PUBLIC_LLM_API_KEY` with a non-public environment variable such as `LLM_API_KEY`; validate it in `src/lib/env.ts` and document the blank value in `.env.example`. Never serialize the key to a client component or use it in browser code.
- **Conversation context:** load at most the last ten persisted messages—five completed user/assistant exchanges—for the active chat session, plus the current message. The browser must not be the source of truth for memory.
- **Scope:** Pulse answers about the authenticated employee only. A manager or administrator still receives answers about their own dashboard context, not unrestricted employee records. Any future team-assistant capability needs separate requirements and authorization rules.
- **Knowledge boundary:** Pulse can only retrieve categories and knowledge belonging to the authenticated user's department. It should respond that it cannot help when the request is unrelated, needs unavailable company information, or requests protected data.
- **Inquiry delivery:** creating an inquiry persists it first, then emails every active manager assigned to the employee's department. A failed email must be recorded/logged and shown as a delivery-status failure without losing the inquiry.

## 1. Foundation and category descriptions

1. Add `description` (`varchar`/`text`, bounded and non-null after backfill) to the `Category` entity.
2. Create a forward-only TypeORM migration that:
   - adds the column safely;
   - backfills every existing row with the exact value `Place Holder`;
   - makes the column required; and
   - preserves the existing `(departmentId, name)` uniqueness constraint.
3. Create one standalone, explicit `db:update-category-descriptions` script. It will contain the curated category-ID/name-to-description mapping, update only matching category descriptions, report categories still set to `Place Holder`, and be safe to re-run. It is the only mechanism that supplies meaningful descriptions for the existing categories.
4. Update category validation, department/category APIs, dashboard serialization, and TypeScript types to require a trimmed short description.
5. Update category creation/editing controls and the Knowledge tab to display the selected category description beneath its name.

Do not change the knowledge-import format, seed data, or any existing seed/import scripts for this work. Newly created categories continue to use the normal category API validation; the dedicated script is solely for curating the current categories.

**Acceptance criteria:** every category has a concise description; descriptions are editable only by authorized department managers and administrators; employees can read descriptions for their own department.

## 2. Database model and migrations

Add entities, relations, indexes, exports, and a new forward-only migration. Register every new entity and migration in `src/lib/db/data-source.ts`.

| Table | Key fields and relations | Purpose |
| --- | --- | --- |
| `chat_sessions` | `id`, `userId`, `title`, `createdAt`, `updatedAt`, `lastMessageAt`; FK to `users`; index `(userId, lastMessageAt)` | Multiple named or automatically titled Pulse conversations per user. |
| `chat_messages` | `id`, `sessionId`, `role` (`USER`, `ASSISTANT`, `TOOL`), `content`, `toolCalls` JSONB nullable, `toolResults` JSONB nullable, `createdAt`; FK to `chat_sessions`; index `(sessionId, createdAt)` | Durable transcript, audit data for tool use, and five-exchange memory source. Tool rows remain server-created only. |
| `inquiries` | `id`, `employeeId`, `departmentId`, `subject`, `status` (`OPEN`, `ANSWERED`, `CLOSED`), `referenceType`, `referenceId`, `createdAt`, `updatedAt`, `lastMessageAt`; FKs to `users` and `departments`; indexes for employee, department/status, and last activity | Inquiry/thread envelope and optional dashboard reference. |
| `inquiry_recipients` | `id`, `inquiryId`, `managerId`, `notifiedAt`, `readAt`; UUID primary key and FKs to inquiry/user | Snapshot of managers addressed at submission, so access and notifications remain historically correct if department assignments change. A narrow unique constraint on `(inquiryId, managerId)` prevents an accidental duplicate recipient; it is not a composite primary key. |
| `inquiry_messages` | `id`, `inquiryId`, `authorId`, `body`, `createdAt`; FKs to inquiry and author; index `(inquiryId, createdAt)` | Initial question and chronological replies. Explicit per-message reply nesting is intentionally omitted: one inquiry is the thread, which keeps the model and UI simpler while preserving the required conversation flow. |

`referenceType` will be an allow-listed enum: `GOAL`, `JOURNAL_ENTRY`, `KPI_DEFINITION`, `KPI_PERFORMANCE`, `KNOWLEDGE`, or `NONE`. On write, validate that the referenced record exists and belongs to the employee or is accessible departmental knowledge. Keep a small reference snapshot (label/type) in the inquiry so historical displays do not break if the source record is later removed.

**Identifier and integrity convention:** every entity's primary key is a database-generated UUID (`id uuid DEFAULT gen_random_uuid()`); every relationship/reference ID is stored as `uuid`. No table uses a composite primary key. Keep only the small number of composite indexes/unique constraints that enforce an actual query or integrity requirement: category-name uniqueness within a department, recipient de-duplication within an inquiry, and chronological session/inquiry lookups. `referenceId` is also UUID, but intentionally has no FK because `referenceType` selects among several tables. Use `RESTRICT` for records whose deletion would orphan a conversation or inquiry, or explicitly retain a display snapshot. Use database constraints for enum values, foreign keys, uniqueness, and non-empty bodies; use Zod validation for length limits and request shape.

## 3. Pulse service, tools, guardrails, and streaming

Create a server-only Pulse service (for example, `src/lib/pulse/`) rather than placing provider logic directly in a route. Separate the following responsibilities:

- **Provider client:** OpenAI-compatible request/response and SSE parsing for the supplied Groq endpoint/model, timeouts, error normalization, and streamed token forwarding.
- **Prompt builder:** one versioned, rigid system prompt stating Pulse's role, allowed topics, trusted data sources, tone, privacy requirements, refusal behavior, and instruction-hierarchy rules. User-provided text and retrieved knowledge are untrusted data, never instructions.
- **Tool registry and executor:** a typed allow-list with Zod argument schemas; do not expose generic database querying, URLs, email, mutation, or arbitrary record lookup tools.
- **Conversation repository:** transactional persistence of the user message, tool audit data, final assistant output, and session timestamps.

Provide only these read-only tools initially:

1. `get_my_dashboard_context` — returns the actor's role, assigned KPI targets, recent KPI entries, goals, and next role plus its required KPI targets.
2. `list_my_department_categories` — returns category names and descriptions in the actor's department, allowing Pulse to select a category before requesting detailed guidance.
3. `get_category_guidance` — accepts one authorized category ID and returns the relevant SOPs, best practices, and knowledge KPIs. Enforce the department match in the executor, not merely in the model prompt.

Tool loop requirements:

1. Authenticate the request and ensure its session belongs to the actor.
2. Validate and persist the user message.
3. Load the last five exchanges from the same session.
4. Request a non-streamed planning/tool-call turn from the provider.
5. Validate, authorize, execute, and audit every requested tool; repeat the planning step while tool calls remain, with a small hard cap (for example, four rounds and eight total calls) to prevent loops and cost abuse.
6. Make the final provider request with `stream: true`; pass normalized SSE events to the client as tokens arrive.
7. Assemble and persist the final assistant message only after the stream completes. If the client disconnects or the provider fails, mark the partial result appropriately and return a safe retry message.

Guardrails must include strict input length limits, per-user rate limits, model timeout and output-token caps, structured error logs without secrets, same-origin checks for mutations, and redaction of credentials/tokens from logs. The assistant must not invent KPIs or SOPs: when no authorized source supports an answer, it should say so and direct the user to an inquiry.

## 4. Pulse API and user experience

Implement authenticated endpoints following existing `{ data }` / `{ error }` conventions:

- `GET /api/chat/sessions` — current user's sessions, newest first.
- `POST /api/chat/sessions` — create a session; title can be supplied or derived from the first message.
- `GET /api/chat/sessions/[id]/messages` — paginated transcript after ownership validation.
- `POST /api/chat/sessions/[id]/messages` — accepts one user message and returns `text/event-stream` for Pulse's response and safe status events.
- `PATCH`/`DELETE /api/chat/sessions/[id]` — rename/archive or delete only the current user's own session, using the chosen retention policy.

Add a **Pulse** tab to `DashboardShell` with a friendly empty state, new-session action, session list, transcript, streaming assistant bubbles, typing/tool-status indicator, retry state, and keyboard-accessible message composer. Escape assistant output in the UI and render it as plain text or a sanitized, tightly limited format; do not render arbitrary HTML. Include a visible reminder that Pulse uses dashboard and department knowledge, plus a link/button to start an employee inquiry when it cannot resolve a question.

## 5. Employee inquiry workflow

Create a server-only inquiry service that derives recipients from the employee's department rather than trusting client-provided manager IDs.

### API

- `POST /api/inquiries` — employee creates an inquiry with subject, message, optional validated reference, and implicitly addressed department managers.
- `GET /api/inquiries` — returns only the caller's sent inquiries for employees; assigned inquiries for managers; all inquiries for administrators. Support role-appropriate status, cursor, and date filters.
- `GET /api/inquiries/[id]` — returns the thread, authorized recipients, reference snapshot, and messages only to the employee author, a snapshotted recipient manager, or an administrator.
- `POST /api/inquiries/[id]/messages` — employee author, recipient manager, or administrator adds a reply. Validate `parentMessageId` belongs to the same inquiry. Update status and `lastMessageAt` atomically.
- `PATCH /api/inquiries/[id]` — authorized close/reopen and read-state operations, with an audit-friendly status transition policy.

### Permissions and email

- Employees can create and view only their own inquiries, and cannot select arbitrary managers or references outside their access.
- Managers can view and reply only to inquiries where they were snapshotted as a recipient; department membership changes do not silently expose old threads.
- Administrators can view every inquiry and participate when needed.
- On creation, email each active recipient through the existing SMTP service with a dashboard link, employee name, subject, reference label, and safe message preview. Add a separate email helper/template and log delivery failures without exposing mail credentials.
- Send a notification email to the employee when a manager or administrator replies. Do not email the author about their own message.

### UI

Add an **Inquiries** tab available to every access level. Employees get a compose panel, optional reference picker (their goals, journal entries, KPIs/performance, and department knowledge), sent-thread list, status, and replies. Managers get an inbox of addressed inquiries with unread/reply status. Administrators get an all-inquiries view with filters. Reuse a single accessible threaded detail component and clearly show the reference snapshot/link.

## 6. Tests, security review, and rollout

1. Add unit tests for category migration/backfill, validation, Pulse prompt construction, tool argument validation, tool authorization, five-exchange memory selection, tool loop limits, and inquiry status transitions.
2. Add integration tests for chat-session ownership, SSE headers/events, manager/admin/employee inquiry visibility, cross-department denial, reference validation, and email failure handling.
3. Add UI tests for streaming rendering, session switching, inquiry compose/reply flows, and role-specific tabs/states.
4. Run `npm run typecheck`, `npm run lint`, `npm run build`, database migration checks, and the relevant test suite. Manually test a full stream, a multi-tool answer, a prompt-injection attempt inside a knowledge item, and an inquiry to a department with multiple managers.
5. Before production: set `LLM_API_KEY` only in the deployment secret manager, run the migration, back up the database, configure monitoring for provider failures and email failures, and verify rate-limit thresholds. Roll back application code if required; do not revert a production migration without an explicit data-safe rollback plan.

## Completion checklist

- The migration gives all existing categories `Place Holder`; the dedicated category-description script then applies curated descriptions without changing seed or import workflows. The UI/API enforce descriptions for future categories.
- Pulse streams answers, persists separate user sessions, carries exactly the recent five exchanges, and completes authorized multi-tool calls.
- Pulse cannot disclose another user's data or use knowledge outside the actor's department.
- Employees can create, reference, and revisit inquiries; all assigned managers are notified and can reply.
- Managers only see their addressed inquiries, while administrators see all inquiries.
- Migrations, authorization tests, provider failure handling, and quality checks pass.
