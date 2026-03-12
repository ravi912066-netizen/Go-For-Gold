const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(courses);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { questions: true, assignments: true, materials: true }
        });
        if (!course) return res.status(404).json({ error: 'Not found' });
        res.json(course);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { title, description, icon } = req.body;
        const course = await prisma.course.create({ data: { title, description, icon } });
        res.json(course);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
    try {
        const course = await prisma.course.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(course);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        await prisma.course.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
