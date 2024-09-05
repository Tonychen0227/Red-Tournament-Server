module.exports = function ensureRunner(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'runner') {
        return next();
    } else {
        res.status(403).json({
            title: 'Access Denied',
            message: 'Access denied. You must be a runner to perform this action or view this page.',
            username: req.user ? req.user.username : null
        });
    }
};