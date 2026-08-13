'use strict';
const { db, init } = require('./lib/db');
const { hashPassword } = require('./lib/auth');

async function upsertUser(name, email, password, role, title) {
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#22c55e'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const info = await db.prepare(
    'INSERT INTO users (name, email, password_hash, role, avatar_color, title) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, email, hashPassword(password), role, color, title);
  return info.lastInsertRowid;
}

async function createProject(adminId, managerId, name, description, start, end, priority, status, members, tasks) {
  const info = await db.prepare(`
    INSERT INTO projects (name, description, start_date, end_date, priority, status, manager_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description, start, end, priority, status, managerId, adminId);
  const projectId = info.lastInsertRowid;

  for (const uid of members) {
    await db.prepare(
      'INSERT INTO project_members (project_id, user_id) VALUES (?, ?) ON CONFLICT (project_id, user_id) DO NOTHING'
    ).run(projectId, uid);
  }

  for (const t of tasks) {
    await db.prepare(`
      INSERT INTO tasks (project_id, title, description, assignee_id, priority, status, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, t.title, t.description || '', t.assignee || null, t.priority || 'MEDIUM', t.status || 'TODO', t.due || null, managerId);
  }

  await db.prepare('INSERT INTO activity_log (project_id, user_id, message) VALUES (?, ?, ?)')
    .run(projectId, adminId, `Project "${name}" created.`);

  return projectId;
}

const today = new Date();
function daysFromNow(n) {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  await init();

  const alreadySeeded = (await db.prepare('SELECT COUNT(*) c FROM users').get()).c > 0;
  if (alreadySeeded) {
    console.log('Database already has data — skipping seed.');
    process.exit(0);
  }

  console.log('Seeding TaskFlow database...');

  const adminId = await upsertUser('Ayesha Malik', 'admin@taskflow.dev', 'admin123', 'ADMIN', 'System Administrator');
  const pm1 = await upsertUser('Hamza Sheikh', 'hamza.pm@taskflow.dev', 'password123', 'PROJECT_MANAGER', 'Senior Project Manager');
  const pm2 = await upsertUser('Sara Ahmed', 'sara.pm@taskflow.dev', 'password123', 'PROJECT_MANAGER', 'Project Manager');
  const tm1 = await upsertUser('Bilal Khan', 'bilal@taskflow.dev', 'password123', 'TEAM_MEMBER', 'Frontend Developer');
  const tm2 = await upsertUser('Zainab Raza', 'zainab@taskflow.dev', 'password123', 'TEAM_MEMBER', 'Backend Developer');
  const tm3 = await upsertUser('Usman Tariq', 'usman@taskflow.dev', 'password123', 'TEAM_MEMBER', 'UI/UX Designer');
  const tm4 = await upsertUser('Mahnoor Iqbal', 'mahnoor@taskflow.dev', 'password123', 'TEAM_MEMBER', 'QA Engineer');

  await createProject(
    adminId, pm1,
    'Orion Customer Portal Revamp',
    'Rebuild the customer-facing portal with a modern design system, faster load times, and self-service account management.',
    daysFromNow(-20), daysFromNow(40), 'HIGH', 'ACTIVE', [tm1, tm2, tm3],
    [
      { title: 'Design new dashboard layout', assignee: tm3, priority: 'HIGH', status: 'COMPLETED', due: daysFromNow(-10) },
      { title: 'Set up component library', assignee: tm1, priority: 'MEDIUM', status: 'COMPLETED', due: daysFromNow(-5) },
      { title: 'Build authentication flow', assignee: tm2, priority: 'CRITICAL', status: 'IN_PROGRESS', due: daysFromNow(2) },
      { title: 'Implement billing page', assignee: tm1, priority: 'HIGH', status: 'IN_PROGRESS', due: daysFromNow(5) },
      { title: 'API integration for account settings', assignee: tm2, priority: 'MEDIUM', status: 'REVIEW', due: daysFromNow(1) },
      { title: 'Cross-browser QA pass', assignee: null, priority: 'LOW', status: 'TODO', due: daysFromNow(12) },
    ]
  );

  await createProject(
    adminId, pm1,
    'Atlas Mobile App Launch',
    'Native mobile app for iOS and Android supporting offline sync and push notifications for field teams.',
    daysFromNow(-5), daysFromNow(60), 'CRITICAL', 'ACTIVE', [tm2, tm4],
    [
      { title: 'Define offline sync architecture', assignee: tm2, priority: 'CRITICAL', status: 'IN_PROGRESS', due: daysFromNow(3) },
      { title: 'Push notification service setup', assignee: tm2, priority: 'HIGH', status: 'TODO', due: daysFromNow(8) },
      { title: 'Write end-to-end test plan', assignee: tm4, priority: 'MEDIUM', status: 'TODO', due: daysFromNow(15) },
    ]
  );

  await createProject(
    adminId, pm2,
    'Nimbus Internal Analytics Suite',
    'Company-wide analytics dashboards for sales, support, and product usage metrics.',
    daysFromNow(-40), daysFromNow(-2), 'MEDIUM', 'COMPLETED', [tm1, tm4],
    [
      { title: 'Data warehouse schema design', assignee: tm1, priority: 'HIGH', status: 'COMPLETED', due: daysFromNow(-30) },
      { title: 'Build sales dashboard', assignee: tm1, priority: 'MEDIUM', status: 'COMPLETED', due: daysFromNow(-15) },
      { title: 'QA and sign-off', assignee: tm4, priority: 'MEDIUM', status: 'COMPLETED', due: daysFromNow(-3) },
    ]
  );

  await createProject(
    adminId, pm2,
    'Helios Marketing Site Redesign',
    'Refresh the public marketing website with new brand guidelines and improved SEO performance.',
    daysFromNow(0), daysFromNow(30), 'LOW', 'PLANNING', [tm3],
    [
      { title: 'Competitive audit & brand moodboard', assignee: tm3, priority: 'LOW', status: 'TODO', due: daysFromNow(7) },
    ]
  );

  // A project with no manager yet, to demo admin assignment flow
  await createProject(
    adminId, null,
    'Phoenix Payments Integration',
    'Integrate a new payments provider across web and mobile checkout flows.',
    daysFromNow(5), daysFromNow(50), 'HIGH', 'PLANNING', [], []
  );

  // Sample discussion + notifications for realism
  const sampleTask = await db.prepare('SELECT id, project_id, title FROM tasks LIMIT 1').get();
  if (sampleTask) {
    await db.prepare('INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)')
      .run(sampleTask.id, pm1, "Let's make sure this lines up with the new design tokens before merging.");
    await db.prepare('INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)')
      .run(sampleTask.id, tm1, "Sounds good — I'll sync the tokens today and update the PR.");
  }

  await db.prepare('INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)')
    .run(pm1, 'PROJECT_ASSIGNED', 'You were assigned as Project Manager for "Orion Customer Portal Revamp".', '#/projects/1');
  await db.prepare('INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)')
    .run(tm1, 'TASK_ASSIGNED', 'You were assigned a new task: "Set up component library".', '#/projects/1');

  console.log('Seed complete.');
  console.log('---------------------------------------------');
  console.log('Login credentials:');
  console.log('  Administrator : admin@taskflow.dev / admin123');
  console.log('  Project Mgr 1 : hamza.pm@taskflow.dev / password123');
  console.log('  Project Mgr 2 : sara.pm@taskflow.dev / password123');
  console.log('  Team Member   : bilal@taskflow.dev / password123');
  console.log('  Team Member   : zainab@taskflow.dev / password123');
  console.log('  Team Member   : usman@taskflow.dev / password123');
  console.log('  Team Member   : mahnoor@taskflow.dev / password123');
  console.log('---------------------------------------------');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});