const jwt = require('jsonwebtoken');

// Simple in-memory user store (replace with database in production)
const users = new Map();
users.set('admin', {
  id: '1',
  username: 'admin',
  password: '$2a$10$X8qZ9Z9Z9Z9Z9Z9Z9Z9Z9e', // bcrypt hash placeholder
  role: 'admin'
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = {
  authenticateToken,
  generateToken,
  users
};
