const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

// Admin stats overview
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const [users, questions, submissions, courses] = await Promise.all([
            prisma.user.count({ where: { role: 'student' } }),
            prisma.question.count(),
            prisma.submission.count({ where: { status: 'Accepted' } }),
            prisma.course.count()
        ]);
        res.json({ users, questions, submissions, courses });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all students
router.get('/students', auth, adminOnly, async (req, res) => {
    try {
        const students = await prisma.user.findMany({
            where: { role: 'student' },
            select: { id: true, name: true, email: true, college: true, xp: true, currentStreak: true, createdAt: true },
            orderBy: { xp: 'desc' }
        });
        res.json(students);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Google Sheets sync (stub)
router.post('/sync-sheet', auth, adminOnly, async (req, res) => {
    try {
        const { sheetUrl } = req.body;
        // In production: parse Google Sheets API
        // For now: return demo data
        res.json({
            synced: 0,
            message: 'Google Sheets sync requires API key configuration. Connect via environment variable GOOGLE_API_KEY.'
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
