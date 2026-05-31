
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * Valid status transitions:
 *   TODO        → IN_PROGRESS, BLOCKED
 *   IN_PROGRESS → IN_REVIEW,   BLOCKED
 *   IN_REVIEW   → DONE,        BLOCKED, IN_PROGRESS
 *   DONE        → (terminal — no transitions)
 *   BLOCKED     → TODO,        IN_PROGRESS (reopen)
 */
const STATUS_TRANSITIONS = {
  TODO:        ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW:   ['DONE', 'BLOCKED', 'IN_PROGRESS'],
  DONE:        [],
  BLOCKED:     ['TODO', 'IN_PROGRESS'],
};

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 255],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM(...TASK_PRIORITIES),
    allowNull: false,
    defaultValue: 'MEDIUM',
  },
  status: {
    type: DataTypes.ENUM(...TASK_STATUSES),
    allowNull: false,
    defaultValue: 'TODO',
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: true,
      isFuture(value) {
        if (value && new Date(value) < new Date()) {
          throw new Error('due_date must be a future date');
        }
      },
    },
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id',
    },
  },
  assigneeId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id',
    },
  },
}, {
  tableName: 'tasks',
  indexes: [
    // Frequently queried fields — per assignment requirement
    { fields: ['status'] },
    { fields: ['assigneeId'] },
    { fields: ['dueDate'] },
    { fields: ['projectId'] },
    { fields: ['organizationId'] },
    { fields: ['priority'] },
    // Composite index for list queries: filter by assignee + status
    { fields: ['assigneeId', 'status'] },
    { fields: ['organizationId', 'status'] },
  ],
});

module.exports = Task;
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.TASK_PRIORITIES = TASK_PRIORITIES;
module.exports.STATUS_TRANSITIONS = STATUS_TRANSITIONS;
