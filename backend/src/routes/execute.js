const router = require('express').Router();
const { exec } = require('child_process');
const { auth } = require('../middleware/auth');

const LANG_CONFIG = {
    python: { ext: 'py', cmd: (file) => `timeout 5 python3 ${file}` },
    cpp: { ext: 'cpp', cmd: (file, bin) => `timeout 10 g++ -O2 -o ${bin} ${file} && timeout 5 ${bin}` },
    java: { ext: 'java', cmd: (file, dir) => `timeout 15 javac ${file} && timeout 5 java -cp ${dir} Main` },
    javascript: { ext: 'js', cmd: (file) => `timeout 5 node ${file}` },
};

router.post('/', auth, async (req, res) => {
    const { code, language, input } = req.body;
    if (!LANG_CONFIG[language]) return res.status(400).json({ error: 'Unsupported language' });

    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfg-'));
    const config = LANG_CONFIG[language];
    const fileName = language === 'java' ? 'Main' : 'solution';
    const filePath = path.join(tmpDir, `${fileName}.${config.ext}`);
    const binPath = path.join(tmpDir, 'solution');

    try {
        fs.writeFileSync(filePath, code);

        let cmd;
        if (language === 'cpp') cmd = config.cmd(filePath, binPath);
        else if (language === 'java') cmd = config.cmd(filePath, tmpDir);
        else cmd = config.cmd(filePath);

        const inputPath = path.join(tmpDir, 'input.txt');
        if (input) {
            fs.writeFileSync(inputPath, input);
            cmd = `echo "${input.replace(/"/g, '\\"')}" | ${cmd}`;
        }

        const startTime = Date.now();
        exec(cmd, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            const runtime = Date.now() - startTime;

            // Cleanup
            try { fs.rmSync(tmpDir, { recursive: true }); } catch { }

            if (error && !stdout) {
                return res.json({
                    status: stderr.includes('Timeout') ? 'TLE' : 'Runtime Error',
                    output: '',
                    error: stderr || error.message,
                    runtime,
                    memory: 0
                });
            }

            res.json({
                status: 'Success',
                output: stdout,
                error: stderr || null,
                runtime,
                memory: Math.floor(Math.random() * 20) + 5 // Mock memory in MB
            });
        });
    } catch (e) {
        try { require('fs').rmSync(tmpDir, { recursive: true }); } catch { }
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
