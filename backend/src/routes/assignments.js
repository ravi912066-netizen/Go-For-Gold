const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth, adminOnly } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const { courseId } = req.query;
        const where = courseId ? { courseId: parseInt(courseId) } : {};
        const assignments = await prisma.assignment.findMany({
            where, orderBy: { createdAt: 'desc' },
            include: { course: { select: { title: true } }, questions: { include: { question: true } } }
        });
        res.json(assignments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { title, description, courseId, startTime, deadline, difficulty, tags, questionIds } = req.body;
        const assignment = await prisma.assignment.create({
            data: {
                title, description,
                courseId: parseInt(courseId),
                startTime: startTime ? new Date(startTime) : null,
                deadline: deadline ? new Date(deadline) : null,
                difficulty, tags,
                questions: questionIds ? {
                    create: questionIds.map(qid => ({ questionId: parseInt(qid) }))
                } : undefined
            },
            include: { questions: true }
        });
        res.json(assignment);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.startTime) data.startTime = new Date(data.startTime);
        if (data.deadline) data.deadline = new Date(data.deadline);
        delete data.questionIds;
        const a = await prisma.assignment.update({ where: { id: parseInt(req.params.id) }, data });
        res.json(a);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        await prisma.assignmentQuestion.deleteMany({ where: { assignmentId: parseInt(req.params.id) } });
        await prisma.assignment.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
