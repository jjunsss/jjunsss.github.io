// Mesh gradient blobs — warm background orbs, painted once.
// Static by design: the previous ~21fps animation loop redrew a full-viewport canvas
// continuously, which was the main source of scroll jank / idle CPU on Windows laptops.
// Keeps the original element IDs for compatibility.
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

    const rand = (min, max) => min + Math.random() * (max - min);
    let blobs = [];
    let paintedWidth = 0;

    function createBlobs() {
        const isMobile = window.innerWidth <= 768;
        const count = isMobile ? 4 : 6;
        const minR = isMobile ? 180 : 260;
        const maxR = isMobile ? 300 : 460;
        blobs = Array.from({ length: count }, (_, i) => ({
            x: rand(0, 1),
            y: rand(0, 1),
            r: rand(minR, maxR),
            color: BLOB_PALETTE[i % BLOB_PALETTE.length],
            alpha: rand(0.30, 0.48),
        }));
    }

    function paint() {
        // Soft gradients gain nothing from high-DPI backing stores; 1x keeps the layer small.
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        for (const b of blobs) {
            const px = b.x * width;
            const py = b.y * height;
            const { r: cr, g: cg, b: cb } = b.color;
            const grad = ctx.createRadialGradient(px, py, 0, px, py, b.r);
            grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${b.alpha})`);
            grad.addColorStop(0.55, `rgba(${cr}, ${cg}, ${cb}, ${b.alpha * 0.35})`);
            grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        paintedWidth = width;
    }

    createBlobs();
    paint();

    // Repaint only when the width changes (mobile URL-bar show/hide changes height only;
    // the canvas simply stretches, which is invisible for blurred blobs).
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth === paintedWidth) return;
            createBlobs();
            paint();
        }, 150);
    }, { passive: true });
})();
