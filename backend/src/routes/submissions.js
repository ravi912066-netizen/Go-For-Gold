const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const prisma = new PrismaClient();

const XP_MAP = { Easy: 10, Medium: 20, Hard: 40 };

// POST submit code result
router.post('/', auth, async (req, res) => {
    try {
        const { questionId, code, language, status, runtime, memory, output } = req.body;
        const q = await prisma.question.findUnique({ where: { id: parseInt(questionId) } });
        if (!q) return res.status(404).json({ error: 'Question not found' });

        const sub = await prisma.submission.create({
            data: {
                userId: req.user.id, questionId: parseInt(questionId),
                code, language, status: status || 'Pending', runtime, memory, output
            }
        });

        // If accepted, update XP, streak, leaderboard
        if (status === 'Accepted') {
            const xpGain = XP_MAP[q.difficulty] || 10;
            const now = new Date();
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });

            // Streak logic
            let newStreak = user.currentStreak;
            const lastSolved = user.lastSolvedAt;
            if (lastSolved) {
                const dayDiff = Math.floor((now - lastSolved) / (1000 * 60 * 60 * 24));
                if (dayDiff === 1) newStreak += 1;
                else if (dayDiff > 1) newStreak = 1;
            } else {
                newStreak = 1;
            }
            const newLongest = Math.max(user.longestStreak, newStreak);

            await prisma.user.update({
                where: { id: req.user.id },
                data: { xp: { increment: xpGain }, currentStreak: newStreak, longestStreak: newLongest, lastSolvedAt: now }
            });

            // Update leaderboard
            const totalSolved = await prisma.submission.count({ where: { userId: req.user.id, status: 'Accepted' } });
            await prisma.leaderboardEntry.upsert({
                where: { userId: req.user.id },
                update: { totalSolved, totalXp: user.xp + xpGain },
                create: { userId: req.user.id, totalSolved, totalXp: xpGain }
            });

            // Award badges
            await checkBadges(req.user.id, totalSolved, newStreak);
        }

        res.json(sub);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

async function checkBadges(userId, totalSolved, streak) {
    const checks = [
        { condition: totalSolved >= 1, key: 'first_solve' },
        { condition: totalSolved >= 100, key: 'problems_100' },
        { condition: streak >= 7, key: 'streak_7' },
        { condition: streak >= 30, key: 'streak_30' },
    ];
    for (const check of checks) {
        if (check.condition) {
            const badge = await prisma.badge.findUnique({ where: { key: check.key } });
            if (badge) {
                await prisma.userBadge.upsert({
                    where: { userId_badgeId: { userId, badgeId: badge.id } },
                    update: {},
                    create: { userId, badgeId: badge.id }
                });
            }
        }
    }
}

// GET user's submissions for a question
router.get('/question/:questionId', auth, async (req, res) => {
    try {
        const subs = await prisma.submission.findMany({
            where: { userId: req.user.id, questionId: parseInt(req.params.questionId) },
            orderBy: { createdAt: 'desc' }
        });
        res.json(subs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all submissions for user
router.get('/me', auth, async (req, res) => {
    try {
        const subs = await prisma.submission.findMany({
            where: { userId: req.user.id },
            include: { question: { select: { title: true, difficulty: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(subs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
