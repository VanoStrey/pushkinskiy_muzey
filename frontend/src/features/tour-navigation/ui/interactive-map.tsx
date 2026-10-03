import { useEffect, useMemo, useRef, useState } from "react";
import type { BreakInfo, Stop } from "@/entities/route";
import {
  FLOOR_VIEWBOX,
  HALL_SPATIAL_REGISTRY,
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

export function InteractiveMap({
  stops,
  currentStopIndex,
  onSelectStop,
  breakInfo,
  hasBreak = false,
  breakAfterStop,
  compact = false,
}: InteractiveMapProps) {
  // Floor selection: follows current stop's floor unless user manually clicks a tab
  const currentStop = stops[currentStopIndex];
  const [selectedFloor, setSelectedFloor] = useState<1 | 2 | null>(null);
  const [prevStopIndex, setPrevStopIndex] = useState<number>(currentStopIndex);

  if (currentStopIndex !== prevStopIndex) {
    setPrevStopIndex(currentStopIndex);
    setSelectedFloor(null);
  }

  const activeFloor: 1 | 2 = selectedFloor ?? (currentStop?.floor_number === "2" ? 2 : 1);

  // SVG cached strings
  const [svgCache, setSvgCache] = useState<Record<1 | 2, string>>({ 1: "", 2: "" });
  const isLoadingSvg = !svgCache[activeFloor];
  const [selectedHallInfo, setSelectedHallInfo] = useState<{
    hallName: string;
    hallNumber: string;
    note?: string;
    stopIndex?: number;
  } | null>(null);

  // Zoom and pan state
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Load official vector maps
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
        console.error("Failed to load official SVG map:", err);
      });
  }, [activeFloor, svgCache]);

  // Stops on the currently active floor
  const floorStops = useMemo(() => {
    return stops
      .map((stop, idx) => ({ stop, originalIndex: idx }))
      .filter(({ stop }) => {
        const floor = stop.floor_number ? parseInt(stop.floor_number, 10) : 1;
        return floor === activeFloor;
      });
  }, [stops, activeFloor]);

  // Stops count per floor for tab badges
  const stopsCountByFloor = useMemo(() => {
    const counts = { 1: 0, 2: 0 };
    for (const stop of stops) {
      if (stop.floor_number === "2") {
        counts[2]++;
      } else {
        counts[1]++;
      }
    }
    return counts;
  }, [stops]);

  // Mapping of hall_id to route stop indices
  const hallToStopIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    stops.forEach((stop, idx) => {
      const spatial = getHallSpatialData(stop.hall_id, stop.hall_number);
      if (spatial) {
        map.set(spatial.hallId, idx);
      }
    });
    return map;
  }, [stops]);

  // Highlight and attach interactions to the official SVG polygons
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const container = svgContainerRef.current;
    const hallElements = container.querySelectorAll<SVGGraphicsElement>(".map-hall, [data-hall]");

    hallElements.forEach((el) => {
      const hallId = el.getAttribute("data-hall");
      if (!hallId) return;

      const stopIdx = hallToStopIndexMap.get(hallId);
      const isBreakHall = activeFloor === 1 && hallId === "198" && hasBreak;

      // Reset styles
      el.style.transition = "all 0.25s ease-in-out";
      el.style.cursor = "default";
      el.style.pointerEvents = "auto";

      if (stopIdx !== undefined) {
        el.style.cursor = "pointer";
        if (stopIdx === currentStopIndex) {
          // Current stop hall
          el.style.fill = "#899770";
          el.style.fillOpacity = "0.38";
          el.style.stroke = "#899770";
          el.style.strokeWidth = "8px";
        } else if (stopIdx < currentStopIndex) {
          // Visited hall
          el.style.fill = "#2E7D32";
          el.style.fillOpacity = "0.25";
          el.style.stroke = "#2E7D32";
          el.style.strokeWidth = "6px";
        } else {
          // Upcoming hall
          el.style.fill = "#D4A373";
          el.style.fillOpacity = "0.22";
          el.style.stroke = "#C69214";
          el.style.strokeWidth = "5px";
        }

        el.onclick = (e) => {
          e.stopPropagation();
          onSelectStop?.(stopIdx);
          const spatial = HALL_SPATIAL_REGISTRY[hallId];
          if (spatial) {
            setSelectedHallInfo({
              hallName: spatial.name,
              hallNumber: spatial.number,
              stopIndex: stopIdx,
            });
          }
        };
      } else if (isBreakHall) {
        // Break hall (Italian courtyard, hall 15)
        el.style.cursor = "pointer";
        el.style.fill = "#C69214";
        el.style.fillOpacity = "0.22";
        el.style.stroke = "#C69214";
        el.style.strokeWidth = "6px";
        el.style.strokeDasharray = "10 5";

        el.onclick = (e) => {
          e.stopPropagation();
          setSelectedHallInfo({
            hallName: "Итальянский дворик (Зал 15)",
            hallNumber: "15",
            note:
              breakInfo?.note ||
              `Кафе в цокольном этаже Главного здания временно закрыто на техобслуживание. Для отдыха ${breakAfterStop ? `после ${breakAfterStop}-й остановки` : "в середине визита"} рекомендуем диваны в Итальянском дворике.`,
          });
        };
      } else {
        // Neutral inactive museum hall
        el.style.fill = "#FFFFFF";
        el.style.fillOpacity = "0.7";
        el.style.stroke = "#B5B0A6";
        el.style.strokeWidth = "2px";
        el.onclick = null;
      }
    });
  }, [
    activeFloor,
    svgCache,
    hallToStopIndexMap,
    currentStopIndex,
    hasBreak,
    breakInfo,
    breakAfterStop,
    onSelectStop,
  ]);

  // Pan event handlers
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

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.35, 2.5));
  const handleZoomOut = () => {
    setScale((s) => {
      const next = Math.max(s - 0.35, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="bg-white border border-[#E3DDD4] shadow-xs overflow-hidden flex flex-col">
      {/* Header bar: Floor tabs & Controls */}
      <div className="p-3 sm:p-4 border-b border-[#E8E3DC] flex flex-wrap items-center justify-between gap-2 bg-[#FAF8F5]">
        {/* Floor switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[#EFEAE2] text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setSelectedFloor(1);
              handleResetZoom();
            }}
            className={`px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFloor === 1
                ? "bg-white text-[#1A1918] shadow-xs font-semibold"
                : "text-[#726E67] hover:text-[#1A1918]"
            }`}
          >
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
              handleResetZoom();
            }}
            className={`px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFloor === 2
                ? "bg-white text-[#1A1918] shadow-xs font-semibold"
                : "text-[#726E67] hover:text-[#1A1918]"
            }`}
          >
            <span>2 этаж (залы 16–30)</span>
            {stopsCountByFloor[2] > 0 && (
              <span className="w-4 h-4 bg-[#899770] text-white text-[10px] flex items-center justify-center font-bold">
                {stopsCountByFloor[2]}
              </span>
            )}
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.5}
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
              onClick={handleResetZoom}
              title="Сбросить масштаб"
              className="text-xs px-2 h-8 border border-[#E3DDD4] bg-white text-[#726E67] hover:text-[#1A1918] cursor-pointer"
            >
              100%
            </button>
          )}
        </div>
      </div>

      {/* SVG Map Container */}
      <div
        className={`relative w-full overflow-hidden bg-[#F4EFEB] select-none ${
          compact ? "h-[320px] sm:h-[400px]" : "h-[420px] sm:h-[520px]"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {isLoadingSvg && !svgCache[activeFloor] && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs z-20">
            <div className="flex items-center gap-2 text-xs text-[#726E67]">
              <span className="w-4 h-4 border-2 border-[#899770] border-t-transparent animate-spin" />
              <span>Загрузка векторного плана этажа...</span>
            </div>
          </div>
        )}

        <div
          className="w-full h-full transition-transform duration-100 ease-out origin-center flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {/* Base official vector floor plan */}
          <div
            ref={svgContainerRef}
            className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svgCache[activeFloor] }}
          />

          {/* Overlay layer with stop pin markers and coffee break icon */}
          <svg
            viewBox={FLOOR_VIEWBOX[activeFloor]}
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Break badge on Floor 1 (Italian courtyard / hall 15) */}
            {activeFloor === 1 && hasBreak && (
              <g
                className="cursor-pointer pointer-events-auto transition-transform hover:scale-110"
                onClick={() => {
                  setSelectedHallInfo({
                    hallName: "Итальянский дворик (Зал 15)",
                    hallNumber: "15",
                    note:
                      breakInfo?.note ||
                      "Кафе в цокольном этаже Главного здания временно закрыто на техобслуживание. Для комфортной паузы рекомендуем отдохнуть в Итальянском или Греческом дворике.",
                  });
                }}
              >
                {/* Aura ring */}
                <circle cx={2271.1} cy={1154.8} r={55} fill="#C69214" fillOpacity={0.2} />
                {/* Badge circle */}
                <circle cx={2271.1} cy={1154.8} r={38} fill="#C69214" stroke="#FFFFFF" strokeWidth={5} />
                {/* Coffee icon */}
                <text
                  x={2271.1}
                  y={1154.8 + 8}
                  textAnchor="middle"
                  fontSize={26}
                  className="select-none"
                >
                  ☕
                </text>
                {/* Label badge */}
                <rect
                  x={2271.1 - 70}
                  y={1154.8 + 48}
                  width={140}
                  height={28}
                  rx={8}
                  fill="#FFFFFF"
                  stroke="#C69214"
                  strokeWidth={2}
                />
                <text
                  x={2271.1}
                  y={1154.8 + 68}
                  textAnchor="middle"
                  fill="#8D4B00"
                  fontSize={18}
                  fontWeight="bold"
                  className="select-none"
                >
                  Пауза: Зал 15
                </text>
              </g>
            )}

            {/* Stop pins on this floor */}
            {floorStops.map(({ stop, originalIndex }) => {
              const spatial = getHallSpatialData(stop.hall_id, stop.hall_number);
              if (!spatial) return null;

              const isCurrent = originalIndex === currentStopIndex;
              const isCompleted = originalIndex < currentStopIndex;
              const stopNumber = originalIndex + 1;

              return (
                <g
                  key={stop.exhibit_id}
                  className="cursor-pointer pointer-events-auto transition-transform hover:scale-110"
                  onClick={() => {
                    onSelectStop?.(originalIndex);
                    setSelectedHallInfo({
                      hallName: spatial.name,
                      hallNumber: spatial.number,
                      stopIndex: originalIndex,
                    });
                  }}
                >
                  {/* Pulsing ring for current stop */}
                  {isCurrent && (
                    <circle
                      cx={spatial.cx}
                      cy={spatial.cy}
                      r={70}
                      fill="#899770"
                      fillOpacity={0.25}
                      className="animate-ping"
                    />
                  )}

                  {/* Main badge circle */}
                  <circle
                    cx={spatial.cx}
                    cy={spatial.cy}
                    r={isCurrent ? 44 : 36}
                    fill={isCurrent ? "#899770" : isCompleted ? "#2E7D32" : "#FAF8F5"}
                    stroke={isCurrent ? "#FFFFFF" : isCompleted ? "#FFFFFF" : "#C69214"}
                    strokeWidth={isCurrent ? 6 : 4}
                  />

                  {/* Stop sequence number */}
                  <text
                    x={spatial.cx}
                    y={spatial.cy + (isCurrent ? 11 : 9)}
                    textAnchor="middle"
                    fill={isCurrent || isCompleted ? "#FFFFFF" : "#1A1918"}
                    fontSize={isCurrent ? 30 : 24}
                    fontWeight="bold"
                    className="select-none"
                  >
                    {stopNumber}
                  </text>

                  {/* Hall title plate */}
                  <rect
                    x={spatial.cx - 65}
                    y={spatial.cy + (isCurrent ? 52 : 44)}
                    width={130}
                    height={26}
                    rx={0}
                    fill="#FFFFFF"
                    stroke={isCurrent ? "#899770" : "#D8D2C9"}
                    strokeWidth={1.5}
                    fillOpacity={0.95}
                  />
                  <text
                    x={spatial.cx}
                    y={spatial.cy + (isCurrent ? 70 : 62)}
                    textAnchor="middle"
                    fill="#1A1918"
                    fontSize={16}
                    fontWeight="600"
                    className="select-none"
                  >
                    Зал {spatial.number}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected hall overlay card */}
        {selectedHallInfo && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-xs bg-white/95 backdrop-blur-md border border-[#E3DDD4] p-3 shadow-lg z-20 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-[#1A1918] flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#899770]" />
                  <span>Зал {selectedHallInfo.hallNumber}</span>
                </div>
                <div className="text-[#5C5954] mt-0.5 font-medium leading-snug">
                  {selectedHallInfo.hallName}
                </div>
                {selectedHallInfo.note && (
                  <p className="mt-1.5 text-[11px] text-[#8D4B00] bg-[#FAF5F0] p-1.5 border border-[#E8E3DC] leading-relaxed">
                    {selectedHallInfo.note}
                  </p>
                )}
                {selectedHallInfo.stopIndex !== undefined && (
                  <div className="mt-2 text-[#899770] font-semibold flex items-center gap-1">
                    <span>Остановка {selectedHallInfo.stopIndex + 1} из {stops.length}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedHallInfo(null)}
                className="text-[#726E67] hover:text-[#1A1918] p-1 cursor-pointer"
                aria-label="Закрыть информацию"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend & Factual Grounding Note */}
      <div className="p-3 sm:p-4 border-t border-[#E8E3DC] bg-[#FAF8F5] space-y-2">
        {/* Badges Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C5954]">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#899770] inline-block border border-white shadow-2xs" />
            <span className="font-medium text-[#1A1918]">Текущая остановка</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#2E7D32] inline-block border border-white shadow-2xs" />
            <span>Пройдено</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#FAF8F5] border border-[#C69214] inline-block shadow-2xs" />
            <span>Предстоящая</span>
          </div>
          {hasBreak && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 bg-[#C69214] text-[10px]">
                ☕
              </span>
              <span>Отдых (Итальянский дворик)</span>
            </div>
          )}
        </div>

        {/* Factual Integrity Grounding Notice */}
        <div className="text-[11px] text-[#726E67] leading-relaxed pt-1 border-t border-[#EAE5DF]">
          <span className="font-semibold text-[#5C5954]">Официальный план Главного здания (Волхонка, 12). </span>
          <span>
            Режим B: показаны подтверждённые залы и порядок маршрута на официальной векторной схеме без сквозных линий через стены.
          </span>
        </div>
      </div>
    </div>
  );
}
