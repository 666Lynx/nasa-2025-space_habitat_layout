import React, { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

// HabitatDesigner.jsx
// Single-file React component scaffold for the Space Habitat Layout Tool MVP.
// - Uses Tailwind CSS classes for layout.
// - 2D plan editor (top-down cylinder) implemented with SVG.
// - Simple axial partition generator and draggable separators.
// - Synchronized minimal 3D preview using react-three-fiber.
//
// Notes:
// - This file is intended as a starting scaffold. It assumes you have the following
//   dependencies installed: react, react-dom, @react-three/fiber, @react-three/drei, and tailwindcss.
// - Exported as default React component.

// ---------- Utility functions ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function computeCylinderUsableVolume(radius, height, wallThickness = 0.05) {
  const r = Math.max(0, radius - wallThickness);
  return Math.PI * r * r * Math.max(0, height - wallThickness * 2);
}

function computeSectorArea(radius, startAngle, endAngle) {
  const angle = Math.abs(endAngle - startAngle) * (Math.PI / 180);
  return 0.5 * radius * radius * angle;
}

function format(n, units = "m") {
  return `${n.toFixed(2)} ${units}`;
}

// ---------- PlanEditor component (SVG) ----------
function PlanEditor({ radiusM, zones, setZones, onSelectZone, selectedZoneId }) {
  const size = 520; // SVG viewport square px
  const center = size / 2;
  const scale = (size / 2 - 20) / radiusM; // px per meter

  function toPx(x) {
    return center + x * scale;
  }

  function angleToPoint(angleDeg, rMeters) {
    const a = (angleDeg - 90) * (Math.PI / 180); // rotate so 0° at top
    return {
      x: center + Math.cos(a) * rMeters * scale,
      y: center + Math.sin(a) * rMeters * scale,
    };
  }

  // Dragging separators (sector boundaries)
  const dragging = useRef(null);

  function onMouseDownHandle(e, zoneIndex, handleType) {
    e.stopPropagation();
    dragging.current = { zoneIndex, handleType };
  }

  function onMouseMove(e) {
    if (!dragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - center;
    const y = e.clientY - rect.top - center;
    const angleDeg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    const normalized = (angleDeg + 360) % 360;

    setZones((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const z = copy[dragging.current.zoneIndex];
      if (dragging.current.handleType === "start") z.start = normalized;
      else z.end = normalized;
      // ensure start < end by rotating if needed
      if (z.end <= z.start) z.end = z.start + 1; // minimum 1 degree
      return copy;
    });
  }

  function onMouseUp() {
    dragging.current = null;
  }

  // Render zones as sectors
  return (
    <div className="bg-white rounded shadow p-2">
      <svg
        width={size}
        height={size}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        className="block mx-auto"
      >
        {/* Outer circle */}
        <circle cx={center} cy={center} r={(radiusM * scale) | 0} fill="#f8fafc" stroke="#0f172a" strokeWidth={1} />

        {/* Zones */}
        {zones.map((z, i) => {
          const r = radiusM * scale;
          const a1 = ((z.start - 90) * Math.PI) / 180;
          const a2 = ((z.end - 90) * Math.PI) / 180;
          const x1 = center + r * Math.cos(a1);
          const y1 = center + r * Math.sin(a1);
          const x2 = center + r * Math.cos(a2);
          const y2 = center + r * Math.sin(a2);
          const largeArc = Math.abs(z.end - z.start) > 180 ? 1 : 0;
          const path = `M ${center} ${center} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

          return (
            <g key={z.id} onClick={() => onSelectZone(z.id)}>
              <path d={path} fill={z.color} opacity={selectedZoneId === z.id ? 0.9 : 0.75} stroke="#0b1220" />
              {/* handles: start and end */}
              <circle
                cx={angleToPoint(z.start, radiusM).x}
                cy={angleToPoint(z.start, radiusM).y}
                r={6}
                fill="#111827"
                onMouseDown={(e) => onMouseDownHandle(e, i, "start")}
                style={{ cursor: "pointer" }}
              />
              <circle
                cx={angleToPoint(z.end, radiusM).x}
                cy={angleToPoint(z.end, radiusM).y}
                r={6}
                fill="#111827"
                onMouseDown={(e) => onMouseDownHandle(e, i, "end")}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {/* center marker */}
        <circle cx={center} cy={center} r={4} fill="#111827" />

        {/* overlay text for metrics */}
        <text x={12} y={20} fontSize={12} fill="#0f172a">
          Top-down plan (radius: {radiusM} m)
        </text>
      </svg>
    </div>
  );
}

// ---------- 3DPreview component (react-three-fiber) ----------
function Module3D({ radiusM, heightM, zones }) {
  // We will render a simple transparent cylinder and colored zone labels around it.
  // This is a minimal preview; for a production app you'd add proper lighting, materials and object models.
  const usableRadius = Math.max(0.1, radiusM - 0.05);
  const cylinderHeight = Math.max(0.1, heightM);

  return (
    <mesh rotation={[0, 0, 0]}>
      <cylinderGeometry args={[usableRadius, usableRadius, cylinderHeight, 48]} />
      <meshStandardMaterial opacity={0.22} transparent={true} metalness={0.1} roughness={0.9} />

      {/* simple labels as small boxes for each zone around circumference */}
      {zones.map((z, i) => {
        const mid = ((z.start + z.end) / 2 - 90) * (Math.PI / 180);
        const labelR = usableRadius + 0.1;
        const x = Math.cos(mid) * labelR;
        const zpos = Math.sin(mid) * labelR;
        const y = 0; // center height
        return (
          <mesh key={z.id} position={[x, y, zpos]} rotation={[0, -mid, 0]}>
            <boxGeometry args={[0.18, 0.08, 0.02]} />
            <meshStandardMaterial color={z.color} />
          </mesh>
        );
      })}
    </mesh>
  );
}

// ---------- Main HabitatDesigner component ----------
export default function HabitatDesigner() {
  // envelope parameters
  const [radiusM, setRadiusM] = useState(3.0);
  const [heightM, setHeightM] = useState(8.0);
  const [crewSize, setCrewSize] = useState(4);
  const [missionDays, setMissionDays] = useState(30);

  // zones are radial sectors (start/end degrees)
  const [zones, setZones] = useState([
    { id: "z-sleep", name: "Sleep", start: 0, end: 90, color: "#60a5fa" },
    { id: "z-work", name: "Work/Kitchen", start: 90, end: 210, color: "#34d399" },
    { id: "z-eclss", name: "ECLSS/Tech", start: 210, end: 270, color: "#f59e0b" },
    { id: "z-storage", name: "Stowage", start: 270, end: 360, color: "#f87171" },
  ]);

  const [selectedZoneId, setSelectedZoneId] = useState(null);

  useEffect(() => {
    if (!selectedZoneId && zones.length) setSelectedZoneId(zones[0].id);
  }, []);

  // Derived metrics
  const usableVolumeTotal = computeCylinderUsableVolume(radiusM, heightM);
  const usableFloorAreaTop = Math.PI * Math.pow(Math.max(0, radiusM - 0.05), 2);

  // compute per-zone area (top-down sector area) and approximate volume (assuming full height)
  const zonesWithMetrics = zones.map((z) => {
    const area = computeSectorArea(Math.max(0, radiusM - 0.05), z.start, z.end);
    const vol = area * Math.max(0.95, heightM - 0.05);
    return { ...z, area, volume: vol };
  });

  // Example rule: sleep area per crew min (sqm per person)
  const sleepMinAreaPerPerson = 3.0; // placeholder value
  const sleepZone = zonesWithMetrics.find((z) => z.name.toLowerCase().includes("sleep"));
  const sleepOK = sleepZone ? sleepZone.area >= crewSize * sleepMinAreaPerPerson : false;

  // Simple axial auto-partitioner: split along length into N compartments
  function autoAxialPartition(n) {
    if (n < 1) return;
    const length = heightM;
    // For top-down radial zones we'll keep angles but add "axialRank" metadata for visualization.
    setZones((prev) => prev.map((z, i) => ({ ...z, axialRank: i % n })));
  }

  function addZone() {
    const newId = `z-${Math.random().toString(36).slice(2, 8)}`;
    const lastEnd = zones[zones.length - 1].end;
    const start = lastEnd;
    const end = (lastEnd + 60) % 360;
    const color = `hsl(${Math.floor(Math.random() * 360)} 70% 60%)`;
    setZones((s) => [...s, { id: newId, name: "New Zone", start, end, color }]);
  }

  function removeSelectedZone() {
    if (!selectedZoneId) return;
    setZones((prev) => prev.filter((z) => z.id !== selectedZoneId));
    setSelectedZoneId(null);
  }

  function exportJSON() {
    const payload = {
      envelope: { type: "cylinder", radius_m: radiusM, height_m: heightM },
      crew: { size: crewSize, mission_days: missionDays },
      zones,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "habitat_design.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Space Habitat Layout — Scaffold</h1>
          <div className="text-sm text-slate-600">Quick prototype: 2D plan + 3D preview</div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Left controls */}
          <aside className="col-span-3 bg-white p-4 rounded shadow space-y-4">
            <div>
              <label className="text-xs text-slate-500">Envelope — Shape: Cylinder (editable)</label>
              <div className="mt-2 flex gap-2">
                <div>
                  <div className="text-xs text-slate-500">Radius (m)</div>
                  <input
                    type="number"
                    value={radiusM}
                    step={0.1}
                    min={0.5}
                    onChange={(e) => setRadiusM(clamp(parseFloat(e.target.value || 0), 0.5, 20))}
                    className="w-24 p-1 border rounded"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Length / Height (m)</div>
                  <input
                    type="number"
                    value={heightM}
                    step={0.1}
                    min={0.5}
                    onChange={(e) => setHeightM(clamp(parseFloat(e.target.value || 0), 0.5, 60))}
                    className="w-24 p-1 border rounded"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Mission parameters</label>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="text-xs">Crew size</div>
                  <input
                    type="number"
                    min={1}
                    value={crewSize}
                    onChange={(e) => setCrewSize(clamp(parseInt(e.target.value || 0), 1, 20))}
                    className="w-20 p-1 border rounded"
                  />
                </div>
                <div>
                  <div className="text-xs">Mission days</div>
                  <input
                    type="number"
                    min={1}
                    value={missionDays}
                    onChange={(e) => setMissionDays(clamp(parseInt(e.target.value || 0), 1, 3650))}
                    className="w-28 p-1 border rounded"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => autoAxialPartition(2)} className="px-3 py-1 bg-slate-800 text-white rounded">
                Auto partition (2)
              </button>
              <button onClick={() => autoAxialPartition(3)} className="px-3 py-1 bg-slate-700 text-white rounded">
                Auto partition (3)
              </button>
            </div>

            <div className="space-y-2">
              <button onClick={addZone} className="w-full px-3 py-1 bg-emerald-600 text-white rounded">
                Add zone
              </button>
              <button onClick={removeSelectedZone} className="w-full px-3 py-1 bg-red-600 text-white rounded">
                Remove selected zone
              </button>
            </div>

            <div className="pt-2 border-t">
              <div className="text-sm font-medium">Export</div>
              <div className="mt-2 flex gap-2">
                <button onClick={exportJSON} className="px-3 py-1 bg-indigo-600 text-white rounded">
                  Export JSON
                </button>
              </div>
            </div>
          </aside>

          {/* Center workspace */}
          <main className="col-span-6">
            <div className="bg-white p-3 rounded shadow">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <PlanEditor
                    radiusM={radiusM}
                    zones={zones}
                    setZones={setZones}
                    onSelectZone={(id) => setSelectedZoneId(id)}
                    selectedZoneId={selectedZoneId}
                  />
                </div>
                <div className="h-[520px] rounded overflow-hidden border">
                  <Canvas camera={{ position: [0, 6, 8], fov: 50 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 10, 5]} intensity={0.6} />
                    <Module3D radiusM={radiusM} heightM={heightM} zones={zones} />
                    <OrbitControls />
                  </Canvas>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white p-3 rounded shadow">
              <h3 className="font-medium">Quick metrics</h3>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-slate-700">
                <div>Total usable floor area (m²)</div>
                <div className="text-right">{format(usableFloorAreaTop, "m²")}</div>

                <div>Total usable volume (m³)</div>
                <div className="text-right">{format(usableVolumeTotal, "m³")}</div>

                <div>Zones</div>
                <div className="text-right">{zones.length}</div>

                <div>Sleep rule</div>
                <div className="text-right">{sleepOK ? "OK" : "Too small"}</div>
              </div>

              <div className="mt-3">
                <h4 className="text-sm font-medium">Zones</h4>
                <div className="mt-2 space-y-2">
                  {zonesWithMetrics.map((z) => (
                    <div
                      key={z.id}
                      className={`p-2 rounded border flex items-center justify-between ${selectedZoneId === z.id ? "ring-2 ring-indigo-300" : ""}`}
                      onClick={() => setSelectedZoneId(z.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded" style={{ background: z.color }} />
                        <div>
                          <div className="text-sm font-medium">{z.name}</div>
                          <div className="text-xs text-slate-500">Area: {z.area.toFixed(2)} m² • Vol: {z.volume.toFixed(2)} m³</div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">{(100 * (z.volume / usableVolumeTotal)).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>

          {/* Right inspector */}
          <aside className="col-span-3 bg-white p-4 rounded shadow">
            <div>
              <h3 className="font-medium">Zone inspector</h3>
              {selectedZoneId ? (
                (() => {
                  const z = zones.find((x) => x.id === selectedZoneId);
                  if (!z) return <div className="text-sm text-slate-500">Select a zone</div>;
                  return (
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="text-xs text-slate-500">Name</div>
                        <input
                          value={z.name}
                          onChange={(e) => setZones((prev) => prev.map((p) => (p.id === z.id ? { ...p, name: e.target.value } : p)))}
                          className="w-full p-1 border rounded"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-slate-500">Start°</div>
                          <input
                            type="number"
                            value={Math.round(z.start)}
                            onChange={(e) => setZones((prev) => prev.map((p) => (p.id === z.id ? { ...p, start: clamp(Number(e.target.value), 0, 359) } : p)))}
                            className="w-full p-1 border rounded"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">End°</div>
                          <input
                            type="number"
                            value={Math.round(z.end)}
                            onChange={(e) => setZones((prev) => prev.map((p) => (p.id === z.id ? { ...p, end: clamp(Number(e.target.value), 1, 360) } : p)))}
                            className="w-full p-1 border rounded"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">Color</div>
                        <input
                          type="color"
                          value={z.color}
                          onChange={(e) => setZones((prev) => prev.map((p) => (p.id === z.id ? { ...p, color: e.target.value } : p)))}
                          className="w-16 h-10 p-1"
                        />
                      </div>

                      <div className="pt-2">
                        <button onClick={() => alert("Rule checks run — implement more rules in the scaffold") } className="px-3 py-1 bg-amber-500 text-white rounded">
                          Run Rule Check
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-sm text-slate-500">No zone selected</div>
              )}
            </div>

            <div className="mt-6">
              <h4 className="font-medium">Hints / Next steps</h4>
              <ul className="mt-2 text-sm list-disc pl-5 text-slate-600 space-y-1">
                <li>Replace placeholder rule values with NASA-derived numbers.</li>
                <li>Add deck/axial split UI and circulation path editor.</li>
                <li>Add object library (crew proxies, racks, treadmill) and clearance checks.</li>
                <li>Wire up backend to save designs and enable sharing.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
