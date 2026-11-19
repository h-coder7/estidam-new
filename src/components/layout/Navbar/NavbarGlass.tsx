"use client";

import { useEffect, useRef } from "react";
import {
    Mesh,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Vector2,
    WebGLRenderer,
} from "three";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uLight;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Soft liquid distortion field
  float field = fbm(p * 3.2 + vec2(uTime * 0.05, uTime * 0.03));
  float field2 = fbm(p * 6.0 - vec2(uTime * 0.04, -uTime * 0.02));
  float grain = noise(uv * uResolution * 0.55 + uTime * 8.0);

  // Rounded capsule edge / fresnel
  float edgeX = smoothstep(0.0, 0.18, uv.x) * smoothstep(0.0, 0.18, 1.0 - uv.x);
  float edgeY = smoothstep(0.0, 0.35, uv.y) * smoothstep(0.0, 0.35, 1.0 - uv.y);
  float rim = 1.0 - edgeX * edgeY;
  rim = pow(clamp(rim, 0.0, 1.0), 1.35);

  // Specular blob that drifts with pointer
  vec2 lightPos = mix(vec2(0.28, 0.72), uPointer, 0.55);
  float spec = exp(-length((uv - lightPos) * vec2(1.8, 2.6)) * 7.5);
  float streak = exp(-abs((uv.x - lightPos.x) * 3.2 + (uv.y - 0.5) * 0.35) * 18.0) * 0.55;

  vec3 tintCold = vec3(0.78, 0.88, 1.0);
  vec3 tintWarm = vec3(0.95, 0.97, 1.0);
  vec3 base = mix(tintCold, tintWarm, field);

  float alpha = mix(0.18, 0.42, uLight) + field * 0.12 + rim * 0.22;
  alpha += grain * 0.05;
  alpha = clamp(alpha, 0.12, 0.62);

  vec3 color = base;
  color += vec3(1.0) * (spec * 0.55 + streak * 0.28);
  color += tintCold * rim * 0.35;
  color += vec3(0.55, 0.75, 1.0) * field2 * 0.08;

  // Subtle chromatic edge for glass feel
  color.r += rim * 0.04;
  color.b += rim * 0.06;

  gl_FragColor = vec4(color, alpha);
}
`;

type Props = {
    light?: boolean;
};

export default function NavbarGlass({ light = true }: Props) {
    const hostRef = useRef<HTMLDivElement>(null);
    const pointerRef = useRef(new Vector2(0.3, 0.7));

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let renderer: WebGLRenderer;

        try {
            renderer = new WebGLRenderer({
                alpha: true,
                antialias: false,
                powerPreference: "low-power",
                premultipliedAlpha: true,
            });
        } catch {
            return;
        }

        renderer.setClearColor(0x000000, 0);
        renderer.domElement.className = "navbar_glass_canvas";
        renderer.domElement.setAttribute("aria-hidden", "true");
        host.appendChild(renderer.domElement);

        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const material = new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new Vector2(1, 1) },
                uPointer: { value: pointerRef.current },
                uLight: { value: light ? 1 : 0 },
            },
            vertexShader: VERT,
            fragmentShader: FRAG,
        });
        const mesh = new Mesh(new PlaneGeometry(2, 2), material);
        scene.add(mesh);

        const resize = () => {
            const w = Math.max(1, host.clientWidth);
            const h = Math.max(1, host.clientHeight);
            const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
            renderer.setPixelRatio(dpr);
            renderer.setSize(w, h, false);
            material.uniforms.uResolution.value.set(w * dpr, h * dpr);
        };

        resize();

        const onPointer = (e: PointerEvent) => {
            const rect = host.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            pointerRef.current.set(
                (e.clientX - rect.left) / rect.width,
                1 - (e.clientY - rect.top) / rect.height,
            );
        };

        window.addEventListener("pointermove", onPointer, { passive: true });
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            material.uniforms.uTime.value = reduced ? 0 : (now - start) / 1000;
            material.uniforms.uPointer.value.copy(pointerRef.current);
            renderer.render(scene, camera);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("pointermove", onPointer);
            ro.disconnect();
            material.dispose();
            mesh.geometry.dispose();
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [light]);

    return <div className="navbar_glass" ref={hostRef} aria-hidden="true" />;
}
