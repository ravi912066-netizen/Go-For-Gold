const router = require('express').Router();
const https = require('https');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

// ─── Helper: fetch raw HTML/JSON from URL ────────────────────────────────────
function fetchURL(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: { 'User-Agent': 'GoForGold/1.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ data, status: res.statusCode, headers: res.headers }));
        }).on('error', reject);
    });
}

// ─── POST /api/import/url ─────────────────────────────────────────────────────
// Admin pastes a problem URL (Newton School, Codeforces, LeetCode, AOC etc.)
// Returns parsed question data (not saved yet — admin reviews then saves)
router.post('/url', auth, adminOnly, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        let parsed = { title: '', statement: '', difficulty: 'Medium', tags: [], testcases: [], starterCode: '', source: url };

        // ── Newton School / my.newtonschool.co ────────────────────────────────
        if (url.includes('newtonschool')) {
            const { data: html } = await fetchURL(url);

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) parsed.title = titleMatch[1].replace(/\s*[\|\-].*$/, '').trim();

            // Extract problem statement from common selectors
            const stmtMatch = html.match(/class="[^"]*problem[^"]*statement[^"]*"[^>]*>([\s\S]+?)<\/div>/i)
                || html.match(/class="[^"]*problem-desc[^"]*"[^>]*>([\s\S]+?)<\/div>/i)
                || html.match(/"description"\s*:\s*"([^"]+)"/i);
            if (stmtMatch) {
                parsed.statement = stmtMatch[1].replace(/<[^>]+>/g, '').replace(/&#\d+;/g, ' ').trim().substring(0, 2000);
            }

            // Try to extract difficulty
            if (html.toLowerCase().includes('"easy"') || html.toLowerCase().includes('difficulty":"easy')) parsed.difficulty = 'Easy';
            else if (html.toLowerCase().includes('"hard"') || html.toLowerCase().includes('difficulty":"hard')) parsed.difficulty = 'Hard';

            if (!parsed.title) parsed.title = 'Imported from Newton School';
            if (!parsed.statement) parsed.statement = `Problem imported from: ${url}\n\n[Please add the full problem statement here]`;
        }

        // ── Codeforces ────────────────────────────────────────────────────────
        else if (url.includes('codeforces.com/problemset/problem') || url.includes('codeforces.com/contest')) {
            const urlParts = url.match(/\/problem\/(\d+)\/([A-Z])/i) || url.match(/contest\/(\d+)\/problem\/([A-Z])/i);
            if (urlParts) {
                const contestId = urlParts[1];
                const problemId = urlParts[2];
                try {
                    const cfResp = await fetchURL(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`);
                    const cfData = JSON.parse(cfResp.data);
                    if (cfData.status === 'OK') {
                        const prob = cfData.result?.problems?.find(p => p.index === problemId);
                        if (prob) {
                            parsed.title = `${prob.index}. ${prob.name}`;
                            parsed.tags = prob.tags || [];
                        }
                    }
                } catch { }
                if (!parsed.title) parsed.title = `CF ${contestId}${problemId}`;
                parsed.statement = `**Codeforces Problem** [${contestId}${problemId}](${url})\n\nOpen the problem on Codeforces to view the full statement.\n\n[Add the problem statement here]`;
            }
        }

        // ── LeetCode ─────────────────────────────────────────────────────────
        else if (url.includes('leetcode.com/problems')) {
            const slugMatch = url.match(/problems\/([a-z0-9-]+)/);
            if (slugMatch) {
                const slug = slugMatch[1];
                parsed.title = slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
                // LeetCode GraphQL
                try {
                    const gqlBody = JSON.stringify({
                        query: `query{ question(titleSlug:"${slug}"){ title difficulty content} }`
                    });
                    const lcResp = await new Promise((resolve, reject) => {
                        const req2 = https.request({
                            hostname: 'leetcode.com', path: '/graphql', method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Content-Length': gqlBody.length, 'User-Agent': 'GoForGold/1.0' }
                        }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
                        req2.on('error', reject);
                        req2.write(gqlBody); req2.end();
                    });
                    const lcData = JSON.parse(lcResp);
                    const q = lcData?.data?.question;
                    if (q) {
                        parsed.title = q.title || parsed.title;
                        parsed.difficulty = q.difficulty || 'Medium';
                        parsed.statement = (q.content || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().substring(0, 3000);
                    }
                } catch { }
                if (!parsed.statement) parsed.statement = `**LeetCode Problem**: [${parsed.title}](${url})\n\n[Add the problem statement here]`;
            }
        }

        // ── AtCoder ───────────────────────────────────────────────────────────
        else if (url.includes('atcoder.jp')) {
            const acMatch = url.match(/contests\/([^/]+)\/tasks\/([^/?]+)/);
            if (acMatch) {
                parsed.title = acMatch[2].replace(/_/g, ' ').split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
                parsed.statement = `**AtCoder Problem**: [${parsed.title}](${url})\n\n[Add the problem statement here]`;
            }
        }

        // ── Google Docs ───────────────────────────────────────────────────────
        else if (url.includes('docs.google.com/document')) {
            // Convert to export URL
            const docIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (docIdMatch) {
                const exportUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
                try {
                    const { data: text } = await fetchURL(exportUrl);
                    const lines = text.split('\n').filter(l => l.trim());
                    parsed.title = lines[0]?.substring(0, 100) || 'Google Doc Problem';
                    parsed.statement = lines.slice(1).join('\n').substring(0, 3000);
                } catch {
                    parsed.title = 'Google Doc Problem';
                    parsed.statement = `**Imported from Google Docs**: [View Doc](${url})\n\n[Add the problem statement here]`;
                }
            }
        }

        // ── Generic fallback ──────────────────────────────────────────────────
        else {
            try {
                const { data: html } = await fetchURL(url);
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                parsed.title = titleMatch ? titleMatch[1].replace(/\s*[\|\-].*$/, '').trim().substring(0, 100) : 'Imported Problem';
                parsed.statement = `Problem imported from: ${url}\n\n[Add the problem statement here]`;
            } catch {
                parsed.title = 'Imported Problem';
                parsed.statement = `Problem from: ${url}\n\n[Add the problem statement here]`;
            }
        }

        res.json({ success: true, parsed });
    } catch (e) {
        console.error('URL import error:', e.message);
        res.status(500).json({ error: 'Failed to import from URL: ' + e.message });
    }
});

// ─── POST /api/import/sheet ───────────────────────────────────────────────────
// Admin pastes a Google Sheet URL → parse rows → return question list
// Expected columns: Course | Title | Difficulty | Deadline | Tags | URL
router.post('/sheet', auth, adminOnly, async (req, res) => {
    const { sheetUrl } = req.body;
    if (!sheetUrl) return res.status(400).json({ error: 'Sheet URL required' });

    try {
        // Extract sheet ID
        const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (!idMatch) return res.status(400).json({ error: 'Invalid Google Sheets URL' });

        const sheetId = idMatch[0].split('/d/')[1];
        // Export as CSV (works for public sheets)
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

        const { data: csv } = await fetchURL(csvUrl);

        if (!csv || csv.includes('<html') || csv.includes('Sign in')) {
            return res.status(403).json({
                error: 'Sheet is private or requires login. Please make the sheet public (Anyone with link can view) and try again.'
            });
        }

        // Parse CSV rows
        const rows = csv.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
        const headers = rows[0].map(h => h.toLowerCase());

        const questions = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.every(c => !c)) continue;

            const getCol = (...names) => {
                for (const n of names) {
                    const idx = headers.findIndex(h => h.includes(n));
                    if (idx >= 0 && row[idx]) return row[idx];
                }
                return '';
            };

            const title = getCol('title', 'name', 'question', 'q.') || `Question ${i}`;
            const difficulty = getCol('difficulty', 'level', 'diff') || 'Medium';
            const tags = getCol('tags', 'topic', 'category') || '';
            const deadline = getCol('deadline', 'due', 'date') || '';
            const url = getCol('url', 'link', 'http') || '';
            const course = getCol('course', 'subject') || '';

            // Skip header-like rows
            if (title.toLowerCase().includes('title') || title.toLowerCase().includes('question')) continue;

            questions.push({ title, difficulty, tags: tags.split(/[,;]/).map(t => t.trim()).filter(Boolean), deadline, url, course, rowIndex: i });
        }

        res.json({ success: true, questions, total: questions.length });
    } catch (e) {
        console.error('Sheet import error:', e.message);
        res.status(500).json({ error: 'Failed to read sheet: ' + e.message });
    }
});

// ─── POST /api/import/sheet/save ─────────────────────────────────────────────
// Bulk-save the parsed sheet questions to database
router.post('/sheet/save', auth, adminOnly, async (req, res) => {
    const { questions, courseId } = req.body;
    if (!questions?.length) return res.status(400).json({ error: 'No questions to save' });

    const created = [];
    const failed = [];

    for (const q of questions) {
        try {
            const slug = (q.title || 'question').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now() + Math.random().toString(36).slice(2, 5);
            const newQ = await prisma.question.create({
                data: {
                    title: q.title,
                    slug,
                    statement: q.url
                        ? `Problem imported from: [${q.title}](${q.url})\n\n[Admin: add full problem statement]`
                        : `[Add problem statement for: ${q.title}]`,
                    difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
                    tags: JSON.stringify(q.tags || []),
                    timeLimit: 2, memoryLimit: 256,
                    testcases: JSON.stringify([]),
                    isQotd: false,
                    deadline: q.deadline ? new Date(q.deadline) : null,
                    courseId: courseId ? parseInt(courseId) : null,
                    starterCode: ''
                }
            });
            created.push(newQ.id);
        } catch (e) {
            failed.push({ title: q.title, error: e.message });
        }
    }

    res.json({ success: true, created: created.length, failed: failed.length, failedItems: failed });
});

module.exports = router;
