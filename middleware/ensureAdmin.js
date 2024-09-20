module.exports = function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) {
        return next();
    } else {
        res.status(403).json({ 
            error: 'Access denied. You must be an admin to perform this action.'
        });
    }
};