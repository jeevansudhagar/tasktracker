'use strict';

/**
 * Role hierarchy:
 *   ADMIN   — full access: manage users, projects, tasks
 *   MANAGER — manage projects and tasks, assign members; cannot manage users
 *   MEMBER  — view and update only tasks assigned to them
 *
 * RBAC is enforced at middleware level, NOT inside controller logic.
 */

const ROLE_HIERARCHY = {
  ADMIN: 3,
  MANAGER: 2,
  MEMBER: 1,
};

/**
 * requireRole(...roles)
 * Middleware factory — checks req.user.role against allowed roles.
 *
 * Usage:
 *   router.delete('/:id', authenticate, requireRole('ADMIN'), handler)
 *   router.post('/',      authenticate, requireRole('ADMIN', 'MANAGER'), handler)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
};

/**
 * requireMinRole(role)
 * Allows the given role and any higher role in hierarchy.
 *
 * Example: requireMinRole('MANAGER') → allows MANAGER and ADMIN
 */
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: `Access denied. Minimum required role: ${minRole}`,
      });
    }

    next();
  };
};

module.exports = { requireRole, requireMinRole, ROLE_HIERARCHY };
