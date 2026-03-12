const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const https = require('https');
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

// GET upcoming contests from external platforms (CF, LC, AC, etc.)
router.get('/external', async (req, res) => {
    try {
        // Using Kontests API for convenience
        const data = await fetchJSON('https://kontests.net/api/v1/all');
        const platforms = ['CodeForces', 'LeetCode', 'AtCoder', 'CodeChef'];
        const upcoming = data.filter(c => platforms.includes(c.site) && new Date(c.start_time) > new Date());
        res.json(upcoming);
    } catch (e) {
        // Fallback or empty if API fails
        res.json([]);
    }
});

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'GoForGold/1.0' } }, (resp) => {
            let data = '';
            resp.on('data', (chunk) => data += chunk);
            resp.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

module.exports = router;
