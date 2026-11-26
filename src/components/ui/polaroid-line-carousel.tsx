"use client"

import * as React from "react"
import { createPortal } from "react-dom"

/*
 * Polaroid Line Carousel — instant photos pegged to a sagging string. Drag the
 * line (or use the arrows) and the prints slide along it, swinging on their
 * pegs with the speed you give them and settling back with a little
 * overshoot; even at rest they sway in a light breeze. The one in the middle
 * is the one you're looking at.
 *
 * Drag, click a print (opens lightbox with zoom/download/close chrome), ←/→
 * and autoplay. The line loops forever (arrows, drag, and autoplay wrap both
 * ways). Starts on the middle print. Slides without an `image` get a painted
 * landscape.
 */

export type LandPalette = "dawn" | "alpine" | "dusk" | "mist"

export type Slide = {
  image?: string
  /** Full-resolution source for the lightbox. The card uses `image` (smaller). */
  fullImage?: string
  title?: string
  caption?: string
  alt?: string
  /** Palette and seed of the painted landscape used when `image` is empty. */
  palette?: LandPalette
  seed?: number
}

export type PolaroidLineCarouselProps = {
  slides?: Slide[]
  /** Any CSS length. Default 100svh. Pass `null` to size via `className` instead. */
  height?: number | string | null
  /** Width of a print in px (it shrinks on narrow screens). */
  cardWidth?: number
  /** How far the string sags in the middle, px. */
  sag?: number
  /** How much the prints swing; 0 holds them still. */
  swing?: number
  /** ms per print; 0 turns autoplay off. It waits while someone is interacting. */
  autoplay?: number
  /** Colour of the string and pegs. */
  string?: string
  background?: string
  ink?: string
  onChange?: (index: number) => void
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  /** When false, hide caption bar, counter, and arrow buttons. Default true. */
  showChrome?: boolean
}

// #region logic
export function wrap(i: number, n: number): number {
  return n ? ((i % n) + n) % n : 0
}

export function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v))
}

/** Height of a string sagging by `sag` between (0, y0) and (w, y0), at x. */
export function stringY(x: number, w: number, y0: number, sag: number): number {
  const t = clamp(x / w, 0, 1)
  return y0 + 4 * sag * t * (1 - t)
}

/** One step of a critically damped spring toward target. */
export function springStep(x: number, v: number, target: number, dt: number, k = 70): [number, number] {
  const c = 2 * Math.sqrt(k)
  const nv = v + (k * (target - x) - c * v) * dt
  return [x + nv * dt, nv]
}

/** One step of a print's swing. lineVel is the prints' on-screen speed (px/s, + = moving right); a print lags behind the motion, is pulled back by gravity and damped. */
export function swingStep(a: number, w: number, lineVel: number, dt: number, gain: number): [number, number] {
  const nw = w + (-38 * a - 4.2 * w + lineVel * 0.0034 * gain) * dt
  return [clamp(a + nw * dt, -0.6, 0.6), nw]
}

/** Index of the print nearest the centre for a line offset (wraps). */
export function nearestAt(off: number, spacing: number, n: number): number {
  if (n <= 0) return 0
  return wrap(Math.round(off / spacing), n)
}

/**
 * Horizontal offset of print `i` from the viewport centre for a looping line.
 * Picks the nearest copy of the print so the string reads as infinite.
 */
export function cardRelX(i: number, off: number, spacing: number, n: number): number {
  if (n <= 0) return 0
  const period = n * spacing
  let rel = i * spacing - off
  rel = ((rel % period) + period) % period
  if (rel >= period / 2) rel -= period
  return rel
}

/** Snap `off`/`target` into a stable band without changing the visible slide. */
export function normalizeLoopOffset(off: number, spacing: number, n: number): number {
  if (n <= 0 || spacing <= 0) return 0
  const period = n * spacing
  return ((off % period) + period) % period
}

export function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n)
}
// #endregion logic

/* ------------------------------------------------------- painted images */

const PALETTES = {
  dawn: { top: "#e7b7a5", bottom: "#f8e8d6", sun: "#fff4df", far: "#d2b2bb", near: "#3a2a3b", mist: "255,240,232" },
  alpine: { top: "#7ea5c8", bottom: "#e3ecf2", sun: "#ffffff", far: "#a9bfd0", near: "#1c3044", mist: "236,244,250" },
  dusk: { top: "#2a2450", bottom: "#ef8d60", sun: "#ffd9a6", far: "#93607c", near: "#18121f", mist: "255,196,160" },
  mist: { top: "#c4d0cb", bottom: "#eef1ec", sun: "#ffffff", far: "#aebcb5", near: "#2c3a33", mist: "246,248,245" },
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hexRgb(h: string): [number, number, number] {
  const v = parseInt(h.replace("#", ""), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
function mixRgb(a: string, b: string, t: number): string {
  const A = hexRgb(a)
  const B = hexRgb(b)
  return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")"
}

// A layered-ridge landscape: sky, a low sun, five ridges fading into haze with
// mist between them, a tree line on the nearest, film grain. Painted once.
function paintLandscape(seed: number, palette: LandPalette, w = 1600, h = 1000): string {
  if (typeof document === "undefined") return ""
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const g = c.getContext("2d")
  if (!g) return ""
  const P = PALETTES[palette] ?? PALETTES.dawn
  const r = mulberry32(seed * 104729 + 7)

  const sky = g.createLinearGradient(0, 0, 0, h * 0.72)
  sky.addColorStop(0, P.top)
  sky.addColorStop(1, P.bottom)
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  const sx = w * (0.22 + r() * 0.56)
  const sy = h * (0.26 + r() * 0.16)
  const halo = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.45)
  halo.addColorStop(0, "rgba(" + hexRgb(P.sun).join(",") + ",.85)")
  halo.addColorStop(0.08, "rgba(" + hexRgb(P.sun).join(",") + ",.55)")
  halo.addColorStop(1, "rgba(" + hexRgb(P.sun).join(",") + ",0)")
  g.fillStyle = halo
  g.fillRect(0, 0, w, h)
  g.fillStyle = P.sun
  g.beginPath()
  g.arc(sx, sy, h * 0.045, 0, Math.PI * 2)
  g.fill()

  const layers = 5
  for (let L = 0; L < layers; L++) {
    const k = L / (layers - 1)
    const base = h * (0.42 + k * 0.4)
    const amp = h * (0.07 + k * 0.1)
    const ph = [r(), r(), r(), r()].map((v) => v * Math.PI * 2)
    const fr = [1.3 + r(), 3.1 + r() * 2, 7 + r() * 4, 17 + r() * 8]
    const ridge = (x: number) => {
      const u = x / w
      return (
        base -
        amp *
          (0.55 * Math.sin(u * fr[0] + ph[0]) +
            0.28 * Math.sin(u * fr[1] + ph[1]) +
            0.12 * Math.abs(Math.sin(u * fr[2] + ph[2])) +
            0.05 * Math.sin(u * fr[3] + ph[3]))
      )
    }
    const mist = g.createLinearGradient(0, base - amp * 1.4, 0, base + amp * 0.4)
    mist.addColorStop(0, "rgba(" + P.mist + ",0)")
    mist.addColorStop(1, "rgba(" + P.mist + "," + (0.55 - k * 0.35).toFixed(2) + ")")
    g.fillStyle = mist
    g.fillRect(0, base - amp * 1.4, w, amp * 1.8)
    const body = g.createLinearGradient(0, base - amp, 0, h)
    body.addColorStop(0, mixRgb(P.far, P.near, Math.pow(k, 1.3)))
    body.addColorStop(1, mixRgb(P.far, P.near, Math.min(1, Math.pow(k, 1.3) + 0.18)))
    g.fillStyle = body
    g.beginPath()
    g.moveTo(0, h)
    for (let x = 0; x <= w; x += 6) g.lineTo(x, ridge(x))
    g.lineTo(w, h)
    g.closePath()
    g.fill()
    if (L >= layers - 2) {
      g.fillStyle = mixRgb(P.far, P.near, Math.min(1, Math.pow(k, 1.3) + 0.08))
      for (let x = 0; x < w; x += 7 + r() * 9) {
        if (r() < 0.35) continue
        const y = ridge(x) + 2
        const th = h * (0.025 + r() * 0.035) * (0.6 + k)
        const tw = th * 0.32
        g.beginPath()
        g.moveTo(x, y - th)
        g.lineTo(x + tw, y)
        g.lineTo(x - tw, y)
        g.closePath()
        g.fill()
      }
    }
  }

  const vig = g.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h / 2, w * 0.78)
  vig.addColorStop(0, "rgba(0,0,0,0)")
  vig.addColorStop(1, "rgba(0,0,0,.32)")
  g.fillStyle = vig
  g.fillRect(0, 0, w, h)
  const grain = g.getImageData(0, 0, w, h)
  const d = grain.data
  for (let i = 0; i < d.length; i += 4) {
    const v = (r() - 0.5) * 14
    d[i] += v
    d[i + 1] += v
    d[i + 2] += v
  }
  g.putImageData(grain, 0, 0)
  return c.toDataURL("image/jpeg", 0.88)
}

const DEFAULT_SLIDES: Slide[] = [
  { title: "First Light", caption: "Haze lifting off the eastern ridges.", palette: "dawn", seed: 3 },
  { title: "High Pass", caption: "Cold air, clear to the far range.", palette: "alpine", seed: 8 },
  { title: "Ember Hour", caption: "The last of the sun on the valley floor.", palette: "dusk", seed: 14 },
  { title: "Still Valley", caption: "Morning mist that never quite lifts.", palette: "mist", seed: 21 },
  { title: "Rose Ridge", caption: "Five ridges, one long exhale.", palette: "dawn", seed: 34 },
  { title: "Blue Hour", caption: "Pines going dark against the snow.", palette: "alpine", seed: 55 },
]

// Every slide as an image URL; slides without one are painted after mount.
function useSlideImages(slides: Slide[]): string[] {
  const key = slides.map((s) => s.image || (s.palette || "dawn") + ":" + (s.seed ?? 1)).join("|")
  const [painted, setPainted] = React.useState(() => slides.map(() => ""))
  React.useEffect(() => {
    setPainted(slides.map((s, i) => (s.image ? "" : paintLandscape(s.seed ?? i + 1, s.palette || "dawn"))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return slides.map((s, i) => s.image || painted[i] || "")
}

const PL_CSS = [
  ".pl-root{position:relative;width:100%;overflow:hidden;background:var(--pl-bg);color:var(--pl-ink);user-select:none;-webkit-user-select:none;touch-action:pan-y;outline:none;cursor:grab;container-type:inline-size;--pl-cw:min(300px,42cqi)}",
  ".pl-root[data-drag='1']{cursor:grabbing}",
  ".pl-root[data-ready='0'] .pl-card{visibility:hidden}",
  ".pl-root[data-ready='0'] .pl-card[data-lcp='1']{visibility:visible;left:50%;top:0;transform:translate(-50%,calc(max(40px,20%) + 40px))}",
  ".pl-root:focus-visible{box-shadow:inset 0 0 0 2px var(--pl-ink)}",
  ".pl-string{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}",
  ".pl-card{position:absolute;left:0;top:0;width:var(--pl-cw);transform-origin:50% 0;will-change:transform;cursor:pointer}",
  ".pl-root[data-drag='1'] .pl-card{cursor:grabbing}",
  ".pl-print{margin-top:10px;background:#fbfaf7;padding:10px 10px 0;box-shadow:0 1px 2px rgba(0,0,0,.12),0 18px 30px -16px rgba(0,0,0,.4);transition:transform .5s cubic-bezier(.2,.7,.2,1),filter .5s ease}",
  ".pl-card[data-on='0'] .pl-print{transform:scale(.9);filter:saturate(.7) brightness(.96)}",
  ".pl-shot{position:relative;aspect-ratio:1;overflow:hidden;background:#d9d5cc}",
  ".pl-shot img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;display:block;pointer-events:none}",
  ".pl-note{height:46px;display:flex;align-items:center;justify-content:center;padding:0 6px;font:italic 400 15px/1.1 ui-serif,Georgia,'Times New Roman',serif;color:#3b3833;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".pl-root[data-chrome='0'] .pl-note{height:14px}",
  ".pl-peg{position:absolute;left:50%;top:0;width:10px;height:26px;margin-left:-5px;border-radius:2px;background:linear-gradient(90deg,#c9a67a,#e3c9a1 45%,#b8915f);box-shadow:0 2px 3px rgba(0,0,0,.25)}",
  ".pl-peg::after{content:'';position:absolute;left:4px;top:8px;width:2px;height:7px;background:rgba(80,60,30,.45);border-radius:1px}",
  ".pl-bar{position:absolute;left:clamp(16px,4vw,56px);right:clamp(16px,4vw,56px);bottom:clamp(20px,4vh,40px);display:flex;align-items:center;gap:clamp(12px,2vw,24px);cursor:default}",
  ".pl-cap{flex:1;min-width:0;overflow:hidden;padding-bottom:.15em}",
  ".pl-cap>*{display:block;animation:pl-in .55s cubic-bezier(.2,.8,.2,1) both}",
  ".pl-title{font:500 clamp(18px,2.2vw,26px)/1.15 ui-serif,Georgia,'Times New Roman',serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".pl-sub{margin-top:4px;font:400 13px/1.4 ui-sans-serif,system-ui,sans-serif;color:var(--pl-muted)}",
  ".pl-count{font:500 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:var(--pl-muted)}",
  ".pl-count b{color:var(--pl-ink);font-weight:500}",
  ".pl-btn{appearance:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--pl-line);background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;transition:background .2s ease,color .2s ease}",
  ".pl-btn:hover{background:var(--pl-ink);color:var(--pl-bg)}",
  ".pl-btn:focus-visible{outline:2px solid var(--pl-ink);outline-offset:2px}",
  ".pl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
  ".pl-lb{position:fixed;inset:0;z-index:100;background:rgba(10,10,10,.92);display:grid;place-items:center;touch-action:none;cursor:zoom-out}",
  ".pl-lb-stage{position:relative;width:100%;height:100%;overflow:hidden;display:grid;place-items:center;cursor:default}",
  ".pl-lb-img{max-width:min(92vw,92vh);max-height:min(92vw,92vh);width:auto;height:auto;object-fit:contain;transform-origin:center center;will-change:transform;user-select:none;-webkit-user-select:none;pointer-events:auto;cursor:zoom-in}",
  ".pl-lb-img[data-zoomed='1']{cursor:grab}",
  ".pl-lb-img[data-panning='1']{cursor:grabbing}",
  ".pl-lb-chrome{position:absolute;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:2;display:flex;align-items:center;gap:8px;cursor:default}",
  ".pl-lb-tool{appearance:none;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(20,20,20,.72);color:#f5f5f5;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background .15s ease,border-color .15s ease}",
  ".pl-lb-tool:hover{background:rgba(40,40,40,.88);border-color:rgba(255,255,255,.45)}",
  ".pl-lb-tool:focus-visible{outline:2px solid #fff;outline-offset:2px}",
  ".pl-lb-tool:disabled{opacity:.35;cursor:default}",
  ".pl-lb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}",
  "@keyframes pl-in{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}",
  "@media (prefers-reduced-motion:reduce){.pl-cap>*{animation:none}.pl-print{transition:none}}",
].join("\n")

/** Middle slide index so the line can scroll both ways from load. */
export function middleIndex(n: number): number {
  if (n <= 1) return 0
  return Math.floor((n - 1) / 2)
}

function cardWidthFor(r: DOMRectReadOnly, cardWidth: number, showChrome: boolean): number {
  return Math.round(
    Math.max(
      150,
      Math.min(cardWidth, r.width * 0.42, showChrome ? r.height * 0.42 : cardWidth),
    ),
  )
}

/** Fullscreen lightbox: pinch + wheel zoom, pan when zoomed, chrome controls, close on backdrop / Esc. */
function PolaroidLightbox({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  const imgRef = React.useRef(null as HTMLImageElement | null)
  const view = React.useRef({ scale: 1, x: 0, y: 0 })
  const pan = React.useRef(null as null | { x: number; y: number; px: number; py: number; pointerId: number })
  const pinch = React.useRef(null as null | { dist: number; scale: number })
  /** Tracks a potential click/tap-to-zoom (ignored once the gesture pans or pinches). */
  const tap = React.useRef(null as null | { x: number; y: number; pointerId: number; moved: boolean })
  const didPinch = React.useRef(false)
  const [panning, setPanning] = React.useState(false)
  const [scale, setScale] = React.useState(1)

  const apply = React.useCallback(() => {
    const el = imgRef.current
    if (!el) return
    const v = view.current
    el.style.transform = "translate(" + v.x.toFixed(1) + "px," + v.y.toFixed(1) + "px) scale(" + v.scale.toFixed(3) + ")"
    setScale(v.scale)
  }, [])

  const zoomAt = React.useCallback(
    (next: number, cx: number, cy: number) => {
      const v = view.current
      const el = imgRef.current
      if (!el) return
      const s0 = v.scale
      const s1 = clamp(next, 1, 4)
      if (s1 === s0) return
      const rect = el.getBoundingClientRect()
      const ox = cx - (rect.left + rect.width / 2)
      const oy = cy - (rect.top + rect.height / 2)
      v.x = ox - ((ox - v.x) * s1) / s0
      v.y = oy - ((oy - v.y) * s1) / s0
      v.scale = s1
      if (s1 === 1) {
        v.x = 0
        v.y = 0
      }
      apply()
    },
    [apply],
  )

  const zoomByButton = React.useCallback(
    (dir: 1 | -1) => {
      const el = imgRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      zoomAt(view.current.scale * (dir > 0 ? 1.25 : 1 / 1.25), cx, cy)
    },
    [zoomAt],
  )

  const downloadImage = React.useCallback(async () => {
    const name = (alt || "polaroid").replace(/[^\w\u0600-\u06FF.-]+/g, "-").replace(/^-|-$/g, "") || "polaroid"
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name + (blob.type.includes("png") ? ".png" : blob.type.includes("webp") ? ".webp" : ".jpg")
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      const a = document.createElement("a")
      a.href = src
      a.download = name
      a.rel = "noopener"
      a.target = "_blank"
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }, [alt, src])

  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault()
        zoomByButton(1)
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        zoomByButton(-1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose, zoomByButton])

  React.useEffect(() => {
    view.current = { scale: 1, x: 0, y: 0 }
    apply()
  }, [apply, src])

  // Native wheel listener so preventDefault works (React wheel is often passive).
  React.useEffect(() => {
    const stage = imgRef.current?.parentElement
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      zoomAt(view.current.scale * factor, e.clientX, e.clientY)
    }
    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => stage.removeEventListener("wheel", onWheel)
  }, [zoomAt, src])

  const toggleZoomAt = React.useCallback(
    (cx: number, cy: number) => {
      if (view.current.scale > 1.05) {
        view.current = { scale: 1, x: 0, y: 0 }
        apply()
        return
      }
      zoomAt(2, cx, cy)
    },
    [apply, zoomAt],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return
    tap.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, moved: false }
    if (view.current.scale <= 1) return
    pan.current = { x: e.clientX, y: e.clientY, px: view.current.x, py: view.current.y, pointerId: e.pointerId }
    setPanning(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const t = tap.current
    if (t && t.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 6) t.moved = true
    }
    const p = pan.current
    if (!p || p.pointerId !== e.pointerId) return
    view.current.x = p.px + (e.clientX - p.x)
    view.current.y = p.py + (e.clientY - p.y)
    apply()
  }
  const endPointer = (e: React.PointerEvent, allowTap: boolean) => {
    const t = tap.current
    const wasTap = allowTap && t && t.pointerId === e.pointerId && !t.moved
    if (pan.current?.pointerId === e.pointerId) {
      pan.current = null
      setPanning(false)
    }
    tap.current = null
    if (wasTap) toggleZoomAt(e.clientX, e.clientY)
  }
  const onPointerUp = (e: React.PointerEvent) => endPointer(e, true)
  const onPointerCancel = (e: React.PointerEvent) => endPointer(e, false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinch.current = { dist, scale: view.current.scale }
      didPinch.current = true
      pan.current = null
      tap.current = null
      setPanning(false)
      return
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]
      didPinch.current = false
      tap.current = { x: t.clientX, y: t.clientY, pointerId: -1, moved: false }
      if (view.current.scale > 1) {
        pan.current = { x: t.clientX, y: t.clientY, px: view.current.x, py: view.current.y, pointerId: -1 }
        setPanning(true)
      }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinch.current) {
      didPinch.current = true
      tap.current = null
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const cx = (a.clientX + b.clientX) / 2
      const cy = (a.clientY + b.clientY) / 2
      zoomAt(pinch.current.scale * (dist / Math.max(1, pinch.current.dist)), cx, cy)
      return
    }
    const t0 = e.touches[0]
    const tapState = tap.current
    if (t0 && tapState && Math.hypot(t0.clientX - tapState.x, t0.clientY - tapState.y) > 8) {
      tapState.moved = true
    }
    const p = pan.current
    if (e.touches.length === 1 && p) {
      const t = e.touches[0]
      view.current.x = p.px + (t.clientX - p.x)
      view.current.y = p.py + (t.clientY - p.y)
      apply()
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null
    if (e.touches.length === 0) {
      const tapState = tap.current
      const wasTap = Boolean(tapState && !tapState.moved && !didPinch.current)
      const x = tapState?.x
      const y = tapState?.y
      pan.current = null
      setPanning(false)
      tap.current = null
      didPinch.current = false
      if (wasTap && x != null && y != null) toggleZoomAt(x, y)
    } else if (e.touches.length === 1 && view.current.scale > 1) {
      const t = e.touches[0]
      tap.current = null
      pan.current = { x: t.clientX, y: t.clientY, px: view.current.x, py: view.current.y, pointerId: -1 }
    }
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="pl-lb"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image"}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("pl-lb-stage")) onClose()
      }}
    >
      <div
        className="pl-lb-chrome"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="pl-lb-tool"
          aria-label="Zoom in"
          disabled={scale >= 4 - 1e-6}
          onClick={() => zoomByButton(1)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.4" />
            <path d="M12 12.5 15.5 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M8 5.75v4.5M5.75 8h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className="pl-lb-tool"
          aria-label="Zoom out"
          disabled={scale <= 1 + 1e-6}
          onClick={() => zoomByButton(-1)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.4" />
            <path d="M12 12.5 15.5 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M5.75 8h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="pl-lb-tool" aria-label="Download image" onClick={() => void downloadImage()}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 3.5v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="m5.75 8.75 3.25 3.25 3.25-3.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 14.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="pl-lb-tool" aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="m5 5 8 8M13 5 5 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div
        className="pl-lb-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          className="pl-lb-img"
          src={src}
          alt={alt}
          draggable={false}
          data-zoomed={scale > 1.05 ? "1" : "0"}
          data-panning={panning ? "1" : "0"}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      </div>
      <span className="pl-lb-sr">Use zoom buttons, click or tap the image, pinch, or scroll to zoom. Download or press Escape to close.</span>
    </div>,
    document.body,
  )
}

export default function PolaroidLineCarousel({
  slides = DEFAULT_SLIDES,
  height = "100svh",
  cardWidth = 300,
  sag = 46,
  swing = 1,
  autoplay = 4500,
  string = "#8a7f72",
  background = "var(--color-background, #efece6)",
  ink = "var(--color-foreground, #161513)",
  onChange,
  className,
  style,
  ariaLabel = "Image carousel",
  showChrome = true,
}: PolaroidLineCarouselProps) {
  const n = slides.length
  const startIndex = middleIndex(n)
  const srcs = useSlideImages(slides)
  const [active, setActive] = React.useState(startIndex)
  const [dragging, setDragging] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [lightbox, setLightbox] = React.useState(null as number | null)
  const [size, setSize] = React.useState({ w: 0, h: 0, cw: cardWidth })
  const rootRef = React.useRef(null as HTMLDivElement | null)
  const pathRef = React.useRef(null as SVGPathElement | null)
  const cards = React.useRef([] as (HTMLDivElement | null)[])
  const sim = React.useRef({ off: 0, vel: 0, target: 0, a: [] as number[], w: [] as number[] })
  const drag = React.useRef(null as null | { x: number; off: number; lx: number; lt: number; v: number; moved: boolean })
  const lastTouch = React.useRef(0)
  const activeRef = React.useRef(startIndex)
  const sizeRef = React.useRef(size)
  const spacingRef = React.useRef(cardWidth * 1.08)
  const lightboxRef = React.useRef(lightbox)
  const opts = React.useRef({ sag, swing })
  opts.current = { sag, swing }
  sizeRef.current = size
  lightboxRef.current = lightbox

  const spacing = size.cw * 1.08
  spacingRef.current = spacing

  /** Move to slide `i` (any integer; wraps). Chooses the nearest loop copy so motion keeps direction. */
  const goTo = React.useCallback((i: number) => {
    if (n <= 0) return
    const sp = spacingRef.current
    const period = n * sp
    const targetIdx = wrap(i, n)
    const currentOff = sim.current.off
    let desired = targetIdx * sp
    if (period > 0) {
      const k = Math.round((currentOff - desired) / period)
      desired = desired + k * period
    }
    sim.current.target = desired
  }, [n])

  const syncCenter = React.useCallback(
    (cw: number, index = activeRef.current) => {
      const sp = cw * 1.08
      const i = n > 0 ? wrap(index, n) : 0
      // off/target 0 centers slide 0; i * spacing centers slide i
      sim.current.target = i * sp
      sim.current.off = i * sp
      sim.current.vel = 0
      activeRef.current = i
      spacingRef.current = sp
    },
    [n],
  )

  const paintOnce = React.useCallback(
    (now = performance.now()) => {
      const { w, h, cw } = sizeRef.current
      if (w <= 0 || h <= 0) return
      const sp = cw * 1.08
      const S = sim.current
      const o = opts.current
      const y0 = Math.max(40, h * 0.2)
      const near = nearestAt(S.off, sp, n)
      for (let i = 0; i < n; i++) {
        const el = cards.current[i]
        if (!el) continue
        const rel = cardRelX(i, S.off, sp, n)
        const x = w / 2 + rel
        if (x < -cw * 1.5 || x > w + cw * 1.5) {
          el.style.visibility = "hidden"
          continue
        }
        el.style.visibility = "visible"
        const a = S.a[i] || 0
        const y = stringY(x, w, y0, o.sag) - 6
        el.style.transform =
          "translate(" + (x - cw / 2).toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + a.toFixed(4) + "rad)"
        const dist = Math.min(
          Math.abs(i - near),
          n - Math.abs(i - near),
        )
        el.style.zIndex = String(i === near ? n + 1 : n - dist)
      }
      pathRef.current?.setAttribute("d", "M0 " + y0 + " Q" + w / 2 + " " + (y0 + 2 * o.sag) + " " + w + " " + y0)
      if (near !== activeRef.current) {
        activeRef.current = near
        setActive(near)
      }
      void now
    },
    [n],
  )

  // Measure before paint so the middle print is centered (scroll both ways from load).
  React.useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const r = root.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      const cw = cardWidthFor(r, cardWidth, showChrome)
      const next = { w: r.width, h: r.height, cw }
      const i = middleIndex(n)
      sizeRef.current = next
      syncCenter(cw, i)
      setActive(i)
      setSize(next)
      setReady(true)
      // paint after refs attach; microtask keeps it before the next frame
      queueMicrotask(() => paintOnce())
    }
    measure()
    const ro = new ResizeObserver(() => {
      const r = root.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      const cw = cardWidthFor(r, cardWidth, showChrome)
      const prev = sizeRef.current
      const next = { w: r.width, h: r.height, cw }
      sizeRef.current = next
      // Keep the active print centered when spacing / width changes.
      syncCenter(cw, activeRef.current)
      if (prev.w !== next.w || prev.h !== next.h || prev.cw !== next.cw) setSize(next)
      paintOnce()
    })
    ro.observe(root)
    return () => ro.disconnect()
  }, [cardWidth, showChrome, n, syncCenter, paintOnce])

  React.useEffect(() => {
    onChange?.(active)
  }, [active, onChange])

  // the simulation, written straight to the DOM each frame
  React.useEffect(() => {
    const root = rootRef.current
    if (!root || !ready) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let visible = true
    let raf = 0
    let prev = performance.now()
    const S = sim.current
    const frame = (now: number) => {
      raf = 0
      if (!visible) return
      const dt = Math.min(0.033, (now - prev) / 1000)
      prev = now
      const { w, h, cw } = sizeRef.current
      if (w <= 0) {
        raf = requestAnimationFrame(frame)
        return
      }
      const sp = cw * 1.08
      const period = n * sp
      const y0 = Math.max(40, h * 0.2)
      const d = drag.current
      let lineVel: number
      if (d && d.moved) {
        lineVel = d.v * 1000
      } else {
        const before = S.off
        ;[S.off, S.vel] = springStep(S.off, S.vel, S.target, dt)
        lineVel = -(S.off - before) / Math.max(dt, 1e-3)
        // Keep offsets bounded once the spring has settled on a loop copy.
        if (
          period > 0 &&
          Math.abs(S.vel) < 8 &&
          Math.abs(S.off - S.target) < 0.5
        ) {
          const norm = normalizeLoopOffset(S.off, sp, n)
          S.off = norm
          S.target = norm
        }
      }
      const o = opts.current
      const g = reduce ? 0 : o.swing
      const near = nearestAt(S.off, sp, n)
      for (let i = 0; i < n; i++) {
        const el = cards.current[i]
        if (!el) continue
        const rel = cardRelX(i, S.off, sp, n)
        const x = w / 2 + rel
        if (x < -cw * 1.5 || x > w + cw * 1.5) {
          el.style.visibility = "hidden"
          continue
        }
        el.style.visibility = "visible"
        let a = S.a[i] || 0
        let av = S.w[i] || 0
        ;[a, av] = swingStep(a, av, lineVel, dt, g)
        if (g) a += Math.sin(now / 1300 + i * 1.7) * 0.0009 * g
        S.a[i] = a
        S.w[i] = av
        const y = stringY(x, w, y0, o.sag) - 6
        el.style.transform = "translate(" + (x - cw / 2).toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + a.toFixed(4) + "rad)"
        const dist = Math.min(Math.abs(i - near), n - Math.abs(i - near))
        el.style.zIndex = String(i === near ? n + 1 : n - dist)
      }
      pathRef.current?.setAttribute("d", "M0 " + y0 + " Q" + w / 2 + " " + (y0 + 2 * o.sag) + " " + w + " " + y0)
      if (near !== activeRef.current) {
        activeRef.current = near
        setActive(near)
      }
      raf = requestAnimationFrame(frame)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) {
        prev = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(root)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [ready, n])

  // autoplay forever — advances one print each tick and wraps both ends
  React.useEffect(() => {
    if (!autoplay || n < 2) return
    const t = window.setInterval(() => {
      if (
        document.hidden ||
        drag.current ||
        lightboxRef.current != null ||
        performance.now() - lastTouch.current < autoplay
      ) {
        return
      }
      // Step from the spring target (not active) so a mid-wrap frame cannot skip.
      const sp = spacingRef.current || 1
      goTo(Math.round(sim.current.target / sp) + 1)
    }, autoplay)
    return () => window.clearInterval(t)
  }, [autoplay, n, goTo])

  const onDown = (e: React.PointerEvent) => {
    if (lightbox != null) return
    if ((e.target as HTMLElement).closest(".pl-bar")) return
    lastTouch.current = performance.now()
    drag.current = { x: e.clientX, off: sim.current.off, lx: e.clientX, lt: e.timeStamp, v: 0, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true
      setDragging(true)
      rootRef.current?.setPointerCapture(e.pointerId)
    }
    if (!d.moved) return
    const dt = Math.max(1, e.timeStamp - d.lt)
    d.v = 0.7 * ((e.clientX - d.lx) / dt) + 0.3 * d.v
    d.lx = e.clientX
    d.lt = e.timeStamp
    // Free drag — loop positioning handles both ends (no rubber band).
    sim.current.off = d.off - dx
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    lastTouch.current = performance.now()
    if (!d) return
    if (d.moved) {
      setDragging(false)
      sim.current.vel = -d.v * 1000
      // Aim at the nearest print in the fling direction (index may leave [0, n)).
      const sp = spacingRef.current
      const aimed = Math.round((sim.current.off - d.v * 180) / sp)
      goTo(aimed)
      return
    }
    // Click (not drag): center that print and open the lightbox.
    const card = (e.target as HTMLElement).closest("[data-i]")
    if (!card) return
    const i = Number(card.getAttribute("data-i"))
    if (!Number.isFinite(i)) return
    goTo(i)
    if (srcs[i]) setLightbox(i)
  }
  const step = (dir: number) => {
    lastTouch.current = performance.now()
    goTo(activeRef.current + dir)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (lightbox != null) return
    if (e.key === "ArrowRight") step(1)
    else if (e.key === "ArrowLeft") step(-1)
    else if (e.key === "Enter" || e.key === " ") {
      const i = activeRef.current
      if (srcs[i]) {
        e.preventDefault()
        setLightbox(i)
      }
      return
    } else return
    e.preventDefault()
  }

  const s = slides[active] || {}
  const lb = lightbox != null ? slides[lightbox] : null

  return (
    <div
      ref={rootRef}
      className={["pl-root", className].filter(Boolean).join(" ")}
      style={{
        ...(height != null ? { height } : null),
        ["--pl-bg" as string]: background,
        ["--pl-ink" as string]: ink,
        ["--pl-muted" as string]: "color-mix(in srgb, var(--pl-ink) 55%, transparent)",
        ["--pl-line" as string]: "color-mix(in srgb, var(--pl-ink) 18%, transparent)",
        ["--pl-cw" as string]: size.w > 0 ? size.cw + "px" : `min(${cardWidth}px, 42cqi)`,
        ...style,
      }}
      data-drag={dragging ? "1" : "0"}
      data-chrome={showChrome ? "1" : "0"}
      data-ready={ready ? "1" : "0"}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <style>{PL_CSS}</style>
      <svg className="pl-string" aria-hidden="true">
        <path ref={pathRef} fill="none" stroke={string} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {slides.map((sl, i) => {
        const lcp = i === startIndex
        // Only the center print is in the first HTML. Neighbors mount after
        // layout so the browser does not download every slide before LCP.
        const showImg = ready || lcp
        return (
        <div
          key={i}
          className="pl-card"
          data-i={i}
          data-lcp={lcp ? "1" : undefined}
          data-on={i === active ? "1" : "0"}
          ref={(el) => void (cards.current[i] = el)}
          aria-hidden={i === active ? undefined : true}
        >
          <div className="pl-print">
            <div className="pl-shot">
              {showImg && srcs[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={srcs[i]}
                  alt={sl.alt || sl.title || ""}
                  width={640}
                  height={640}
                  draggable={false}
                  decoding="async"
                  loading={lcp ? "eager" : "lazy"}
                  fetchPriority={lcp ? "high" : "low"}
                />
              ) : null}
            </div>
            <div className="pl-note">{showChrome ? sl.title || "" : ""}</div>
          </div>
          <div className="pl-peg" />
        </div>
        )
      })}
      {showChrome ? (
        <div className="pl-bar">
          <div className="pl-cap" key={active} aria-hidden="true">
            {s.title ? <span className="pl-title">{s.title}</span> : null}
            {s.caption ? <span className="pl-sub">{s.caption}</span> : null}
          </div>
          <span className="pl-count" aria-hidden="true">
            <b>{pad2(active + 1)}</b> / {pad2(n)}
          </span>
          <button type="button" className="pl-btn" aria-label="Previous" onClick={() => step(-1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
          <button type="button" className="pl-btn" aria-label="Next" onClick={() => step(1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </div>
      ) : null}
      <div className="pl-sr" aria-live="polite">
        {"Print " + (active + 1) + " of " + n + (s.title ? ": " + s.title : "")}
      </div>
      {lightbox != null && (slides[lightbox]?.fullImage || srcs[lightbox]) ? (
        <PolaroidLightbox
          src={slides[lightbox]?.fullImage || srcs[lightbox]}
          alt={lb?.alt || lb?.title || ""}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  )
}
