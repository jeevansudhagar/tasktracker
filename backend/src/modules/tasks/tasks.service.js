
const { Task, User, Project } = require('../../models');
const { STATUS_TRANSITIONS } = require('../../models/Task');
const { getCache, setCache, deleteCache, deletePattern } = require('../../config/redis');
const { createError } = require('../../middleware/errorHandler');
const { Op } = require('sequelize');

// Cache key helpers

/**
 * Cache key for task list per assignee.
 * Includes query params so different filters don't collide.
 */
const buildAssigneeCacheKey = (assigneeId, queryStr) =>
  `tasks:assignee:${assigneeId}:${queryStr}`;

/**
 * Invalidate all cache entries for a given assignee.
 * Called on create / update / delete.
 */
const invalidateAssigneeCache = async (assigneeId) => {
  if (assigneeId) {
    await deletePattern(`tasks:assignee:${assigneeId}:*`);
  }
};

// Task Attributes

const TASK_INCLUDES = [
  { association: 'assignee', attributes: ['id', 'name', 'email'] },
  { association: 'creator',  attributes: ['id', 'name', 'email'] },
  { association: 'project',  attributes: ['id', 'name'] },
];

// Service Functions

/**
 * Enforce status transition rules.
 * Throws 400 if transition is not allowed.
 */
const assertValidTransition = (currentStatus, newStatus) => {
  if (currentStatus === newStatus) return; // no change — allow
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw createError(
      400,
      'INVALID_STATUS_TRANSITION',
      `Cannot transition task from '${currentStatus}' to '${newStatus}'. ` +
        `Allowed transitions: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`
    );
  }
};

/**
 * Verify assignee belongs to the same org.
 */
const assertAssigneeBelongsToOrg = async (assigneeId, organizationId) => {
  const assignee = await User.findOne({ where: { id: assigneeId, organizationId, isActive: true } });
  if (!assignee) {
    throw createError(400, 'INVALID_ASSIGNEE', 'Assignee not found in this organization');
  }
  return assignee;
};

/**
 * Verify project belongs to the same org.
 */
const assertProjectBelongsToOrg = async (projectId, organizationId) => {
  const project = await Project.findOne({ where: { id: projectId, organizationId, isActive: true } });
  if (!project) {
    throw createError(400, 'INVALID_PROJECT', 'Project not found or is inactive');
  }
  return project;
};

// Exported Service Methods

/**
 * List tasks with filtering, pagination and Redis caching.
 *
 * Caching strategy:
 *   - Cache key: tasks:assignee:<assigneeId>:<serialized-query>
 *   - TTL: 5 minutes
 *   - Invalidation: any write on tasks belonging to that assignee clears their cache
 *
 * MEMBER role: can only see tasks assigned to them.
 * ADMIN/MANAGER: can see all tasks in org with optional assignee filter.
 */
const listTasks = async (user, query) => {
  const { page = 1, limit = 20, status, priority, assigneeId } = query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = { organizationId: user.organizationId };

  // MEMBER — scope to own tasks only
  const effectiveAssigneeId = user.role === 'MEMBER' ? user.id : assigneeId;
  if (effectiveAssigneeId) where.assigneeId = effectiveAssigneeId;

  if (status)   where.status   = status;
  if (priority) where.priority = priority;

  // Build cache key
  const cacheKey = buildAssigneeCacheKey(
    effectiveAssigneeId || 'all',
    `${page}:${limit}:${status || ''}:${priority || ''}:${user.organizationId}`
  );

  // Try cache first
  const cached = await getCache(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const { count, rows } = await Task.findAndCountAll({
    where,
    include: TASK_INCLUDES,
    limit: parseInt(limit),
    offset,
    order: [
      ['dueDate', 'ASC'],
      ['priority', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });

  const result = {
    tasks: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
    },
  };

  // Cache the result
  await setCache(cacheKey, result, 300); // 5 minutes TTL

  return { ...result, fromCache: false };
};

/**
 * Get a single task by ID.
 * MEMBER: only if assigned to them.
 */
const getTask = async (user, taskId) => {
  const task = await Task.findOne({
    where: { id: taskId, organizationId: user.organizationId },
    include: TASK_INCLUDES,
  });

  if (!task) throw createError(404, 'TASK_NOT_FOUND', 'Task not found');

  // MEMBER scope enforcement
  if (user.role === 'MEMBER' && task.assigneeId !== user.id) {
    throw createError(403, 'FORBIDDEN', 'You can only view tasks assigned to you');
  }

  return task;
};

/**
 * Create a task.
 * ADMIN | MANAGER only.
 */
const createTask = async (user, body) => {
  const { title, description, priority, dueDate, projectId, assigneeId } = body;

  await assertProjectBelongsToOrg(projectId, user.organizationId);
  if (assigneeId) await assertAssigneeBelongsToOrg(assigneeId, user.organizationId);

  const task = await Task.create({
    title,
    description,
    priority: priority || 'MEDIUM',
    status: 'TODO',
    dueDate: dueDate || null,
    projectId,
    assigneeId: assigneeId || null,
    createdById: user.id,
    organizationId: user.organizationId,
  });

  // Invalidate assignee cache
  await invalidateAssigneeCache(assigneeId);

  // Reload with associations
  return Task.findByPk(task.id, { include: TASK_INCLUDES });
};

/**
 * Update task fields (not status — that uses updateTaskStatus).
 * ADMIN | MANAGER: can update all fields.
 * MEMBER: cannot update via this route (only status via updateTaskStatus).
 */
const updateTask = async (user, taskId, body) => {
  const task = await Task.findOne({
    where: { id: taskId, organizationId: user.organizationId },
  });
  if (!task) throw createError(404, 'TASK_NOT_FOUND', 'Task not found');

  const { title, description, priority, dueDate, assigneeId, projectId } = body;

  if (projectId) await assertProjectBelongsToOrg(projectId, user.organizationId);
  if (assigneeId !== undefined && assigneeId !== null) {
    await assertAssigneeBelongsToOrg(assigneeId, user.organizationId);
  }

  const oldAssigneeId = task.assigneeId;

  await task.update({
    ...(title       !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(priority    !== undefined && { priority }),
    ...(dueDate     !== undefined && { dueDate }),
    ...(assigneeId  !== undefined && { assigneeId }),
    ...(projectId   !== undefined && { projectId }),
  });

  // Invalidate both old and new assignee caches
  await invalidateAssigneeCache(oldAssigneeId);
  if (assigneeId && assigneeId !== oldAssigneeId) {
    await invalidateAssigneeCache(assigneeId);
  }

  return Task.findByPk(task.id, { include: TASK_INCLUDES });
};

/**
 * Update task status with transition enforcement.
 *
 * Rules (from assignment):
 *   - Only the assignee OR a MANAGER/ADMIN can advance a task's status
 *   - Transitions: TODO → IN_PROGRESS → IN_REVIEW → DONE
 *                  Any active state → BLOCKED
 */
const updateTaskStatus = async (user, taskId, newStatus) => {
  const task = await Task.findOne({
    where: { id: taskId, organizationId: user.organizationId },
    include: TASK_INCLUDES,
  });
  if (!task) throw createError(404, 'TASK_NOT_FOUND', 'Task not found');

  // Permission: assignee OR MANAGER/ADMIN
  const isAssignee = task.assigneeId === user.id;
  const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(user.role);

  if (!isAssignee && !isManagerOrAdmin) {
    throw createError(
      403,
      'FORBIDDEN',
      'Only the task assignee or a MANAGER/ADMIN can change task status'
    );
  }

  // Enforce transition rules
  assertValidTransition(task.status, newStatus);

  await task.update({ status: newStatus });

  // Invalidate assignee cache
  await invalidateAssigneeCache(task.assigneeId);

  return Task.findByPk(task.id, { include: TASK_INCLUDES });
};

/**
 * Delete a task.
 * ADMIN only.
 */
const deleteTask = async (user, taskId) => {
  const task = await Task.findOne({
    where: { id: taskId, organizationId: user.organizationId },
  });
  if (!task) throw createError(404, 'TASK_NOT_FOUND', 'Task not found');

  const assigneeId = task.assigneeId;
  await task.destroy();

  // Invalidate cache
  await invalidateAssigneeCache(assigneeId);
};

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
