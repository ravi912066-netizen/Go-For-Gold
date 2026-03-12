const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const { filter } = req.query; // global | college | course
        const entries = await prisma.leaderboardEntry.findMany({
            orderBy: [{ totalXp: 'desc' }, { totalSolved: 'desc' }],
            take: 100,
            include: {
                user: { select: { id: true, name: true, college: true, photoUrl: true, currentStreak: true } }
            }
        });
        const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
        res.json(ranked);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Today's fastest - users who solved QOTD today
router.get('/todays-fastest', async (req, res) => {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const qotd = await prisma.question.findFirst({ where: { isQotd: true, qotdDate: { gte: today, lt: tomorrow } } });
        if (!qotd) return res.json([]);
        const subs = await prisma.submission.findMany({
            where: { questionId: qotd.id, status: 'Accepted', createdAt: { gte: today } },
            orderBy: { createdAt: 'asc' },
            take: 10,
            include: { user: { select: { id: true, name: true, college: true, photoUrl: true } } }
        });
        res.json(subs.map((s, i) => ({ ...s, rank: i + 1 })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
