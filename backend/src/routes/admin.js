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
            select: {
                id: true, name: true, email: true, college: true, xp: true,
                currentStreak: true, createdAt: true,
                externalProfile: true
            },
            orderBy: { xp: 'desc' }
        });
        res.json(students);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete student
router.delete('/students/:id', auth, adminOnly, async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true, message: 'Student removed successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Detailed Assignment Tracking
router.get('/assignments/:id/tracking', auth, adminOnly, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [assignment, students] = await Promise.all([
            prisma.assignment.findUnique({
                where: { id },
                include: { questions: { include: { question: true } } }
            }),
            prisma.user.findMany({
                where: { role: 'student', enrollments: { some: { course: { assignments: { some: { id } } } } } },
                select: { id: true, name: true, email: true, submissions: { include: { question: true } } }
            })
        ]);

        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

        const assignmentQuestionIds = assignment.questions.map(aq => aq.questionId);

        const tracking = students.map(s => {
            const assignmentSubmissions = s.submissions.filter(sub => assignmentQuestionIds.includes(sub.questionId));
            const distinctSolved = new Set(assignmentSubmissions.filter(sub => sub.status === 'Accepted').map(sub => sub.questionId));
            const distinctAttempted = new Set(assignmentSubmissions.map(sub => sub.questionId));

            return {
                userId: s.id,
                name: s.name,
                email: s.email,
                stats: {
                    attempted: distinctAttempted.size,
                    solved: distinctSolved.size,
                    total: assignmentQuestionIds.length,
                    isFinished: distinctSolved.size === assignmentQuestionIds.length && assignmentQuestionIds.length > 0
                }
            };
        });

        res.json({
            title: assignment.title,
            totals: {
                joinedCount: students.length,
                attemptedCount: tracking.filter(t => t.stats.attempted > 0).length,
                submittedCount: tracking.filter(t => t.stats.isFinished).length
            },
            students: tracking
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
