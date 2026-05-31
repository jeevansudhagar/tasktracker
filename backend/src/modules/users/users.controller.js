
const { User } = require('../../models');
const { createError } = require('../../middleware/errorHandler');
const { Op } = require('sequelize');

const SAFE_ATTRIBUTES = { exclude: ['password', 'refreshToken'] };

/**
 * GET /users
 * ADMIN: list all users in organization
 */
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { organizationId: req.user.organizationId };
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: SAFE_ATTRIBUTES,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      status: 200,
      data: {
        users: rows,
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
 * GET /users/:id
 * ADMIN or self
 */
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Non-admin can only view themselves
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      throw createError(403, 'FORBIDDEN', 'You can only view your own profile');
    }

    const user = await User.findOne({
      where: { id, organizationId: req.user.organizationId },
      attributes: SAFE_ATTRIBUTES,
      include: [{ association: 'organization', attributes: ['id', 'name', 'slug'] }],
    });

    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found');

    return res.json({ status: 200, data: { user } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /users/:id
 * ADMIN: update role / isActive / name
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, isActive, name } = req.body;

    const user = await User.findOne({
      where: { id, organizationId: req.user.organizationId },
    });
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found');

    // Prevent self-demotion
    if (id === req.user.id && role && role !== req.user.role) {
      throw createError(400, 'SELF_ROLE_CHANGE', 'Admins cannot change their own role');
    }

    await user.update({ role, isActive, name });

    return res.json({
      status: 200,
      message: 'User updated',
      data: { user: user.toSafeObject() },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /users/:id
 * ADMIN: soft delete (set isActive=false)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      throw createError(400, 'SELF_DELETE', 'Admins cannot delete their own account');
    }

    const user = await User.findOne({
      where: { id, organizationId: req.user.organizationId },
    });
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found');

    await user.update({ isActive: false });

    return res.json({ status: 200, message: 'User deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, getUser, updateUser, deleteUser };
