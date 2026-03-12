const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

// Get all external resources (Admins see all, students might see specific types)
router.get('/', auth, async (req, res) => {
    try {
        const resources = await prisma.externalResource.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(resources);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add a new resource (Admin only)
router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { title, url, type } = req.body;
        if (!title || !url) return res.status(400).json({ error: 'Title and URL are required' });

        const resource = await prisma.externalResource.create({
            data: { title, url, type: type || 'newton_playground', addedBy: req.user.id }
        });
        res.json(resource);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a resource (Admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        await prisma.externalResource.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Resource deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
