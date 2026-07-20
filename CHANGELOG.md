# Changelog

All notable changes to the Performance Tracking Dashboard are documented here.

## Version 3

### Knowledge library

- Reworked the Knowledge tab into a department and category-based library for SOPs, Best Practices, and Key Performance Indicators.
- Added compact department/category filters and a clearer visual hierarchy for all knowledge sections.
- Display SOP steps as numbered, titled instructions with compact number tiles.
- Improved KPI metadata presentation with readable inline label/value pairs and consistent orange accents across all knowledge types.
- Added permission-aware knowledge management:
  - Department managers can add, edit, and delete SOPs, Best Practices, and KPI references for their assigned departments.
  - Administrators can manage knowledge entries across all departments.
  - Other users retain read-only access.
- Added protected Knowledge API endpoints for creating, updating, and deleting entries, with server-side department authorization.

### Performance comparison

- Added a dedicated Comparison tab for managers and administrators.
- Added employee-versus-team KPI performance summaries, team ranking, and per-KPI breakdowns.
- Added selectable reporting windows:
  - Choose any recorded month for monthly reporting.
  - Choose a specific quarter for quarterly reporting.
  - Choose a specific year for annual reporting.
- Added a KPI performance trend graph that compares the selected employee's monthly score with the team average across the selected period.

### Dashboard experience

- Redesigned the Monthly Performance Update workspace into a unified split form with equal-width KPI and journal panels.
- Kept panel heights and action buttons aligned while making the KPI list independently scrollable as more KPIs are added.
- Refined form controls, spacing, panel styling, and responsive behavior for a cleaner management workflow.
- Rebuilt Role Progression connectors using dynamic SVG measurements:
  - Lines connect card bottom-centers to child top-centers.
  - Single-child relationships use straight connectors.
  - Multi-child relationships use smooth curved connectors.
  - Connectors resize dynamically and remain behind role cards.

## Version 2

### Major changes

#### Department-based management

- Replaced direct employee-to-manager relationships with department-based ownership.
- Added departments with unique names and a many-to-many manager assignment model.
- Assigned each user to a department instead of an individual manager.
- Updated permissions so every manager assigned to a department can manage its users; administrators retain access to all users.
- Added department management controls for administrators:
  - Create and rename departments.
  - Assign or remove managers from departments.
  - Assign users to departments when creating or updating accounts.
- Limited managers to creating employees only within departments they manage.

#### Standard operating procedures

- Added department-owned SOPs with a name and detailed description.
- Established a one-to-many relationship between departments and SOPs.
- Added a dedicated SOP library tab.
- Allowed managers to create and edit SOPs only for their assigned departments.
- Allowed administrators to manage SOPs across all departments.
- Provided employees with read-only access to SOPs for their department.

#### Role progression

- Added an optional subsequent-role link to each role.
- Added administrator controls for configuring role progression.
- Added next-role KPI targets to the bottom of the Overview tab for users whose role has a subsequent role.

### Improvements

- Added Goals with descriptions, deadlines, statuses, and manager remarks.
- Added a Notes journal category alongside Achievements and Challenges.
- Consolidated Journal entries into a filterable chronological list and aligned its visual language with Goals.
- Kept impact values numeric in storage while presenting them as High, Medium, or Low in the interface.
- Refined the monthly performance workflow by separating KPI updates from journal entry creation.
- Restricted journal and goal editing to authorized managers; employees retain read-only access.
- Added dashboard invitation emails when managers or administrators create user accounts.
- Added secure password-reset functionality.
- Added management directories for roles, KPIs, departments, and employees with complete relationship details and permission-aware inline editing.
- Standardized management card sizing and moved department assignment details out of the action cards and into the department directory.

## Version 1 — Initial release

- Introduced the Performance Tracking Dashboard with role-based access, KPI tracking, performance history, and employee management.
