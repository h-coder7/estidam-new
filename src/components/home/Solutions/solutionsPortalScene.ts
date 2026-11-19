import {
    AmbientLight,
    CanvasTexture,
    Color,
    DirectionalLight,
    Group,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    SRGBColorSpace,
    Vector3,
    WebGLRenderer,
} from "three";

export type PortalCardInput = {
    id: string;
    title: string;
    subtitle?: string;
    accent?: string;
};

export type PortalSceneApi = {
    setProgress: (p: number) => void;
    resize: () => void;
    destroy: () => void;
};

const NAVY = new Color(0x0b1a33);

function makeCardTexture(title: string, subtitle: string, index: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new CanvasTexture(canvas);

    const hues = [210, 198, 188, 220, 205, 195];
    const h = hues[index % hues.length];
    const g = ctx.createLinearGradient(0, 0, 512, 320);
    g.addColorStop(0, `hsl(${h} 58% 28%)`);
    g.addColorStop(0.55, `hsl(${h + 12} 48% 18%)`);
    g.addColorStop(1, `hsl(${h - 8} 42% 12%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 320);

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 492, 300);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), 36, 56);

    ctx.fillStyle = "#fff";
    ctx.font = "700 34px system-ui, sans-serif";
    wrapText(ctx, title, 36, 120, 440, 40);

    if (subtitle) {
        ctx.fillStyle = "rgba(200,220,255,0.78)";
        ctx.font = "500 22px system-ui, sans-serif";
        wrapText(ctx, subtitle, 36, 210, 440, 30);
    }

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
    const words = text.split(/\s+/);
    let line = "";
    let yy = y;
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, yy);
            line = word;
            yy += lineH;
            if (yy > y + lineH * 2) break;
        } else {
            line = test;
        }
    }
    if (line && yy <= y + lineH * 2) ctx.fillText(line, x, yy);
}

/** Scattered depth field — not a sphere. */
function cardField(count: number) {
    const pts: Vector3[] = [];
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const ring = 0.55 + (i % 4) * 0.55;
        const x = Math.cos(a * 1.7) * (1.2 + ring * 1.8) * (i % 2 === 0 ? 1 : -0.85);
        const y = Math.sin(a * 1.15) * (0.7 + (i % 3) * 0.55) * (i % 3 === 0 ? 1.15 : 0.9);
        const z = -1.2 - (i % 5) * 0.85 - ring * 0.35;
        pts.push(new Vector3(x, y, z));
    }
    return pts;
}

export function createSolutionsPortalScene(
    canvas: HTMLCanvasElement,
    cards: PortalCardInput[],
): PortalSceneApi {
    const scene = new Scene();
    scene.background = new Color(0xf4f6fa);

    const camera = new PerspectiveCamera(42, 1, 0.1, 120);
    camera.position.set(0, 0.1, 5.2);

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;

    const ambient = new AmbientLight(0xffffff, 0.7);
    const key = new DirectionalLight(0xffffff, 0.85);
    key.position.set(2.5, 3.5, 4);
    scene.add(ambient, key);

    const cardRoot = new Group();
    cardRoot.visible = false;
    cardRoot.scale.setScalar(0.2);
    scene.add(cardRoot);

    const source = cards.length ? cards : [{ id: "0", title: "Solution", subtitle: "" }];
    const densified: PortalCardInput[] = [];
    const targetCount = Math.max(10, Math.min(16, source.length * 3));
    for (let i = 0; i < targetCount; i++) densified.push(source[i % source.length]);

    const points = cardField(densified.length);
    const cardMeshes: Mesh[] = [];
    densified.forEach((card, i) => {
        const tex = makeCardTexture(card.title, card.subtitle || "", i);
        const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0 });
        const mesh = new Mesh(new PlaneGeometry(1.45, 0.9), mat);
        mesh.position.copy(points[i]);
        mesh.userData.home = points[i].clone();
        cardRoot.add(mesh);
        cardMeshes.push(mesh);
    });

    let raf = 0;
    let progress = 0;
    let running = true;

    const resize = () => {
        const parent = canvas.parentElement;
        const w = parent?.clientWidth || window.innerWidth;
        const h = parent?.clientHeight || window.innerHeight;
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };

    const setProgress = (raw: number) => {
        progress = MathUtils.clamp(raw, 0, 1);
    };

    const ease = (a: number, b: number, t: number) => a + (b - a) * MathUtils.clamp(t, 0, 1);
    const span = (p: number, a: number, b: number) => MathUtils.clamp((p - a) / Math.max(0.0001, b - a), 0, 1);

    const tick = () => {
        if (!running) return;
        raf = requestAnimationFrame(tick);

        const p = progress;
        const dark = span(p, 0.12, 0.32);
        scene.background = NAVY.clone().lerp(new Color(0xf4f6fa), 1 - dark);

        const cardsIn = span(p, 0.22, 0.48);
        const dive = span(p, 0.45, 0.92);
        cardRoot.visible = p > 0.18;
        cardRoot.scale.setScalar(ease(0.15, 1, cardsIn) * ease(1, 1.35, dive));
        cardRoot.rotation.y = ease(0, 0.35, dive);
        cardRoot.position.z = ease(0, 1.2, dive);

        camera.position.z = ease(5.2, 2.4, dive);
        camera.fov = ease(42, 50, dive);
        camera.updateProjectionMatrix();

        const spread = ease(0.55, 1.35, dive);
        cardMeshes.forEach((mesh, i) => {
            const home = mesh.userData.home as Vector3;
            mesh.position.set(home.x * spread, home.y * spread, home.z);
            mesh.lookAt(camera.position);
            const mat = mesh.material as MeshBasicMaterial;
            mat.opacity = ease(0, 0.95, cardsIn) * ease(1, 0.7, Math.max(0, dive - 0.4));
            if (i % 5 === 0 && dive > 0.35) mat.opacity *= 0.35;
        });

        ambient.intensity = ease(0.75, 0.28, dark);
        renderer.render(scene, camera);
    };

    resize();
    tick();

    return {
        setProgress,
        resize,
        destroy: () => {
            running = false;
            cancelAnimationFrame(raf);
            cardMeshes.forEach((m) => {
                const mat = m.material as MeshBasicMaterial;
                mat.map?.dispose();
                mat.dispose();
                m.geometry.dispose();
            });
            renderer.dispose();
        },
    };
}
