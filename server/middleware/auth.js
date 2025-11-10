// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  // Get user role from request headers
  const userRole = req.headers['x-user-role'];

  if (!userRole) {
    return res.status(401).json({
      error: 'Unauthorized: User role not provided',
    });
  }

  if (userRole !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: Admin access required',
    });
  }

  next();
};

module.exports = { requireAdmin };

