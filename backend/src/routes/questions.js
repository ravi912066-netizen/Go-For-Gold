const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET all questions
router.get('/', async (req, res) => {
    try {
        const { difficulty, courseId, search } = req.query;
        const where = {};
        if (difficulty) where.difficulty = difficulty;
        if (courseId) where.courseId = parseInt(courseId);
        if (search) where.title = { contains: search };
        const questions = await prisma.question.findMany({ where, orderBy: { createdAt: 'desc' }, include: { course: true } });
        res.json(questions);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET question of the day
router.get('/qotd', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const qotd = await prisma.question.findFirst({
            where: { isQotd: true, qotdDate: { gte: today, lt: tomorrow } }
        });
        if (!qotd) {
            // Fallback: latest QOTD
            const latest = await prisma.question.findFirst({ where: { isQotd: true }, orderBy: { qotdDate: 'desc' } });
            return res.json(latest);
        }
        res.json(qotd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single question
router.get('/:id', async (req, res) => {
    try {
        const q = await prisma.question.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { course: true }
        });
        if (!q) return res.status(404).json({ error: 'Not found' });
        res.json(q);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create question (admin)
router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { title, statement, difficulty, tags, timeLimit, memoryLimit, starterCode, testcases, isQotd, qotdDate, deadline, courseId } = req.body;
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
        const q = await prisma.question.create({
            data: {
                title, slug, statement, difficulty: difficulty || 'Medium',
                tags: JSON.stringify(tags || []),
                timeLimit: timeLimit || 2,
                memoryLimit: memoryLimit || 256,
                starterCode, testcases: JSON.stringify(testcases || []),
                isQotd: !!isQotd,
                qotdDate: qotdDate ? new Date(qotdDate) : null,
                deadline: deadline ? new Date(deadline) : null,
                courseId: courseId ? parseInt(courseId) : null
            }
        });
        res.json(q);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update question (admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.tags) data.tags = JSON.stringify(data.tags);
        if (data.testcases) data.testcases = JSON.stringify(data.testcases);
        if (data.qotdDate) data.qotdDate = new Date(data.qotdDate);
        if (data.deadline) data.deadline = new Date(data.deadline);
        const q = await prisma.question.update({ where: { id: parseInt(req.params.id) }, data });
        res.json(q);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE question (admin)
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        await prisma.question.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
