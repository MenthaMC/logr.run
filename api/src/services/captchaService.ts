const https = require('https');
const {
    TURNSTILE_BYPASS,
    TURNSTILE_SECRET_KEY,
    TURNSTILE_VERIFY_URL
} = require('../config/env.ts');

const verifyTurnstile = (token, remoteIp) => {
    if (TURNSTILE_BYPASS || !TURNSTILE_SECRET_KEY) {
        return Promise.resolve({ ok: true });
    }
    if (!token) return Promise.resolve({ ok: false, error: 'Captcha required' });

    const payload = new URLSearchParams();
    payload.set('secret', TURNSTILE_SECRET_KEY);
    payload.set('response', token);
    if (remoteIp) payload.set('remoteip', remoteIp);

    const body = payload.toString();

    return new Promise((resolve) => {
        const req = https.request(
            TURNSTILE_VERIFY_URL,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk.toString('utf8');
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result && result.success) return resolve({ ok: true });
                        const codes = Array.isArray(result && result['error-codes']) ? result['error-codes'] : [];
                        if (codes.includes('missing-input-response')) return resolve({ ok: false, error: 'Captcha required' });
                        if (codes.includes('timeout-or-duplicate')) return resolve({ ok: false, error: 'Captcha expired' });
                        return resolve({ ok: false, error: 'Invalid captcha' });
                    } catch {
                        return resolve({ ok: false, error: 'Invalid captcha' });
                    }
                });
            }
        );
        req.on('error', () => resolve({ ok: false, error: 'Invalid captcha' }));
        req.write(body);
        req.end();
    });
};

module.exports = {
    verifyTurnstile
};
