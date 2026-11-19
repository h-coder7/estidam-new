/** WebGL circular photo transitions for Solutions Dial. */

export type DialGlApi = {
    go: (from: number, to: number) => void;
    resize: () => void;
    destroy: () => void;
    ready: boolean;
};

const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uProgress;
uniform vec2 uFromRatio;
uniform vec2 uToRatio;
uniform float uTime;
varying vec2 vUv;

// ratio.x = image width/height — object-fit: cover into the square dial
vec2 cover(vec2 uv, vec2 ratio) {
  float a = max(ratio.x, 0.0001);
  // Landscape: crop sides. Portrait: crop top/bottom.
  vec2 scale = a > 1.0 ? vec2(1.0 / a, 1.0) : vec2(1.0, a);
  return clamp((uv - 0.5) * scale + 0.5, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  float r = length(p);
  float circle = smoothstep(0.502, 0.495, r);
  if (circle <= 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float t = clamp(uProgress, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 3.0);

  // Soft ripple only during the handoff
  float pulse = sin(e * 3.14159);
  float wave = sin(r * 22.0 - e * 10.0 + uTime) * 0.01 * pulse;
  vec2 warped = p * (1.0 + wave) + 0.5;

  // Expanding circular reveal of the next slide (center → edge)
  float rad = e * 0.78;
  float reveal = 1.0 - smoothstep(rad - 0.06, rad + 0.02, r);

  vec2 uvA = cover(warped, uFromRatio);
  vec2 uvB = cover(warped, uToRatio);

  float fringe = smoothstep(0.0, 0.16, abs(r - rad)) * pulse;
  vec2 split = normalize(p + 1e-5) * fringe * 0.01;

  vec3 aCol = texture2D(uFrom, uvA).rgb;
  float bR = texture2D(uTo, uvB + split).r;
  float bG = texture2D(uTo, uvB).g;
  float bB = texture2D(uTo, uvB - split).b;
  vec3 bCol = vec3(bR, bG, bB);

  vec3 accent = vec3(0.09, 0.57, 0.82);
  bCol = mix(bCol, bCol + accent * 0.16, fringe * 0.55);

  vec3 rgb = mix(aCol, bCol, reveal);
  float vig = smoothstep(0.52, 0.16, r);
  rgb *= 0.86 + 0.14 * vig;

  gl_FragColor = vec4(rgb * circle, circle);
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }
        const img = new Image();
        img.decoding = "async";
        if (!src.startsWith("/") && !src.startsWith("data:")) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function makePlaceholder(w = 8, h = 8) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (ctx) {
        ctx.fillStyle = "#0a1628";
        ctx.fillRect(0, 0, w, h);
    }
    return c;
}

export function createDialPhotoGl(
    canvas: HTMLCanvasElement,
    imageUrls: string[],
    opts: { start?: number; duration?: number } = {},
): DialGlApi {
    const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = opts.duration ?? 780;
    const start = Math.min(opts.start ?? 0, Math.max(0, imageUrls.length - 1));
    const N = imageUrls.length;

    const empty: DialGlApi = {
        ready: false,
        go: () => {},
        resize: () => {},
        destroy: () => {},
    };
    if (!N) return empty;

    const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
    });
    if (!gl) return empty;

    let destroyed = false;
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let aPos = -1;
    let textures: (WebGLTexture | null)[] = [];
    let ratios: [number, number][] = Array.from({ length: N }, () => [1, 1]);
    let current = start;
    let anim: { from: number; to: number; t0: number } | null = null;
    let raf = 0;
    let time0 = performance.now();

    const u = {
        from: null as WebGLUniformLocation | null,
        to: null as WebGLUniformLocation | null,
        progress: null as WebGLUniformLocation | null,
        fromRatio: null as WebGLUniformLocation | null,
        toRatio: null as WebGLUniformLocation | null,
        time: null as WebGLUniformLocation | null,
    };

    try {
        const vs = compile(gl, gl.VERTEX_SHADER, VS);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
        prog = gl.createProgram();
        if (!prog) throw new Error("program");
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");

        buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

        aPos = gl.getAttribLocation(prog, "aPos");

        u.from = gl.getUniformLocation(prog, "uFrom");
        u.to = gl.getUniformLocation(prog, "uTo");
        u.progress = gl.getUniformLocation(prog, "uProgress");
        u.fromRatio = gl.getUniformLocation(prog, "uFromRatio");
        u.toRatio = gl.getUniformLocation(prog, "uToRatio");
        u.time = gl.getUniformLocation(prog, "uTime");

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    } catch {
        return empty;
    }

    function upload(source: TexImageSource, tex: WebGLTexture) {
        if (!gl) return;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }

    function makeTex(source: TexImageSource) {
        if (!gl) return null;
        const tex = gl.createTexture();
        if (!tex) return null;
        upload(source, tex);
        return tex;
    }

    const placeholder = makePlaceholder();
    textures = imageUrls.map(() => makeTex(placeholder));

    void Promise.all(imageUrls.map((url) => loadImage(url))).then((imgs) => {
        if (destroyed || !gl) return;
        imgs.forEach((img, i) => {
            if (!img) return;
            ratios[i] = [img.naturalWidth / Math.max(1, img.naturalHeight), 1];
            const existing = textures[i];
            if (existing) upload(img, existing);
            else textures[i] = makeTex(img);
        });
        draw(anim ? undefined : 1);
    });

    function resize() {
        if (!gl || destroyed) return;
        const parent = canvas.parentElement;
        const rect = parent?.getBoundingClientRect();
        const cssW = Math.max(1, rect?.width || canvas.clientWidth || 1);
        const cssH = Math.max(1, rect?.height || canvas.clientHeight || 1);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(cssW * dpr);
        const h = Math.round(cssH * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            canvas.style.width = `${cssW}px`;
            canvas.style.height = `${cssH}px`;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw(anim ? undefined : 1);
    }

    function draw(progressOverride?: number) {
        if (!gl || !prog || destroyed || aPos < 0) return;
        const progress =
            progressOverride ??
            (anim ? Math.min(1, (performance.now() - anim.t0) / duration) : 1);
        const from = anim?.from ?? current;
        const to = anim?.to ?? current;
        const tFrom = textures[from] || textures[current];
        const tTo = textures[to] || textures[current];
        if (!tFrom || !tTo) return;

        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tFrom);
        gl.uniform1i(u.from, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tTo);
        gl.uniform1i(u.to, 1);

        gl.uniform1f(u.progress, progress);
        gl.uniform2f(u.fromRatio, ratios[from][0], ratios[from][1]);
        gl.uniform2f(u.toRatio, ratios[to][0], ratios[to][1]);
        gl.uniform1f(u.time, (performance.now() - time0) / 1000);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function tick() {
        if (destroyed) return;
        if (!anim) {
            raf = 0;
            return;
        }
        const p = Math.min(1, (performance.now() - anim.t0) / duration);
        draw(p);
        if (p >= 1) {
            current = anim.to;
            anim = null;
            raf = 0;
            draw(1);
            return;
        }
        raf = requestAnimationFrame(tick);
    }

    function go(from: number, to: number) {
        if (destroyed || !gl) return;
        from = ((from % N) + N) % N;
        to = ((to % N) + N) % N;
        if (from === to) {
            current = to;
            anim = null;
            draw(1);
            return;
        }
        if (REDUCED) {
            current = to;
            anim = null;
            draw(1);
            return;
        }
        // Interrupt in-flight blend from the slide we were heading to
        const visualFrom = anim ? anim.to : from;
        anim = { from: visualFrom, to, t0: performance.now() };
        current = to;
        if (!raf) raf = requestAnimationFrame(tick);
        else draw(0);
    }

    resize();
    draw(1);

    const onLost = (e: Event) => {
        e.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return {
        ready: true,
        go,
        resize,
        destroy: () => {
            destroyed = true;
            cancelAnimationFrame(raf);
            canvas.removeEventListener("webglcontextlost", onLost);
            if (!gl) return;
            textures.forEach((t) => t && gl.deleteTexture(t));
            if (buf) gl.deleteBuffer(buf);
            if (prog) gl.deleteProgram(prog);
            textures = [];
        },
    };
}
