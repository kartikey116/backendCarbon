// In middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the decoded user info to the request object
        req.user = decoded; 

        // Move to the next function in the chain
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
};

module.exports = authMiddleware;