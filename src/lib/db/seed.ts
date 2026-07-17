import "reflect-metadata";
import { hash } from "bcryptjs";
import { AppDataSource } from "./data-source";
import {
  AccessLevel,
  Department,
  Goal,
  GoalStatus,
  Journal,
  JournalCategory,
  KpiDefinition,
  Role,
  RoleKpiAssignment,
  User,
  UserKpiPerformance,
  UserStatus,
} from "./entities";

const ADMIN_PASSWORD = "utfwJdPyXhyf53v";
const TEAM_PASSWORD = "spctek123";

const roleDefinitions = [
  { title: "Chief Operating Officer", next: null },
  { title: "Head of Operations", next: "Chief Operating Officer" },
  { title: "Operations Manager", next: "Head of Operations" },
  { title: "Operations Specialist", next: "Operations Manager" },
  { title: "Operations Associate", next: "Operations Specialist" },
  { title: "Head of Marketing", next: "Chief Operating Officer" },
  { title: "Marketing Manager", next: "Head of Marketing" },
  { title: "Marketing Specialist", next: "Marketing Manager" },
  { title: "Marketing Associate", next: "Marketing Specialist" },
] as const;

const roleKpis: Record<string, Array<[string, string, string, number]>> = {
  "Chief Operating Officer": [
    ["Company Revenue", "PKR", "Monthly revenue delivered across departments", 2_000_000],
    ["Operating Margin", "%", "Operating margin across the business", 22],
    ["Strategic Initiatives", "%", "Quarterly strategic initiatives delivered on plan", 95],
  ],
  "Operations Manager": [
    ["On-Time Delivery", "%", "Work completed by its agreed deadline", 96],
    ["Process Compliance", "%", "Audited work following documented processes", 94],
    ["Operations Throughput", "tasks", "Monthly completed operations tasks", 450],
  ],
  "Operations Specialist": [
    ["On-Time Delivery", "%", "Work completed by its agreed deadline", 93],
    ["Process Compliance", "%", "Audited work following documented processes", 90],
    ["Operations Throughput", "tasks", "Monthly completed operations tasks", 180],
  ],
  "Marketing Manager": [
    ["Marketing Qualified Leads", "leads", "Marketing-qualified leads generated monthly", 260],
    ["Campaign ROAS", "x", "Return on advertising spend", 4.2],
    ["Campaign Delivery", "%", "Campaigns launched on their agreed schedule", 95],
  ],
  "Marketing Specialist": [
    ["Marketing Qualified Leads", "leads", "Marketing-qualified leads generated monthly", 120],
    ["Campaign ROAS", "x", "Return on advertising spend", 3.6],
    ["Campaign Delivery", "%", "Campaigns launched on their agreed schedule", 92],
  ],
};

function monthPeriods() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    return month.toISOString().slice(0, 10);
  });
}

async function seed() {
  const db = await AppDataSource.initialize();
  const roleRepo = db.getRepository(Role);
  const departmentRepo = db.getRepository(Department);
  const userRepo = db.getRepository(User);
  const kpiRepo = db.getRepository(KpiDefinition);
  const assignmentRepo = db.getRepository(RoleKpiAssignment);
  const performanceRepo = db.getRepository(UserKpiPerformance);
  const journalRepo = db.getRepository(Journal);
  const goalRepo = db.getRepository(Goal);

  const roles: Record<string, Role> = {};
  for (const definition of roleDefinitions) {
    let role = await roleRepo.findOneBy({ title: definition.title });
    if (!role) role = await roleRepo.save({ title: definition.title });
    roles[definition.title] = role;
  }
  for (const definition of roleDefinitions) {
    await roleRepo.update(roles[definition.title].id, {
      nextRoleId: definition.next ? roles[definition.next].id : null,
    });
  }

  const departments: Record<string, Department> = {};
  for (const name of ["Operations", "Marketing"]) {
    let department = await departmentRepo.findOneBy({ name });
    if (!department) department = await departmentRepo.save({ name });
    departments[name] = department;
  }

  const adminPassword = await hash(ADMIN_PASSWORD, 12);
  const teamPassword = await hash(TEAM_PASSWORD, 12);
  async function saveUser(
    name: string,
    email: string,
    roleTitle: keyof typeof roles,
    accessLevel: AccessLevel,
    department: Department | null,
    password: string,
  ) {
    const values = {
      name,
      password,
      emailVerified: true,
      roleId: roles[roleTitle].id,
      accessLevel,
      departmentId: department?.id ?? null,
      status: UserStatus.ACTIVE,
    };
    let user = await userRepo.findOneBy({ email });
    if (user) {
      await userRepo.update(user.id, values);
      user = await userRepo.findOneByOrFail({ email });
    } else {
      user = await userRepo.save({ email, ...values });
    }
    return user;
  }

  const admin = await saveUser("Faizan Ali", "f.ali@spctek.com", "Chief Operating Officer", AccessLevel.ADMIN, null, adminPassword);
  const affan = await saveUser("Affan Waseem", "awaseem@spctek.com", "Operations Manager", AccessLevel.MANAGER, null, teamPassword);
  const yasir = await saveUser("Yasir Shoaib", "yasir@spctek.com", "Marketing Manager", AccessLevel.MANAGER, null, teamPassword);
  const kevin = await saveUser("Kevin Paul", "kpaul@spctek.com", "Operations Specialist", AccessLevel.EMPLOYEE, departments.Operations, teamPassword);
  const kashan = await saveUser("Muhammad Kashan", "mkashan@spctek.com", "Marketing Specialist", AccessLevel.EMPLOYEE, departments.Marketing, teamPassword);

  for (const [department, manager] of [[departments.Operations, affan], [departments.Marketing, yasir]] as const) {
    await db.createQueryBuilder().insert().into("department_managers")
      .values({ departmentId: department.id, managerId: manager.id }).orIgnore().execute();
  }

  const kpis: Record<string, KpiDefinition> = {};
  for (const definitions of Object.values(roleKpis)) {
    for (const [name, unit, description] of definitions) {
      if (kpis[name]) continue;
      let kpi = await kpiRepo.findOneBy({ name });
      if (!kpi) kpi = await kpiRepo.save({ name, unit, description });
      kpis[name] = kpi;
    }
  }
  for (const [roleTitle, definitions] of Object.entries(roleKpis)) {
    for (const [name, , , target] of definitions) {
      await assignmentRepo.upsert(
        { roleId: roles[roleTitle].id, kpiId: kpis[name].id, target: String(target) },
        ["roleId", "kpiId"],
      );
    }
  }

  const people = [admin, affan, yasir, kevin, kashan];
  const months = monthPeriods();
  for (const [personIndex, person] of people.entries()) {
    const assignments = await assignmentRepo.findBy({ roleId: person.roleId });
    for (const [monthIndex, period] of months.entries()) {
      for (const [kpiIndex, assignment] of assignments.entries()) {
        const target = Number(assignment.target);
        const seasonalProgress = 0.8 + monthIndex * 0.017 + personIndex * 0.012 + (kpiIndex % 2) * 0.02;
        await performanceRepo.upsert(
          {
            userId: person.id,
            kpiId: assignment.kpiId,
            period,
            current: String(Math.round(target * Math.min(seasonalProgress, 1.12) * 100) / 100),
            target: String(target),
          },
          ["userId", "kpiId", "period"],
        );
      }
    }
  }

  const journalSubjects = [
    "executive operating review", "operations delivery plan", "marketing campaign plan", "operations workflow", "marketing optimization plan",
  ];
  await journalRepo.save(people.flatMap((person, personIndex) => months.map((period, monthIndex) => ({
    userId: person.id,
    description: `${journalSubjects[personIndex]} ${monthIndex + 1} completed with ${monthIndex % 4 === 2 ? "a dependency noted" : "measurable progress"}.`,
    category: monthIndex % 4 === 2 ? JournalCategory.NOTE : monthIndex % 5 === 4 ? JournalCategory.BAD : JournalCategory.GOOD,
    impact: String(monthIndex % 3 === 0 ? 99 : monthIndex % 3 === 1 ? 66 : 33),
    period,
  }))));

  const now = new Date();
  await goalRepo.save(people.flatMap((person, personIndex) => [
    { userId: person.id, description: `Complete Q${((personIndex % 4) + 1)} role objectives`, deadline: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15)), status: GoalStatus.IN_PROGRESS, remarks: "On track with monthly KPI checkpoints." },
    { userId: person.id, description: "Deliver the annual improvement initiative", deadline: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 4, 1)), status: GoalStatus.BACKLOG, remarks: "Plan and milestones have been documented." },
    { userId: person.id, description: "Review previous-quarter performance", deadline: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 28)), status: GoalStatus.FINISHED, remarks: "Review completed and follow-up actions recorded." },
  ]));

  console.log(`Seed complete. Admin: ${admin.email}; team password: ${TEAM_PASSWORD}`);
  await db.destroy();
}

seed().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});
