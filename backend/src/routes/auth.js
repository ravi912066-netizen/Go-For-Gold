const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, college, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) return res.status(409).json({ error: 'Email already registered' });
        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, password: hashed, college, role: role === 'admin' ? 'admin' : 'student' }
        });
        // Create leaderboard entry
        await prisma.leaderboardEntry.create({ data: { userId: user.id } });
        // Award first join badge
        const badge = await prisma.badge.findUnique({ where: { key: 'welcome' } });
        if (badge) await prisma.userBadge.create({ data: { userId: user.id, badgeId: badge.id } });
        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, college: user.college } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, college: user.college } });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
