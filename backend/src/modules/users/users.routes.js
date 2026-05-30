'use strict';

const { Router } = require('express');
const { param, body, query } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const controller = require('./users.controller');

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /users — ADMIN only
router.get('/', requireRole('ADMIN'), controller.listUsers);

// GET /users/:id — ADMIN or self
router.get('/:id', validate([param('id').isUUID()]), controller.getUser);

// PATCH /users/:id — ADMIN only (update role, isActive)
router.patch(
  '/:id',
  requireRole('ADMIN'),
  validate([
    param('id').isUUID(),
    body('role').optional().isIn(['ADMIN', 'MANAGER', 'MEMBER']),
    body('isActive').optional().isBoolean(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
  ]),
  controller.updateUser
);

// DELETE /users/:id — ADMIN only (soft delete)
router.delete('/:id', requireRole('ADMIN'), validate([param('id').isUUID()]), controller.deleteUser);

module.exports = router;
