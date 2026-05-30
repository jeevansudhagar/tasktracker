'use strict';

const jwt = require('jsonwebtoken');
const { User, Organization } = require('../../models');
const { createError } = require('../../middleware/errorHandler');

/**
 * Generate access + refresh token pair
 */
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );

  return { accessToken, refreshToken };
};

/**
 * POST /auth/register
 * Register a new user (creates org if not provided)
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, organizationId, organizationName, role } = req.body;

    // Check duplicate email
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      throw createError(409, 'EMAIL_EXISTS', 'Email is already registered');
    }

    let orgId = organizationId;

    // If no org provided, create a new org from organizationName
    if (!orgId) {
      if (!organizationName) {
        throw createError(400, 'ORG_REQUIRED', 'organizationId or organizationName is required');
      }
      const slug = organizationName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 100);

      const slugExists = await Organization.findOne({ where: { slug } });
      if (slugExists) {
        throw createError(409, 'ORG_EXISTS', 'Organization with this name already exists');
      }

      const org = await Organization.create({ name: organizationName, slug });
      orgId = org.id;
    } else {
      // Verify org exists
      const org = await Organization.findByPk(orgId);
      if (!org) throw createError(404, 'ORG_NOT_FOUND', 'Organization not found');
    }

    // Only ADMIN can create ADMIN users — default new users to MEMBER
    const safeRole = role && ['ADMIN', 'MANAGER'].includes(role) ? role : 'MEMBER';

    const user = await User.create({
      name,
      email,
      password,
      role: safeRole,
      organizationId: orgId,
    });

    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in DB
    await user.update({ refreshToken, lastLoginAt: new Date() });

    return res.status(201).json({
      status: 201,
      message: 'Registration successful',
      data: {
        user: user.toSafeObject(),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const { accessToken, refreshToken } = generateTokens(user);
    await user.update({ refreshToken, lastLoginAt: new Date() });

    return res.json({
      status: 200,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/refresh
 * Issue new access token using refresh token
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw createError(400, 'REFRESH_TOKEN_REQUIRED', 'refreshToken is required');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      throw createError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }

    const user = await User.findOne({
      where: { id: decoded.id, refreshToken, isActive: true },
    });

    if (!user) {
      throw createError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token has been revoked or already used');
    }

    // Rotate refresh token
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await user.update({ refreshToken: newRefreshToken });

    return res.json({
      status: 200,
      message: 'Token refreshed',
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/logout
 * Invalidate refresh token
 */
const logout = async (req, res, next) => {
  try {
    // req.user is set by authenticate middleware
    await User.update(
      { refreshToken: null },
      { where: { id: req.user.id } }
    );

    return res.json({ status: 200, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/me
 * Return current authenticated user
 */
const me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'refreshToken'] },
      include: [{ association: 'organization', attributes: ['id', 'name', 'slug'] }],
    });

    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found');

    return res.json({ status: 200, data: { user } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, me };
