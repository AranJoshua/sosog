import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { MUNICIPALITY_BOUNDARIES } from './map/boundaries';
import { ICON_LABELS, ICON_PATHS, iconKeyFor } from './map/icons';
import {
  PROVINCE_BOX,
  boxToViewBox,
  declutter,
  easeInOut,
  lerpBox,
  padBox,
  pathBox,
  pointBoxes,
  project,
  reserveBox,
  unionBoxes,
  type Box
} from '../lib/map-geometry';

export interface MapStructure {
  id: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  classification: string | null;
  yearBuilt: string | null;
  materials: string | null;
  occupancy: string | null;
  /** URL of the 480 px thumbnail, or null when the structure has no photo. */
  photo: string | null;
  /** A short excerpt of the technical description. */
  summary: string | null;
}

interface MapProps {
  structures: MapStructure[];
}

const PIN_PX = 34;
const DOT_PX = 10;
const ANIMATION_MS = 520;
/** Width the desktop popup takes up (20rem card plus its gutters), kept clear of pins. */
const POPUP_RESERVE_PX = 344;
/** Share of the map height the phone popup can take up at the bottom. */
const POPUP_RESERVE_SHARE = 0.6;

const PROVINCE_NAMES = MUNICIPALITY_BOUNDARIES.map((b) => b.name);
const MUNICIPALITY_BOXES = new Map(MUNICIPALITY_BOUNDARIES.map((b) => [b.name, pathBox(b.d)]));

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ProvinceMap({ structures }: MapProps) {
  const [municipality, setMunicipality] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 800, height: 640 });
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupBodyRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<Record<string, SVGGElement | null>>({});
  const frameRef = useRef<number | null>(null);

  const points = useMemo(
    () => structures.map((s) => ({ id: s.id, ...project(s.latitude, s.longitude) })),
    [structures]
  );

  // The whole-province view, widened when a structure (an offshore island, for example) falls outside the drawn mainland.
  const provinceBox = useMemo(() => padBox(unionBoxes([PROVINCE_BOX, ...pointBoxes(points)]), 14), [points]);

  const boxFor = useCallback(
    (name: string | null): Box => {
      if (!name) return provinceBox;
      const base = MUNICIPALITY_BOXES.get(name) ?? provinceBox;
      const own = points.filter((p) => structures.find((s) => s.id === p.id)?.municipality === name);
      return padBox(unionBoxes([base, ...pointBoxes(own)]), 26, 150);
    },
    [points, provinceBox, structures]
  );

  // Matches the Tailwind `sm` breakpoint the popup's layout switches on.
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 640px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  // While the popup is open, frame the municipality in the part of the map the popup is not covering.
  const reserveLeft = activeId && wide ? POPUP_RESERVE_PX : 0;
  const reserveBottom = activeId && !wide ? size.height * POPUP_RESERVE_SHARE : 0;
  const targetBox = useMemo(() => {
    const base = boxFor(municipality);
    return municipality ? reserveBox(base, size.width, size.height, reserveLeft, reserveBottom) : base;
  }, [boxFor, municipality, size.width, size.height, reserveLeft, reserveBottom]);
  const [box, setBox] = useState<Box>(provinceBox);
  const boxRef = useRef<Box>(box);
  boxRef.current = box;

  // Animate the viewBox towards the target whenever the selected municipality changes.
  useEffect(() => {
    if (frameRef.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current);
    const from = boxRef.current;
    if (from.x === targetBox.x && from.y === targetBox.y && from.w === targetBox.w && from.h === targetBox.h) return;
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setBox(targetBox);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      setBox(lerpBox(from, targetBox, easeInOut(t)));
      frameRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current);
    };
  }, [targetBox]);

  // Track the rendered size so pins keep a constant on-screen size at every zoom level.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(size.width / box.w, size.height / box.h);
  const targetScale = Math.min(size.width / targetBox.w, size.height / targetBox.h);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of structures) map.set(s.municipality, (map.get(s.municipality) ?? 0) + 1);
    return map;
  }, [structures]);

  const inMunicipality = useMemo(
    () => (municipality ? structures.filter((s) => s.municipality === municipality) : []),
    [structures, municipality]
  );

  // Icon positions for the selected municipality, spread apart so identical or near-identical coordinates stay clickable.
  const placed = useMemo(() => {
    const own = points.filter((p) => inMunicipality.some((s) => s.id === p.id));
    return declutter(own, (PIN_PX * 1.55) / targetScale, (PIN_PX * 5) / targetScale, 240);
  }, [points, inMunicipality, targetScale]);

  const active = structures.find((s) => s.id === activeId) ?? null;

  const closePopup = useCallback(() => {
    setActiveId((previous) => {
      if (previous) {
        const el = pinRefs.current[previous];
        if (el) window.setTimeout(() => el.focus(), 0);
      }
      return null;
    });
  }, []);

  const showWholeProvince = useCallback(() => {
    setActiveId(null);
    setMunicipality(null);
  }, []);

  const selectMunicipality = useCallback(
    (name: string) => {
      setActiveId(null);
      setMunicipality((current) => (current === name ? null : name));
    },
    []
  );

  const selectStructure = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (activeId) closePopup();
      else if (municipality) showWholeProvince();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeId, municipality, closePopup, showWholeProvince]);

  // A link such as /map?s=<structure id> opens the map zoomed to that structure with its details showing.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('s');
    const found = wanted ? structures.find((s) => s.id === wanted) : null;
    if (found) {
      setMunicipality(found.municipality);
      setActiveId(found.id);
    }
    // Runs once on load; later selections come from clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeId) popupRef.current?.focus({ preventScroll: true });
  }, [activeId]);

  // When the card is taller than the map, fade its lower edge while there is more to scroll to, so a line is never left cut off without a cue.
  useEffect(() => {
    const body = popupBodyRef.current;
    if (!body) return;
    const update = () => body.toggleAttribute('data-more', body.scrollHeight - body.scrollTop - body.clientHeight > 4);
    update();
    body.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(body);
    return () => {
      body.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [activeId]);

  const onActivate = (handler: () => void) => (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  };

  const onPlatePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const tip = tipRef.current;
    if (!tip || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = Math.min(event.clientX - rect.left + 16, rect.width - tip.offsetWidth - 12);
    const y = Math.max(event.clientY - rect.top - tip.offsetHeight - 14, 12);
    tip.style.transform = `translate(${Math.max(12, x)}px, ${y}px)`;
  };

  const unit = 1 / scale; // SVG units per screen pixel
  // Where each municipality's name sits on the whole-province view: at the middle of its area unless a dot or another name is there, in which case it moves to the nearest free spot.
  const labelSpots = useMemo(() => {
    const out = new Map<string, { x: number; y: number }>();
    if (municipality) return out;
    const fs = 12 * unit;
    const dotR = (DOT_PX / 2 + 4) * unit;
    const dots = points.map((p) => ({ x: p.x, y: p.y - 5 * unit }));
    const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const shifts: [number, number][] = [[0, 0], [0, -1.5], [0, 1.5], [-0.3, 0], [0.3, 0], [0, -3], [0, 3], [-0.3, -1.5], [0.3, -1.5], [-0.3, 1.5], [0.3, 1.5], [-0.5, 0], [0.5, 0]];
    const order = [...MUNICIPALITY_BOUNDARIES].sort((a, b) => (MUNICIPALITY_BOXES.get(b.name)?.w ?? 0) - (MUNICIPALITY_BOXES.get(a.name)?.w ?? 0));
    for (const b of order) {
      const box2 = MUNICIPALITY_BOXES.get(b.name);
      if (!box2 || !(box2.w * scale >= 58 || hoverName === b.name)) continue;
      const documented = (counts.get(b.name) ?? 0) > 0;
      const w = b.name.length * fs * 0.66 + 8 * unit;
      const baseX = box2.x + box2.w / 2;
      const baseY = box2.y + box2.h / 2 + 4 * unit - (documented ? 5 * unit : 0);
      let best: { x: number; y: number; r: { x0: number; x1: number; y0: number; y1: number }; score: number } | null = null;
      for (const [sx, sy] of shifts) {
        const x = baseX + sx * w;
        const y = baseY + sy * fs;
        const r = { x0: x - w / 2, x1: x + w / 2, y0: y - fs * 0.95, y1: y + fs * 0.35 };
        let score = Math.abs(sx) * 1.2 + Math.abs(sy) * 0.4;
        for (const d of dots) {
          const nx = Math.max(r.x0, Math.min(d.x, r.x1));
          const ny = Math.max(r.y0, Math.min(d.y, r.y1));
          if (Math.hypot(d.x - nx, d.y - ny) < dotR) score += 20;
        }
        for (const t of taken) if (r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0) score += 20;
        if (r.x0 < box2.x - w * 0.12 || r.x1 > box2.x + box2.w + w * 0.12 || r.y0 < box2.y || r.y1 > box2.y + box2.h) score += 6;
        if (!best || score < best.score) best = { x, y, r, score };
      }
      // A name that cannot be placed clear of every dot is left off, unless it is the one being pointed at.
      if (best && (best.score < 20 || hoverName === b.name)) {
        out.set(b.name, { x: best.x, y: best.y });
        taken.push(best.r);
      }
    }
    return out;
  }, [municipality, unit, scale, points, counts, hoverName]);
  const selectedBoundary = MUNICIPALITY_BOUNDARIES.find((b) => b.name === municipality) ?? null;
  const otherBoundaries = MUNICIPALITY_BOUNDARIES.filter((b) => b.name !== municipality);
  const maxCount = Math.max(1, ...Array.from(counts.values()));

  /*
   * Each municipality is a block of the site model: documented ones stand proud of the ground, the selected one is raised higher still, and the rest lie flat. The sides are drawn as stacked copies of the outline.
   */
  const renderBoundary = (name: string, d: string, selected: boolean) => {
    const count = counts.get(name) ?? 0;
    const hovered = hoverName === name && !selected;
    const dimmed = municipality !== null && !selected;
    const lift = selected ? 11 : hovered ? 4 : 0;
    const height = dimmed ? 0 : (count > 0 ? 4 : 0) + lift;
    const steps = Math.min(12, Math.max(0, Math.ceil(height / 1.4)));
    const side = selected ? '#5A1F1F' : '#B7A787';
    const top = selected ? '#8A2D2D' : dimmed || count === 0 ? '#3B5378' : '#F1EACE';
    const opacity = 1;
    return (
      <g key={name}>
        {steps > 0 && (
          <g aria-hidden="true" pointerEvents="none" opacity={opacity}>
            {Array.from({ length: steps }, (_, k) => (
              <path
                key={k}
                d={d}
                fill={side}
                stroke={side}
                strokeWidth={1 * unit}
                strokeLinejoin="round"
                transform={`translate(0 ${-(height * (k / steps)) * unit})`}
              />
            ))}
          </g>
        )}
        <path
          d={d}
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label={`${name}, ${count} documented ${count === 1 ? 'structure' : 'structures'}`}
          onClick={() => selectMunicipality(name)}
          onKeyDown={onActivate(() => selectMunicipality(name))}
          onPointerEnter={() => setHoverName(name)}
          onPointerLeave={() => setHoverName((current) => (current === name ? null : current))}
          onFocus={() => setHoverName(name)}
          onBlur={() => setHoverName((current) => (current === name ? null : current))}
          fill={top}
          fillOpacity={opacity}
          stroke={selected ? '#F1EACE' : '#461717'}
          strokeOpacity={selected ? 1 : dimmed || count === 0 ? 0.35 : 0.6}
          strokeWidth={(selected ? 2.4 : 1.3) * unit}
          strokeLinejoin="round"
          className="muni-path"
          style={{
            transform: height ? `translate(0px, ${-height * unit}px)` : undefined,
            filter: selected ? `drop-shadow(0 ${14 * unit}px ${10 * unit}px rgba(0,0,0,0.5))` : undefined
          }}
        />
      </g>
    );
  };

  const tipCount = hoverName ? counts.get(hoverName) ?? 0 : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      {/* The map sits in a cream mat, like a chart in a frame. */}
      <div className="bg-cream p-3 shadow-[0_40px_60px_-36px_rgb(0_0_0/0.9)] sm:p-4">
        <div
          ref={wrapRef}
          onPointerMove={onPlatePointerMove}
          className="map-plate relative h-[72vh] min-h-[26rem] overflow-hidden bg-navy-deep lg:h-[calc(100svh-var(--header-h)-6rem)] lg:max-h-[52rem] lg:min-h-[34rem]"
        >
          <svg
            viewBox={boxToViewBox(box)}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
            role="group"
            aria-label="Map of Sorsogon province. Select a municipality to zoom in and see its historical structures."
          >
            {/* Water-lines: soft bands around the coast, as on a chart. */}
            <g aria-hidden="true" fill="none" stroke="#F1EACE" strokeLinejoin="round" pointerEvents="none" opacity={municipality ? 0.5 : 1}>
              {MUNICIPALITY_BOUNDARIES.map((b) => (
                <path key={`w1-${b.name}`} d={b.d} strokeOpacity={0.05} strokeWidth={26 * unit} />
              ))}
              {MUNICIPALITY_BOUNDARIES.map((b) => (
                <path key={`w2-${b.name}`} d={b.d} strokeOpacity={0.08} strokeWidth={12 * unit} />
              ))}
            </g>

            {otherBoundaries.map((b) => renderBoundary(b.name, b.d, false))}
            {selectedBoundary && renderBoundary(selectedBoundary.name, selectedBoundary.d, true)}

            {/* Municipality names on the whole-province view; small ones appear when pointed at. */}
            {!municipality &&
              MUNICIPALITY_BOUNDARIES.map((b) => {
                const spot = labelSpots.get(b.name);
                if (!spot) return null;
                const documented = (counts.get(b.name) ?? 0) > 0;
                return (
                  <text
                    key={`l-${b.name}`}
                    x={spot.x}
                    y={spot.y}
                    textAnchor="middle"
                    fontSize={12 * unit}
                    fontWeight={700}
                    letterSpacing={0.4 * unit}
                    fill={documented ? '#461717' : '#F1EACE'}
                    stroke={documented ? '#F1EACE' : '#243249'}
                    strokeWidth={3.4 * unit}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    pointerEvents="none"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {b.name}
                  </text>
                );
              })}

            {/* Whole-province view: one small dot per structure at its true position. Dots only mark where structures are; selecting a municipality shows the full icons. */}
            {!municipality &&
              structures.map((s) => {
                const p = points.find((q) => q.id === s.id)!;
                return (
                  <circle
                    key={s.id}
                    cx={p.x}
                    cy={p.y - 5 * unit}
                    r={(DOT_PX / 2) * unit}
                    fill="#461717"
                    stroke="#F1EACE"
                    strokeWidth={2 * unit}
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                );
              })}

            {/* Municipality view: full icons, spread apart where coordinates coincide, with a leader line back to the true position. */}
            {municipality &&
              inMunicipality.map((s, index) => {
                const home = points.find((q) => q.id === s.id)!;
                const at = placed.get(s.id) ?? home;
                const displaced = Math.hypot(at.x - home.x, at.y - home.y) > 3 * unit;
                const isActive = s.id === activeId;
                const isHover = s.id === hoverId;
                const radius = ((isActive ? PIN_PX + 6 : isHover ? PIN_PX + 2 : PIN_PX) / 2) * unit;
                const glyph = (radius * 1.1) / 12;
                const key = iconKeyFor(s.classification);
                const ink = isActive ? '#F1EACE' : '#461717';
                const lifted = at.y - 14 * unit;
                return (
                  <g key={s.id}>
                    {displaced && (
                      <>
                        <line x1={home.x} y1={home.y - 11 * unit} x2={at.x} y2={lifted} stroke="#F1EACE" strokeOpacity={0.9} strokeWidth={2 * unit} strokeDasharray={`${4 * unit} ${4 * unit}`} pointerEvents="none" />
                        <circle cx={home.x} cy={home.y - 11 * unit} r={3 * unit} fill="#F1EACE" pointerEvents="none" />
                      </>
                    )}
                    <g
                      ref={(el) => {
                        pinRefs.current[s.id] = el;
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${s.name}, ${ICON_LABELS[key]}. Open details.`}
                      aria-pressed={isActive}
                      onClick={() => selectStructure(s.id)}
                      onKeyDown={onActivate(() => selectStructure(s.id))}
                      onPointerEnter={() => setHoverId(s.id)}
                      onPointerLeave={() => setHoverId((current) => (current === s.id ? null : current))}
                      className="pin"
                      style={{ ['--d' as string]: `${0.32 + index * 0.07}s` }}
                    >
                      <ellipse cx={at.x} cy={lifted + radius * 1.12} rx={radius * 0.85} ry={radius * 0.28} fill="#000" fillOpacity={0.35} />
                      <circle cx={at.x} cy={lifted} r={radius} fill={isActive ? '#211112' : '#F1EACE'} stroke={isActive ? '#F1EACE' : '#461717'} strokeWidth={2.4 * unit} />
                      <path d={ICON_PATHS[key]} fill={ink} transform={`translate(${at.x - 12 * glyph} ${lifted - 12 * glyph}) scale(${glyph})`} pointerEvents="none" />
                      {isActive && (
                        <g aria-hidden="true" pointerEvents="none">
                          <circle className="pulse" cx={at.x} cy={lifted} r={radius} fill="none" stroke="#F1EACE" strokeWidth={3 * unit} />
                        </g>
                      )}
                    </g>
                  </g>
                );
              })}
          </svg>

          {/* Compass */}
          <svg viewBox="0 0 64 64" className="pointer-events-none absolute bottom-4 right-4 z-[6] h-14 w-14 text-cream" aria-hidden="true" fill="currentColor">
            <circle cx="32" cy="35" r="21" fill="none" stroke="currentColor" strokeWidth="4" strokeOpacity="0.55" />
            <rect x="29.5" y="8" width="5" height="12" />
            <text x="32" y="43" textAnchor="middle" fontSize="22" fontWeight="700" style={{ fontFamily: 'var(--font-body)' }}>N</text>
          </svg>

          {/* Name chip that follows the pointer over a municipality. */}
          <div ref={tipRef} className="map-tip" style={{ opacity: hoverName && !activeId ? 1 : 0, transform: 'translate(-999px, -999px)' }} aria-hidden="true">
            {hoverName && (
              <div className="bg-cream px-4 py-2.5 text-maroon shadow-xl">
                <p className="font-display text-[1.25rem] leading-none">{hoverName}</p>
                <p className="mt-1.5 text-[0.95rem] font-semibold text-maroon/75">{tipCount === 0 ? 'No structures documented' : `${tipCount} ${tipCount === 1 ? 'structure' : 'structures'}`}</p>
              </div>
            )}
          </div>

          {active && (
            <div
              ref={popupRef}
              tabIndex={-1}
              role="dialog"
              aria-label={`${active.name} details`}
              className="popup-in marker-plate absolute inset-x-3 bottom-3 z-10 flex max-h-[64%] flex-col overflow-hidden text-cream shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] outline-none sm:inset-y-3 sm:my-auto sm:h-fit sm:max-h-[calc(100%_-_1.5rem)] sm:right-auto sm:w-[20.5rem]"
            >
              <span className="rivet left-2 top-2" aria-hidden="true" />
              <span className="rivet right-2 top-2" aria-hidden="true" />
              <div ref={popupBodyRef} className="popup-body min-h-0 flex-1 overflow-y-auto p-5 pb-3">
                {active.photo && (
                  <div className="marker-photo mb-5 w-full">
                    <img src={active.photo} alt={active.name} width={480} height={360} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-[1.6rem] leading-[1.05]">{active.name}</h3>
                  <button
                    type="button"
                    onClick={closePopup}
                    aria-label="Close details"
                    className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center text-cream transition-colors hover:bg-cream hover:text-maroon"
                  >
                    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
                      <path d="M5 5l14 14M19 5 5 19" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 inline-block bg-cream px-2.5 py-0.5 text-[0.92rem] font-bold text-maroon">{active.municipality}</p>
                <dl className="mt-4 text-[0.98rem]">
                  {active.yearBuilt && (
                    <div className="grid grid-cols-[5.5rem_1fr] gap-3 px-2.5 py-2.5 odd:bg-ink/35">
                      <dt className="text-cream/70">Built</dt>
                      <dd className="font-bold">{active.yearBuilt}</dd>
                    </div>
                  )}
                  {active.occupancy && (
                    <div className="grid grid-cols-[5.5rem_1fr] gap-3 px-2.5 py-2.5 odd:bg-ink/35">
                      <dt className="text-cream/70">Occupancy</dt>
                      <dd className="font-bold">{active.occupancy}</dd>
                    </div>
                  )}
                  {active.materials && (
                    <div className="grid grid-cols-[5.5rem_1fr] gap-3 px-2.5 py-2.5 odd:bg-ink/35">
                      <dt className="text-cream/70">Materials</dt>
                      <dd className="font-bold">{active.materials}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-[5.5rem_1fr] gap-3 px-2.5 py-2.5 odd:bg-ink/35">
                    <dt className="text-cream/70">Coordinates</dt>
                    <dd className="font-bold">
                      {active.latitude.toFixed(5)}, {active.longitude.toFixed(5)}
                    </dd>
                  </div>
                </dl>
                {active.summary && <p className="mt-4 line-clamp-3 text-[0.98rem] leading-relaxed text-cream/90 sm:line-clamp-4">{active.summary}</p>}
              </div>
              <div className="shrink-0 px-5 pb-5 pt-1">
                <a href={`/structures/${active.id}`} className="btn btn-sm w-full">
                  See more
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside aria-live="polite" className="wall-ink p-7 lg:max-h-[calc(100svh-var(--header-h)-3.5rem)] lg:min-h-[34rem] lg:overflow-y-auto">
        {!municipality && (
          <div key="province" className="panel-in">
            <h2 className="font-display text-[2rem] leading-none">Sorsogon Province</h2>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-cream/80">
              {structures.length} documented {structures.length === 1 ? 'structure' : 'structures'}. Select a municipality on the map, or from this list, to see what is inside it.
            </p>
            <ul className="mt-7">
              {PROVINCE_NAMES.map((name) => {
                const count = counts.get(name) ?? 0;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => selectMunicipality(name)}
                      onPointerEnter={() => setHoverName(name)}
                      onPointerLeave={() => setHoverName((current) => (current === name ? null : current))}
                      className="idx-row"
                    >
                      <span className="w-[7.4rem] shrink-0 text-left">{name}</span>
                      <span className="idx-track" aria-hidden="true">
                        <span className="idx-bar" style={{ width: `${(count / maxCount) * 100}%` }} />
                      </span>
                      <span className={count === 0 ? 'w-14 text-right text-[0.92rem] text-cream/55' : 'w-14 text-right font-bold'}>{count === 0 ? 'None' : count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {municipality && (
          <div key="municipality" className="panel-in">
            <button type="button" onClick={showWholeProvince} className="btn btn-navy btn-sm mb-8">
              Whole province
            </button>
            <h2 className="font-display text-[2rem] leading-none">{municipality}</h2>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-cream/80">
              {inMunicipality.length === 0
                ? 'No structures are documented in this municipality.'
                : `${inMunicipality.length} documented ${inMunicipality.length === 1 ? 'structure' : 'structures'}. Select one to open its details.`}
            </p>
            <ul className="mt-7 space-y-3">
              {inMunicipality.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selectStructure(s.id)}
                    onPointerEnter={() => setHoverId(s.id)}
                    onPointerLeave={() => setHoverId((current) => (current === s.id ? null : current))}
                    aria-pressed={s.id === activeId}
                    className={`group flex w-full gap-4 p-2.5 text-left transition-colors duration-300 ${s.id === activeId ? 'bg-cream text-maroon' : 'bg-cream/10 hover:bg-cream/20'}`}
                  >
                    {s.photo ? (
                      <img src={s.photo} alt="" width={72} height={72} loading="lazy" className="h-[76px] w-[76px] shrink-0 object-cover" />
                    ) : (
                      <span className="grid h-[76px] w-[76px] shrink-0 place-items-center bg-navy px-1 text-center text-[0.78rem] leading-tight text-cream/80">No photo available</span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-display text-[1.15rem] leading-[1.12]">{s.name}</span>
                      <span className={`mt-1 block text-[0.92rem] ${s.id === activeId ? 'text-maroon/75' : 'text-cream/70'}`}>{[s.yearBuilt, s.materials, s.occupancy].filter(Boolean).join(', ') || 'No details recorded'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="mt-9 text-[0.98rem]">
          <summary className="key-summary cursor-pointer font-semibold text-cream/85 hover:text-cream">
            <span className="key-mark" aria-hidden="true" />
            Map key
          </summary>
          <ul className="mt-4 grid gap-3 text-cream/85">
            <li className="grid grid-cols-[1.75rem_1fr] items-center gap-x-3"><span className="h-4 w-7 bg-cream" aria-hidden="true" />Raised: structures documented</li>
            <li className="grid grid-cols-[1.75rem_1fr] items-center gap-x-3"><span className="h-4 w-7" style={{ background: '#3B5378' }} aria-hidden="true" />Flat: no structures documented</li>
            <li className="grid grid-cols-[1.75rem_1fr] items-center gap-x-3"><span className="h-4 w-7 bg-maroon-light" aria-hidden="true" />The municipality you selected</li>
          </ul>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-cream/85">
            {(Object.keys(ICON_LABELS) as (keyof typeof ICON_LABELS)[]).map((key) => (
              <li key={key} className="grid grid-cols-[1.75rem_1fr] items-center gap-x-3 leading-tight">
                <svg viewBox="0 0 24 24" className="h-5 w-5 justify-self-center" aria-hidden="true">
                  <path d={ICON_PATHS[key]} fill="#F1EACE" />
                </svg>
                {ICON_LABELS[key]}
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </div>
  );
}
