const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const contests = await prisma.contest.findMany({ orderBy: { startTime: 'desc' } });
        res.json(contests);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { title, startTime, duration, problems } = req.body;
        const c = await prisma.contest.create({
            data: { title, startTime: new Date(startTime), duration: parseInt(duration), problems: JSON.stringify(problems || []) }
        });
        res.json(c);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/activate', auth, adminOnly, async (req, res) => {
    try {
        const c = await prisma.contest.update({ where: { id: parseInt(req.params.id) }, data: { isActive: true } });
        res.json(c);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
