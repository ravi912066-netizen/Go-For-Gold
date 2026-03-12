const router = require('express').Router();
const { auth } = require('../middleware/auth');

const HINTS = {
    debug: [
        "Check your variable initialization — uninitialized variables in C++ cause undefined behavior.",
        "Array index out of bounds is a common cause of runtime errors. Verify your loop bounds.",
        "Integer overflow can silently corrupt results. Consider using long long in C++.",
        "Check if you're reading input correctly — mismatched data types cause wrong answers.",
    ],
    explain: [
        "Your code fails on edge cases. Test with minimum input values (n=0, n=1).",
        "The error suggests a null pointer dereference. Check all pointer operations.",
        "Time Limit Exceeded usually means your algorithm is O(n²) or worse. Consider sorting or hashing.",
    ],
    hint: [
        "Think about the data structure that allows O(1) lookup.",
        "Can you sort the array first to simplify the problem?",
        "Try a two-pointer approach — it often converts O(n²) to O(n).",
        "Dynamic programming might work here. Define your state carefully.",
        "Consider binary search — does the answer space have monotonic properties?",
        "A sliding window technique could help with subarray problems.",
        "Think recursively first, then optimize with memoization.",
    ],
    optimize: [
        "Replace nested loops with a hash map for O(n) time complexity.",
        "Precompute prefix sums to answer range queries in O(1).",
        "Use bit manipulation to speed up this operation.",
        "Reduce space complexity by processing in-place instead of allocating extra arrays.",
        "Lazy propagation in segment trees can reduce your update time from O(n) to O(log n).",
    ]
};

router.post('/', auth, async (req, res) => {
    try {
        const { code, language, error, mode, questionTitle } = req.body;
        if (!HINTS[mode]) return res.status(400).json({ error: 'Invalid mode' });

        // Simulate AI thinking based on code analysis
        await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

        const hints = HINTS[mode];
        const hint = hints[Math.floor(Math.random() * hints.length)];

        let response = '';
        if (mode === 'debug') {
            response = `🔍 **Debugging "${questionTitle || 'your code'}"**\n\n${hint}\n\n*If you'd like a more specific analysis, share the error message you're seeing.*`;
        } else if (mode === 'explain') {
            response = `📖 **Error Explanation**\n\n${hint}\n\n*Review your code logic around the lines where the error occurs.*`;
        } else if (mode === 'hint') {
            response = `💡 **Hint** *(Approach, not solution)*\n\n${hint}\n\n*Try implementing this idea. Use the Debug mode if you get stuck.*`;
        } else if (mode === 'optimize') {
            response = `⚡ **Optimization Suggestion**\n\n${hint}\n\n*Implementing this should improve your runtime significantly.*`;
        }

        res.json({ response, mode });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
