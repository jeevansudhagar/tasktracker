'use strict';

/**
 * Seed script — creates demo data:
 *   1 Organization
 *   3 Users: admin, manager, member
 *   2 Projects
 *   6 Tasks (mix of statuses/priorities)
 *
 * Run: node src/scripts/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Organization, User, Project, Task, syncDatabase } = require('../models');

const seed = async () => {
  try {
    console.log('🌱 Starting seed...');
    await syncDatabase({ alter: true });

    // ── Organization ──────────────────────────────────────────────────────────
    const [org] = await Organization.findOrCreate({
      where: { slug: 'acme-corp' },
      defaults: { name: 'Acme Corp', slug: 'acme-corp', description: 'Demo organization' },
    });
    console.log(`✅ Organization: ${org.name} (${org.id})`);

    // ── Users ─────────────────────────────────────────────────────────────────
    const password = await bcrypt.hash('Password@123', 12);

    const [admin] = await User.findOrCreate({
      where: { email: 'admin@acme.com' },
      defaults: { name: 'Admin User', email: 'admin@acme.com', password, role: 'ADMIN', organizationId: org.id },
    });

    const [manager] = await User.findOrCreate({
      where: { email: 'manager@acme.com' },
      defaults: { name: 'Manager User', email: 'manager@acme.com', password, role: 'MANAGER', organizationId: org.id },
    });

    const [member] = await User.findOrCreate({
      where: { email: 'member@acme.com' },
      defaults: { name: 'Member User', email: 'member@acme.com', password, role: 'MEMBER', organizationId: org.id },
    });

    console.log(`✅ Users created: admin, manager, member`);
    console.log(`   admin@acme.com / manager@acme.com / member@acme.com`);
    console.log(`   Password for all: Password@123`);

    // ── Projects ──────────────────────────────────────────────────────────────
    const [projectA] = await Project.findOrCreate({
      where: { name: 'Website Redesign', organizationId: org.id },
      defaults: { name: 'Website Redesign', description: 'Redesign company website', organizationId: org.id, createdById: admin.id },
    });

    const [projectB] = await Project.findOrCreate({
      where: { name: 'Mobile App', organizationId: org.id },
      defaults: { name: 'Mobile App', description: 'Build React Native mobile app', organizationId: org.id, createdById: manager.id },
    });

    console.log(`✅ Projects: Website Redesign, Mobile App`);

    // ── Tasks ─────────────────────────────────────────────────────────────────
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    const tasks = [
      { title: 'Design landing page wireframes', priority: 'HIGH',   status: 'IN_PROGRESS', projectId: projectA.id, assigneeId: member.id,   dueDate: tomorrow  },
      { title: 'Set up CI/CD pipeline',         priority: 'MEDIUM', status: 'TODO',        projectId: projectA.id, assigneeId: manager.id,  dueDate: nextWeek  },
      { title: 'Write API documentation',       priority: 'LOW',    status: 'TODO',        projectId: projectA.id, assigneeId: member.id,   dueDate: nextMonth },
      { title: 'Implement auth screens',        priority: 'HIGH',   status: 'IN_REVIEW',   projectId: projectB.id, assigneeId: member.id,   dueDate: tomorrow  },
      { title: 'Set up push notifications',     priority: 'MEDIUM', status: 'TODO',        projectId: projectB.id, assigneeId: member.id,   dueDate: nextWeek  },
      { title: 'Performance testing',           priority: 'HIGH',   status: 'BLOCKED',     projectId: projectB.id, assigneeId: manager.id,  dueDate: nextWeek  },
    ];

    for (const t of tasks) {
      await Task.findOrCreate({
        where: { title: t.title, organizationId: org.id },
        defaults: { ...t, organizationId: org.id, createdById: admin.id },
      });
    }

    console.log(`✅ Tasks seeded: ${tasks.length} tasks`);
    console.log('\n🎉 Seed complete! You can now start the server with: npm run dev\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
