import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { BreakInfo, Stop } from "@/entities/route";
import { ArtworkImage } from "@/entities/route";
import {
  FLOOR_VIEWBOX,
  HALL_SPATIAL_REGISTRY,
  MUSEUM_LANDMARKS,
  getHallSpatialData,
} from "../model/hall-map-data";

interface InteractiveMapProps {
  stops: Stop[];
  currentStopIndex: number;
  onSelectStop?: (index: number) => void;
  breakInfo?: BreakInfo | null;
  hasBreak?: boolean;
  breakAfterStop?: number | null;
  compact?: boolean;
}

interface SelectedHallDetails {
  hallName: string;
  hallNumber: string;
  stop?: Stop;
  stopIndex?: number;
  note?: string;
  floor: 1 | 2;
}

export function InteractiveMap({
  stops,
  currentStopIndex,
  onSelectStop,
  breakInfo,
  hasBreak = false,
  breakAfterStop,
  compact = false,
}: InteractiveMapProps) {
  const currentStop = stops[currentStopIndex];

  // Resolve true floor for the current stop based on spatial registry
  const currentStopSpatial = useMemo(() => {
    if (!currentStop) return null;
    return getHallSpatialData(currentStop.hall_id, currentStop.hall_number);
  }, [currentStop]);

  const currentStopFloor: 1 | 2 = currentStopSpatial?.floor ?? (currentStop?.floor_number === "2" ? 2 : 1);

  // Floor selection: tracks current stop by default, user can switch tabs manually
  const [selectedFloor, setSelectedFloor] = useState<1 | 2 | null>(null);
  const [prevStopIndex, setPrevStopIndex] = useState<number>(currentStopIndex);

  if (currentStopIndex !== prevStopIndex) {
    setPrevStopIndex(currentStopIndex);
    setSelectedFloor(null); // Return to current stop's floor on stop navigation
  }

  const activeFloor: 1 | 2 = selectedFloor ?? currentStopFloor;

  // Vector maps cache
  const [svgCache, setSvgCache] = useState<Record<1 | 2, string>>({ 1: "", 2: "" });
  const isLoadingSvg = !svgCache[activeFloor];

  // Selected hall / stop overlay details
  const [selectedInfo, setSelectedInfo] = useState<SelectedHallDetails | null>(null);

  // Zoom and pan state
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Fetch official vector SVG map assets
  useEffect(() => {
    if (svgCache[activeFloor]) return;
    const url = activeFloor === 1 ? "/maps/main_1floor.svg" : "/maps/main_2floor.svg";

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((rawSvg) => {
        setSvgCache((prev) => ({ ...prev, [activeFloor]: rawSvg }));
      })
      .catch((err) => {
        console.error("Failed to load official vector floor plan:", err);
      });
  }, [activeFloor, svgCache]);

  // Stops counts per floor for quick-switch tabs
  const stopsCountByFloor = useMemo(() => {
    const counts = { 1: 0, 2: 0 };
    for (const stop of stops) {
      const sp = getHallSpatialData(stop.hall_id, stop.hall_number);
      const fl = sp?.floor ?? (stop.floor_number === "2" ? 2 : 1);
      counts[fl]++;
    }
    return counts;
  }, [stops]);

  // Filter stops that reside on the active floor
  const floorStops = useMemo(() => {
    return stops
      .map((stop, idx) => ({ stop, originalIndex: idx }))
      .filter(({ stop }) => {
        const sp = getHallSpatialData(stop.hall_id, stop.hall_number);
        const fl = sp?.floor ?? (stop.floor_number === "2" ? 2 : 1);
        return fl === activeFloor;
      });
  }, [stops, activeFloor]);

  // Map of hallId -> stop index for SVG polygon interactions
  const hallToStopMap = useMemo(() => {
    const map = new Map<string, { stop: Stop; originalIndex: number }>();
    stops.forEach((stop, idx) => {
      const sp = getHallSpatialData(stop.hall_id, stop.hall_number);
      if (sp) {
        map.set(sp.hallId, { stop, originalIndex: idx });
      }
    });
    return map;
  }, [stops]);

  // Group floor stops by hall to offset multiple pins in the same hall
  const hallPinPositions = useMemo(() => {
    // Map hallId -> array of { stop, originalIndex, pinX, pinY }
    const grouped = new Map<string, Array<{ stop: Stop; originalIndex: number }>>();

    floorStops.forEach((item) => {
      const sp = getHallSpatialData(item.stop.hall_id, item.stop.hall_number);
      const hallId = sp?.hallId || "unknown";
      if (!grouped.has(hallId)) grouped.set(hallId, []);
      grouped.get(hallId)!.push(item);
    });

    const positions: Array<{
      stop: Stop;
      originalIndex: number;
      pinX: number;
      pinY: number;
      spatial: (typeof HALL_SPATIAL_REGISTRY)[string];
    }> = [];

    grouped.forEach((items, hallId) => {
      const sp = HALL_SPATIAL_REGISTRY[hallId];
      if (!sp) return;
      const count = items.length;

      items.forEach((item, posInHall) => {
        // If multiple stops in the same hall, offset horizontally
        const offsetX = count > 1 ? (posInHall - (count - 1) / 2) * 90 : 0;
        positions.push({
          stop: item.stop,
          originalIndex: item.originalIndex,
          pinX: sp.cx + offsetX,
          pinY: sp.cy,
          spatial: sp,
        });
      });
    });

    return positions;
  }, [floorStops]);

  // All halls on this floor for displaying clean background room numbers
  const floorHallsList = useMemo(() => {
    return Object.values(HALL_SPATIAL_REGISTRY).filter((h) => h.floor === activeFloor);
  }, [activeFloor]);

  // Landmarks for this floor
  const floorLandmarks = useMemo(() => {
    return MUSEUM_LANDMARKS.filter((l) => l.floor === activeFloor);
  }, [activeFloor]);

  // Check if tour transitions between floors after one of the floor stops
  const nextFloorTransition = useMemo(() => {
    const nextIdx = currentStopIndex + 1;
    if (nextIdx < stops.length) {
      const nextStop = stops[nextIdx];
      const nextSp = getHallSpatialData(nextStop.hall_id, nextStop.hall_number);
      const nextFl = nextSp?.floor ?? (nextStop.floor_number === "2" ? 2 : 1);
      if (nextFl !== activeFloor) {
        return {
          targetFloor: nextFl,
          targetStopNumber: nextIdx + 1,
          targetHallNumber: nextSp?.number || nextStop.hall_number || "",
        };
      }
    }
    return null;
  }, [stops, currentStopIndex, activeFloor]);

  // Connect stops on this floor in sequence with a clean architectural trajectory line
  const routePolylinePoints = useMemo(() => {
    if (hallPinPositions.length < 2) return "";
    const sorted = [...hallPinPositions].sort((a, b) => a.originalIndex - b.originalIndex);
    return sorted.map((p) => `${p.pinX},${p.pinY}`).join(" ");
  }, [hallPinPositions]);

  // Highlight and attach interactions to the official SVG polygons
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const container = svgContainerRef.current;
    const hallElements = container.querySelectorAll<SVGGraphicsElement>(".map-hall, [data-hall]");

    hallElements.forEach((el) => {
      const hallId = el.getAttribute("data-hall");
      if (!hallId) return;

      const stopInfo = hallToStopMap.get(hallId);
      const isBreakHall = activeFloor === 1 && hallId === "198" && hasBreak;
      const sp = HALL_SPATIAL_REGISTRY[hallId];

      el.style.transition = "all 0.2s ease-in-out";
      el.style.cursor = "pointer";
      el.style.pointerEvents = "auto";

      if (stopInfo !== undefined) {
        if (stopInfo.originalIndex === currentStopIndex) {
          // Current stop hall
          el.style.fill = "#899770";
          el.style.fillOpacity = "0.38";
          el.style.stroke = "#899770";
          el.style.strokeWidth = "8px";
        } else if (stopInfo.originalIndex < currentStopIndex) {
          // Visited hall
          el.style.fill = "#2E7D32";
          el.style.fillOpacity = "0.22";
          el.style.stroke = "#2E7D32";
          el.style.strokeWidth = "6px";
        } else {
          // Upcoming hall
          el.style.fill = "#899770";
          el.style.fillOpacity = "0.14";
          el.style.stroke = "#899770";
          el.style.strokeWidth = "5px";
          el.style.strokeDasharray = "10 5";
        }

        el.onclick = (e) => {
          e.stopPropagation();
          onSelectStop?.(stopInfo.originalIndex);
          if (sp) {
            setSelectedInfo({
              hallName: sp.name,
              hallNumber: sp.number,
              stop: stopInfo.stop,
              stopIndex: stopInfo.originalIndex,
              floor: sp.floor,
            });
          }
        };
      } else if (isBreakHall) {
        // Break hall (Italian courtyard, hall 15)
        el.style.fill = "#C69214";
        el.style.fillOpacity = "0.22";
        el.style.stroke = "#C69214";
        el.style.strokeWidth = "6px";
        el.style.strokeDasharray = "10 5";

        el.onclick = (e) => {
          e.stopPropagation();
          setSelectedInfo({
            hallName: "Итальянский дворик (Зал 15)",
            hallNumber: "15",
            floor: 1,
            note:
              breakInfo?.note ||
              `Кафе в цокольном этаже Главного здания временно закрыто на техобслуживание. Для отдыха ${breakAfterStop ? `после ${breakAfterStop}-й остановки` : "в середине визита"} рекомендуем диваны в Итальянском дворике.`,
          });
        };
      } else {
        // Museum hall not in the current route
        el.style.fill = "#FFFFFF";
        el.style.fillOpacity = "0.85";
        el.style.stroke = "#D5CDC2";
        el.style.strokeWidth = "2.5px";
        el.style.strokeDasharray = "none";

        el.onclick = (e) => {
          e.stopPropagation();
          if (sp) {
            setSelectedInfo({
              hallName: sp.name,
              hallNumber: sp.number,
              floor: sp.floor,
              note: "Постоянная экспозиция Главного здания. Экспонаты зала открыты для свободного осмотра.",
            });
          }
        };
      }
    });
  }, [
    activeFloor,
    svgCache,
    hallToStopMap,
    currentStopIndex,
    hasBreak,
    breakInfo,
    breakAfterStop,
    onSelectStop,
  ]);

  // Center view on current stop coordinate
  const handleCenterOnCurrentStop = useCallback(() => {
    if (!currentStopSpatial || currentStopSpatial.floor !== activeFloor) {
      if (currentStopSpatial) {
        setSelectedFloor(currentStopSpatial.floor);
      }
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const [vbW, vbH] = activeFloor === 1 ? [3203.9, 2322.7] : [3203.8, 2579];

    const targetScale = 1.6;
    // Normalized position (0 to 1)
    const normX = currentStopSpatial.cx / vbW;
    const normY = currentStopSpatial.cy / vbH;

    // Pan to center point
    const dx = (0.5 - normX) * rect.width * targetScale;
    const dy = (0.5 - normY) * rect.height * targetScale;

    setScale(targetScale);
    setPan({ x: dx, y: dy });
  }, [currentStopSpatial, activeFloor]);

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(s + 0.35, 2.8));
  const handleZoomOut = () => {
    setScale((s) => {
      const next = Math.max(s - 0.35, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    setScale((s) => {
      const next = Math.max(1, Math.min(2.8, s * zoomFactor));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setPan({
        x: e.touches[0].clientX - touchStartRef.current.x,
        y: e.touches[0].clientY - touchStartRef.current.y,
      });
    } else if (e.touches.length === 2 && touchDistRef.current !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = newDist / touchDistRef.current;
      touchDistRef.current = newDist;
      setScale((s) => Math.max(1, Math.min(2.8, s * (1 + (ratio - 1) * 0.7))));
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  const isCurrentStopOnThisFloor = currentStopSpatial?.floor === activeFloor;

  return (
    <div className="bg-white border border-[#E3DDD4] shadow-xs overflow-hidden flex flex-col select-none">
      {/* 1. Header Toolbar */}
      <div className="p-3 sm:p-4 border-b border-[#E8E3DC] flex flex-wrap items-center justify-between gap-2.5 bg-[#FAF8F5]">
        {/* Floor switcher tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#EFEAE2] text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setSelectedFloor(1);
              handleResetView();
            }}
            className={`px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFloor === 1
                ? "bg-white text-[#1A1918] shadow-xs font-semibold"
                : "text-[#726E67] hover:text-[#1A1918]"
            }`}
          >
            {currentStopSpatial?.floor === 1 && (
              <span className="w-2 h-2 bg-[#899770] inline-block" title="Текущий экспонат здесь" />
            )}
            <span>1 этаж (залы 1–15)</span>
            {stopsCountByFloor[1] > 0 && (
              <span className="w-4 h-4 bg-[#899770] text-white text-[10px] flex items-center justify-center font-bold">
                {stopsCountByFloor[1]}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedFloor(2);
              handleResetView();
            }}
            className={`px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFloor === 2
                ? "bg-white text-[#1A1918] shadow-xs font-semibold"
                : "text-[#726E67] hover:text-[#1A1918]"
            }`}
          >
            {currentStopSpatial?.floor === 2 && (
              <span className="w-2 h-2 bg-[#899770] inline-block" title="Текущий экспонат здесь" />
            )}
            <span>2 этаж (залы 16–30)</span>
            {stopsCountByFloor[2] > 0 && (
              <span className="w-4 h-4 bg-[#899770] text-white text-[10px] flex items-center justify-center font-bold">
                {stopsCountByFloor[2]}
              </span>
            )}
          </button>
        </div>

        {/* View and Zoom Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Center on current stop button */}
          <button
            type="button"
            onClick={handleCenterOnCurrentStop}
            title={
              isCurrentStopOnThisFloor
                ? "Центрировать карту на текущем шедевре"
                : `Перейти на ${currentStopSpatial?.floor || 1} этаж к текущему шедевру`
            }
            className={`h-8 px-2.5 text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
              isCurrentStopOnThisFloor
                ? "border-[#899770] bg-[#F4F6F2] text-[#5A6844] hover:bg-[#EAEFE8]"
                : "border-[#E3DDD4] bg-white text-[#726E67] hover:text-[#1A1918]"
            }`}
          >
            <span aria-hidden="true">🎯</span>
            <span className="hidden sm:inline">
              {isCurrentStopOnThisFloor
                ? `Зал ${currentStopSpatial?.number || ""}`
                : `К шедевру (${currentStopSpatial?.floor || 1} эт)`}
            </span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 2.8}
              title="Приблизить карту"
              className="w-8 h-8 border border-[#E3DDD4] bg-white text-[#1A1918] flex items-center justify-center text-sm font-bold hover:bg-[#FAF8F5] disabled:opacity-40 cursor-pointer"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 1}
              title="Отдалить карту"
              className="w-8 h-8 border border-[#E3DDD4] bg-white text-[#1A1918] flex items-center justify-center text-sm font-bold hover:bg-[#FAF8F5] disabled:opacity-40 cursor-pointer"
            >
              −
            </button>
            {scale > 1 && (
              <button
                type="button"
                onClick={handleResetView}
                title="Сбросить масштаб и показать весь этаж"
                className="text-xs px-2 h-8 border border-[#E3DDD4] bg-white text-[#726E67] hover:text-[#1A1918] cursor-pointer"
              >
                {Math.round(scale * 100)}% ⟲
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Opposite floor banner alert if user is looking at another floor */}
      {!isCurrentStopOnThisFloor && currentStopSpatial && (
        <div className="bg-[#FAF5F0] border-b border-[#E8E3DC] px-4 py-2 text-xs flex items-center justify-between text-[#8D4B00]">
          <div className="flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>
              Текущий экспонат (Остановка {currentStopIndex + 1}) расположен на{" "}
              <strong>{currentStopSpatial.floor}-м этаже в Зале {currentStopSpatial.number}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedFloor(currentStopSpatial.floor);
              handleResetView();
            }}
            className="font-bold underline cursor-pointer text-[#8D4B00] hover:text-[#000000]"
          >
            Перейти на {currentStopSpatial.floor} этаж →
          </button>
        </div>
      )}

      {/* 3. Main Map Canvas Container */}
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden bg-[#F4EFEB] ${
          compact ? "h-[320px] sm:h-[400px]" : "h-[420px] sm:h-[540px]"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          touchAction: scale > 1 ? "none" : "pan-y",
        }}
      >
        {/* Loading Spinner */}
        {isLoadingSvg && !svgCache[activeFloor] && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-xs z-30">
            <div className="flex items-center gap-2 text-xs text-[#726E67] font-medium">
              <span className="w-4 h-4 border-2 border-[#899770] border-t-transparent animate-spin" />
              <span>Загрузка официального векторного плана {activeFloor} этажа...</span>
            </div>
          </div>
        )}

        {/* Panning & Zooming Viewport */}
        <div
          className="w-full h-full transition-transform duration-100 ease-out origin-center flex items-center justify-center p-2 sm:p-4"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {/* Synchronized aspect-ratio wrapper guaranteeing 100% pixel-perfect alignment */}
          <div
            className="relative"
            style={{
              width: "100%",
              height: "100%",
              maxWidth: "100%",
              maxHeight: "100%",
              aspectRatio: activeFloor === 1 ? "3203.9 / 2322.7" : "3203.8 / 2579",
            }}
          >
            {/* Base official vector floor plan from pushkinmuseum.art */}
            <div
              ref={svgContainerRef}
              className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: svgCache[activeFloor] }}
            />

            {/* Synchronized Vector Overlay Layer */}
            <svg
              viewBox={FLOOR_VIEWBOX[activeFloor]}
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              {/* Layer 1: Directional Route Trajectory Polyline */}
              {routePolylinePoints && (
                <g className="route-flow-layer pointer-events-none">
                  {/* Subtle shadow glow */}
                  <polyline
                    points={routePolylinePoints}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={10}
                    strokeLinecap="square"
                    strokeLinejoin="round"
                    strokeOpacity={0.9}
                  />
                  {/* Active trajectory line */}
                  <polyline
                    points={routePolylinePoints}
                    fill="none"
                    stroke="#899770"
                    strokeWidth={5}
                    strokeDasharray="16 10"
                    strokeLinecap="square"
                    strokeLinejoin="round"
                    strokeOpacity={0.85}
                  />
                </g>
              )}

              {/* Layer 2: Staircase transition indicator if next stop is on the other floor */}
              {nextFloorTransition && (
                <g
                  className="cursor-pointer pointer-events-auto transition-transform hover:scale-105"
                  onClick={() => {
                    setSelectedFloor(nextFloorTransition.targetFloor);
                    handleResetView();
                  }}
                >
                  <circle cx={1860} cy={1550} r={40} fill="#899770" fillOpacity={0.2} />
                  <rect
                    x={1860 - 150}
                    y={1550 - 24}
                    width={300}
                    height={48}
                    rx={0}
                    fill="#262626"
                    stroke="#899770"
                    strokeWidth={2}
                  />
                  <text
                    x={1860}
                    y={1550 + 6}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={15}
                    fontWeight="700"
                    className="select-none font-sans"
                  >
                    🪜 На {nextFloorTransition.targetFloor} этаж: к Остановке {nextFloorTransition.targetStopNumber} →
                  </text>
                </g>
              )}

              {/* Layer 3: Architectural Landmarks (Entrance, Staircases, Courtyards) */}
              {floorLandmarks.map((lm) => {
                // If there's already an active stop at this position, omit landmark badge to avoid collision
                const hasStopClose = hallPinPositions.some(
                  (p) => Math.hypot(p.pinX - lm.cx, p.pinY - lm.cy) < 100
                );
                if (hasStopClose) return null;

                return (
                  <g
                    key={lm.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => {
                      setSelectedInfo({
                        hallName: lm.name,
                        hallNumber: lm.subtext,
                        floor: lm.floor,
                        note: `Архитектурный ориентир Главного здания ГМИИ им. А.С. Пушкина: ${lm.subtext}`,
                      });
                    }}
                  >
                    <rect
                      x={lm.cx - 95}
                      y={lm.cy - 16}
                      width={190}
                      height={32}
                      rx={0}
                      fill="#FFFFFF"
                      stroke="#ADA589"
                      strokeWidth={1.5}
                      fillOpacity={0.94}
                    />
                    <text
                      x={lm.cx}
                      y={lm.cy + 5}
                      textAnchor="middle"
                      fill="#262626"
                      fontSize={14}
                      fontWeight="600"
                      className="select-none font-sans"
                    >
                      {lm.icon} {lm.name}
                    </text>
                  </g>
                );
              })}

              {/* Layer 4: Universal Hall Numbers for all rooms without tour stops */}
              {floorHallsList.map((sp) => {
                const hasStopInHall = hallPinPositions.some((p) => p.spatial.hallId === sp.hallId);
                if (hasStopInHall) return null; // Tour stop pin will be rendered on top
                const isBreak = activeFloor === 1 && sp.hallId === "198" && hasBreak;

                return (
                  <g
                    key={`hall-tag-${sp.hallId}`}
                    className="cursor-pointer pointer-events-auto transition-opacity opacity-80 hover:opacity-100"
                    onClick={() => {
                      setSelectedInfo({
                        hallName: sp.name,
                        hallNumber: sp.number,
                        floor: sp.floor,
                        note: isBreak
                          ? breakInfo?.note || "Рекомендуемая зона отдыха в Итальянском дворике"
                          : "Постоянная экспозиция Главного здания.",
                      });
                    }}
                  >
                    <rect
                      x={sp.cx - 40}
                      y={sp.cy - 18}
                      width={80}
                      height={36}
                      rx={0}
                      fill={isBreak ? "#FFF8EE" : "#FFFFFF"}
                      stroke={isBreak ? "#C69214" : "#D5CDC2"}
                      strokeWidth={isBreak ? 2 : 1.5}
                      fillOpacity={0.92}
                    />
                    <text
                      x={sp.cx}
                      y={sp.cy + 6}
                      textAnchor="middle"
                      fill={isBreak ? "#8D4B00" : "#5C5954"}
                      fontSize={16}
                      fontWeight="700"
                      className="select-none font-sans"
                    >
                      {isBreak ? "☕ 15" : `Зал ${sp.number}`}
                    </text>
                  </g>
                );
              })}

              {/* Layer 5: Tour Stop Pins (with individual offsets if multiple stops in hall) */}
              {hallPinPositions.map(({ stop, originalIndex, pinX, pinY, spatial }) => {
                const isCurrent = originalIndex === currentStopIndex;
                const isCompleted = originalIndex < currentStopIndex;
                const stopNumber = originalIndex + 1;

                return (
                  <g
                    key={`${stop.exhibit_id}-${originalIndex}`}
                    className="cursor-pointer pointer-events-auto transition-transform hover:scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStop?.(originalIndex);
                      setSelectedInfo({
                        hallName: spatial.name,
                        hallNumber: spatial.number,
                        stop,
                        stopIndex: originalIndex,
                        floor: spatial.floor,
                      });
                    }}
                  >
                    {/* Pulsing ring for current stop */}
                    {isCurrent && (
                      <circle
                        cx={pinX}
                        cy={pinY}
                        r={72}
                        fill="#899770"
                        fillOpacity={0.25}
                        className="animate-ping"
                      />
                    )}

                    {/* Outer border plate */}
                    <circle
                      cx={pinX}
                      cy={pinY}
                      r={isCurrent ? 44 : 36}
                      fill={isCurrent ? "#899770" : isCompleted ? "#2E7D32" : "#FAF8F5"}
                      stroke={isCurrent ? "#FFFFFF" : isCompleted ? "#FFFFFF" : "#899770"}
                      strokeWidth={isCurrent ? 6 : 4}
                    />

                    {/* Sequence number or checkmark */}
                    <text
                      x={pinX}
                      y={pinY + (isCurrent ? 11 : 9)}
                      textAnchor="middle"
                      fill={isCurrent || isCompleted ? "#FFFFFF" : "#1A1918"}
                      fontSize={isCurrent ? 30 : 24}
                      fontWeight="bold"
                      className="select-none font-sans"
                    >
                      {isCompleted ? "✓" : stopNumber}
                    </text>

                    {/* Hall title plate below pin */}
                    <rect
                      x={pinX - (isCurrent ? 80 : 70)}
                      y={pinY + (isCurrent ? 52 : 44)}
                      width={isCurrent ? 160 : 140}
                      height={isCurrent ? 30 : 26}
                      rx={0}
                      fill={isCurrent ? "#262626" : "#FFFFFF"}
                      stroke={isCurrent ? "#899770" : isCompleted ? "#2E7D32" : "#D5CDC2"}
                      strokeWidth={isCurrent ? 2 : 1.5}
                      fillOpacity={0.96}
                    />
                    <text
                      x={pinX}
                      y={pinY + (isCurrent ? 72 : 62)}
                      textAnchor="middle"
                      fill={isCurrent ? "#FFFFFF" : "#1A1918"}
                      fontSize={isCurrent ? 15 : 13}
                      fontWeight="700"
                      className="select-none font-sans"
                    >
                      Зал {spatial.number} · {isCompleted ? "Пройдено" : `Шаг ${stopNumber}`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 4. Rich Interactive Popover Card for Selected Hall / Stop */}
        {selectedInfo && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-sm bg-white/98 backdrop-blur-md border border-[#E3DDD4] p-3.5 shadow-xl z-20 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                {/* Header status */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[#1A1918] bg-[#F4F6F2] text-[#5A6844] px-2 py-0.5 border border-[#DCE4D4]">
                    Зал {selectedInfo.hallNumber}
                  </span>
                  <span className="text-[#726E67] font-medium">
                    {selectedInfo.floor} этаж
                  </span>
                  {selectedInfo.stopIndex !== undefined && (
                    <span className="text-[#899770] font-bold">
                      • Остановка {selectedInfo.stopIndex + 1} из {stops.length}
                    </span>
                  )}
                </div>

                {/* Hall Name */}
                <div className="font-serif text-sm font-bold text-[#1A1918] leading-tight">
                  {selectedInfo.hallName}
                </div>

                {/* Artwork snippet if hall is an active stop */}
                {selectedInfo.stop && (
                  <div className="flex items-center gap-2.5 pt-1 border-t border-[#E8E3DC]">
                    <div className="w-12 h-14 shrink-0 overflow-hidden border border-[#E5E1D8]">
                      <ArtworkImage
                        src={selectedInfo.stop.image_url}
                        alt={selectedInfo.stop.title}
                        artist={selectedInfo.stop.artist || ""}
                        showMagnifyButton={false}
                        compact={true}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-xs font-bold text-[#000000] line-clamp-1">
                        {selectedInfo.stop.title}
                      </div>
                      <div className="text-[11px] text-[#7A756D] line-clamp-1">
                        {selectedInfo.stop.artist || "Автор не указан"}
                      </div>
                      {selectedInfo.stopIndex !== undefined && (
                        <button
                          type="button"
                          onClick={() => onSelectStop?.(selectedInfo.stopIndex!)}
                          className="mt-1 text-[11px] font-bold text-[#899770] hover:text-[#75835C] flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Перейти к описанию шедевра</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Note or description */}
                {selectedInfo.note && !selectedInfo.stop && (
                  <p className="text-[11px] text-[#5C5954] leading-relaxed pt-1">
                    {selectedInfo.note}
                  </p>
                )}
              </div>

              {/* Close popover */}
              <button
                type="button"
                onClick={() => setSelectedInfo(null)}
                className="text-[#726E67] hover:text-[#1A1918] p-1 cursor-pointer shrink-0"
                aria-label="Закрыть карточку зала"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Footer Legend and Orientation Guide */}
      <div className="p-3 sm:p-4 border-t border-[#E8E3DC] bg-[#FAF8F5] space-y-2">
        {/* Badges Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#5C5954]">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#899770] inline-block border border-white shadow-2xs" />
            <span className="font-semibold text-[#1A1918]">Текущий шедевр</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#2E7D32] inline-block border border-white shadow-2xs" />
            <span>Пройденная точка</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#FAF8F5] border border-[#899770] inline-block shadow-2xs" />
            <span>Предстоящая</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-white border border-[#ADA589] inline-block text-[9px] font-bold text-center leading-3">
              10
            </span>
            <span>Зал музея</span>
          </div>
          {hasBreak && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 bg-[#C69214] text-[10px] text-white">
                ☕
              </span>
              <span>Зона отдыха (Зал 15)</span>
            </div>
          )}
        </div>

        {/* Navigation & Controls Hint */}
        <div className="text-[11px] text-[#726E67] leading-relaxed pt-1.5 border-t border-[#EAE5DF] flex flex-wrap items-center justify-between gap-1">
          <span>
            💡 <strong>Навигация:</strong> перетаскивайте карту мышью или пальцем; колесико или щипок — масштаб. Нажмите на любой зал для деталей.
          </span>
          <span className="font-mono text-[10px] text-[#8C867E]">
            ГМИИ им. А.С. Пушкина · Волхонка, 12
          </span>
        </div>
      </div>
    </div>
  );
}
