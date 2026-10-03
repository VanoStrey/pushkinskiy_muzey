import { useEffect, useState } from "react";

interface ArtworkImageProps {
  src: string | null;
  alt: string;
  artist: string;
  className?: string;
  showMagnifyButton?: boolean;
  compact?: boolean;
}

export function ArtworkImage({
  src,
  alt,
  artist,
  className = "",
  showMagnifyButton = true,
  compact = false,
}: ArtworkImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Official React pattern: adjust state during render when a prop changes
  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
    setIsLoading(true);
  }

  // Handle escape key and body scroll lock for zoom modal
  useEffect(() => {
    if (!isZoomed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsZoomed(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isZoomed]);

  return (
    <>
      <div
        className={`relative overflow-hidden bg-[#ECE6DF] flex items-center justify-center border border-[#E3DDD4] select-none ${className}`}
      >
        {/* Loading skeleton */}
        {isLoading && !hasError && src && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#ECE6DF] via-[#F4EFEB] to-[#ECE6DF] animate-pulse"
          />
        )}

        {/* Real image */}
        {src && !hasError ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={`w-full h-full object-contain transition-transform duration-500 ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
          />
        ) : (
          /* Graceful museum placeholder if image missing or blocked */
          <div
            className={`text-center flex flex-col items-center justify-center h-full w-full ${
              compact ? "p-1.5 max-w-full" : "p-4 sm:p-6 max-w-sm"
            }`}
          >
            <div
              className={`rounded-full border border-[#D5CDC2] flex items-center justify-center text-[#9E2A2B] shrink-0 ${
                compact ? "w-7 h-7 mb-1" : "w-12 h-12 mb-3"
              }`}
            >
              <svg
                className={compact ? "w-3.5 h-3.5" : "w-6 h-6"}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p
              className={`font-serif text-[#1A1918] font-semibold leading-tight line-clamp-2 ${
                compact ? "text-[10px]" : "text-base sm:text-lg"
              }`}
            >
              {alt}
            </p>
            <p
              className={`text-[#726E67] font-sans uppercase tracking-wider line-clamp-1 ${
                compact ? "text-[8px] mt-0.5" : "text-xs mt-1"
              }`}
            >
              {artist}
            </p>
            {!compact && (
              <span className="text-[11px] text-[#A29C93] mt-2 border-t border-[#D5CDC2] pt-2">
                Оригинал в экспозиции ГМИИ им. А.С. Пушкина
              </span>
            )}
          </div>
        )}

        {/* Magnify button */}
        {src && !hasError && showMagnifyButton && !isLoading && (
          <button
            type="button"
            onClick={() => setIsZoomed(true)}
            aria-label={`Рассмотреть детально: ${alt}`}
            className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-[#1A1918] px-2.5 py-1.5 rounded text-xs font-medium shadow-sm backdrop-blur-sm flex items-center gap-1.5 transition-all border border-[#E3DDD4] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
            title="Рассмотреть в высоком разрешении"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
              />
            </svg>
            <span>Детали</span>
          </button>
        )}
      </div>

      {/* Modal Zoom View */}
      {isZoomed && src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Просмотр произведения: ${alt}`}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="flex items-center justify-between text-white/90 mb-2 max-w-5xl mx-auto w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pr-4">
              <p className="font-serif text-base sm:text-lg font-medium">{alt}</p>
              <p className="text-xs text-white/70">{artist}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              aria-label="Закрыть полноэкранный просмотр"
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center overflow-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-[85vh] max-w-full object-contain rounded shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
