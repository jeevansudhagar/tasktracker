'use strict';

const sequelize = require('../config/database');
const Organization = require('./Organization');
const User = require('./User');
const Project = require('./Project');
const Task = require('./Task');

// ─── Associations ──────────────────────────────────────────────────────────────

// Organization → Users (one-to-many)
Organization.hasMany(User, { foreignKey: 'organizationId', as: 'members' });
User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// Organization → Projects (one-to-many)
Organization.hasMany(Project, { foreignKey: 'organizationId', as: 'projects' });
Project.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// User → Projects created (one-to-many)
User.hasMany(Project, { foreignKey: 'createdById', as: 'createdProjects' });
Project.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });

// Project → Tasks (one-to-many)
Project.hasMany(Task, { foreignKey: 'projectId', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Organization → Tasks (one-to-many)
Organization.hasMany(Task, { foreignKey: 'organizationId', as: 'tasks' });
Task.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// User → Tasks assigned (one-to-many)  — the core query path
User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

// User → Tasks created (one-to-many)
User.hasMany(Task, { foreignKey: 'createdById', as: 'createdTasks' });
Task.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });

// ─── Sync helper ───────────────────────────────────────────────────────────────

const syncDatabase = async ({ force = false, alter = false } = {}) => {
  await sequelize.sync({ force, alter });
  console.log(`✅ Database synced (force=${force}, alter=${alter})`);
};

module.exports = {
  sequelize,
  Organization,
  User,
  Project,
  Task,
  syncDatabase,
};
