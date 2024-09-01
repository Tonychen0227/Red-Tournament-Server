module.exports = function ensureRunner(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'runner') {
        return next();
    } else {
        res.status(403).render('error', { 
            title: 'Access Denied',
            message: 'Access denied. You must be a runner to view this page.',
            username: req.user ? req.user.username : null
        });
    }
};