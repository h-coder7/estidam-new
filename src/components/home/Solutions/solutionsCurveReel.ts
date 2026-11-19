/** Concave looping card reel — WebGL mesh (Curve Reel–style), Estidam-adapted. */

export type ReelCard = {
    id: string;
    label: string;
    title: string;
    text?: string;
    highlight?: string;
    image?: string;
};

export type ReelApi = {
    destroy: () => void;
    resize: () => void;
};

type Spring = {
    to: (t: number) => Spring;
    jump: (t: number) => Spring;
    value: number;
};

function spring(opts: {
    from?: number;
    to?: number;
    tension?: number;
    friction?: number;
    onUpdate?: (v: number) => void;
}): Spring {
    let k = opts.tension ?? 170;
    let c = opts.friction ?? 26;
    let x = opts.from ?? 0;
    let v = 0;
    let target = opts.to ?? x;
    let raf = 0;
    let last = 0;
    const reduced =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const step = (now: number) => {
        const dt = Math.min((now - (last || now)) / 1000 || 1 / 60, 1 / 20);
        last = now;
        const n = Math.max(1, Math.ceil(dt * 240));
        const h = dt / n;
        for (let i = 0; i < n; i++) {
            v += (-k * (x - target) - c * v) * h;
            x += v * h;
        }
        if (Math.abs(v) < 1e-3 && Math.abs(x - target) < 1e-4) {
            x = target;
            v = 0;
            opts.onUpdate?.(x);
            raf = 0;
            last = 0;
            return;
        }
        opts.onUpdate?.(x);
        raf = requestAnimationFrame(step);
    };

    const api: Spring = {
        to(t) {
            target = t;
            if (reduced) return api.jump(t);
            if (!raf) {
                last = 0;
                raf = requestAnimationFrame(step);
            }
            return api;
        },
        jump(t) {
            cancelAnimationFrame(raf);
            raf = 0;
            x = target = t;
            v = 0;
            opts.onUpdate?.(x);
            return api;
        },
        get value() {
            return x;
        },
    };
    opts.onUpdate?.(x);
    if ((opts.to ?? x) !== x) api.to(opts.to!);
    return api;
}

/** Journey-style split card texture (light face for the dark Solutions field). */
function paintCard(card: ReelCard, _index: number, photo?: HTMLImageElement | null, w = 512, h = 682) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    const ink = "#0b1a33";
    const blue = "#295cc7";
    const muted = "#5d6878";
    const mediaBg = "#d5deec";
    const face = "#f4f6fa";
    const radius = 36;
    const font =
        typeof document !== "undefined"
            ? getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
            : "system-ui, sans-serif";

    ctx.clearRect(0, 0, w, h);
    // Opaque bake — SDF in the fragment shader cuts the rounded corners
    ctx.fillStyle = face;
    ctx.fillRect(0, 0, w, h);

    // Journey media column → top media on portrait reel cards
    const mediaH = Math.round(h * (photo && photo.naturalWidth > 0 ? 0.48 : 0.38));
    ctx.fillStyle = mediaBg;
    ctx.fillRect(0, 0, w, mediaH);

    if (photo && photo.naturalWidth > 0) {
        // object-fit: cover (matches .sj-media img)
        const scale = Math.max(w / photo.naturalWidth, mediaH / photo.naturalHeight) * 1.12;
        const dw = photo.naturalWidth * scale;
        const dh = photo.naturalHeight * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, mediaH);
        ctx.clip();
        ctx.drawImage(photo, (w - dw) / 2, (mediaH - dh) / 2, dw, dh);
        ctx.restore();
    } else {
        const g = ctx.createLinearGradient(0, 0, w, mediaH);
        g.addColorStop(0, "#d7e2f4");
        g.addColorStop(1, "#b7c9e6");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, mediaH);
        ctx.fillStyle = "rgba(41, 92, 199, 0.14)";
        ctx.beginPath();
        ctx.arc(w * 0.7, mediaH * 0.52, mediaH * 0.48, 0, Math.PI * 2);
        ctx.fill();
    }

    const padX = 34;
    let y = mediaH + 32;

    ctx.fillStyle = blue;
    ctx.font = `700 16px ${font}`;
    ctx.fillText((card.label || "Solution").toUpperCase(), padX, y);

    y += 40;
    ctx.fillStyle = ink;
    ctx.font = `700 32px ${font}`;
    y = wrap(ctx, card.title, padX, y, w - padX * 2, 36, 3) + 14;

    if (card.text) {
        ctx.fillStyle = muted;
        ctx.font = `500 19px ${font}`;
        y = wrap(ctx, card.text, padX, y, w - padX * 2, 26, 4) + 16;
    }

    if (card.highlight) {
        const textX = padX + 16;
        const startY = y;
        ctx.fillStyle = blue;
        ctx.font = `600 18px ${font}`;
        const endY = wrap(ctx, card.highlight, textX, y, w - textX - padX, 24, 3);
        ctx.fillStyle = blue;
        roundRect(ctx, padX, startY - 14, 3, Math.max(20, endY - startY + 4), 2);
        ctx.fill();
    }

    return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const c = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, c);
    else {
        ctx.moveTo(x + c, y);
        ctx.arcTo(x + w, y, x + w, y + h, c);
        ctx.arcTo(x + w, y + h, x, y + h, c);
        ctx.arcTo(x, y + h, x, y, c);
        ctx.arcTo(x, y, x + w, y, c);
        ctx.closePath();
    }
}

function wrap(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lineH: number,
    maxLines: number,
) {
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    let yy = y;
    let lines = 0;
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, yy);
            line = word;
            yy += lineH;
            lines++;
            if (lines >= maxLines) return yy;
        } else line = test;
    }
    if (line && lines < maxLines) {
        ctx.fillText(line, x, yy);
        yy += lineH;
    }
    return yy;
}

function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

/** Same-origin proxy so WebGL can upload CMS images (storage has no CORS). */
export function reelImageSrc(src?: string) {
    if (!src) return "";
    if (src.startsWith("/") || src.startsWith("data:")) return src;
    try {
        const host = new URL(src).hostname;
        if (host === "inspire-sa.com" || host.endsWith(".inspire-sa.com")) {
            return `/api/media/?url=${encodeURIComponent(src)}`;
        }
    } catch {
        /* keep original */
    }
    return src;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = "async";
        // Proxied URLs are same-origin; remote still needs anonymous for GL upload
        if (!src.startsWith("/") && !src.startsWith("data:")) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/* ---- WebGL film-band mesh ---- */
const COLS = 64;
const FLOATS = 6; // x, y, u, v, shade, lift
const MAX_COPIES = 24;
const TEX_W = 512;
const TEX_H = 1024;

const VS = `
attribute vec2 aPos;
attribute vec2 aUV;
attribute float aShade;
attribute float aLift;
uniform vec2 uRes;
varying vec2 vUV;
varying float vShade;
varying float vLift;
void main() {
  vUV = aUV;
  vShade = aShade;
  vLift = aLift;
  vec2 c = aPos / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

const FS = (deriv: boolean) => `${deriv ? "#extension GL_OES_standard_derivatives : enable\n" : ""}precision mediump float;
uniform sampler2D uTex;
uniform vec2 uCard;
uniform float uRadius;
uniform float uTime;
varying vec2 vUV;
varying float vShade;
varying float vLift;
void main() {
  vec2 p = (vUV - 0.5) * uCard;
  vec2 q = abs(p) - (0.5 * uCard - uRadius);
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float aa = ${deriv ? "max(fwidth(sd), 1e-4)" : "1.25"};
  float alpha = clamp(0.5 - sd / aa, 0.0, 1.0);

  vec4 tex = texture2D(uTex, vUV);

  // Soft cylindrical shade + cyan rim when lifted
  float sheen = 0.08 + 0.12 * vShade + 0.18 * vLift;
  float sweep = 0.5 + 0.5 * sin((vUV.x + uTime * 0.08) * 6.28318);
  sheen += sweep * 0.04 * (0.35 + vLift);

  vec3 rgb = tex.rgb * (0.88 + sheen);
  rgb += vec3(0.06, 0.14, 0.28) * vLift * 0.35;
  // Premultiplied
  gl_FragColor = vec4(rgb * alpha, alpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
    const sh = gl.createShader(type);
    if (!sh) throw new Error("shader");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(log || "compile");
    }
    return sh;
}

export function createSolutionsCurveReel(
    canvas: HTMLCanvasElement,
    band: HTMLElement,
    cards: ReelCard[],
): ReelApi {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const LOOP_SECONDS = 22;
    const HOVER_SPEED = 0.18;
    const LIFT_SCALE = 1.08;
    let CURVE_HEIGHT = 2.8;
    let CURVE_SPREAD = 0.65;
    const CARD_MARGIN = 0.015;

    const source = cards.length ? cards : [{ id: "0", label: "Solution", title: "Solution" }];
    const list: ReelCard[] = [];
    const target = Math.max(7, source.length);
    for (let i = 0; i < target; i++) list.push(source[i % source.length]);

    let cardCanvases = list.map((c, i) => paintCard(c, i));
    const slots = list.length;

    let gl: WebGLRenderingContext | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;
    let prog: WebGLProgram | null = null;
    let vbo: WebGLBuffer | null = null;
    let loc: {
        pos: number;
        uv: number;
        shade: number;
        lift: number;
        res: WebGLUniformLocation | null;
        card: WebGLUniformLocation | null;
        radius: WebGLUniformLocation | null;
        tex: WebGLUniformLocation | null;
        time: WebGLUniformLocation | null;
    } | null = null;
    let glTextures: WebGLTexture[] = [];
    let glLost = false;
    const verts = new Float32Array(MAX_COPIES * COLS * 6 * FLOATS);
    const slotStart = new Int32Array(16);
    const slotCount = new Int32Array(16);

    let W = 0;
    let H = 0;
    let dpr = 1;
    let t = 13 / 14;
    let speed = 1;
    let raf = 0;
    let last = 0;
    let clock = 0;
    let inView = false;
    let destroyed = false;
    let ready = false;
    let pointer: { x: number; y: number } | null = null;
    let hovered = -1;
    let liftX = 0;
    let dragging: { x: number; time: number; v: number } | null = null;
    const lifts = list.map(() => 0);
    const liftSprings = list.map((_, i) =>
        spring({
            from: 0,
            tension: 190,
            friction: 22,
            onUpdate: (v) => {
                lifts[i] = v;
            },
        }),
    );
    const speedSpring = spring({
        from: 1,
        tension: 280,
        friction: 60,
        onUpdate: (v) => {
            speed = v;
        },
    });
    const flingSpring = spring({
        from: 1,
        tension: 280,
        friction: 120,
        onUpdate: (v) => {
            speed = v;
        },
    });

    type Copy = { i: number; F: number };
    let copies: Copy[] = [];
    let pitch = 1;
    let cardW = 1;
    let cardH = 1;

    const zOf = (s: number, k: number) => {
        const L = s / k;
        return s * (1 + CURVE_SPREAD * L * L);
    };
    const BOf = (s: number, C: number) => {
        const L = Math.min(Math.abs(s) / C, Math.PI / 2);
        return Math.min(1.5, 1 - Math.cos(L));
    };
    const teOf = (s: number, C: number) => 1 + CURVE_HEIGHT * BOf(s, C) * 0.22;

    const layout = () => {
        const short = Math.min(W, H);
        const cssW = W / dpr;
        // 0.8× previous band fill — slightly smaller, still readable on the dark field
        const sizePct = cssW >= 1440 ? 0.576 : cssW >= 1024 ? 0.56 : cssW >= 768 ? 0.512 : 0.56;
        const gapPct = cssW >= 1440 ? 0.03 : 0.034;
        CURVE_HEIGHT = cssW >= 1024 ? 2.2 : cssW >= 768 ? 1.7 : 0.75;
        CURVE_SPREAD = cssW >= 1024 ? 0.55 : cssW >= 768 ? 0.42 : 0.18;

        cardH = short * sizePct;
        cardW = cardH * (3 / 4);
        const gap = short * gapPct;
        pitch = cardW + gap;
        const track = slots * pitch;
        const E = t * track;
        const k = W / 2 + pitch;
        const A = Math.max(0.06, Math.PI / 2.2);
        const C = k / A;
        copies = [];

        for (let i = 0; i < slots; i++) {
            const X = (((i * pitch - E) % track) + track) % track - track / 2;
            for (let Y = -1; Y <= 1; Y++) {
                const F = X + Y * track;
                if (Math.abs(zOf(F, k)) > W / 2 + cardW * 1.6) continue;
                copies.push({ i, F });
            }
        }

        return { k, C, T: H / 2, hmax: H / 2 - CARD_MARGIN * H, track };
    };

    const hitAt = (px: number, py: number) => {
        const { k, C, T, hmax } = layout();
        for (let c = copies.length - 1; c >= 0; c--) {
            const { i, F } = copies[c];
            const x0 = W / 2 + zOf(F - cardW / 2, k);
            const x1 = W / 2 + zOf(F + cardW / 2, k);
            if (px < x0 || px > x1) continue;
            const half = Math.min((cardH * teOf(F, C)) / 2, hmax);
            if (Math.abs(py - T) <= half) return i;
        }
        return -1;
    };

    const liftedCopy = (slot: number, x: number) => {
        const { k } = layout();
        let best = -1;
        let dist = Infinity;
        for (let c = 0; c < copies.length; c++) {
            if (copies[c].i !== slot) continue;
            const dd = Math.abs(W / 2 + zOf(copies[c].F, k) - x);
            if (dd < dist) {
                dist = dd;
                best = c;
            }
        }
        return best;
    };

    function makeTexture(src: HTMLCanvasElement) {
        if (!gl) return null;
        const tex = gl.createTexture();
        if (!tex) return null;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
        if (aniso) {
            gl.texParameterf(
                gl.TEXTURE_2D,
                aniso.TEXTURE_MAX_ANISOTROPY_EXT,
                Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)),
            );
        }
        return tex;
    }

    function uploadTextures() {
        if (!gl) return;
        for (const tex of glTextures) gl.deleteTexture(tex);
        glTextures = cardCanvases.map((c) => makeTexture(c)!).filter(Boolean);
    }

    function initGL() {
        if (!gl) return;
        const deriv = !!gl.getExtension("OES_standard_derivatives");
        const vs = compile(gl, gl.VERTEX_SHADER, VS);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FS(deriv));
        prog = gl.createProgram();
        if (!prog) throw new Error("program");
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
        gl.useProgram(prog);

        loc = {
            pos: gl.getAttribLocation(prog, "aPos"),
            uv: gl.getAttribLocation(prog, "aUV"),
            shade: gl.getAttribLocation(prog, "aShade"),
            lift: gl.getAttribLocation(prog, "aLift"),
            res: gl.getUniformLocation(prog, "uRes"),
            card: gl.getUniformLocation(prog, "uCard"),
            radius: gl.getUniformLocation(prog, "uRadius"),
            tex: gl.getUniformLocation(prog, "uTex"),
            time: gl.getUniformLocation(prog, "uTime"),
        };

        vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW);

        const stride = FLOATS * 4;
        gl.enableVertexAttribArray(loc.pos);
        gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(loc.uv);
        gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 8);
        gl.enableVertexAttribArray(loc.shade);
        gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 16);
        gl.enableVertexAttribArray(loc.lift);
        gl.vertexAttribPointer(loc.lift, 1, gl.FLOAT, false, stride, 20);

        gl.uniform1i(loc.tex, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        uploadTextures();
    }

    function quad(
        o: number,
        xa: number,
        ha: number,
        ua: number,
        sa: number,
        xb: number,
        hb: number,
        ub: number,
        sb: number,
        lift: number,
        T: number,
    ) {
        // two triangles sharing the column edge
        const push = (x: number, y: number, u: number, v: number, s: number) => {
            verts[o++] = x;
            verts[o++] = y;
            verts[o++] = u;
            verts[o++] = v;
            verts[o++] = s;
            verts[o++] = lift;
        };
        push(xa, T - ha, ua, 0, sa);
        push(xb, T - hb, ub, 0, sb);
        push(xa, T + ha, ua, 1, sa);
        push(xa, T + ha, ua, 1, sa);
        push(xb, T - hb, ub, 0, sb);
        push(xb, T + hb, ub, 1, sb);
        return o;
    }

    function buildMesh() {
        const { k, C, T, hmax } = layout();
        let o = 0;
        for (let s = 0; s < slots; s++) {
            slotStart[s] = o / FLOATS;
            const lc = lifts[s] > 1e-3 ? liftedCopy(s, liftX) : -1;
            for (let c = 0; c < copies.length; c++) {
                if (copies[c].i !== s) continue;
                const F = copies[c].F;
                const cx = W / 2 + zOf(F, k);
                const L = lifts[s] || 0;
                const S = c === lc ? 1 + (LIFT_SCALE - 1) * L : 1;

                let xa = 0;
                let ha = 0;
                let ua = 0;
                let sa = 0;
                for (let j = 0; j <= COLS; j++) {
                    const q = F - cardW / 2 + (j * cardW) / COLS;
                    const rawX = W / 2 + zOf(q, k);
                    const xb = cx + (rawX - cx) * S;
                    const hb = Math.min((cardH * teOf(q, C) * S) / 2, hmax);
                    const ub = j / COLS;
                    // Shade from how far this column sits from band centre (cylinder feel)
                    const sb = clamp(1 - Math.abs(rawX - W / 2) / (W * 0.55), 0, 1);
                    if (j > 0) o = quad(o, xa, ha, ua, sa, xb, hb, ub, sb, L, T);
                    xa = xb;
                    ha = hb;
                    ua = ub;
                    sa = sb;
                }
            }
            slotCount[s] = o / FLOATS - slotStart[s];
        }
    }

    function drawGL() {
        if (!gl || !prog || !vbo || !loc || glLost) return;
        layout();
        buildMesh();
        gl.viewport(0, 0, W, H);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
        gl.uniform2f(loc.res, W, H);
        gl.uniform2f(loc.card, cardW, cardH);
        gl.uniform1f(loc.radius, Math.min(cardW, cardH) * 0.07);
        gl.uniform1f(loc.time, clock);

        for (let s = 0; s < slots; s++) {
            if (!slotCount[s] || !glTextures[s]) continue;
            gl.bindTexture(gl.TEXTURE_2D, glTextures[s]);
            gl.drawArrays(gl.TRIANGLES, slotStart[s], slotCount[s]);
        }
    }

    /** Clean 2D fallback — whole cards, no strip seams. */
    function draw2d() {
        if (!ctx2d) return;
        const { k, C, T, hmax } = layout();
        ctx2d.clearRect(0, 0, W, H);
        for (let c = 0; c < copies.length; c++) {
            const { i, F } = copies[c];
            const cx = W / 2 + zOf(F, k);
            const lift = lifts[i] || 0;
            const isLift = liftedCopy(i, liftX) === c && lift > 1e-3;
            const S = isLift ? 1 + (LIFT_SCALE - 1) * lift : 1;
            const hh = Math.min(cardH * teOf(F, C), hmax * 2) * S;
            const ww = cardW * S * (1 + Math.abs(zOf(F + cardW / 2, k) - zOf(F - cardW / 2, k)) / cardW - 1) * 0.5 + cardW * S;
            const fade = clamp(1 - Math.abs(cx - W / 2) / (W * 0.62), 0.45, 1);
            ctx2d.save();
            ctx2d.globalAlpha = fade;
            ctx2d.translate(cx, T);
            ctx2d.scale(S, 1);
            // Slight perspective skew via non-uniform — keep simple
            ctx2d.drawImage(cardCanvases[i], -ww / 2 / S, -hh / 2, ww / S, hh);
            ctx2d.restore();
        }
    }

    const draw = () => {
        if (!W || !H || destroyed || !ready) return;
        if (gl && !glLost) drawGL();
        else draw2d();
    };

    const tick = (now: number) => {
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        clock += dt;
        if (!dragging && !reduced) t = (((t + (dt * speed) / LOOP_SECONDS) % 1) + 1) % 1;

        let hit = -1;
        if (pointer) {
            layout();
            hit = hitAt(pointer.x * dpr, pointer.y * dpr);
        }
        if (hit !== hovered) {
            if (hovered >= 0) liftSprings[hovered].to(0);
            if (hit >= 0) liftSprings[hit].to(1);
            hovered = hit;
            band.dataset.hoverSlot = String(hit);
        }
        if (hit >= 0 && pointer) liftX = pointer.x * dpr;
        draw();
        raf = requestAnimationFrame(tick);
    };

    const resize = () => {
        if (destroyed) return;
        const r = band.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(1, Math.round(r.width * dpr));
        H = Math.max(1, Math.round(r.height * dpr));
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = `${r.width}px`;
        canvas.style.height = `${r.height}px`;
        draw();
    };

    const sync = () => {
        if (destroyed) return;
        if (inView && !document.hidden && !reduced) {
            if (!raf) {
                last = 0;
                raf = requestAnimationFrame(tick);
            }
        } else if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            draw();
        }
    };

    try {
        gl = canvas.getContext("webgl", {
            alpha: true,
            premultipliedAlpha: true,
            antialias: true,
            preserveDrawingBuffer: false,
        });
        if (gl) initGL();
    } catch {
        gl = null;
    }
    if (!gl) ctx2d = canvas.getContext("2d");

    ready = true;

    void Promise.all(list.map((c) => (c.image ? loadImage(c.image) : Promise.resolve(null)))).then((imgs) => {
        if (destroyed) return;
        cardCanvases = list.map((c, i) => paintCard(c, i, imgs[i], TEX_W, TEX_H));
        if (gl && !glLost) uploadTextures();
        draw();
    });

    canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        glLost = true;
        sync();
    });
    canvas.addEventListener("webglcontextrestored", () => {
        try {
            initGL();
            glLost = false;
            draw();
            sync();
        } catch {
            gl = null;
            ctx2d = canvas.getContext("2d");
        }
    });

    const io = new IntersectionObserver(
        ([e]) => {
            inView = e.isIntersecting;
            sync();
        },
        { threshold: 0.05 },
    );
    io.observe(band);

    const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = band.getBoundingClientRect();
        pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
        if (!dragging) speedSpring.to(HOVER_SPEED);
    };
    const onLeave = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        pointer = null;
        speedSpring.to(1);
        if (hovered >= 0) liftSprings[hovered].to(0);
        hovered = -1;
    };
    const onDown = (e: PointerEvent) => {
        if (e.pointerType === "mouse") return;
        dragging = { x: e.clientX, time: e.timeStamp, v: 0 };
        flingSpring.jump(0);
    };
    const onDrag = (e: PointerEvent) => {
        if (!dragging || e.pointerType === "mouse") return;
        const dx = e.clientX - dragging.x;
        const dtm = Math.max(1, e.timeStamp - dragging.time);
        layout();
        const step = pitch || 1;
        const dT = -(dx * dpr) / (step * slots);
        t = (((t + dT) % 1) + 1) % 1;
        dragging.v = 0.7 * (dT / (dtm / 1000)) + 0.3 * dragging.v;
        dragging.x = e.clientX;
        dragging.time = e.timeStamp;
        if (!raf) draw();
    };
    const onUp = (e: PointerEvent) => {
        if (!dragging || e.pointerType === "mouse") return;
        const fling = clamp(dragging.v * LOOP_SECONDS, -8, 8);
        dragging = null;
        flingSpring.jump(fling || 1).to(1);
    };

    band.addEventListener("pointermove", onMove);
    band.addEventListener("pointerleave", onLeave);
    band.addEventListener("pointerdown", onDown);
    band.addEventListener("pointermove", onDrag);
    band.addEventListener("pointerup", onUp);
    band.addEventListener("pointercancel", onUp);
    document.addEventListener("visibilitychange", sync);

    const ro = new ResizeObserver(resize);
    ro.observe(band);
    resize();
    if (reduced) draw();
    else sync();

    return {
        resize,
        destroy: () => {
            destroyed = true;
            cancelAnimationFrame(raf);
            io.disconnect();
            ro.disconnect();
            band.removeEventListener("pointermove", onMove);
            band.removeEventListener("pointerleave", onLeave);
            band.removeEventListener("pointerdown", onDown);
            band.removeEventListener("pointermove", onDrag);
            band.removeEventListener("pointerup", onUp);
            band.removeEventListener("pointercancel", onUp);
            document.removeEventListener("visibilitychange", sync);
            if (gl) {
                for (const tex of glTextures) gl.deleteTexture(tex);
                if (vbo) gl.deleteBuffer(vbo);
                if (prog) gl.deleteProgram(prog);
            }
            band.style.cursor = "";
        },
    };
}
