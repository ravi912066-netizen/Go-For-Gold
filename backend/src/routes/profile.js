const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const https = require('https');
const prisma = new PrismaClient();

router.get('/:id', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { externalProfile: true, badges: { include: { badge: true } }, leaderboard: true }
        });
        if (!user) return res.status(404).json({ error: 'Not found' });
        const { password, ...safe } = user;
        res.json(safe);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/me', auth, async (req, res) => {
    try {
        const { name, college, bio, photoUrl, githubUrl } = req.body;
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { name, college, bio, photoUrl, githubUrl }
        });
        const { password, ...safe } = user;
        res.json(safe);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/external', auth, async (req, res) => {
    try {
        const { codeforcesId, leetcodeId, atcoderId } = req.body;
        const ext = await prisma.externalProfile.upsert({
            where: { userId: req.user.id },
            update: { codeforcesId, leetcodeId, atcoderId },
            create: { userId: req.user.id, codeforcesId, leetcodeId, atcoderId }
        });
        res.json(ext);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sync external stats
router.post('/sync-stats', auth, async (req, res) => {
    try {
        const ext = await prisma.externalProfile.findUnique({ where: { userId: req.user.id } });
        if (!ext) return res.status(404).json({ error: 'No external profile linked' });

        let updates = { lastSynced: new Date() };

        // Fetch Codeforces stats
        if (ext.codeforcesId) {
            try {
                const cfData = await fetchJSON(`https://codeforces.com/api/user.info?handles=${ext.codeforcesId}`);
                if (cfData.status === 'OK') {
                    const u = cfData.result[0];
                    updates.cfRating = u.rating || 0;
                    updates.cfRank = u.rank || 'Unranked';
                }
                const cfContests = await fetchJSON(`https://codeforces.com/api/user.rating?handle=${ext.codeforcesId}`);
                if (cfContests.status === 'OK') updates.cfContests = cfContests.result.length;
            } catch { }
        }

        // Fetch LeetCode stats via unofficial API
        if (ext.leetcodeId) {
            try {
                const lcData = await fetchJSON(`https://leetcode-stats-api.herokuapp.com/${ext.leetcodeId}`);
                if (lcData.status === 'success') {
                    updates.lcSolved = lcData.totalSolved || 0;
                    updates.lcEasy = lcData.easySolved || 0;
                    updates.lcMedium = lcData.mediumSolved || 0;
                    updates.lcHard = lcData.hardSolved || 0;
                }
            } catch { }
        }
        // Fetch AtCoder stats
        if (ext.atcoderId) {
            try {
                const acData = await fetchJSON(`https://atcoder.jp/users/${ext.atcoderId}/history/json`);
                if (Array.isArray(acData)) {
                    updates.acRating = acData.length > 0 ? acData[acData.length - 1].NewRating : 0;
                    updates.acContests = acData.length;
                }
            } catch { }
        }

        const updated = await prisma.externalProfile.update({ where: { userId: req.user.id }, data: updates });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
