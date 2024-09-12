module.exports = (req, res, next) => {
    const apiKey = req.headers['authorization'];
    const secretKey = `Bearer ${process.env.SECRET_KEY}`;

    if (!apiKey || apiKey !== secretKey) {
        return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
    }

    next();
};