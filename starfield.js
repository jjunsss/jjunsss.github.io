// Mesh gradient blobs — warm, slow-moving background orbs.
// Replaces the previous starfield. Keeps original element IDs for compatibility.
(function() {
    const root = document.getElementById('starfield-root');
    const canvas = document.getElementById('bubble-canvas');
    if (!root || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Warm palette for blobs (cream, peach, terracotta, honey).
    const BLOB_PALETTE = [
        { r: 252, g: 215, b: 181 }, // soft peach
        { r: 244, g: 194, b: 150 }, // warm apricot
        { r: 232, g: 184, b: 109 }, // honey
        { r: 217, g: 119, b: 87  }, // terracotta
        { r: 249, g: 227, b: 196 }, // pale sand
        { r: 226, g: 168, b: 129 }, // rose clay
    ];

    let blobs = [];
    let animId = null;
    let lastFrameTime = 0;
    let dpr = 1;
    let width = 0;
    let height = 0;

    function rand(min, max) { return min + Math.random() * (max - min); }

    function pickColor(i) {
        return BLOB_PALETTE[i % BLOB_PALETTE.length];
    }

    function createBlobs() {
        const isMobile = window.innerWidth <= 768;
        const count = isMobile ? 4 : 6;
        const minR = isMobile ? 180 : 260;
        const maxR = isMobile ? 300 : 460;

        blobs = [];
        for (let i = 0; i < count; i++) {
            const color = pickColor(i);
            blobs.push({
                x: rand(0, 1),            // normalized [0,1]
                y: rand(0, 1),
                r: rand(minR, maxR),      // radius in px
                // Drift — full traversal takes ~30-50 seconds. Slow ambient movement.
                vx: rand(-0.00022, 0.00022),
                vy: rand(-0.00018, 0.00018),
                // Phase for subtle radius pulsing (breathing effect).
                phase: rand(0, Math.PI * 2),
                phaseSpeed: rand(0.00028, 0.00055),
                color,
                alpha: rand(0.30, 0.48),
            });
        }
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBlob(b) {
        const px = b.x * width;
        const py = b.y * height;
        // Radius pulses gently around its base size.
        const pulse = 1 + Math.sin(b.phase) * 0.08;
        const r = b.r * pulse;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
        const { r: cr, g: cg, b: cb } = b.color;
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${b.alpha})`);
        grad.addColorStop(0.55, `rgba(${cr}, ${cg}, ${cb}, ${b.alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
    }

    function step(now) {
        // Cap to ~30fps — the motion is intentionally slow.
        if (now - lastFrameTime < 33) {
            animId = requestAnimationFrame(step);
            return;
        }
        const dt = Math.min(now - lastFrameTime, 64);
        lastFrameTime = now;

        ctx.clearRect(0, 0, width, height);
        // Soft blend so overlapping blobs mix into a mesh-gradient feel.
        ctx.globalCompositeOperation = 'lighter';

        for (const b of blobs) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.phase += b.phaseSpeed * dt;

            // Bounce off edges softly (keep most of the blob visible).
            if (b.x < -0.1) { b.x = -0.1; b.vx *= -1; }
            if (b.x > 1.1)  { b.x = 1.1;  b.vx *= -1; }
            if (b.y < -0.1) { b.y = -0.1; b.vy *= -1; }
            if (b.y > 1.1)  { b.y = 1.1;  b.vy *= -1; }

            drawBlob(b);
        }

        ctx.globalCompositeOperation = 'source-over';
        animId = requestAnimationFrame(step);
    }

    function drawStatic() {
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        for (const b of blobs) drawBlob(b);
        ctx.globalCompositeOperation = 'source-over';
    }

    function start() {
        cancelAnimationFrame(animId);
        lastFrameTime = performance.now();
        animId = requestAnimationFrame(step);
    }

    function stop() {
        if (animId) cancelAnimationFrame(animId);
        animId = null;
    }

    let resizeTimer = null;
    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize();
            createBlobs();
        }, 120);
    }

    resize();
    createBlobs();
    start();

    window.addEventListener('resize', onResize, { passive: true });

    // Pause when tab hidden to save CPU; resume on focus.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else start();
    });
})();
