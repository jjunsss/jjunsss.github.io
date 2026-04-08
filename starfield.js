(function() {
    const root = document.getElementById('starfield-root');
    const canvas = document.getElementById('bubble-canvas');
    const fallback = document.getElementById('starfield-fallback');
    const qaPanel = document.getElementById('starfield-qa');
    if (!root || !canvas || !fallback) return;

    const qaParam = new URLSearchParams(window.location.search).get('qa');
    const showQa = qaParam === '1' || qaParam === 'true' || qaParam === 'starfield';
    if (showQa && qaPanel) qaPanel.hidden = false;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }) || canvas.getContext('2d');
    const stars = [];
    let scrollForce = 0;
    let smoothScrollForce = 0;
    let lastScrollY = window.scrollY;
    let animId = null;
    let lastFrameTime = 0;
    let isMobile = window.innerWidth <= 768;
    let targetFps = isMobile ? 14 : 30;
    let frameInterval = 1000 / targetFps;
    let qualityTimer = null;
    let recoveryAttempts = 0;
    let fallbackActive = false;
    let lastQuality = null;

    const STAR_COLORS = [
        { r: 155, g: 176, b: 255 },
        { r: 170, g: 191, b: 255 },
        { r: 202, g: 215, b: 255 },
        { r: 248, g: 247, b: 255 },
        { r: 255, g: 244, b: 234 },
        { r: 255, g: 210, b: 161 },
        { r: 255, g: 204, b: 111 },
    ];
    const SAMPLE_POINTS = [
        [0.08, 0.12],
        [0.5, 0.16],
        [0.86, 0.12],
        [0.22, 0.58],
        [0.74, 0.72],
    ];

    function updatePerformanceMode() {
        isMobile = window.innerWidth <= 768;
        targetFps = isMobile ? 14 : 30;
        frameInterval = 1000 / targetFps;
    }

    function toRgb(color) {
        return `${color.r}, ${color.g}, ${color.b}`;
    }

    function updateQa(reason) {
        if (!showQa || !qaPanel) return;
        const quality = lastQuality || {};
        qaPanel.innerHTML = `
            <div class="qa-label">Starfield QA</div>
            <div class="qa-line"><strong>mode</strong> ${fallbackActive ? 'fallback' : 'canvas'}</div>
            <div class="qa-line"><strong>reason</strong> ${reason || quality.reason || 'startup'}</div>
            <div class="qa-line"><strong>dpr</strong> ${(window.devicePixelRatio || 1).toFixed(2)}</div>
            <div class="qa-line"><strong>viewport</strong> ${window.innerWidth} x ${window.innerHeight}</div>
            <div class="qa-line"><strong>canvas</strong> ${canvas.width} x ${canvas.height}</div>
            <div class="qa-line"><strong>alpha ratio</strong> ${(quality.nonZeroRatio || 0).toFixed(4)}</div>
            <div class="qa-line"><strong>bright ratio</strong> ${(quality.brightRatio || 0).toFixed(4)}</div>
            <div class="qa-line"><strong>checks</strong> ${quality.sampleCount || 0}</div>
        `;
    }

    function setFallbackActive(active, reason) {
        fallbackActive = active;
        document.body.classList.toggle('starfield-fallback-active', active);
        root.dataset.mode = active ? 'fallback' : 'canvas';
        if (reason) root.dataset.reason = reason;
        updateQa(reason);
    }

    function createFallbackStar(layer) {
        const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
        const el = document.createElement('span');
        const layerName = layer === 0 ? 'layer-far' : layer === 1 ? 'layer-mid' : 'layer-near';
        const size = layer === 0 ? 0.7 + Math.random() * 1.1 : layer === 1 ? 1.25 + Math.random() * 1.9 : 2.2 + Math.random() * 2.8;
        const opacity = layer === 0 ? 0.16 + Math.random() * 0.28 : layer === 1 ? 0.34 + Math.random() * 0.32 : 0.62 + Math.random() * 0.28;
        const driftRange = layer === 0 ? 12 : layer === 1 ? 20 : 34;
        const twinkle = layer === 0 ? 6 + Math.random() * 4 : layer === 1 ? 3.2 + Math.random() * 2.6 : 2 + Math.random() * 1.8;
        const drift = layer === 0 ? 26 + Math.random() * 12 : layer === 1 ? 18 + Math.random() * 8 : 12 + Math.random() * 6;

        el.className = `fallback-star ${layerName}`;
        el.style.setProperty('--x', `${Math.random() * window.innerWidth}px`);
        el.style.setProperty('--y', `${Math.random() * window.innerHeight}px`);
        el.style.setProperty('--size', `${size.toFixed(2)}px`);
        el.style.setProperty('--opacity', opacity.toFixed(3));
        el.style.setProperty('--star-rgb', toRgb(color));
        el.style.setProperty('--delay', `${(-Math.random() * twinkle).toFixed(2)}s`);
        el.style.setProperty('--twinkle', `${twinkle.toFixed(2)}s`);
        el.style.setProperty('--drift', `${drift.toFixed(2)}s`);
        el.style.setProperty('--drift-x', `${((Math.random() - 0.5) * driftRange).toFixed(2)}px`);
        el.style.setProperty('--drift-y', `${((Math.random() - 0.5) * driftRange).toFixed(2)}px`);
        return el;
    }

    function buildFallbackStars() {
        fallback.textContent = '';
        const area = window.innerWidth * window.innerHeight;
        const density = Math.max(1, area / (420 * 900));
        const far = Math.round(72 * density);
        const mid = Math.round(22 * density);
        const near = Math.round(8 * density);
        for (let i = 0; i < far; i++) fallback.appendChild(createFallbackStar(0));
        for (let i = 0; i < mid; i++) fallback.appendChild(createFallbackStar(1));
        for (let i = 0; i < near; i++) fallback.appendChild(createFallbackStar(2));
    }

    function sizeCanvas() {
        if (!ctx) return;
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
        canvas.width = Math.max(1, Math.ceil(window.innerWidth * dpr));
        canvas.height = Math.max(1, Math.ceil(window.innerHeight * dpr));
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createStar(layer) {
        const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (layer === 0) {
            return {
                layer: 0,
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.5 + Math.random() * 1.2,
                baseOpacity: 0.25 + Math.random() * 0.35,
                twinkleSpeed: 0.08 + Math.random() * 0.18,
                twinklePhase: Math.random() * Math.PI * 2,
                color,
                vx: 0,
                vy: 0,
                scrollFactor: 0.02,
            };
        }
        if (layer === 1) {
            return {
                layer: 1,
                x: Math.random() * w,
                y: Math.random() * h,
                size: 1.2 + Math.random() * 2.2,
                baseOpacity: 0.45 + Math.random() * 0.35,
                twinkleSpeed: 0.22 + Math.random() * 0.65,
                twinklePhase: Math.random() * Math.PI * 2,
                color,
                vx: (Math.random() - 0.5) * 0.04,
                vy: (Math.random() - 0.5) * 0.03,
                scrollFactor: 0.06,
                hasGlow: Math.random() < 0.42,
            };
        }
        return {
            layer: 2,
            x: Math.random() * w,
            y: Math.random() * h,
            size: 2.5 + Math.random() * 3.5,
            baseOpacity: 0.7 + Math.random() * 0.3,
            twinkleSpeed: 0.8 + Math.random() * 2,
            twinklePhase: Math.random() * Math.PI * 2,
            color,
            vx: (Math.random() - 0.5) * 0.08,
            vy: (Math.random() - 0.5) * 0.06,
            scrollFactor: 0.15,
        };
    }

    function rebuildStars() {
        stars.length = 0;
        const density = (window.innerWidth * window.innerHeight) / (400 * 800);
        const far = Math.round(45 * density);
        const mid = Math.round(16 * density);
        const near = Math.round(5 * density);
        for (let i = 0; i < far; i++) stars.push(createStar(0));
        for (let i = 0; i < mid; i++) stars.push(createStar(1));
        for (let i = 0; i < near; i++) stars.push(createStar(2));
    }

    function drawStarL0(star, alphaScale) {
        const opacity = star.baseOpacity * alphaScale;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color.r}, ${star.color.g}, ${star.color.b}, ${opacity})`;
        ctx.fill();
    }

    function drawStarL1(star, time, alphaScale) {
        const twinkle = Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase);
        const pulse = twinkle * 0.5 + 0.5;
        const opacity = star.baseOpacity * (0.72 + 0.28 * pulse) * alphaScale;
        const size = star.size * (0.92 + 0.08 * pulse);
        const { r, g, b } = star.color;

        if (star.hasGlow) {
            const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, size * 3.6);
            glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 0.22})`);
            glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.beginPath();
            ctx.arc(star.x, star.y, size * 3.6, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.fill();
    }

    function drawStarL2(star, time, alphaScale) {
        const t = Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase);
        const t2 = Math.sin(time * 0.0007 * star.twinkleSpeed + star.twinklePhase + 1.3);
        const opacity = star.baseOpacity * (0.3 + 0.7 * (t * 0.5 + 0.5)) * alphaScale;
        const size = star.size * (0.7 + 0.3 * (t * 0.5 + 0.5));
        const { r, g, b } = star.color;

        const outer = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, size * 10);
        outer.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 0.1})`);
        outer.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(star.x, star.y, size * 10, 0, Math.PI * 2);
        ctx.fillStyle = outer;
        ctx.fill();

        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, size * 4);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 0.6})`);
        glow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${opacity * 0.15})`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(star.x, star.y, size * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        const armLength = size * 4 * (0.8 + 0.2 * (t2 * 0.5 + 0.5));
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.55})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(star.x - armLength, star.y);
        ctx.lineTo(star.x + armLength, star.y);
        ctx.moveTo(star.x, star.y - armLength);
        ctx.lineTo(star.x, star.y + armLength);
        ctx.stroke();

        const diagonalLength = armLength * 0.45;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.25})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(star.x - diagonalLength, star.y - diagonalLength);
        ctx.lineTo(star.x + diagonalLength, star.y + diagonalLength);
        ctx.moveTo(star.x + diagonalLength, star.y - diagonalLength);
        ctx.lineTo(star.x - diagonalLength, star.y + diagonalLength);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(star.x, star.y, size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 253, 250, ${opacity})`;
        ctx.fill();
    }

    function drawConstellationLinks(time) {
        const brightStars = stars.filter(star => star.layer === 2);
        if (brightStars.length < 2) return;

        const maxDistance = 220;
        const maxConnectionsPerStar = 2;
        const connectionCount = new Map();
        ctx.save();
        ctx.lineWidth = 0.7;

        for (let i = 0; i < brightStars.length; i++) {
            const a = brightStars[i];
            const countA = connectionCount.get(a) || 0;
            if (countA >= maxConnectionsPerStar) continue;

            for (let j = i + 1; j < brightStars.length; j++) {
                const b = brightStars[j];
                const countB = connectionCount.get(b) || 0;
                if (countB >= maxConnectionsPerStar) continue;

                const dist = Math.hypot(b.x - a.x, b.y - a.y);
                if (dist > maxDistance) continue;

                const pulse = 0.65 + 0.35 * (Math.sin(time * 0.0011 + (a.twinklePhase + b.twinklePhase) * 0.5) * 0.5 + 0.5);
                const alpha = (1 - dist / maxDistance) * 0.18 * pulse;
                if (alpha <= 0.01) continue;

                const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                grad.addColorStop(0, `rgba(${a.color.r}, ${a.color.g}, ${a.color.b}, ${alpha})`);
                grad.addColorStop(1, `rgba(${b.color.r}, ${b.color.g}, ${b.color.b}, ${alpha * 0.8})`);
                ctx.strokeStyle = grad;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();

                connectionCount.set(a, countA + 1);
                connectionCount.set(b, countB + 1);
                break;
            }
        }

        ctx.restore();
    }

    function renderScene(time) {
        if (!ctx) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        smoothScrollForce += (scrollForce - smoothScrollForce) * 0.15;
        scrollForce *= 0.92;
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            const driftScale = isMobile ? 0.35 : 1;
            star.x += star.vx * driftScale;
            star.y += (star.vy * driftScale) + smoothScrollForce * star.scrollFactor;
            if (star.x < -10) star.x = width + 10;
            if (star.x > width + 10) star.x = -10;
            if (star.y < -10) star.y = height + 10;
            if (star.y > height + 10) star.y = -10;

            if (star.layer === 0) drawStarL0(star, 1);
            else if (star.layer === 1) drawStarL1(star, time, 1);
            else drawStarL2(star, time, 1);
        }

        drawConstellationLinks(time);
    }

    function animate(time) {
        const elapsed = time - lastFrameTime;
        if (elapsed < frameInterval) {
            animId = requestAnimationFrame(animate);
            return;
        }
        lastFrameTime = time - (elapsed % frameInterval);
        renderScene(time);
        animId = requestAnimationFrame(animate);
    }

    function sampleCanvasQuality(reason) {
        if (!ctx) {
            return { ok: false, reason: reason || 'context-unavailable', nonZeroRatio: 0, brightRatio: 0, sampleCount: 0 };
        }
        if (canvas.width < 64 || canvas.height < 64) {
            return { ok: false, reason: reason || 'canvas-too-small', nonZeroRatio: 0, brightRatio: 0, sampleCount: 0 };
        }

        try {
            const patchSize = Math.max(36, Math.min(Math.floor(Math.min(canvas.width, canvas.height) * 0.14), 220));
            let pixels = 0;
            let nonZeroAlpha = 0;
            let bright = 0;

            for (const [nx, ny] of SAMPLE_POINTS) {
                const x = Math.max(0, Math.min(canvas.width - patchSize, Math.floor(canvas.width * nx)));
                const y = Math.max(0, Math.min(canvas.height - patchSize, Math.floor(canvas.height * ny)));
                const data = ctx.getImageData(x, y, patchSize, patchSize).data;
                pixels += data.length / 4;
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    if (alpha > 0) nonZeroAlpha++;
                    if (alpha > 0 && luminance > 120) bright++;
                }
            }

            const nonZeroRatio = pixels ? nonZeroAlpha / pixels : 0;
            const brightRatio = pixels ? bright / pixels : 0;
            return {
                ok: nonZeroRatio > 0.0012 || brightRatio > 0.00035,
                reason,
                nonZeroRatio,
                brightRatio,
                sampleCount: SAMPLE_POINTS.length,
            };
        } catch (error) {
            return {
                ok: false,
                reason: reason || 'sample-failed',
                error: String(error),
                nonZeroRatio: 0,
                brightRatio: 0,
                sampleCount: 0,
            };
        }
    }

    function scheduleQualityCheck(reason, delay = 900) {
        window.clearTimeout(qualityTimer);
        qualityTimer = window.setTimeout(() => {
            lastQuality = sampleCanvasQuality(reason);
            if (!lastQuality.ok && recoveryAttempts < 1) {
                recoveryAttempts += 1;
                sizeCanvas();
                rebuildStars();
                renderScene(performance.now());
                updateQa(reason);
                scheduleQualityCheck(`${reason}-retry`, 420);
                return;
            }
            recoveryAttempts = 0;
            setFallbackActive(!lastQuality.ok, lastQuality.reason);
            updateQa(reason);
        }, delay);
    }

    function refreshStarfield(reason) {
        updatePerformanceMode();
        buildFallbackStars();
        if (!ctx) {
            setFallbackActive(true, 'context-unavailable');
            return;
        }
        sizeCanvas();
        rebuildStars();
        renderScene(performance.now());
        scheduleQualityCheck(reason, 520);
    }

    window.__starfieldQA = {
        inspect(reason = 'manual') {
            lastQuality = sampleCanvasQuality(reason);
            updateQa(reason);
            return lastQuality;
        },
        forceFallback(reason = 'manual-force') {
            setFallbackActive(true, reason);
        },
        disableFallback(reason = 'manual-disable') {
            setFallbackActive(false, reason);
        },
    };

    buildFallbackStars();
    if (!ctx) {
        setFallbackActive(true, 'context-unavailable');
        return;
    }

    sizeCanvas();
    rebuildStars();
    renderScene(performance.now());
    animId = requestAnimationFrame(animate);
    scheduleQualityCheck('startup', 950);

    window.addEventListener('resize', () => {
        lastFrameTime = 0;
        refreshStarfield('resize');
    });
    window.addEventListener('pageshow', () => {
        lastScrollY = window.scrollY;
        scrollForce = 0;
        smoothScrollForce = 0;
        refreshStarfield('pageshow');
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleQualityCheck('visibility', 420);
    });
    window.addEventListener('scroll', () => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY;
        scrollForce = -delta * 0.15;
        lastScrollY = currentY;
    }, { passive: true });
})();
