
const { Project, Task, User } = require('../../models');
const { createError } = require('../../middleware/errorHandler');

/**
 * GET /projects
 * List all projects in the org (all roles)
 */
const listProjects = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { organizationId: req.user.organizationId };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const { count, rows } = await Project.findAndCountAll({
      where,
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      status: 200,
      data: {
        projects: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /projects/:id
 * Get project with task summary (all roles)
 */
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!project) throw createError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    // Task counts per status
    const taskCounts = await Task.findAll({
      where: { projectId: project.id },
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    return res.json({
      status: 200,
      data: { project, taskCounts },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /projects
 * ADMIN | MANAGER only
 */
const createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const project = await Project.create({
      name,
      description,
      organizationId: req.user.organizationId,
      createdById: req.user.id,
    });

    return res.status(201).json({
      status: 201,
      message: 'Project created',
      data: { project },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /projects/:id
 * ADMIN | MANAGER only
 */
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!project) throw createError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const { name, description, isActive } = req.body;
    await project.update({ name, description, isActive });

    return res.json({
      status: 200,
      message: 'Project updated',
      data: { project },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /projects/:id
 * ADMIN only — soft delete
 */
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!project) throw createError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    // Check for active (non-DONE) tasks
    const activeTasks = await Task.count({
      where: { projectId: project.id, status: { [require('sequelize').Op.ne]: 'DONE' } },
    });

    if (activeTasks > 0) {
      throw createError(
        400,
        'PROJECT_HAS_ACTIVE_TASKS',
        `Cannot delete project with ${activeTasks} active task(s). Complete or reassign them first.`
      );
    }

    await project.update({ isActive: false });

    return res.json({ status: 200, message: 'Project deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject };
