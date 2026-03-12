const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding GO FOR GOLD database...');

    // Create badges
    const badges = [
        { key: 'welcome', name: 'Welcome!', description: 'Joined the platform', icon: '🎉' },
        { key: 'first_solve', name: 'First Blood', description: 'Solved first problem', icon: '⚔️' },
        { key: 'streak_7', name: '7-Day Streak', description: 'Maintained 7 day streak', icon: '🔥' },
        { key: 'streak_30', name: '30-Day Streak', description: 'Maintained 30 day streak', icon: '🏆' },
        { key: 'problems_100', name: 'Century', description: 'Solved 100 problems', icon: '💯' },
        { key: 'contest_winner', name: 'Contest Winner', description: 'Won a contest', icon: '👑' },
    ];
    for (const b of badges) {
        await prisma.badge.upsert({ where: { key: b.key }, update: {}, create: b });
    }

    // Create admin user
    const adminPass = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@goforgold.dev' },
        update: {},
        create: { name: 'Admin', email: 'admin@goforgold.dev', password: adminPass, role: 'admin', college: 'GO FOR GOLD HQ' }
    });

    // Create demo student
    const studentPass = await bcrypt.hash('student123', 10);
    const student = await prisma.user.upsert({
        where: { email: 'ravi@example.com' },
        update: {},
        create: { name: 'Ravi Yadav', email: 'ravi@example.com', password: studentPass, role: 'student', college: 'IIT Delhi', currentStreak: 7, longestStreak: 15, xp: 340 }
    });
    await prisma.leaderboardEntry.upsert({ where: { userId: student.id }, update: {}, create: { userId: student.id, totalSolved: 24, totalXp: 340 } });

    // Create demo student 2
    const s2 = await prisma.user.upsert({
        where: { email: 'chhavi@example.com' },
        update: {},
        create: { name: 'Chhavi Singh', email: 'chhavi@example.com', password: studentPass, role: 'student', college: 'RU, Sonipat', currentStreak: 12, longestStreak: 77, xp: 1460 }
    });
    await prisma.leaderboardEntry.upsert({ where: { userId: s2.id }, update: {}, create: { userId: s2.id, totalSolved: 146, totalXp: 1460 } });

    const s3 = await prisma.user.upsert({
        where: { email: 'saksham@example.com' },
        update: {},
        create: { name: 'Saksham Ke.', email: 'saksham@example.com', password: studentPass, role: 'student', college: 'RU, Sonipat', currentStreak: 77, longestStreak: 77, xp: 2050 }
    });
    await prisma.leaderboardEntry.upsert({ where: { userId: s3.id }, update: {}, create: { userId: s3.id, totalSolved: 167, totalXp: 2050 } });

    // Create courses
    const dsaCourse = await prisma.course.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, title: 'Data Structures & Algorithms', description: 'Master DSA from basics to advanced', icon: '🧮' }
    });
    const cpCourse = await prisma.course.upsert({
        where: { id: 2 },
        update: {},
        create: { id: 2, title: 'Competitive Programming', description: 'Compete at the highest level', icon: '🏆' }
    });
    await prisma.course.upsert({
        where: { id: 3 },
        update: {},
        create: { id: 3, title: 'Algorithms', description: 'Deep dive into algorithm design', icon: '⚙️' }
    });
    await prisma.course.upsert({
        where: { id: 4 },
        update: {},
        create: { id: 4, title: 'Machine Learning', description: 'Intro to ML and AI', icon: '🤖' }
    });

    // Create sample questions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 0);

    const q1 = await prisma.question.upsert({
        where: { slug: 'holiday-of-equality' },
        update: {},
        create: {
            title: 'Holiday of Equality',
            slug: 'holiday-of-equality',
            statement: `You are given the wealth of **n citizens**. The government wants to make the wealth of all citizens **equal** by only giving money to citizens. It is **not allowed to take money away** from anyone.\n\nYour task is to determine the **minimum total amount of money** that must be distributed so that every citizen ends up with the same wealth.\n\n**Input**\n- The first line contains an integer n — the number of citizens.\n- The second line contains n space-separated integers — the wealth of each citizen.\n\n**Output**\nPrint a single integer — the minimum total amount of money required to make all citizens' wealth equal.\n\n**Constraints**\n- 1 ≤ n ≤ 100\n- 0 ≤ a_i ≤ 10⁶`,
            difficulty: 'Easy',
            tags: JSON.stringify(['greedy', 'math']),
            timeLimit: 2, memoryLimit: 256,
            starterCode: `# Read input\nn = int(input())\narr = list(map(int, input().split()))\n\n# Your solution here\n`,
            testcases: JSON.stringify([
                { input: '5\n0 1 2 3 4', output: '10' },
                { input: '3\n5 5 5', output: '0' },
                { input: '4\n1 2 3 4', output: '6' }
            ]),
            isQotd: true,
            qotdDate: today,
            deadline: tomorrow,
            courseId: dsaCourse.id
        }
    });

    await prisma.question.upsert({
        where: { slug: 'mirror-message' },
        update: {},
        create: {
            title: 'Mirror Message',
            slug: 'mirror-message',
            statement: `Given a string S, return its mirror (reverse) version.\n\n**Input:** A single string S\n**Output:** Reversed string\n\n**Constraints:** 1 ≤ |S| ≤ 10⁵`,
            difficulty: 'Easy',
            tags: JSON.stringify(['strings', 'basic']),
            timeLimit: 1, memoryLimit: 128,
            starterCode: `s = input()\nprint(s[::-1])`,
            testcases: JSON.stringify([{ input: 'hello', output: 'olleh' }, { input: 'abcd', output: 'dcba' }]),
            isQotd: false, courseId: dsaCourse.id
        }
    });

    await prisma.question.upsert({
        where: { slug: 'tourney-arrangement' },
        update: {},
        create: {
            title: 'Tourney Arrangement at Winterfell',
            slug: 'tourney-arrangement',
            statement: `N knights need to be arranged in K groups. Find the minimum difference between the largest and smallest group sizes.\n\n**Input:** N K\n**Output:** Minimum difference`,
            difficulty: 'Medium',
            tags: JSON.stringify(['math', 'greedy', 'division']),
            timeLimit: 2, memoryLimit: 256,
            starterCode: `n, k = map(int, input().split())\n# Your solution here\n`,
            testcases: JSON.stringify([{ input: '10 3', output: '1' }]),
            isQotd: false, courseId: cpCourse.id
        }
    });

    await prisma.question.upsert({
        where: { slug: 'avoid-the-palindrome' },
        update: {},
        create: {
            title: 'Avoid the Palindrome',
            slug: 'avoid-the-palindrome',
            statement: `Given a string, modify at most one character to ensure it is NOT a palindrome. If impossible, output -1.\n\n**Input:** String S\n**Output:** Modified string or -1`,
            difficulty: 'Medium',
            tags: JSON.stringify(['strings', 'palindrome', 'greedy']),
            timeLimit: 2, memoryLimit: 256,
            starterCode: `s = input()\n# Your solution here\n`,
            testcases: JSON.stringify([{ input: 'aba', output: 'abc' }, { input: 'a', output: '-1' }]),
            isQotd: false, courseId: dsaCourse.id
        }
    });

    await prisma.question.upsert({
        where: { slug: 'battle-beyond-the-wall' },
        update: {},
        create: {
            title: 'Battle Beyond the Wall',
            slug: 'battle-beyond-the-wall',
            statement: `Given an array of N integers, find the maximum subarray sum.\n\n**Input:** N on first line, array on second\n**Output:** Maximum subarray sum`,
            difficulty: 'Hard',
            tags: JSON.stringify(['dp', 'kadane', 'arrays']),
            timeLimit: 3, memoryLimit: 512,
            starterCode: `n = int(input())\narr = list(map(int, input().split()))\n# Implement Kadane's algorithm here\n`,
            testcases: JSON.stringify([{ input: '6\n-2 1 -3 4 -1 2', output: '5' }]),
            isQotd: false, courseId: dsaCourse.id
        }
    });

    // Create some submissions for demo
    try {
        await prisma.submission.create({
            data: { userId: s2.id, questionId: q1.id, code: 'n=int(input())\narr=list(map(int,input().split()))\nprint(max(arr)*n-sum(arr))', language: 'python', status: 'Accepted', runtime: 45, memory: 8 }
        });
    } catch { }

    // Materials
    for (const m of [
        { title: 'DSA Lecture Notes - Week 1', type: 'pdf', url: '#', courseId: dsaCourse.id },
        { title: 'Graph Theory Slides', type: 'slide', url: '#', courseId: dsaCourse.id },
        { title: 'CP Handbook', type: 'pdf', url: '#', courseId: cpCourse.id },
    ]) {
        try { await prisma.material.create({ data: m }); } catch { }
    }

    console.log('✅ Seed complete!');
    console.log('📧 Admin: admin@goforgold.dev / admin123');
    console.log('📧 Student: ravi@example.com / student123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
