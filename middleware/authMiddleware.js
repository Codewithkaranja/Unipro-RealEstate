const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

// Secret key for signing JWTs
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

module.exports = async function authMiddleware(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided, authorization denied' });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach admin info to request
        const admin = await Admin.findById(decoded.id).select('-password');
        if (!admin) {
            return res.status(401).json({ message: 'Admin not found, authorization denied' });
        }

        req.admin = admin; // accessible in controller
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: 'Token is not valid' });
    }
};
