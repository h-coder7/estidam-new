import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export type SpectralLogo = {
    name: string;
    src: string;
};

export type SpectralTilesOptions = {
    color?: string;
    glowColor?: string;
    backgroundColor?: string;
    grid?: number;
    gap?: number;
    thickness?: number;
    radius?: number;
    density?: number;
    scatter?: number;
    heightVariance?: number;
    angle?: number;
    tilt?: number;
    perspective?: number;
    zoom?: number;
    lights?: number;
    lightIntensity?: number;
    lightSize?: number;
    edgeGlow?: number;
    rim?: number;
    frost?: number;
    fog?: number;
    speed?: number;
    interactive?: boolean;
    lift?: number;
    lean?: number;
    ripple?: boolean;
    intro?: boolean;
    seed?: number;
    /** Partner logos painted onto tile tops */
    logos?: SpectralLogo[];
};

type Tile = {
    ix: number;
    iz: number;
    baseX: number;
    baseZ: number;
    baseY: number;
    mesh: THREE.Mesh;
    introDelay: number;
    intro: number;
    logoFace: THREE.Mesh | null;
    logoReveal: number;
};

function mulberry32(seed: number) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement | null>((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }
        const img = new Image();
        const timer = window.setTimeout(() => resolve(null), 8000);
        img.onload = () => {
            window.clearTimeout(timer);
            resolve(img);
        };
        img.onerror = () => {
            window.clearTimeout(timer);
            resolve(null);
        };
        img.src = src;
    });
}

/** Transparent logo card — no fill, just the mark centered for the tile face. */
function makeLogoTexture(img: HTMLImageElement) {
    const size = 512;
    const cnv = document.createElement("canvas");
    cnv.width = size;
    cnv.height = size;
    const ctx = cnv.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);

    const pad = size * 0.16;
    const maxW = size - pad * 2;
    const maxH = size - pad * 2;
    const scale = Math.min(maxW / Math.max(1, img.width), maxH / Math.max(1, img.height));
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);

    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.premultiplyAlpha = true;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Spectral Tiles — frosted glass floor lit from below by drifting lights.
 * Visual match for React Bits Pro Spectral Tiles (reimplemented for Estidam).
 */
export function mountSpectralTiles(root: HTMLElement, options: SpectralTilesOptions = {}) {
    const canvas = root.querySelector<HTMLCanvasElement>(".spectral_tiles_canvas");
    if (!canvas) return () => {};

    const color = new THREE.Color(options.color ?? "#295cc7");
    const glowColor = new THREE.Color(options.glowColor ?? "#1691d0");
    const backgroundColor = new THREE.Color(options.backgroundColor ?? "#f7f8fa");
    const grid = Math.max(6, Math.min(22, Math.round(options.grid ?? 16)));
    const gapFrac = options.gap ?? 0.06;
    const thickness = options.thickness ?? 0.12;
    const cornerRadius = options.radius ?? 0.07;
    const density = options.density ?? 0.94;
    const scatter = options.scatter ?? 0.9;
    const heightVariance = options.heightVariance ?? 0.08;
    const angleDeg = options.angle ?? 45;
    const tiltDeg = options.tilt ?? 44;
    const perspective = options.perspective ?? 24;
    const zoom = options.zoom ?? 1;
    const lightCount = Math.max(1, Math.min(4, Math.round(options.lights ?? 4)));
    const lightIntensity = options.lightIntensity ?? 1;
    const lightSize = options.lightSize ?? 1;
    const edgeGlow = options.edgeGlow ?? 1;
    const rim = options.rim ?? 1;
    const frost = options.frost ?? 0.5;
    const fogAmt = options.fog ?? 0.7;
    const speed = options.speed ?? 1;
    const interactive = options.interactive !== false;
    const lift = options.lift ?? 1;
    const lean = options.lean ?? 1;
    const rippleOn = options.ripple !== false;
    const introOn = options.intro !== false;
    const seed = options.seed ?? 7;
    const rand = mulberry32(seed);

    // Light backgrounds get a frosted white glass look (brand soft blue).
    const bgLum = backgroundColor.r * 0.2126 + backgroundColor.g * 0.7152 + backgroundColor.b * 0.0722;
    const isLight = bgLum > 0.55;

    const scene = new THREE.Scene();
    // Light mode: keep WebGL clear transparent so the CSS identity gradient shows through.
    scene.background = isLight ? null : backgroundColor.clone();
    // Fog greys-out white tiles — keep it off in light/card mode.
    scene.fog = isLight
        ? null
        : new THREE.FogExp2(backgroundColor.getHex(), 0.018 + fogAmt * 0.028);

    const camera = new THREE.PerspectiveCamera(perspective, 1, 0.05, 120);

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: isLight,
        powerPreference: "high-performance",
    });
    renderer.setClearColor(isLight ? 0xffffff : backgroundColor.getHex(), isLight ? 0 : 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES crush midtones → grey tiles; use linear in light mode for true white cards.
    renderer.toneMapping = isLight ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLight ? 1 : 1.25;

    const floor = new THREE.Group();
    floor.rotation.y = THREE.MathUtils.degToRad(angleDeg);
    scene.add(floor);

    const cell = 1;
    const tileSize = cell * (1 - gapFrac);
    const half = ((grid - 1) * cell) / 2;
    const maxScatter = cell * gapFrac * 0.48 * scatter;

    const geometry = new RoundedBoxGeometry(
        tileSize,
        thickness,
        tileSize,
        2,
        Math.min(cornerRadius * tileSize, tileSize * 0.26),
    );

    // Light mode = Operations card: pure #fff matte. Dark mode keeps spectral glass look.
    const tileColor = isLight ? new THREE.Color(0xffffff) : color.clone().multiplyScalar(0.32);
    const baseMat = new THREE.MeshStandardMaterial({
        color: tileColor,
        metalness: isLight ? 0 : 0.15,
        roughness: isLight ? 0.55 : 0.35 + frost * 0.32,
        emissive: isLight ? new THREE.Color(0x000000) : glowColor.clone().lerp(color, 0.4),
        emissiveIntensity: isLight ? 0 : 0.18 * rim * edgeGlow,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        flatShading: false,
    });

    const logoFaceGeo = new THREE.PlaneGeometry(tileSize * 0.86, tileSize * 0.86);
    const logoTextures: THREE.CanvasTexture[] = [];
    const logoMats: THREE.MeshStandardMaterial[] = [];
    const logoItems = options.logos?.filter((l) => l.src) ?? [];

    const tiles: Tile[] = [];
    for (let iz = 0; iz < grid; iz += 1) {
        for (let ix = 0; ix < grid; ix += 1) {
            if (rand() > density) continue;

            const baseX = ix * cell - half + (rand() - 0.5) * 2 * maxScatter;
            const baseZ = iz * cell - half + (rand() - 0.5) * 2 * maxScatter;
            const baseY = (rand() - 0.5) * 2 * heightVariance;

            const mesh = new THREE.Mesh(geometry, baseMat.clone());
            // Sit in place from the start — reveal is opacity only (no pre-visible rise).
            mesh.position.set(baseX, baseY, baseZ);
            mesh.visible = !introOn;
            floor.add(mesh);

            // Near-camera first (low iz+ix), so logos cascade toward the back.
            const depth = (ix + iz) / Math.max(1, grid * 2 - 2);
            tiles.push({
                ix,
                iz,
                baseX,
                baseZ,
                baseY,
                mesh,
                introDelay: depth * 1.15 + rand() * 0.08,
                intro: introOn ? 0 : 1,
                logoFace: null,
                logoReveal: 0,
            });
        }
    }

    // Load partner logos and stamp them onto tile tops (cycle through the set).
    void Promise.all(logoItems.map((item) => loadImage(item.src))).then((images) => {
        if (disposed) return;

        const ready = images
            .map((img, i) => ({ img, item: logoItems[i] }))
            .filter((entry): entry is { img: HTMLImageElement; item: SpectralLogo } => !!entry.img);

        if (!ready.length) return;

        for (const entry of ready) {
            const tex = makeLogoTexture(entry.img);
            logoTextures.push(tex);
            logoMats.push(
                new THREE.MeshStandardMaterial({
                    map: tex,
                    color: 0xffffff,
                    metalness: 0.02,
                    roughness: 0.38,
                    transparent: true,
                    opacity: 1,
                    alphaTest: 0.08,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2,
                }),
            );
        }

        tiles.forEach((tile, i) => {
            const shared = logoMats[i % logoMats.length];
            if (!shared) return;
            // Per-face material so opacity can stagger independently.
            const mat = shared.clone();
            logoMats.push(mat);
            const face = new THREE.Mesh(logoFaceGeo, mat);
            face.rotation.x = -Math.PI / 2;
            face.rotation.z = 0;
            face.position.y = thickness * 0.5 + 0.004;
            face.scale.setScalar(0.001);
            face.visible = false;
            face.frustumCulled = false;
            tile.mesh.add(face);
            tile.logoFace = face;
        });
    });

    scene.add(new THREE.AmbientLight(isLight ? 0xffffff : 0x152040, isLight ? 1.35 : 0.55));
    scene.add(
        new THREE.HemisphereLight(
            isLight ? 0xffffff : glowColor.getHex(),
            isLight ? 0xeef1f5 : 0x02040a,
            isLight ? 0.45 : 0.45,
        ),
    );

    // Soft top key — bright white faces like elevated UI cards
    const key = new THREE.DirectionalLight(isLight ? 0xffffff : glowColor.getHex(), isLight ? 0.95 : 0.55);
    key.position.set(-3.2, 9, 4.2);
    scene.add(key);

    if (isLight) {
        const fill = new THREE.DirectionalLight(0xffffff, 0.4);
        fill.position.set(5, 4, -2);
        scene.add(fill);
    }

    type DriftLight = {
        light: THREE.PointLight;
        ox: number;
        oz: number;
        phase: number;
        amp: number;
        speed: number;
    };

    const driftLights: DriftLight[] = [];
    for (let i = 0; i < lightCount; i += 1) {
        const light = new THREE.PointLight(
            isLight ? new THREE.Color("#ffffff") : glowColor.clone().lerp(color, 0.15 + i * 0.1),
            // Keep drift lights subtle in light mode so tiles stay card-white
            (isLight ? 0.22 : 5.5) * lightIntensity,
            (isLight ? 3.6 : 5.5) * lightSize,
            1.55,
        );
        light.position.set(0, -0.7, 0);
        floor.add(light);
        driftLights.push({
            light,
            ox: (rand() - 0.5) * grid * 0.5,
            oz: (rand() - 0.5) * grid * 0.5,
            phase: rand() * Math.PI * 2,
            amp: 2.4 + rand() * 2.6,
            speed: 0.25 + rand() * 0.35,
        });
    }

    // Same zoom/tile size — aim above the floor so the diamond sits lower and the top row clears.
    const span = grid * cell * 0.72;
    const tilt = THREE.MathUtils.degToRad(tiltDeg);
    const camDist = (span / Math.tan(THREE.MathUtils.degToRad(perspective * 0.5))) * (0.52 / zoom);
    camera.position.set(0, Math.sin(tilt) * camDist, Math.cos(tilt) * camDist);
    camera.lookAt(0, 1.05, -0.12);
    // Nudge the floor down in view without changing tile scale.
    floor.position.y = -0.55;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Bloom off on light grounds — UI-card white shouldn't glow.
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        isLight ? 0 : 0.7,
        isLight ? 0.2 : 0.45,
        isLight ? 1 : 0.55,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const pointerNdc = new THREE.Vector2(-999, -999);
    const pointerLocal = new THREE.Vector3(9999, 0, 9999);
    const raycaster = new THREE.Raycaster();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const invFloor = new THREE.Matrix4();

    let ripples: Array<{ x: number; z: number; t: number }> = [];
    let revealArmed = !introOn;
    let revealStart = performance.now();
    let raf = 0;
    let disposed = false;
    let reducedMotion = false;
    try {
        reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
        reducedMotion = false;
    }

    // Start the staggered logo/tile reveal only when the section enters view.
    const io = new IntersectionObserver(
        ([entry]) => {
            if (!entry?.isIntersecting || revealArmed) return;
            revealArmed = true;
            revealStart = performance.now();
        },
        { threshold: 0.28, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(root);

    function resize() {
        const w = Math.max(1, root.clientWidth);
        const h = Math.max(1, root.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        bloom.setSize(w, h);
    }

    function projectPointer(clientX: number, clientY: number) {
        const rect = canvas!.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        raycaster.setFromCamera(pointerNdc, camera);
        floor.updateMatrixWorld(true);
        if (raycaster.ray.intersectPlane(floorPlane, hit)) {
            invFloor.copy(floor.matrixWorld).invert();
            pointerLocal.copy(hit).applyMatrix4(invFloor);
        }
    }

    function onPointerMove(e: PointerEvent) {
        if (!interactive) return;
        projectPointer(e.clientX, e.clientY);
    }

    function onPointerLeave() {
        pointerLocal.set(9999, 0, 9999);
    }

    function onPointerDown(e: PointerEvent) {
        if (!rippleOn || !interactive) return;
        projectPointer(e.clientX, e.clientY);
        ripples.push({ x: pointerLocal.x, z: pointerLocal.z, t: 0 });
        if (ripples.length > 4) ripples.shift();
    }

    function animate() {
        if (disposed) return;
        raf = requestAnimationFrame(animate);

        const now = performance.now();
        const clock = (now - (revealArmed ? revealStart : now)) / 1000;
        const elapsed = revealArmed ? clock : 0;
        const motion = reducedMotion ? 0 : speed;

        for (const d of driftLights) {
            const t = (revealArmed ? elapsed : now / 1000) * d.speed * motion + d.phase;
            d.light.position.x = d.ox + Math.cos(t) * d.amp;
            d.light.position.z = d.oz + Math.sin(t * 0.87 + 1.1) * d.amp * 0.85;
            d.light.position.y = -0.55 - thickness - Math.sin(t * 0.6) * 0.1;
            d.light.intensity =
                ((isLight ? 0.95 : 4.6) + Math.sin(t * 1.35) * (isLight ? 0.2 : 1.1)) * lightIntensity;
        }

        ripples = ripples
            .map((r) => ({ ...r, t: r.t + 0.016 * (reducedMotion ? 0 : 1) }))
            .filter((r) => r.t < 1.35);

        for (const tile of tiles) {
            if (!revealArmed) {
                tile.intro = 0;
                tile.logoReveal = 0;
            } else if (reducedMotion || !introOn) {
                tile.intro = 1;
                tile.logoReveal = 1;
            } else {
                if (tile.intro < 1) {
                    const localT = Math.max(0, elapsed - tile.introDelay);
                    tile.intro = Math.min(1, localT / 0.7);
                }
                if (tile.logoReveal < 1) {
                    // Logos follow the tile rise, slightly delayed for a soft cascade.
                    const logoT = Math.max(0, elapsed - tile.introDelay - 0.12);
                    tile.logoReveal = Math.min(1, logoT / 0.55);
                }
            }

            const ease = 1 - Math.pow(1 - tile.intro, 3);
            const logoEase = 1 - Math.pow(1 - tile.logoReveal, 3);

            let liftY = 0;
            let leanX = 0;
            let leanZ = 0;

            if (interactive && !reducedMotion && revealArmed) {
                const dx = tile.baseX - pointerLocal.x;
                const dz = tile.baseZ - pointerLocal.z;
                const dist = Math.hypot(dx, dz);
                const influence = Math.max(0, 1 - dist / 2.35);
                const soft = influence * influence;
                liftY += soft * 0.3 * lift;
                leanX += (dz / Math.max(0.001, dist)) * soft * 0.24 * lean;
                leanZ += (-dx / Math.max(0.001, dist)) * soft * 0.24 * lean;
            }

            for (const r of ripples) {
                const dist = Math.hypot(tile.baseX - r.x, tile.baseZ - r.z);
                const wave =
                    Math.sin((dist - r.t * 4.2) * 2.2) * Math.exp(-dist * 0.55) * (1 - r.t / 1.35);
                liftY += Math.max(0, wave) * 0.34 * lift;
            }

            const idle =
                revealArmed && tile.intro > 0.95
                    ? Math.sin(elapsed * 1.05 * motion + tile.ix * 0.4 + tile.iz * 0.55) * 0.014
                    : 0;

            tile.mesh.position.set(tile.baseX, tile.baseY + liftY * ease + idle, tile.baseZ);
            tile.mesh.rotation.x = leanX * ease;
            tile.mesh.rotation.z = leanZ * ease;

            const mat = tile.mesh.material as THREE.MeshStandardMaterial;
            if (isLight) {
                // Lock card-white every frame — never let drift/rim tint re-grey the slabs.
                mat.color.setRGB(1, 1, 1);
                mat.emissive.setRGB(0, 0, 0);
                mat.emissiveIntensity = 0;
                mat.metalness = 0;
            } else {
                const nearLight = driftLights.reduce((acc, d) => {
                    const dd = Math.hypot(tile.baseX - d.light.position.x, tile.baseZ - d.light.position.z);
                    return Math.max(acc, Math.max(0, 1 - dd / (3.2 * lightSize)));
                }, 0);
                mat.emissiveIntensity =
                    (0.12 + nearLight * 0.85 + liftY * 1.4) * rim * (0.65 + edgeGlow * 0.5) * ease;
            }
            // Staggered fade-in from opacity 0 — tiles stay invisible until their turn.
            mat.transparent = true;
            mat.opacity = ease;
            mat.depthWrite = ease > 0.85;
            tile.mesh.visible = ease > 0.01;

            if (tile.logoFace) {
                const face = tile.logoFace;
                const faceMat = face.material as THREE.MeshStandardMaterial;
                if (logoEase <= 0.001) {
                    face.visible = false;
                    face.scale.setScalar(0.001);
                    faceMat.opacity = 0;
                } else {
                    face.visible = true;
                    face.scale.setScalar(0.85 + logoEase * 0.15);
                    faceMat.opacity = logoEase;
                    faceMat.alphaTest = logoEase > 0.92 ? 0.08 : 0.02;
                }
            }
        }

        composer.render();
    }

    resize();
    window.addEventListener("resize", resize);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("pointerdown", onPointerDown);
    animate();

    return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("resize", resize);
        root.removeEventListener("pointermove", onPointerMove);
        root.removeEventListener("pointerleave", onPointerLeave);
        root.removeEventListener("pointerdown", onPointerDown);
        geometry.dispose();
        logoFaceGeo.dispose();
        baseMat.dispose();
        logoMats.forEach((m) => m.dispose());
        logoTextures.forEach((t) => t.dispose());
        tiles.forEach((t) => (t.mesh.material as THREE.Material).dispose());
        composer.dispose();
        renderer.dispose();
        scene.clear();
    };
}
