'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const controller = require('./tasks.controller');

const router = Router();

// All task routes require authentication
router.use(authenticate);

// ─── Validation Rules ─────────────────────────────────────────────────────────

const taskId = param('id').isUUID().withMessage('Invalid task ID');

const createRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 2, max: 255 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  body('dueDate')
    .optional()
    .isDate().withMessage('dueDate must be a valid date (YYYY-MM-DD)')
    .custom((val) => {
      if (val && new Date(val) < new Date()) {
        throw new Error('due_date must be a future date');
      }
      return true;
    }),
  body('projectId')
    .notEmpty().withMessage('projectId is required')
    .isUUID().withMessage('projectId must be a valid UUID'),
  body('assigneeId')
    .optional()
    .isUUID().withMessage('assigneeId must be a valid UUID'),
];

const updateRules = [
  taskId,
  body('title').optional().trim().isLength({ min: 2, max: 255 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
  body('dueDate')
    .optional()
    .isDate()
    .custom((val) => {
      if (val && new Date(val) < new Date()) throw new Error('due_date must be a future date');
      return true;
    }),
  body('assigneeId').optional().isUUID(),
  body('projectId').optional().isUUID(),
];

const statusRules = [
  taskId,
  body('status')
    .notEmpty().withMessage('status is required')
    .isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'])
    .withMessage('Invalid status value'),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']),
  query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
  query('assigneeId').optional().isUUID(),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /tasks — all roles (MEMBER scoped to own)
router.get('/', validate(listRules), controller.listTasks);

// GET /tasks/:id
router.get('/:id', validate([taskId]), controller.getTask);

// POST /tasks — ADMIN | MANAGER
router.post('/', requireRole('ADMIN', 'MANAGER'), validate(createRules), controller.createTask);

// PATCH /tasks/:id — ADMIN | MANAGER (fields update)
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), validate(updateRules), controller.updateTask);

// PATCH /tasks/:id/status — assignee or ADMIN/MANAGER (enforced in service)
router.patch('/:id/status', validate(statusRules), controller.updateTaskStatus);

// DELETE /tasks/:id — ADMIN only
router.delete('/:id', requireRole('ADMIN'), validate([taskId]), controller.deleteTask);

module.exports = router;
