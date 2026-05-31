
const taskService = require('./tasks.service');

/**
 * GET /tasks
 * MEMBER: own tasks only | ADMIN/MANAGER: all org tasks (filterable)
 */
const listTasks = async (req, res, next) => {
  try {
    const result = await taskService.listTasks(req.user, req.query);
    return res.json({
      status: 200,
      data: result,
      ...(result.fromCache && { meta: { cache: 'HIT' } }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /tasks/:id
 */
const getTask = async (req, res, next) => {
  try {
    const task = await taskService.getTask(req.user, req.params.id);
    return res.json({ status: 200, data: { task } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /tasks
 * ADMIN | MANAGER only
 */
const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.user, req.body);
    return res.status(201).json({
      status: 201,
      message: 'Task created',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /tasks/:id
 * ADMIN | MANAGER only — update fields (title, description, priority, dueDate, assigneeId, projectId)
 */
const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.user, req.params.id, req.body);
    return res.json({
      status: 200,
      message: 'Task updated',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /tasks/:id/status
 * Assignee OR MANAGER/ADMIN — status transitions only
 */
const updateTaskStatus = async (req, res, next) => {
  try {
    const task = await taskService.updateTaskStatus(req.user, req.params.id, req.body.status);
    return res.json({
      status: 200,
      message: `Task status updated to '${task.status}'`,
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /tasks/:id
 * ADMIN only
 */
const deleteTask = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.user, req.params.id);
    return res.json({ status: 200, message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listTasks, getTask, createTask, updateTask, updateTaskStatus, deleteTask };
