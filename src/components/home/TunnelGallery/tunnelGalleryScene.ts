import { gsap } from "gsap";
import * as THREE from "three";

/* Estidam Tunnel Gallery — product catalog media only */

const CONFIG = {
    background: "#e8eef8",
    gridColor: "#8aa7c9",
    accentColor: "#295cc7",
    frameColor: "#9bb4d4",
    speed: 0.0075,
    gridIntensity: 0.42,
    mouseAmp: 0.12,
    fadeFar: 58,
    panelFar: 64,
    floorReflect: 0.18,
    cell: 0.8,
};

const SEG = 420;
const HW = 3.2;
const HH = 3.2;
const GAP = 0;
const RING_RADIUS = 92;

export type TunnelGalleryItem = {
    id: string;
    src: string;
    title: string;
    tagline: string;
    status: string;
    statusTone: "available" | "soon";
    logo: string;
    problemLabel: string;
    problem: string;
    usersLabel: string;
    users: string;
};

type Panel = {
    index: number;
    productIndex: number;
    mesh: THREE.Mesh;
    reflection: THREE.Mesh | null;
    material: THREE.ShaderMaterial;
    media: TunnelGalleryItem;
    faceId: number;
    t: number;
    w: number;
    h: number;
    center: THREE.Vector3;
    inward: THREE.Vector3;
    up: THREE.Vector3;
    aspect: number;
    setAspect: (a: number) => void;
};

function resolveTextureSrc(src: string) {
    if (!src) return src;
    if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
    if (/^https?:\/\//i.test(src)) {
        return `/api/media?url=${encodeURIComponent(src)}`;
    }
    return src;
}

export function mountTunnelGallery(root: HTMLElement, items: TunnelGalleryItem[]) {
    const canvas = root.querySelector<HTMLCanvasElement>(".tunnel_gallery_canvas");
    const counterEl = root.querySelector<HTMLElement>(".tunnel_gallery_counter .n");
    const totalEl = root.querySelector<HTMLElement>(".tunnel_gallery_counter .tot");
    const cardEl = root.querySelector<HTMLElement>(".tunnel_gallery_card");
    const cardImg = root.querySelector<HTMLImageElement>(".tunnel_gallery_card_img");
    const cardStatus = root.querySelector<HTMLElement>(".tunnel_gallery_card_status");
    const cardStatusText = root.querySelector<HTMLElement>(".tunnel_gallery_card_status_text");
    const cardTitle = root.querySelector<HTMLElement>(".tunnel_gallery_card_title");
    const cardTagline = root.querySelector<HTMLElement>(".tunnel_gallery_card_tagline");
    const cardLogo = root.querySelector<HTMLImageElement>(".tunnel_gallery_card_logo img");
    const cardLogoWrap = root.querySelector<HTMLElement>(".tunnel_gallery_card_logo");
    const problemItem = root.querySelector<HTMLElement>(".tunnel_gallery_card_meta_item.is_problem");
    const usersItem = root.querySelector<HTMLElement>(".tunnel_gallery_card_meta_item.is_users");
    if (
        !canvas ||
        !counterEl ||
        !totalEl ||
        !cardEl ||
        !cardImg ||
        !cardStatus ||
        !cardStatusText ||
        !cardTitle ||
        !cardTagline ||
        !cardLogo ||
        !cardLogoWrap ||
        !problemItem ||
        !usersItem ||
        !items.length
    ) {
        return () => {};
    }

    const productCount = items.length;
    const STATIONS = Math.min(72, Math.max(productCount * 12, productCount));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const params = {
        speed: reduced ? 0 : CONFIG.speed,
        cell: CONFIG.cell,
        gridIntensity: CONFIG.gridIntensity,
        floorReflect: CONFIG.floorReflect,
        mouseAmp: CONFIG.mouseAmp,
        fadeFar: CONFIG.fadeFar,
        panelFar: CONFIG.panelFar,
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.background);

    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 160);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    let seed = 20260725;
    const rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };

    const pathPoints: THREE.Vector3[] = [];
    const RING_POINTS = 24;
    for (let i = 0; i < RING_POINTS; i += 1) {
        const a = (i / RING_POINTS) * Math.PI * 2;
        const r = RING_RADIUS * (1 + Math.sin(a * 3) * 0.14 + (rand() - 0.5) * 0.06);
        pathPoints.push(
            new THREE.Vector3(
                Math.cos(a) * r,
                Math.sin(a * 2) * 7 + Math.sin(a * 5) * 2.5,
                Math.sin(a) * r,
            ),
        );
    }
    const curve = new THREE.CatmullRomCurve3(pathPoints, true, "catmullrom", 0.5);
    curve.arcLengthDivisions = 4000;
    const totalLength = curve.getLength();
    const frames = curve.computeFrenetFrames(SEG, true);
    const ringPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= SEG; i += 1) ringPoints.push(curve.getPointAt((i % SEG) / SEG));

    const cellV = totalLength / Math.round(totalLength / params.cell);
    const HWi = HW * (1 - GAP);
    const HHi = HH * (1 - GAP);
    const FACES = [
        { off: [HW, 0] as [number, number], a: [0, -HHi] as [number, number], b: [0, HHi] as [number, number] },
        { off: [-HW, 0] as [number, number], a: [0, -HHi] as [number, number], b: [0, HHi] as [number, number] },
        { off: [0, HH] as [number, number], a: [-HWi, 0] as [number, number], b: [HWi, 0] as [number, number] },
        { off: [0, -HH] as [number, number], a: [-HWi, 0] as [number, number], b: [HWi, 0] as [number, number] },
    ];

    const buildTunnel = () => {
        const pos: number[] = [];
        const uv: number[] = [];
        const edge: number[] = [];
        const idx: number[] = [];
        const tmp = new THREE.Vector3();

        FACES.forEach((face) => {
            const base = pos.length / 3;
            const span = Math.hypot(face.b[0] - face.a[0], face.b[1] - face.a[1]);
            for (let i = 0; i <= SEG; i += 1) {
                const p = ringPoints[i];
                const N = frames.normals[i % SEG];
                const B = frames.binormals[i % SEG];
                const v = (i / SEG) * totalLength;
                for (let k = 0; k < 2; k += 1) {
                    const c = k === 0 ? face.a : face.b;
                    tmp.copy(p).addScaledVector(B, face.off[0] + c[0]).addScaledVector(N, face.off[1] + c[1]);
                    pos.push(tmp.x, tmp.y, tmp.z);
                    uv.push(k * span, v);
                    edge.push(k);
                }
            }
            for (let i = 0; i < SEG; i += 1) {
                const a = base + i * 2;
                idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        });

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geo.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
        geo.setIndex(idx);
        return geo;
    };

    const gridMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uCellU: { value: params.cell },
            uCellV: { value: cellV },
            uColor: { value: new THREE.Color(CONFIG.gridColor) },
            uAccent: { value: new THREE.Color(CONFIG.accentColor) },
            uIntensity: { value: params.gridIntensity },
            uTime: { value: 0 },
            uFar: { value: params.fadeFar },
            uHeadV: { value: 0 },
            uLoop: { value: totalLength },
        },
        vertexShader: /* glsl */ `
            attribute float aEdge;
            varying vec2 vUv;
            varying float vEdge;
            varying float vDist;
            void main() {
                vUv = uv;
                vEdge = aEdge;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vDist = -mv.z;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uCellU;
            uniform float uCellV;
            uniform vec3 uColor;
            uniform vec3 uAccent;
            uniform float uIntensity;
            uniform float uTime;
            uniform float uFar;
            uniform float uHeadV;
            uniform float uLoop;
            varying vec2 vUv;
            varying float vEdge;
            varying float vDist;
            float gridLine(float x, float cell) {
                float c = x / cell;
                float d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-5);
                return 1.0 - clamp(d, 0.0, 1.0);
            }
            void main() {
                float lu = gridLine(vUv.x, uCellU);
                float lv = gridLine(vUv.y, uCellV);
                float line = max(lu, lv);
                float e = min(vEdge, 1.0 - vEdge);
                float rim = 1.0 - clamp(e / max(fwidth(vEdge), 1e-5), 0.0, 1.0);
                float wave = 0.5 + 0.5 * sin(vUv.y * 0.055 - uTime * 0.35);
                float dv = mod(vUv.y - uHeadV + uLoop * 0.5, uLoop) - uLoop * 0.5;
                float win = smoothstep(-16.0, -7.0, dv) * (1.0 - smoothstep(uFar * 0.3, uFar, dv));
                float fadeNear = smoothstep(0.6, 7.0, vDist);
                float fade = win * fadeNear;
                float a = (line * 0.72 + rim * 0.9) * uIntensity * fade;
                a *= mix(0.7, 1.05, wave);
                if (a < 0.01) discard;
                vec3 col = mix(uColor, uAccent, rim * 0.55 + wave * 0.1);
                gl_FragColor = vec4(col, a * 0.85);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
    });

    const tunnel = new THREE.Mesh(buildTunnel(), gridMaterial);
    tunnel.frustumCulled = false;
    scene.add(tunnel);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const CARD_W = 1024;
    const CARD_H = 492;
    const CARD_ASPECT = CARD_W / CARD_H;
    const cardSlots = new Map<
        string,
        {
            aspect: number;
            ready: boolean;
            waiting: Array<(a: number) => void>;
            texture: THREE.CanvasTexture;
            canvas: HTMLCanvasElement;
        }
    >();

    function loadHtmlImage(src: string) {
        return new Promise<HTMLImageElement | null>((resolve) => {
            if (!src) {
                resolve(null);
                return;
            }
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = resolveTextureSrc(src);
        });
    }

    function roundRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
    ) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }

    function wrapText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        maxLines: number,
    ) {
        const words = text.split(/\s+/).filter(Boolean);
        if (!words.length) return y;
        let line = "";
        let cy = y;
        let lines = 0;
        for (let i = 0; i < words.length; i += 1) {
            const test = line ? `${line} ${words[i]}` : words[i];
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, cy);
                lines += 1;
                if (lines >= maxLines) return cy + lineHeight;
                line = words[i];
                cy += lineHeight;
            } else {
                line = test;
            }
        }
        if (line && lines < maxLines) ctx.fillText(line, x, cy);
        return cy + lineHeight;
    }

    function paintProductCard(
        ctx: CanvasRenderingContext2D,
        item: TunnelGalleryItem,
        photo: HTMLImageElement | null,
        logo: HTMLImageElement | null,
    ) {
        const w = CARD_W;
        const h = CARD_H;
        ctx.clearRect(0, 0, w, h);

        // Soft drop shadow
        ctx.save();
        ctx.shadowColor = "rgba(11, 26, 51, 0.12)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 10;
        roundRect(ctx, 18, 18, w - 36, h - 36, 36);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();

        roundRect(ctx, 18, 18, w - 36, h - 36, 36);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "rgba(17, 24, 39, 0.06)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Media panel
        const mediaX = 34;
        const mediaY = 34;
        const mediaW = (w - 36) * 0.48;
        const mediaH = h - 68;
        ctx.save();
        roundRect(ctx, mediaX, mediaY, mediaW, mediaH, 24);
        ctx.clip();
        ctx.fillStyle = "#e8eef8";
        ctx.fillRect(mediaX, mediaY, mediaW, mediaH);
        if (photo) {
            const scale = Math.max(mediaW / photo.width, mediaH / photo.height);
            const dw = photo.width * scale;
            const dh = photo.height * scale;
            ctx.drawImage(photo, mediaX + (mediaW - dw) / 2, mediaY + (mediaH - dh) / 2, dw, dh);
        }
        ctx.restore();

        // Body copy
        const bodyX = mediaX + mediaW + 36;
        const bodyW = w - bodyX - 48;
        let cy = 78;

        if (item.status) {
            const tone = item.statusTone === "soon" ? { bg: "#eef2ff", fg: "#3b5bdb" } : { bg: "#eefdf5", fg: "#00d95b" };
            ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
            const label = item.status.toUpperCase();
            const tw = ctx.measureText(label).width;
            const pw = tw + 36;
            const ph = 34;
            roundRect(ctx, bodyX, cy, pw, ph, 17);
            ctx.fillStyle = tone.bg;
            ctx.fill();
            ctx.fillStyle = tone.fg;
            ctx.beginPath();
            ctx.arc(bodyX + 16, cy + ph / 2, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText(label, bodyX + 28, cy + 23);
            cy += 56;
        }

        ctx.fillStyle = "#111827";
        ctx.font = "700 42px ui-sans-serif, system-ui, sans-serif";
        cy = wrapText(ctx, item.title || "Product", bodyX, cy + 10, bodyW - (logo ? 110 : 0), 48, 2);

        if (item.tagline) {
            ctx.fillStyle = "#6b7280";
            ctx.font = "500 22px ui-sans-serif, system-ui, sans-serif";
            wrapText(ctx, item.tagline, bodyX, cy + 8, bodyW - (logo ? 110 : 0), 30, 3);
        }

        if (logo) {
            const lw = 96;
            const lh = (logo.height / logo.width) * lw;
            const lx = w - 48 - lw;
            const ly = 70;
            ctx.drawImage(logo, lx, ly, lw, Math.min(lh, 90));
        }

        // Bottom meta hints
        let metaY = h - 110;
        if (item.problem) {
            ctx.fillStyle = "#9aa3b2";
            ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
            ctx.fillText((item.problemLabel || "Problem").toUpperCase(), bodyX, metaY);
            ctx.fillStyle = "#374151";
            ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
            wrapText(ctx, item.problem, bodyX, metaY + 26, bodyW, 26, 2);
            metaY += 70;
        }
    }

    function loadProductCard(item: TunnelGalleryItem, onAspect: (a: number) => void) {
        let slot = cardSlots.get(item.id);
        if (!slot) {
            const cnv = document.createElement("canvas");
            cnv.width = CARD_W;
            cnv.height = CARD_H;
            const ctx = cnv.getContext("2d")!;
            paintProductCard(ctx, item, null, null);
            const texture = new THREE.CanvasTexture(cnv);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = maxAniso;
            texture.needsUpdate = true;
            slot = {
                aspect: CARD_ASPECT,
                ready: false,
                waiting: [],
                texture,
                canvas: cnv,
            };
            cardSlots.set(item.id, slot);

            Promise.all([loadHtmlImage(item.src), loadHtmlImage(item.logo)]).then(([photo, logo]) => {
                paintProductCard(ctx, item, photo, logo);
                texture.needsUpdate = true;
                slot!.ready = true;
                slot!.waiting.forEach((fn) => fn(CARD_ASPECT));
                slot!.waiting.length = 0;
            });
        }
        if (slot.ready) onAspect(slot.aspect);
        else slot.waiting.push(onAspect);
        return slot.texture;
    }

    const panelVertex = /* glsl */ `
        varying vec2 vUv;
        varying float vDist;
        void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vDist = -mv.z;
            gl_Position = projectionMatrix * mv;
        }
    `;
    const panelFragment = /* glsl */ `
        uniform sampler2D uMap;
        uniform vec2 uCrop;
        uniform vec3 uFrame;
        uniform float uHover;
        uniform float uReflect;
        uniform float uFar;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vDist;
        void main() {
            vec2 uv = 0.5 + (vUv - 0.5) * uCrop;
            vec3 col = texture2D(uMap, uv).rgb;
            vec2 d = min(vUv, 1.0 - vUv);
            float edge = 1.0 - smoothstep(0.0, 0.01, min(d.x, d.y));
            float halo = 1.0 - smoothstep(0.01, 0.045, min(d.x, d.y));
            col *= mix(1.0, 1.05, uHover);
            col += uFrame * edge * mix(0.08, 0.28, uHover);
            col += uFrame * halo * mix(0.02, 0.08, uHover);
            float fade = 1.0 - smoothstep(uFar * 0.55, uFar, vDist);
            if (uReflect > 0.5) {
                float a = uOpacity * fade * (1.0 - smoothstep(0.0, 0.8, vUv.y));
                if (a < 0.004) discard;
                gl_FragColor = vec4(col * 0.72, a);
            } else {
                gl_FragColor = vec4(col * fade, 1.0);
            }
        }
    `;

    const raycaster = new THREE.Raycaster();
    const panels: Panel[] = [];
    // Prefer wide footprints so panels match product-card proportions.
    const WALL_FOOTPRINTS = [
        [6, 3],
        [7, 4],
        [5, 3],
        [8, 4],
        [6, 4],
        [7, 3],
    ];
    const CAP_FOOTPRINTS = [
        [6, 3],
        [5, 3],
        [7, 3],
        [8, 4],
    ];
    const FACE_ORDER = [0, 1, 2, 0, 1, 3, 0, 1, 2, 0, 1, 0, 1, 3, 0, 1, 2, 0, 1, 0, 3, 1, 0, 2, 1, 0];
    const mediaFor = (i: number) => items[i % productCount];

    const CELLS_ACROSS = Math.round((2 * HW) / params.cell);
    let vSlot = 0;
    const _p = new THREE.Vector3();
    const _n = new THREE.Vector3();
    const _b = new THREE.Vector3();
    const _v = new THREE.Vector3();

    function frameAt(t: number, outP: THREE.Vector3, outN: THREE.Vector3, outB: THREE.Vector3) {
        const tt = ((t % 1) + 1) % 1;
        const f = tt * SEG;
        const i0 = Math.floor(f) % SEG;
        const i1 = (i0 + 1) % SEG;
        const k = f - Math.floor(f);
        outP.copy(curve.getPointAt(tt));
        outN.copy(frames.normals[i0]).lerp(frames.normals[i1], k).normalize();
        outB.copy(frames.binormals[i0]).lerp(frames.binormals[i1], k).normalize();
    }

    function surfacePoint(faceId: number, v: number, across: number, out: THREE.Vector3) {
        frameAt(v / totalLength, _p, _n, _b);
        out.copy(_p);
        if (faceId === 0) out.addScaledVector(_b, HW - 0.03).addScaledVector(_n, across);
        else if (faceId === 1) out.addScaledVector(_b, -(HW - 0.03)).addScaledVector(_n, across);
        else if (faceId === 2) out.addScaledVector(_n, HH - 0.03).addScaledVector(_b, across);
        else out.addScaledVector(_n, -(HH - 0.03)).addScaledVector(_b, across);
        return out;
    }

    function buildPanelGeometry(faceId: number, v0: number, v1: number, a0: number, a1: number) {
        const wall = faceId < 2;
        const steps = Math.max(2, Math.ceil(Math.abs(v1 - v0) / (cellV * 0.34)));
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        for (let j = 0; j <= steps; j += 1) {
            const s = j / steps;
            const v = v0 + (v1 - v0) * s;
            for (let k = 0; k < 2; k += 1) {
                const a = k === 0 ? a0 : a1;
                surfacePoint(faceId, v, a, _v);
                pos.push(_v.x, _v.y, _v.z);
                if (wall) uv.push(faceId === 0 ? 1 - s : s, k);
                else uv.push(faceId === 2 ? 1 - k : k, s);
            }
        }
        for (let j = 0; j < steps; j += 1) {
            const b = j * 2;
            idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeBoundingSphere();
        return geo;
    }

    function makePanel(i: number) {
        const productIndex = i % productCount;
        const media = mediaFor(i);
        const faceId = FACE_ORDER[i % FACE_ORDER.length];
        const wall = faceId < 2;
        const fp = wall
            ? WALL_FOOTPRINTS[Math.floor(rand() * WALL_FOOTPRINTS.length)]
            : CAP_FOOTPRINTS[Math.floor(rand() * CAP_FOOTPRINTS.length)];
        const cellsX = fp[0];
        const cellsY = fp[1];
        const cellsAlong = wall ? cellsX : cellsY;
        const cellsAcross = wall ? cellsY : cellsX;
        const totalSlots = Math.round(totalLength / cellV);
        const stride = Math.floor(totalSlots / STATIONS);
        vSlot = Math.max(vSlot, i * stride);
        const kStart = vSlot % totalSlots;
        vSlot += cellsAlong + 2 + Math.floor(rand() * 3);
        const vA = kStart * cellV + 0.01;
        const vB = (kStart + cellsAlong) * cellV - 0.01;
        const vCenter = (vA + vB) * 0.5;
        const t = (vCenter / totalLength) % 1;
        const mMax = CELLS_ACROSS - cellsAcross;
        const m = Math.max(0, Math.min(mMax, 1 + Math.floor(rand() * Math.max(1, mMax - 1))));
        const aA = m * params.cell - HW + 0.01;
        const aB = (m + cellsAcross) * params.cell - HW - 0.01;
        const across = (aA + aB) * 0.5;
        const w = wall ? vB - vA : aB - aA;
        const h = wall ? aB - aA : vB - vA;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uMap: { value: null },
                uCrop: { value: new THREE.Vector2(1, 1) },
                uFrame: { value: new THREE.Color(CONFIG.frameColor) },
                uHover: { value: 0 },
                uReflect: { value: 0 },
                uFar: { value: params.panelFar },
                uOpacity: { value: 1 },
            },
            vertexShader: panelVertex,
            fragmentShader: panelFragment,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(buildPanelGeometry(faceId, vA, vB, aA, aB), material);
        mesh.frustumCulled = false;
        scene.add(mesh);

        const center = surfacePoint(faceId, vCenter, across, new THREE.Vector3());
        frameAt(t, _p, _n, _b);
        const inward = new THREE.Vector3();
        if (faceId === 0) inward.copy(_b).multiplyScalar(-1);
        else if (faceId === 1) inward.copy(_b);
        else if (faceId === 2) inward.copy(_n).multiplyScalar(-1);
        else inward.copy(_n);
        const up = wall
            ? _n.clone()
            : _p.clone().sub(curve.getPointAt((((t - 0.004) % 1) + 1) % 1)).normalize();

        let reflection: THREE.Mesh | null = null;
        if (wall && params.floorReflect > 0) {
            const refMat = material.clone();
            refMat.uniforms.uMap = material.uniforms.uMap;
            refMat.uniforms.uCrop = material.uniforms.uCrop;
            refMat.uniforms.uHover = material.uniforms.uHover;
            refMat.uniforms.uReflect.value = 1;
            refMat.uniforms.uOpacity.value = params.floorReflect;
            refMat.transparent = true;
            refMat.depthWrite = false;
            reflection = new THREE.Mesh(buildPanelGeometry(faceId, vA, vB, -2 * HH - aA, -2 * HH - aB), refMat);
            reflection.frustumCulled = false;
            scene.add(reflection);
        }

        const panel: Panel = {
            index: i,
            productIndex,
            mesh,
            reflection,
            material,
            media,
            faceId,
            t,
            w,
            h,
            center,
            inward,
            up,
            aspect: w / h,
            setAspect(a: number) {
                const panelAspect = w / h;
                const crop = material.uniforms.uCrop.value as THREE.Vector2;
                if (a > panelAspect) crop.set(panelAspect / a, 1);
                else crop.set(1, a / panelAspect);
            },
        };

        material.uniforms.uMap.value = loadProductCard(media, (a) => panel.setAspect(a));
        mesh.userData.panel = panel;
        panels.push(panel);
    }

    for (let i = 0; i < STATIONS; i += 1) makePanel(i);
    totalEl.textContent = String(productCount).padStart(2, "0");

    const state = {
        t: 0,
        speedMul: 1,
        focus: null as Panel | null,
        focusMix: 0,
        hovered: null as Panel | null,
        mouse: new THREE.Vector2(-2, -2),
        aim: new THREE.Vector2(0, 0),
        aimTarget: new THREE.Vector2(0, 0),
        aimS1: new THREE.Vector2(0, 0),
        currentProduct: -1,
    };

    const travelPos = new THREE.Vector3();
    const travelQuat = new THREE.Quaternion();
    const lookTarget = new THREE.Vector3();
    const focusPos = new THREE.Vector3();
    const focusQuat = new THREE.Quaternion();
    const mUp = new THREE.Vector3();
    const mAxis = new THREE.Vector3();
    const lookMatrix = new THREE.Matrix4();
    const aimQuat = new THREE.Quaternion();
    const aimEuler = new THREE.Euler();
    const rawQuat = new THREE.Quaternion();
    const smoothQuat = new THREE.Quaternion();
    let quatReady = false;
    let smoothRoll = 0;

    const frameIndexAt = (t: number) => ((Math.round(t * SEG) % SEG) + SEG) % SEG;
    function normalAt(t: number, out: THREE.Vector3) {
        const f = ((t % 1) + 1) * SEG;
        const i0 = Math.floor(f) % SEG;
        const i1 = (i0 + 1) % SEG;
        return out.copy(frames.normals[i0]).lerp(frames.normals[i1], f - Math.floor(f)).normalize();
    }

    function updateTravel(dt: number) {
        if (!state.focus) state.t = (state.t + params.speed * state.speedMul * dt) % 1;
        const t = state.t;
        travelPos.copy(curve.getPointAt(t));
        lookTarget.copy(curve.getPointAt((t + 0.022) % 1));
        normalAt(t, mUp);
        lookMatrix.lookAt(travelPos, lookTarget, mUp);
        rawQuat.setFromRotationMatrix(lookMatrix);
        if (!quatReady) {
            smoothQuat.copy(rawQuat);
            quatReady = true;
        } else {
            smoothQuat.slerp(rawQuat, 1 - Math.exp(-2.6 * dt));
        }
        travelQuat.copy(smoothQuat);
        mAxis.copy(frames.tangents[frameIndexAt(t)]).cross(frames.tangents[frameIndexAt((t + 0.02) % 1)]);
        const targetRoll = THREE.MathUtils.clamp(mAxis.dot(mUp) * 3.5, -0.1, 0.1);
        smoothRoll += (targetRoll - smoothRoll) * (1 - Math.exp(-1.8 * dt));
        aimEuler.set(state.aim.y, state.aim.x, smoothRoll, "YXZ");
        aimQuat.setFromEuler(aimEuler);
        travelQuat.multiply(aimQuat);
    }

    function focusTargets(panel: Panel) {
        const dist = Math.max(panel.w / camera.aspect, panel.h) * 1.25;
        focusPos.copy(panel.center).addScaledVector(panel.inward, dist);
        mUp.copy(panel.up);
        lookMatrix.lookAt(focusPos, panel.center, mUp);
        focusQuat.setFromRotationMatrix(lookMatrix);
    }

    function fillMetaItem(
        itemEl: HTMLElement,
        label: string,
        text: string,
    ) {
        const labelEl = itemEl.querySelector<HTMLElement>(".tunnel_gallery_card_meta_label");
        const textEl = itemEl.querySelector<HTMLElement>(".tunnel_gallery_card_meta_text");
        if (!labelEl || !textEl) return;
        if (!text) {
            itemEl.classList.remove("is_on");
            labelEl.textContent = "";
            textEl.textContent = "";
            return;
        }
        labelEl.textContent = label;
        textEl.textContent = text;
        itemEl.classList.add("is_on");
    }

    function openPanel(panel: Panel) {
        const media = panel.media;
        state.focus = panel;
        gsap.to(state, { focusMix: 1, duration: 1.9, ease: "sine.inOut" });
        gsap.to(state, { speedMul: 0, duration: 1.3, ease: "sine.out" });

        cardImg.src = media.src;
        cardImg.alt = media.title;
        cardTitle.textContent = media.title;
        cardTagline.textContent = media.tagline || "";
        cardStatusText.textContent = media.status || "";
        cardStatus.classList.toggle("is_available", media.statusTone !== "soon");
        cardStatus.classList.toggle("is_soon", media.statusTone === "soon");
        cardStatus.style.display = media.status ? "" : "none";

        if (media.logo) {
            cardLogo.src = media.logo;
            cardLogoWrap.style.display = "";
        } else {
            cardLogo.removeAttribute("src");
            cardLogoWrap.style.display = "none";
        }

        fillMetaItem(problemItem, media.problemLabel, media.problem);
        fillMetaItem(usersItem, media.usersLabel, media.users);

        gsap.delayedCall(0.9, () => {
            if (state.focus === panel) {
                cardEl.classList.add("is_on");
                cardEl.setAttribute("aria-hidden", "false");
            }
        });
    }

    function closePanel() {
        if (!state.focus) return;
        gsap.to(state, {
            focusMix: 0,
            duration: 1.7,
            ease: "sine.inOut",
            onComplete: () => {
                state.focus = null;
            },
        });
        gsap.to(state, { speedMul: 1, duration: 1.8, ease: "sine.inOut", delay: 0.5 });
        cardEl.classList.remove("is_on");
        cardEl.setAttribute("aria-hidden", "true");
    }

    function setHover(panel: Panel | null) {
        if (state.hovered === panel) return;
        if (state.hovered) {
            gsap.to(state.hovered.material.uniforms.uHover, { value: 0, duration: 0.5, ease: "power2.out" });
        }
        state.hovered = panel;
        if (panel) gsap.to(panel.material.uniforms.uHover, { value: 1, duration: 0.45, ease: "power2.out" });
        root.style.cursor = panel ? "pointer" : "crosshair";
    }

    const onPointerMove = (e: PointerEvent) => {
        const rect = root.getBoundingClientRect();
        const x = (e.clientX - rect.left) / Math.max(1, rect.width);
        const y = (e.clientY - rect.top) / Math.max(1, rect.height);
        state.mouse.x = x * 2 - 1;
        state.mouse.y = -(y * 2 - 1);
        state.aimTarget.set(-state.mouse.x * params.mouseAmp * 0.6, state.mouse.y * params.mouseAmp * 0.7 * 0.6);
    };

    let downAt = 0;
    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
        downAt = performance.now();
        downX = e.clientX;
        downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
        const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
        if (moved > 8 || performance.now() - downAt > 450) return;
        if (state.focus) closePanel();
        else if (state.hovered) openPanel(state.hovered);
    };
    const onCardDown = (e: Event) => e.stopPropagation();
    const onCardUp = (e: Event) => {
        e.stopPropagation();
        closePanel();
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") closePanel();
    };

    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerup", onPointerUp);
    cardEl.addEventListener("pointerdown", onCardDown);
    cardEl.addEventListener("pointerup", onCardUp);
    window.addEventListener("keydown", onKey);

    const fit = () => {
        const w = Math.max(1, root.clientWidth);
        const h = Math.max(1, root.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = camera.aspect < 0.75 ? 84 : 70;
        camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;
    let visible = true;

    const AHEAD = 0.085;
    const BEHIND = 0.012;

    function updateHover() {
        if (state.focus) return;
        raycaster.setFromCamera(state.mouse, camera);
        const near: THREE.Object3D[] = [];
        panels.forEach((p) => {
            if (p.mesh.visible && p.center.distanceToSquared(camera.position) < 45 * 45) near.push(p.mesh);
        });
        const hits = raycaster.intersectObjects(near, false);
        setHover(hits.length ? (hits[0].object.userData.panel as Panel) : null);
    }

    function updatePanelVisibility() {
        let bestPanel: Panel | null = null;
        let bestD = Infinity;
        panels.forEach((p) => {
            let d = p.t - state.t;
            if (d < 0) d += 1;
            const near = d < AHEAD || d > 1 - BEHIND;
            p.mesh.visible = near;
            if (p.reflection) p.reflection.visible = near;
            if (d < bestD) {
                bestD = d;
                bestPanel = p;
            }
        });
        if (state.focus) bestPanel = state.focus;
        const productIndex = bestPanel ? bestPanel.productIndex : -1;
        if (productIndex !== state.currentProduct) {
            state.currentProduct = productIndex;
            if (productIndex >= 0) {
                counterEl.textContent = String(productIndex + 1).padStart(2, "0");
            }
        }
    }

    const tick = () => {
        if (!running) return;
        raf = requestAnimationFrame(tick);
        if (!visible) return;

        const dt = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.getElapsedTime();
        const ka = 1 - Math.exp(-dt * 1.2);
        state.aimS1.lerp(state.aimTarget, ka);
        state.aim.lerp(state.aimS1, ka);
        updateTravel(dt);

        if (state.focus || state.focusMix > 0.001) {
            if (state.focus) focusTargets(state.focus);
            camera.position.lerpVectors(travelPos, focusPos, state.focusMix);
            camera.quaternion.slerpQuaternions(travelQuat, focusQuat, state.focusMix);
        } else {
            camera.position.copy(travelPos);
            camera.quaternion.copy(travelQuat);
        }

        gridMaterial.uniforms.uTime.value = elapsed;
        gridMaterial.uniforms.uHeadV.value = state.t * totalLength;
        updatePanelVisibility();
        updateHover();
        renderer.render(scene, camera);
    };

    const io = new IntersectionObserver(
        ([entry]) => {
            visible = entry.isIntersecting;
            if (visible) {
                clock.getDelta();
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(tick);
            }
        },
        { threshold: 0.05 },
    );
    io.observe(root);
    raf = requestAnimationFrame(tick);

    return () => {
        running = false;
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        root.removeEventListener("pointermove", onPointerMove);
        root.removeEventListener("pointerdown", onPointerDown);
        root.removeEventListener("pointerup", onPointerUp);
        cardEl.removeEventListener("pointerdown", onCardDown);
        cardEl.removeEventListener("pointerup", onCardUp);
        window.removeEventListener("keydown", onKey);
        gsap.killTweensOf(state);
        panels.forEach((p) => {
            gsap.killTweensOf(p.material.uniforms.uHover);
            p.material.dispose();
            p.mesh.geometry.dispose();
            if (p.reflection) {
                (p.reflection.material as THREE.Material).dispose();
                p.reflection.geometry.dispose();
            }
        });
        tunnel.geometry.dispose();
        gridMaterial.dispose();
        cardSlots.forEach((s) => s.texture.dispose());
        renderer.dispose();
        root.style.cursor = "";
    };
}
