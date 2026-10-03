import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { BreakInfo, Stop } from "@/entities/route";
import { ArtworkImage } from "@/entities/route";
import { IconArrowRight, IconBreak, IconClose, IconHint, IconTarget } from "@/shared/ui";
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
        let normalized = rawSvg;
        if (!normalized.includes("preserveAspectRatio")) {
          normalized = normalized.replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" ');
        }
        setSvgCache((prev) => ({ ...prev, [activeFloor]: normalized }));
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

  // Map of hallId -> array of { stop: Stop; originalIndex: number }
  const hallToStopsMap = useMemo(() => {
    const map = new Map<string, Array<{ stop: Stop; originalIndex: number }>>();
    stops.forEach((stop, idx) => {
      const sp = getHallSpatialData(stop.hall_id, stop.hall_number);
      if (sp) {
        if (!map.has(sp.hallId)) map.set(sp.hallId, []);
        map.get(sp.hallId)!.push({ stop, originalIndex: idx });
      }
    });
    return map;
  }, [stops]);

  // Group floor stops by hall to layout pins cleanly without collision
  const hallClusters = useMemo(() => {
    const map = new Map<
      string,
      {
        spatial: (typeof HALL_SPATIAL_REGISTRY)[string];
        stops: Array<{ stop: Stop; originalIndex: number }>;
      }
    >();

    floorStops.forEach((item) => {
      const sp = getHallSpatialData(item.stop.hall_id, item.stop.hall_number);
      if (!sp) return;
      if (!map.has(sp.hallId)) {
        map.set(sp.hallId, { spatial: sp, stops: [] });
      }
      map.get(sp.hallId)!.stops.push(item);
    });

    // Sort clusters chronologically by the first stop index in that hall
    return Array.from(map.values()).sort((a, b) => {
      const minA = Math.min(...a.stops.map((s) => s.originalIndex));
      const minB = Math.min(...b.stops.map((s) => s.originalIndex));
      return minA - minB;
    });
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

  // Dynamic CSS rules applied to official SVG polygons (100% immune to zoom/pan/re-render resets)
  const dynamicHallStyles = useMemo(() => {
    let css = `
      .map-hall {
        cursor: pointer !important;
        pointer-events: auto !important;
        transition: fill 0.2s ease, fill-opacity 0.2s ease, stroke 0.2s ease, stroke-width 0.2s ease;
      }
      .map-hall:hover {
        filter: brightness(0.96);
      }
      .map-hall {
        fill: #FFFFFF !important;
        fill-opacity: 0.85 !important;
        stroke: #D5CDC2 !important;
        stroke-width: 2.5px !important;
        stroke-dasharray: none !important;
      }
    `;

    // Break hall styling (Italian courtyard, hall 15 / id 198)
    if (activeFloor === 1 && hasBreak) {
      css += `
        .map-hall[data-hall="198"] {
          fill: #C69214 !important;
          fill-opacity: 0.22 !important;
          stroke: #C69214 !important;
          stroke-width: 5px !important;
          stroke-dasharray: none !important;
        }
      `;
    }

    // Route halls styling
    hallToStopsMap.forEach((hallStops, hallId) => {
      if (!hallStops || hallStops.length === 0) return;
      const sp = HALL_SPATIAL_REGISTRY[hallId];
      if (sp && sp.floor !== activeFloor) return;

      const hasCurrent = hallStops.some((s) => s.originalIndex === currentStopIndex);
      const allCompleted = hallStops.every((s) => s.originalIndex < currentStopIndex);

      if (hasCurrent) {
        css += `
          .map-hall[data-hall="${hallId}"] {
            fill: #899770 !important;
            fill-opacity: 0.38 !important;
            stroke: #899770 !important;
            stroke-width: 8px !important;
            stroke-dasharray: none !important;
          }
        `;
      } else if (allCompleted) {
        css += `
          .map-hall[data-hall="${hallId}"] {
            fill: #2E7D32 !important;
            fill-opacity: 0.22 !important;
            stroke: #2E7D32 !important;
            stroke-width: 6px !important;
            stroke-dasharray: none !important;
          }
        `;
      } else {
        css += `
          .map-hall[data-hall="${hallId}"] {
            fill: #899770 !important;
            fill-opacity: 0.14 !important;
            stroke: #899770 !important;
            stroke-width: 4px !important;
            stroke-dasharray: none !important;
          }
        `;
      }
    });

    return css;
  }, [hallToStopsMap, activeFloor, currentStopIndex, hasBreak]);

  // Delegated click handler on SVG container
  const handleSvgHallClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as Element).closest<SVGGraphicsElement>(".map-hall, [data-hall]");
      if (!target) return;
      const hallId = target.getAttribute("data-hall");
      if (!hallId) return;

      const hallStops = hallToStopsMap.get(hallId);
      const isBreakHall = activeFloor === 1 && hallId === "198" && hasBreak;
      const sp = HALL_SPATIAL_REGISTRY[hallId];

      if (hallStops && hallStops.length > 0) {
        const targetItem =
          hallStops.find((s) => s.originalIndex === currentStopIndex) ||
          hallStops.find((s) => s.originalIndex > currentStopIndex) ||
          hallStops[0];
        onSelectStop?.(targetItem.originalIndex);
        if (sp) {
          setSelectedInfo({
            hallName: sp.name,
            hallNumber: sp.number,
            stop: targetItem.stop,
            stopIndex: targetItem.originalIndex,
            floor: sp.floor,
          });
        }
      } else if (isBreakHall) {
        setSelectedInfo({
          hallName: "Итальянский дворик (Зал 15)",
          hallNumber: "15",
          floor: 1,
          note:
            breakInfo?.note ||
            `Кафе в цокольном этаже Главного здания временно закрыто на техобслуживание. Для отдыха ${breakAfterStop ? `после ${breakAfterStop}-й остановки` : "в середине визита"} рекомендуем диваны в Итальянском дворике.`,
        });
      } else if (sp) {
        setSelectedInfo({
          hallName: sp.name,
          hallNumber: sp.number,
          floor: sp.floor,
          note: "Постоянная экспозиция Главного здания. Экспонаты зала открыты для свободного осмотра.",
        });
      }
    },
    [hallToStopsMap, activeFloor, currentStopIndex, hasBreak, breakInfo, breakAfterStop, onSelectStop]
  );

  // Highlight and attach interactions to the official SVG polygons
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const container = svgContainerRef.current;
    const hallElements = container.querySelectorAll<SVGGraphicsElement>(".map-hall, [data-hall]");

    hallElements.forEach((el) => {
      const hallId = el.getAttribute("data-hall");
      if (!hallId) return;

      const hallStops = hallToStopsMap.get(hallId);
      const isBreakHall = activeFloor === 1 && hallId === "198" && hasBreak;
      const sp = HALL_SPATIAL_REGISTRY[hallId];

      el.style.transition = "all 0.2s ease-in-out";
      el.style.cursor = "pointer";
      el.style.pointerEvents = "auto";

      if (hallStops && hallStops.length > 0) {
        const hasCurrent = hallStops.some((s) => s.originalIndex === currentStopIndex);
        const allCompleted = hallStops.every((s) => s.originalIndex < currentStopIndex);

        if (hasCurrent) {
          // Current stop hall
          el.style.fill = "#899770";
          el.style.fillOpacity = "0.38";
          el.style.stroke = "#899770";
          el.style.strokeWidth = "8px";
          el.style.strokeDasharray = "none";
        } else if (allCompleted) {
          // Visited hall
          el.style.fill = "#2E7D32";
          el.style.fillOpacity = "0.22";
          el.style.stroke = "#2E7D32";
          el.style.strokeWidth = "6px";
          el.style.strokeDasharray = "none";
        } else {
          // Upcoming hall
          el.style.fill = "#899770";
          el.style.fillOpacity = "0.14";
          el.style.stroke = "#899770";
          el.style.strokeWidth = "4px";
          el.style.strokeDasharray = "none";
        }

        el.onclick = (e) => {
          e.stopPropagation();
          const targetItem =
            hallStops.find((s) => s.originalIndex === currentStopIndex) ||
            hallStops.find((s) => s.originalIndex > currentStopIndex) ||
            hallStops[0];
          onSelectStop?.(targetItem.originalIndex);
          if (sp) {
            setSelectedInfo({
              hallName: sp.name,
              hallNumber: sp.number,
              stop: targetItem.stop,
              stopIndex: targetItem.originalIndex,
              floor: sp.floor,
            });
          }
        };
      } else if (isBreakHall) {
        // Break hall (Italian courtyard, hall 15)
        el.style.fill = "#C69214";
        el.style.fillOpacity = "0.22";
        el.style.stroke = "#C69214";
        el.style.strokeWidth = "5px";
        el.style.strokeDasharray = "none";

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
    hallToStopsMap,
    currentStopIndex,
    hasBreak,
    breakInfo,
    breakAfterStop,
    onSelectStop,
    scale,
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
            <IconTarget size={15} />
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
            Перейти на {currentStopSpatial.floor} этаж
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
            {/* Declarative dynamic hall styling that is 100% immune to zoom/pan resets */}
            <style dangerouslySetInnerHTML={{ __html: dynamicHallStyles }} />

            {/* Base official vector floor plan from pushkinmuseum.art */}
            <div
              ref={svgContainerRef}
              onClick={handleSvgHallClick}
              className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: svgCache[activeFloor] }}
            />

            {/* Synchronized Vector Overlay Layer (1:1 identical viewBox and aspect ratio) */}
            <svg
              viewBox={FLOOR_VIEWBOX[activeFloor]}
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Staircase transition indicator if next stop is on the other floor */}
              {nextFloorTransition && (
                <g
                  className="cursor-pointer pointer-events-auto transition-opacity hover:opacity-85"
                  onClick={() => {
                    setSelectedFloor(nextFloorTransition.targetFloor);
                    handleResetView();
                  }}
                >
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
                    На {nextFloorTransition.targetFloor} этаж: к Остановке {nextFloorTransition.targetStopNumber} →
                  </text>
                </g>
              )}

              {/* Layer 3: Architectural Landmarks (Entrance, Staircases, Courtyards) */}
              {floorLandmarks.map((lm) => {
                // If there's already an active stop at this position, omit landmark badge to avoid collision
                const hasStopClose = hallClusters.some(
                  (c) => Math.hypot(c.spatial.cx - lm.cx, c.spatial.cy - lm.cy) < 100
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
                const hasStopInHall = hallClusters.some((c) => c.spatial.hallId === sp.hallId);
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

              {/* Layer 5: Tour Stop Pins (Clustered by hall so pins & labels never overlap) */}
              {hallClusters.map((cluster) => {
                const { spatial, stops: clusterStops } = cluster;
                const totalInHall = clusterStops.length;
                const pinSpacing = 72;

                return (
                  <g key={`cluster-${spatial.hallId}`}>
                    {/* Render each pin in this hall */}
                    {clusterStops.map(({ stop, originalIndex }, idx) => {
                      const isCurrent = originalIndex === currentStopIndex;
                      const isCompleted = originalIndex < currentStopIndex;
                      const stopNumber = originalIndex + 1;

                      // Distribute horizontally if multiple stops in hall
                      const pinX =
                        totalInHall === 1
                          ? spatial.cx
                          : spatial.cx + (idx - (totalInHall - 1) / 2) * pinSpacing;
                      const pinY = spatial.cy - 16;

                      return (
                        <g
                          key={`${stop.exhibit_id}-${originalIndex}`}
                          className="cursor-pointer pointer-events-auto transition-opacity hover:opacity-85"
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
                          {/* Pulsing subtle ambient halo */}
                          {isCurrent && (
                            <rect
                              x={pinX - 44}
                              y={pinY - 44}
                              width={88}
                              height={88}
                              fill="#899770"
                              fillOpacity={0.2}
                              className="animate-pulse"
                              rx={0}
                            />
                          )}

                          {isCurrent ? (
                            // Current Stop: Distinct black container, olive top tag, double dashed outline
                            <g>
                              {/* Outer architectural double frame */}
                              <rect
                                x={pinX - 40}
                                y={pinY - 40}
                                width={80}
                                height={80}
                                fill="none"
                                stroke="#262626"
                                strokeWidth={2.5}
                                strokeDasharray="6 3"
                                rx={0}
                              />
                              {/* Main solid rectangular card */}
                              <rect
                                x={pinX - 34}
                                y={pinY - 34}
                                width={68}
                                height={68}
                                fill="#1A1918"
                                stroke="#899770"
                                strokeWidth={3}
                                rx={0}
                              />
                              {/* Top banner tag */}
                              <rect
                                x={pinX - 34}
                                y={pinY - 50}
                                width={68}
                                height={16}
                                fill="#899770"
                                rx={0}
                              />
                              <text
                                x={pinX}
                                y={pinY - 38}
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize={10}
                                fontWeight="900"
                                letterSpacing="0.05em"
                                className="select-none font-sans"
                              >
                                СЕЙЧАС
                              </text>
                              {/* High contrast step number */}
                              <text
                                x={pinX}
                                y={pinY + 12}
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize={30}
                                fontWeight="900"
                                className="select-none font-sans"
                              >
                                {stopNumber}
                              </text>
                            </g>
                          ) : isCompleted ? (
                            // Completed Stop: Green rectangular badge with explicit checkmark band
                            <g>
                              <rect
                                x={pinX - 30}
                                y={pinY - 30}
                                width={60}
                                height={60}
                                fill="#2E7D32"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                rx={0}
                              />
                              {/* Header band indicating completion */}
                              <rect
                                x={pinX - 30}
                                y={pinY - 30}
                                width={60}
                                height={16}
                                fill="#1B5E20"
                                rx={0}
                              />
                              <text
                                x={pinX}
                                y={pinY - 18}
                                textAnchor="middle"
                                fill="#E8F5E9"
                                fontSize={10}
                                fontWeight="bold"
                                className="select-none font-sans"
                              >
                                ✓ ПРОЙДЕН
                              </text>
                              <text
                                x={pinX}
                                y={pinY + 16}
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize={24}
                                fontWeight="bold"
                                className="select-none font-sans"
                              >
                                {stopNumber}
                              </text>
                            </g>
                          ) : (
                            // Upcoming Stop: Crisp white museum badge with olive border and step tag
                            <g>
                              <rect
                                x={pinX - 30}
                                y={pinY - 30}
                                width={60}
                                height={60}
                                fill="#FFFFFF"
                                stroke="#899770"
                                strokeWidth={2.5}
                                rx={0}
                              />
                              {/* Header tag */}
                              <rect
                                x={pinX - 30}
                                y={pinY - 30}
                                width={60}
                                height={16}
                                fill="#F4F6F2"
                                stroke="#DCE4D4"
                                strokeWidth={1}
                                rx={0}
                              />
                              <text
                                x={pinX}
                                y={pinY - 18}
                                textAnchor="middle"
                                fill="#5A6844"
                                fontSize={10}
                                fontWeight="bold"
                                className="select-none font-sans"
                              >
                                ШАГ
                              </text>
                              <text
                                x={pinX}
                                y={pinY + 16}
                                textAnchor="middle"
                                fill="#1A1918"
                                fontSize={24}
                                fontWeight="bold"
                                className="select-none font-sans"
                              >
                                {stopNumber}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Unified Single Hall Plate below pins (Zero collisions!) */}
                    {(() => {
                      const hasCurrent = clusterStops.some((s) => s.originalIndex === currentStopIndex);
                      const allCompleted = clusterStops.every((s) => s.originalIndex < currentStopIndex);
                      const stepNumbers = clusterStops.map((s) => s.originalIndex + 1).join(", ");
                      const plateWidth = Math.max(160, totalInHall * pinSpacing + 28);
                      const plateY = spatial.cy + 42;

                      return (
                        <g
                          className="cursor-pointer pointer-events-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            const activeStop =
                              clusterStops.find((s) => s.originalIndex === currentStopIndex) ||
                              clusterStops[0];
                            onSelectStop?.(activeStop.originalIndex);
                            setSelectedInfo({
                              hallName: spatial.name,
                              hallNumber: spatial.number,
                              stop: activeStop.stop,
                              stopIndex: activeStop.originalIndex,
                              floor: spatial.floor,
                            });
                          }}
                        >
                          <rect
                            x={spatial.cx - plateWidth / 2}
                            y={plateY - 14}
                            width={plateWidth}
                            height={28}
                            rx={0}
                            fill={hasCurrent ? "#262626" : "#FFFFFF"}
                            stroke={hasCurrent ? "#899770" : allCompleted ? "#2E7D32" : "#D5CDC2"}
                            strokeWidth={hasCurrent ? 2 : 1.5}
                            fillOpacity={0.96}
                          />
                          <text
                            x={spatial.cx}
                            y={plateY + 4}
                            textAnchor="middle"
                            fill={hasCurrent ? "#FFFFFF" : "#1A1918"}
                            fontSize={13}
                            fontWeight="700"
                            className="select-none font-sans"
                          >
                            Зал {spatial.number} · {totalInHall > 1 ? `Шаги ${stepNumbers}` : `Шаг ${stepNumbers}`}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 4. Rich Interactive Popover Card for Selected Hall / Stop */}
        {selectedInfo && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-md bg-white/98 backdrop-blur-md border border-[#E3DDD4] p-3.5 shadow-xl z-20 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
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

                {/* Multi-stop switcher if hall contains multiple artworks */}
                {(() => {
                  const matchingCluster = hallClusters.find(
                    (c) => c.spatial.number === selectedInfo.hallNumber
                  );
                  if (!matchingCluster || matchingCluster.stops.length <= 1) return null;

                  return (
                    <div className="pt-1.5 pb-1 border-t border-[#E8E3DC]">
                      <div className="text-[11px] text-[#7A756D] font-medium mb-1.5">
                        Шедевры в этом зале ({matchingCluster.stops.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matchingCluster.stops.map(({ stop: s, originalIndex: idx }) => {
                          const isCur = idx === currentStopIndex;
                          const isSel = idx === selectedInfo.stopIndex;
                          return (
                            <button
                              key={`pill-${idx}`}
                              type="button"
                              onClick={() => {
                                onSelectStop?.(idx);
                                setSelectedInfo({
                                  hallName: matchingCluster.spatial.name,
                                  hallNumber: matchingCluster.spatial.number,
                                  stop: s,
                                  stopIndex: idx,
                                  floor: matchingCluster.spatial.floor,
                                });
                              }}
                              className={`px-2 py-1 text-[11px] font-semibold border transition-all cursor-pointer ${
                                isSel
                                  ? "bg-[#899770] text-white border-[#899770]"
                                  : isCur
                                  ? "bg-[#F4F6F2] text-[#5A6844] border-[#899770]"
                                  : "bg-[#FAFAFA] text-[#262626] border-[#D5CDC2] hover:bg-[#F0ECE1]"
                              }`}
                            >
                              Шаг {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

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
                          <IconArrowRight size={14} />
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
                <IconClose size={15} />
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
            <span className="w-3.5 h-3.5 bg-[#1A1918] border border-[#899770] inline-block shadow-2xs" />
            <span className="font-semibold text-[#1A1918]">Текущая остановка (СЕЙЧАС)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#2E7D32] border border-white inline-block shadow-2xs" />
            <span>Пройденная точка (✓)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#FFFFFF] border border-[#899770] inline-block shadow-2xs" />
            <span>Предстоящая (ШАГ)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-white border border-[#ADA589] inline-block text-[9px] font-bold text-center leading-3">
              10
            </span>
            <span>Зал музея</span>
          </div>
          {hasBreak && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center bg-[#C69214] text-white">
                <IconBreak size={11} />
              </span>
              <span>Зона отдыха (Зал 15)</span>
            </div>
          )}
        </div>

        {/* Navigation & Controls Hint */}
        <div className="text-[11px] text-[#726E67] leading-relaxed pt-1.5 border-t border-[#EAE5DF] flex flex-wrap items-center justify-between gap-1">
          <span>
            <IconHint size={12} className="mr-1 inline-block align-text-bottom" /><strong>Навигация:</strong> перетаскивайте карту мышью или жестом; масштаб — кнопками +/− или щипком. Порядок экскурсии обозначен номерами шагов на маркерах залов.
          </span>
          <span className="font-mono text-[10px] text-[#8C867E]">
            ГМИИ им. А.С. Пушкина · Волхонка, 12
          </span>
        </div>
      </div>
    </div>
  );
}
