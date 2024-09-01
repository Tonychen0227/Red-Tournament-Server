module.exports = function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) {
        return next();
    } else {
        res.status(403).render('error', { 
            title: 'Access Denied',
            message: 'Access denied. You must be an admin to view this page.',
            username: req.user ? req.user.username : null
        });
    }
};