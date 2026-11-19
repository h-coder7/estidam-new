/** Solutions Dial — Era Dial mechanics adapted for Estidam CMS slides. */

export type DialSlide = {
    id: string;
    title: string;
    text: string;
    highlight: string;
    image: string;
    caption: string;
};

export type DialApi = { destroy: () => void };

type Spring = {
    value: number;
    target: number;
    v: number;
    k: number;
    c: number;
    to: (target: number, preset?: string) => Spring;
    jump: (v: number) => Spring;
    step: (dt: number) => void;
    onUpdate: (v: number) => void;
};

const PRESETS: Record<string, [number, number]> = {
    default: [170, 26],
    gentle: [120, 14],
    stiff: [210, 20],
    slow: [280, 60],
    arrow: [210, 22],
};

const CFG = {
    autoplay: 4000,
    wheelGap: 600,
    photoMs: 700,
    lineOut: 180,
    lineIn: 420,
    lineGap: 80,
    digitGap: 40,
    knobHover: 1.08,
};

export function reelImageSrc(src?: string) {
    if (!src) return "";
    if (src.startsWith("/") || src.startsWith("data:")) return src;
    try {
        const host = new URL(src).hostname;
        if (host === "inspire-sa.com" || host.endsWith(".inspire-sa.com")) {
            return `/api/media/?url=${encodeURIComponent(src)}`;
        }
    } catch {
        /* keep */
    }
    return src;
}

export function createSolutionsDial(
    root: HTMLElement,
    opts: { start?: number; rtl?: boolean; solutionWord: string },
): DialApi {
    const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const MOUSE = matchMedia("(hover: hover) and (pointer: fine)");
    const N = root.querySelectorAll<HTMLElement>("[data-story] .era").length;
    if (N < 1) return { destroy: () => {} };

    const start = Math.min(opts.start ?? Math.min(2, N - 1), N - 1);
    const live = new Set<Spring>();
    const frames = new Set<(dt: number, now: number) => void>();
    let raf = 0;
    let last = 0;
    let fill = 0;
    let active = start;
    let dragging = false;
    let drag: { id: number; a: number; p: number; x: number; y: number; moved: boolean } | null = null;
    let suppress = false;
    let wheelAt = 0;
    let hoverKnob = false;
    let z = 1;
    let destroyed = false;

    const pause = {
        hover: false,
        focus: false,
        drag: false,
        off: true,
        hidden: document.hidden,
        user: false,
    };
    const playing = () => !REDUCED && !Object.values(pause).some(Boolean);

    const wake = () => {
        if (!raf && !destroyed) raf = requestAnimationFrame(tick);
    };

    function tick(now: number) {
        if (destroyed) return;
        const dt = Math.min((now - (last || now)) / 1000, 1 / 20);
        last = now;
        for (const s of live) s.step(dt);
        for (const f of frames) f(dt * 1000, now);
        raf = live.size || frames.size > 1 || playing() ? requestAnimationFrame(tick) : ((last = 0), 0);
    }

    function spring(value: number, preset = "default", onUpdate: (v: number) => void = () => {}): Spring {
        const s: Spring = {
            value,
            target: value,
            v: 0,
            k: 0,
            c: 0,
            onUpdate,
            to(target, p = preset) {
                [s.k, s.c] = PRESETS[p] || PRESETS.default;
                s.target = target;
                if (REDUCED) {
                    s.value = target;
                    s.v = 0;
                    s.onUpdate(s.value);
                    return s;
                }
                live.add(s);
                wake();
                return s;
            },
            jump(v) {
                s.value = s.target = v;
                s.v = 0;
                live.delete(s);
                s.onUpdate(v);
                return s;
            },
            step(dt) {
                const h = 1 / 240;
                let n = Math.max(1, Math.round(dt / h));
                while (n--) {
                    const a = -s.k * (s.value - s.target) - s.c * s.v;
                    s.v += a * h;
                    s.value += s.v * h;
                }
                if (Math.abs(s.v) < 0.001 && Math.abs(s.value - s.target) < 0.0001) {
                    s.value = s.target;
                    s.v = 0;
                    live.delete(s);
                }
                s.onUpdate(s.value);
            },
        };
        [s.k, s.c] = PRESETS[preset] || PRESETS.default;
        return s;
    }

    const dial = root.querySelector<HTMLElement>("[data-dial]")!;
    const ring = root.querySelector<HTMLElement>("[data-ring]")!;
    const knob = root.querySelector<HTMLElement>("[data-knob]")!;
    const knobIn = knob.querySelector<HTMLElement>(".knob__in")!;
    const band = root.querySelector<HTMLElement>(".band")!;
    const photos = [...root.querySelectorAll<HTMLImageElement>(".photo img")];
    const labels = [...ring.querySelectorAll<HTMLElement>(".label")];
    const segs = [...root.querySelectorAll<HTMLElement>(".seg")];
    const eras = [...root.querySelectorAll<HTMLElement>("[data-story] .era")];
    const metas = [...root.querySelectorAll<HTMLElement>('[data-lines="meta"] > span')];
    const caps = [...root.querySelectorAll<HTMLElement>('[data-lines="caption"] > span')];
    const counter = root.querySelector<HTMLElement>("[data-counter]");
    const liveEl = root.querySelector<HTMLElement>("[data-live]");
    const cols = [...root.querySelectorAll<HTMLElement>(".yr")];
    const titles = eras.map((e) => e.querySelector("h3")?.textContent?.trim() || "");

    let G = { a0: 0, dir: 1, step: 14, rem: 16, bandIn: 0, bandOut: 0, mobile: false };

    function geo() {
        const cs = getComputedStyle(root);
        const num = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        // CSS --dir is geometric; RTL flips visual via SCSS, keep script reading CSS
        G = {
            a0: num("--a0"),
            dir: num("--dir") || 1,
            step: num("--step") || Math.max(10, Math.round(70 / Math.max(1, N - 1))),
            rem,
            bandIn: num("--band-in") * rem,
            bandOut: num("--band-out") * rem,
            mobile: num("--dir") < 0,
        };
        root.style.setProperty("--n", String(N));
        root.style.setProperty("--step", String(G.step));
    }

    const center = () => {
        const r = dial.getBoundingClientRect();
        return [r.left, r.top] as const;
    };

    let widths: number[] = [];
    function measure() {
        const probe = cols[0]?.querySelector(".yr__s");
        if (!probe) return;
        widths = [...probe.children].map((s) => {
            const r = document.createRange();
            r.selectNodeContents(s);
            return r.getBoundingClientRect().width;
        });
    }

    const digitSprings = cols.map((col, j) => {
        const sEl = col.querySelector<HTMLElement>(".yr__s")!;
        const startDigit = Number(String(start + 1).padStart(2, "0")[j] || 0);
        return spring(startDigit, "default", (v) => {
            sEl.style.setProperty("--d", String(v));
            if (widths.length) {
                const a = Math.max(0, Math.min(9, Math.floor(v)));
                const b = Math.min(9, a + 1);
                const t = v - a;
                col.style.width = `${widths[a] + (widths[b] - widths[a]) * t}px`;
            }
        });
    });

    function setIndexDigits(i: number) {
        const y = String(i + 1).padStart(2, "0");
        let k = 0;
        for (let j = cols.length - 1; j >= 0; j--) {
            const d = Number(y[j] || 0);
            const s = digitSprings[j];
            if (!s || s.target === d) continue;
            if (REDUCED) {
                s.jump(d);
                continue;
            }
            setTimeout(() => s.to(d), k++ * CFG.digitGap);
        }
    }

    function swap(list: HTMLElement[], from: number, to: number, order: number) {
        const a = list[from];
        const b = list[to];
        if (!b || a === b) return;
        const kill = (el: HTMLElement) => {
            el.getAnimations({ subtree: true }).forEach((x) => x.cancel());
            el.style.visibility = "";
            el.style.opacity = "";
        };
        list.forEach((el) => {
            kill(el);
            if (el !== b) el.classList.remove("is-on");
        });
        b.classList.add("is-on");
        if (REDUCED || !a) return;
        const partsA = a.matches(".era") ? [...a.children] : [a];
        const partsB = b.matches(".era") ? [...b.children] : [b];
        a.style.visibility = "visible";
        a.style.opacity = "1";
        partsA.forEach((p, n) => {
            (p as HTMLElement).animate(
                [
                    { transform: "none", opacity: 1 },
                    { transform: "translateY(-1rem)", opacity: 0 },
                ],
                {
                    duration: CFG.lineOut,
                    delay: (order + n) * CFG.lineGap * 0.25,
                    easing: "cubic-bezier(.5,0,.75,0)",
                    fill: "forwards",
                },
            );
        });
        const outEnd = CFG.lineOut + (order + partsA.length) * CFG.lineGap * 0.25;
        setTimeout(() => {
            if (!a.classList.contains("is-on")) kill(a);
        }, outEnd + 20);
        partsB.forEach((p, n) => {
            (p as HTMLElement).animate(
                [
                    { transform: "translateY(1rem)", opacity: 0 },
                    { transform: "none", opacity: 1 },
                ],
                {
                    duration: CFG.lineIn,
                    delay: CFG.lineOut * 0.8 + (order + n) * CFG.lineGap,
                    easing: "cubic-bezier(.2,.7,.2,1)",
                    fill: "backwards",
                },
            );
        });
    }

    function photo(from: number, to: number) {
        const b = photos[to];
        if (!b) return;
        b.classList.add("is-on");
        b.style.zIndex = String(++z);
        if (REDUCED) {
            photos.forEach((p) => p !== b && p.classList.remove("is-on"));
            return;
        }
        b.getAnimations().forEach((x) => x.cancel());
        const an = b.animate(
            [{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(71% at 50% 50%)" }],
            { duration: CFG.photoMs, easing: "cubic-bezier(.65,0,.35,1)" },
        );
        an.onfinish = () => {
            if (active === to) photos.forEach((p) => p !== b && p.classList.remove("is-on"));
        };
    }

    function setActive(i: number, quiet = false) {
        if (i === active) return;
        if (!quiet && liveEl) {
            liveEl.textContent = `${String(i + 1).padStart(2, "0")} · ${titles[i]}`;
        }
        const from = active;
        active = i;
        setIndexDigits(i);
        photo(from, i);
        if (metas.length) swap(metas, from, i, 3);
        swap(eras, from, i, 0);
        if (caps.length) swap(caps, from, i, 4);
        segs.forEach((s, n) => {
            s.classList.toggle("is-on", n === i);
            s.classList.toggle("is-past", n < i);
            if (n === i) s.setAttribute("aria-current", "step");
            else s.removeAttribute("aria-current");
        });
        labels.forEach((l, n) => {
            l.classList.toggle("is-here", n === i);
            l.tabIndex = n === i ? -1 : 0;
        });
        if (counter) {
            counter.textContent = `${String(i + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
        }
        knob.setAttribute("aria-valuenow", String(i + 1));
        knob.setAttribute("aria-valuetext", `${String(i + 1).padStart(2, "0")} · ${titles[i]}`);
        fill = 0;
    }

    const pos = spring(start, "gentle", (v) => {
        ring.style.setProperty("--rot", String(-G.dir * G.step * v));
        labels.forEach((l, n) => {
            const d = Math.abs(n - v);
            l.style.setProperty("--lo", (0.62 * Math.min(1, Math.max(0, (d - 0.25) / 0.5))).toFixed(3));
        });
        const i = Math.round(Math.max(0, Math.min(N - 1, v)));
        if (dragging || pos.target === i || Math.abs(v - pos.target) < 0.5) setActive(i);
    });

    function go(i: number, preset = "gentle", quiet = false) {
        i = ((i % N) + N) % N;
        const far = Math.abs(i - pos.target) > 1.5;
        pos.to(i, far ? "slow" : preset);
        setActive(i, quiet);
    }

    const angleAt = (x: number, y: number) => {
        const [cx, cy] = center();
        return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
    };

    const isMouse = (e: PointerEvent) => MOUSE.matches && e.pointerType === "mouse";

    const stopAuto = () => {
        if (!MOUSE.matches) pause.user = true;
        fill = 0;
        wake();
    };

    const setPause = (k: keyof typeof pause, v: boolean) => {
        pause[k] = v;
        if (!v) fill = 0;
        wake();
    };

    function onDown(e: PointerEvent) {
        if (e.button > 0 || (e.target as HTMLElement).closest?.(".label")) return;
        const [cx, cy] = center();
        const r = Math.hypot(e.clientX - cx, e.clientY - cy);
        const onKnob = knob.contains(e.target as Node);
        const inRing = r > G.bandIn - 24 && r < G.bandOut + 24;
        const onPhoto = G.mobile && r < G.bandIn;
        if (!onKnob && !inRing && !onPhoto) return;
        drag = {
            id: e.pointerId,
            a: angleAt(e.clientX, e.clientY),
            p: pos.value,
            x: e.clientX,
            y: e.clientY,
            moved: false,
        };
        dial.setPointerCapture(e.pointerId);
    }

    function onMove(e: PointerEvent) {
        if (!drag && isMouse(e)) {
            const [cx, cy] = center();
            const r = Math.hypot(e.clientX - cx, e.clientY - cy);
            band.style.cursor = r > G.bandIn - 24 && r < G.bandOut + 24 ? "grab" : "default";
        }
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved) {
            if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
            drag.moved = true;
            dragging = true;
            root.classList.add("is-dragging");
            knobScale.to(CFG.knobHover, "stiff");
            pause.drag = true;
        }
        let d = angleAt(e.clientX, e.clientY) - drag.a;
        d = ((d + 540) % 360) - 180;
        let p = drag.p - (G.dir * d) / G.step;
        if (p < 0) p *= 0.35;
        if (p > N - 1) p = N - 1 + (p - N + 1) * 0.35;
        pos.to(p, "stiff");
        stopAuto();
    }

    function onUp(e: PointerEvent) {
        if (!drag || e.pointerId !== drag.id) return;
        const wasDrag = drag.moved;
        drag = null;
        if (wasDrag) {
            dragging = false;
            root.classList.remove("is-dragging");
            pause.drag = false;
            const v = pos.value + pos.v * 0.12;
            go(Math.round(Math.max(0, Math.min(N - 1, v))));
            if (!hoverKnob) knobScale.to(1, "stiff");
            suppress = true;
            setTimeout(() => {
                suppress = false;
            }, 0);
        }
    }

    const knobScale = spring(1, "stiff", (v) => knobIn.style.setProperty("--ks", String(v)));

    const onWheel = (e: WheelEvent) => {
        if (G.mobile) return;
        const d = Math.sign(e.deltaY || e.deltaX);
        if (!d) return;
        const next = pos.target + d;
        if (next < 0 || next > N - 1) return;
        e.preventDefault();
        const now = performance.now();
        if (now - wheelAt < CFG.wheelGap) return;
        wheelAt = now;
        go(next);
        stopAuto();
    };

    const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        let t: number | null = null;
        if (k === "ArrowRight" || k === "ArrowDown") t = Math.min(N - 1, pos.target + 1);
        if (k === "ArrowLeft" || k === "ArrowUp") t = Math.max(0, pos.target - 1);
        if (k === "Home") t = 0;
        if (k === "End") t = N - 1;
        if (t === null) return;
        e.preventDefault();
        go(t);
        stopAuto();
    };

    const cleanups: Array<() => void> = [];

    dial.addEventListener("pointerdown", onDown);
    dial.addEventListener("pointermove", onMove);
    dial.addEventListener("pointerup", onUp);
    dial.addEventListener("pointercancel", (e) => {
        if (drag?.moved) onUp(e);
        drag = null;
    });
    dial.addEventListener(
        "click",
        (e) => {
            if (suppress) e.preventDefault();
        },
        true,
    );
    dial.addEventListener("wheel", onWheel, { passive: false });
    knob.addEventListener("keydown", onKey);

    labels.forEach((l) => {
        const fn = () => {
            go(Number(l.dataset.go));
            stopAuto();
        };
        l.addEventListener("click", fn);
        cleanups.push(() => l.removeEventListener("click", fn));
    });

    root.querySelectorAll<HTMLElement>("[data-step]").forEach((b) => {
        const fn = () => {
            go(pos.target + Number(b.dataset.step));
            stopAuto();
        };
        b.addEventListener("click", fn);
        cleanups.push(() => b.removeEventListener("click", fn));
    });

    segs.forEach((s) => {
        const fn = () => {
            go(Number(s.dataset.go));
            stopAuto();
        };
        s.addEventListener("click", fn);
        cleanups.push(() => s.removeEventListener("click", fn));
    });

    // Hover polish
    const onKnobEnter = (e: PointerEvent) => {
        if (!isMouse(e)) return;
        hoverKnob = true;
        knobScale.to(CFG.knobHover, "stiff");
    };
    const onKnobLeave = (e: PointerEvent) => {
        if (!isMouse(e)) return;
        hoverKnob = false;
        if (!dragging) knobScale.to(1, "stiff");
    };
    knob.addEventListener("pointerenter", onKnobEnter);
    knob.addEventListener("pointerleave", onKnobLeave);
    knob.addEventListener("focus", () => {
        if (knob.matches(":focus-visible")) knobScale.to(CFG.knobHover, "stiff");
    });
    knob.addEventListener("blur", () => {
        if (!hoverKnob) knobScale.to(1, "stiff");
    });

    labels.forEach((l) => {
        const on = () => {
            l.style.opacity = "1";
        };
        const off = () => {
            l.style.opacity = "";
        };
        l.addEventListener("pointerenter", (e) => isMouse(e) && on());
        l.addEventListener("pointerleave", (e) => isMouse(e) && off());
        l.addEventListener("focus", () => l.matches(":focus-visible") && on());
        l.addEventListener("blur", off);
    });

    segs.forEach((s) => {
        const i = s.querySelector("i");
        if (!i) return;
        const on = () => i.style.setProperty("--sy", "2");
        const off = () => i.style.removeProperty("--sy");
        s.addEventListener("pointerenter", (e) => isMouse(e) && on());
        s.addEventListener("pointerleave", (e) => isMouse(e) && off());
        s.addEventListener("focus", () => s.matches(":focus-visible") && on());
        s.addEventListener("blur", off);
    });

    root.querySelectorAll<HTMLElement>(".arrow").forEach((b) => {
        const clip = b.querySelector<HTMLElement>(".arrow__clip");
        const a1 = clip?.querySelector("svg");
        if (!clip || !a1) return;
        const a2 = a1.cloneNode(true) as SVGElement;
        clip.appendChild(a2);
        const dir = Number(b.dataset.step) || 1;
        const fillS = spring(0, "stiff", (v) => b.style.setProperty("--fs", String(Math.max(0, v))));
        const rollS = spring(0, "arrow", (v) => {
            a1.style.transform = `translateX(${v * dir * 100}%)`;
            a2.style.transform = `translateX(${(v - 1) * dir * 100}%)`;
        });
        rollS.onUpdate(0);
        const on = () => {
            b.classList.add("is-hot");
            fillS.to(1, "stiff");
            rollS.to(1, "arrow");
        };
        const off = () => {
            b.classList.remove("is-hot");
            fillS.to(0, "stiff");
            rollS.to(0, "arrow");
        };
        b.addEventListener("pointerenter", (e) => isMouse(e) && on());
        b.addEventListener("pointerleave", (e) => isMouse(e) && off());
        b.addEventListener("focus", () => b.matches(":focus-visible") && on());
        b.addEventListener("blur", off);
    });

    const loop = (dt: number) => {
        const seg = segs[active];
        if (!seg) return;
        if (!playing()) {
            seg.style.setProperty("--fill", "1");
            return;
        }
        fill += dt / CFG.autoplay;
        seg.style.setProperty("--fill", Math.min(1, fill).toFixed(4));
        if (fill >= 1) {
            fill = 0;
            go(active === N - 1 ? 0 : active + 1, "gentle", true);
        }
    };
    frames.add(loop);

    const onPointerEnter = (e: PointerEvent) => {
        if (isMouse(e)) setPause("hover", true);
    };
    const onPointerLeave = (e: PointerEvent) => {
        if (isMouse(e)) setPause("hover", false);
    };
    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", (e) => {
        if ((e.target as HTMLElement).matches?.(":focus-visible")) setPause("focus", true);
    });
    root.addEventListener("focusout", () => setPause("focus", false));

    const io = new IntersectionObserver(([en]) => setPause("off", !en.isIntersecting), {
        threshold: 0.25,
    });
    io.observe(root);

    const onVis = () => {
        last = 0;
        setPause("hidden", document.hidden);
    };
    document.addEventListener("visibilitychange", onVis);

    const onResize = () => {
        geo();
        pos.onUpdate(pos.value);
        measure();
        digitSprings.forEach((s) => s.onUpdate(s.value));
    };
    addEventListener("resize", onResize);

    geo();
    pos.jump(start);
    // Ensure initial UI classes without animations
    eras.forEach((e, n) => e.classList.toggle("is-on", n === start));
    photos.forEach((p, n) => p.classList.toggle("is-on", n === start));
    metas.forEach((m, n) => m.classList.toggle("is-on", n === start));
    caps.forEach((c, n) => c.classList.toggle("is-on", n === start));
    segs.forEach((s, n) => {
        s.classList.toggle("is-on", n === start);
        s.classList.toggle("is-past", n < start);
    });
    labels.forEach((l, n) => {
        l.classList.toggle("is-here", n === start);
        l.tabIndex = n === start ? -1 : 0;
    });
    if (counter) counter.textContent = `${String(start + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
    knob.setAttribute("aria-valuemin", "1");
    knob.setAttribute("aria-valuemax", String(N));
    knob.setAttribute("aria-valuenow", String(start + 1));
    knob.setAttribute("aria-valuetext", `${String(start + 1).padStart(2, "0")} · ${titles[start]}`);
    knob.setAttribute("aria-label", opts.solutionWord);

    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    fontsReady.then(() => {
        if (destroyed) return;
        measure();
        digitSprings.forEach((s) => s.onUpdate(s.value));
    });
    wake();

    return {
        destroy: () => {
            destroyed = true;
            cancelAnimationFrame(raf);
            live.clear();
            frames.clear();
            io.disconnect();
            removeEventListener("resize", onResize);
            document.removeEventListener("visibilitychange", onVis);
            dial.removeEventListener("pointerdown", onDown);
            dial.removeEventListener("pointermove", onMove);
            dial.removeEventListener("pointerup", onUp);
            dial.removeEventListener("wheel", onWheel);
            knob.removeEventListener("keydown", onKey);
            root.removeEventListener("pointerenter", onPointerEnter);
            root.removeEventListener("pointerleave", onPointerLeave);
            cleanups.forEach((fn) => fn());
            root.classList.remove("is-dragging");
        },
    };
}
