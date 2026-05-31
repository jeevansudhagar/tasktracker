
const { createClient } = require('redis');

let redisClient = null;
let isConnected = false;

const connectRedis = async () => {
  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.warn('  Redis max reconnect attempts reached. Running without cache.');
          return false;
        }
        return Math.min(retries * 100, 3000);
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  client.on('error', (err) => {
    isConnected = false;
    // Only log first error, not every retry
    if (err.code === 'ECONNREFUSED') {
      console.warn('  Redis not available — caching disabled');
    }
  });

  client.on('connect', () => {
    isConnected = true;
    console.log(' Redis connected');
  });

  client.on('end', () => {
    isConnected = false;
  });

  try {
    await client.connect();
    redisClient = client;
  } catch (err) {
    console.warn('  Redis connection failed — app will run without cache');
    redisClient = null;
  }

  return client;
};

/**
 * Get a value from cache. Returns null if Redis unavailable.
 */
const getCache = async (key) => {
  if (!redisClient || !isConnected) return null;
  try {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

/**
 * Set a value in cache with optional TTL (seconds).
 */
const setCache = async (key, value, ttlSeconds = 300) => {
  if (!redisClient || !isConnected) return;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // silently fail
  }
};

/**
 * Delete one or more cache keys.
 */
const deleteCache = async (...keys) => {
  if (!redisClient || !isConnected) return;
  try {
    await redisClient.del(keys);
  } catch {
    // silently fail
  }
};

/**
 * Delete all keys matching a pattern. Use carefully.
 * Example: deletePattern('tasks:assignee:*')
 */
const deletePattern = async (pattern) => {
  if (!redisClient || !isConnected) return;
  try {
    let cursor = 0;
    do {
      const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      if (reply.keys.length > 0) {
        await redisClient.del(reply.keys);
      }
    } while (cursor !== 0);
  } catch {
    // silently fail
  }
};

module.exports = { connectRedis, getCache, setCache, deleteCache, deletePattern };
