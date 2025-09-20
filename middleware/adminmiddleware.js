// In middleware/adminMiddleware.js
const isAdmin = (req, res, next) => {
    // This runs AFTER the authMiddleware, so we have access to req.user
    if (req.user && req.user.role === 'ADMIN') {
        next(); // User is an admin, proceed
    } else {
        res.status(403).json({ error: 'Forbidden: Requires admin access.' });
    }
};

module.exports = isAdmin;