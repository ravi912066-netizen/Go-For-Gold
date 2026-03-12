const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/:courseId', async (req, res) => {
    try {
        const materials = await prisma.material.findMany({
            where: { courseId: parseInt(req.params.courseId) },
            orderBy: { createdAt: 'desc' }
        });
        res.json(materials);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { title, type, url, courseId } = req.body;
        const m = await prisma.material.create({ data: { title, type, url, courseId: parseInt(courseId) } });
        res.json(m);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        await prisma.material.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
