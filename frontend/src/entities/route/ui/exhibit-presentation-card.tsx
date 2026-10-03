import {
  Frame,
  IconExternal,
  IconLookCloser,
  IconPlace,
  IconPlan,
  NeoButton,
  WallLabel,
} from "@/shared/ui";
import type { Stop } from "../model/types";
import { ArtworkImage } from "./artwork-image";

interface ExhibitPresentationCardProps {
  stop: Stop;
  totalStops?: number;
  onOpenMap?: () => void;
  compact?: boolean;
}

/**
 * The object in front of the visitor. The reproduction and its caption keep the
 * museum's rectangular geometry — a frame and a wall label — while everything
 * pressable around them stays soft.
 */
export function ExhibitPresentationCard({
  stop,
  totalStops,
  onOpenMap,
  compact = false,
}: ExhibitPresentationCardProps) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-surface)] bg-surface text-ink shadow-[var(--shadow-raised)]">
      {/* 1. Spatial status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="rounded-[var(--radius-pill)] bg-ground px-3 py-1 text-[11px] font-bold shadow-[var(--shadow-pressed-sm)]">
            {totalStops
              ? `Остановка ${stop.position} из ${totalStops}`
              : `Остановка ${stop.position}`}
          </span>
          {stop.location && (
            <span className="flex items-center gap-1 font-medium text-muted">
              <IconPlace size={14} className="shrink-0 text-accent" />
              <span>{stop.location}</span>
            </span>
          )}
        </div>

        {onOpenMap && (
          <NeoButton variant="quiet" onClick={onOpenMap} ariaLabel="Показать этот зал на схеме музея">
            <IconPlan size={15} />
            <span className="font-semibold">План этажа</span>
          </NeoButton>
        )}
      </div>

      {/* 2. The reproduction */}
      <div className="px-4 pb-4">
        <Frame>
          <ArtworkImage
            key={stop.image_url || stop.exhibit_id}
            src={stop.image_url}
            alt={stop.title}
            artist={stop.artist || "Автор не указан в данных музея"}
            className={`w-full ${compact ? "h-56 sm:h-64" : "h-72 sm:h-96"}`}
          />
        </Frame>
      </div>

      {/* 3. Body */}
      <div className="space-y-5 px-5 pb-6 sm:px-6">
        <div>
          <h1 className="font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {stop.title}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-muted sm:text-base">
            <span>{stop.artist || "Автор не указан в данных музея"}</span>
            {stop.date && (
              <>
                <span className="mx-2 text-faint">•</span>
                <span className="text-faint">{stop.date}</span>
              </>
            )}
          </p>
        </div>

        {/* 4. Why this object is in the route */}
        {stop.personalization_reason && stop.personalization_reason.trim() !== "" && (
          <div className="rounded-[var(--radius-control)] bg-ground p-4 shadow-[var(--shadow-pressed)]">
            <div className="wall-label mb-2 flex items-center gap-1.5 text-accent-ink">
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-accent" />
              <span>Почему выбран для вашего маршрута</span>
            </div>
            <p className="text-sm font-medium leading-relaxed text-ink">
              {stop.personalization_reason}
            </p>
          </div>
        )}

        {/* 5. Wall label: the catalog facts, set the way a museum sets them */}
        <div>
          <h2 className="wall-label mb-2.5">Этикетка</h2>
          <WallLabel
            items={[
              { term: "Автор", value: stop.artist },
              { term: "Датировка", value: stop.date },
              { term: "Местоположение", value: stop.location },
              { term: "Инв. номер", value: stop.provenance_source },
            ]}
          />
        </div>

        {/* 6. Description */}
        <div className="space-y-2">
          <h2 className="wall-label">Описание произведения</h2>
          <p className="text-sm leading-relaxed text-ink sm:text-base">{stop.description}</p>
          {stop.source_url && (
            <a
              href={stop.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-accent underline underline-offset-4 hover:text-accent-hover"
            >
              <span>Официальная карточка в каталоге ГМИИ им. А.С. Пушкина</span>
              <IconExternal size={13} />
            </a>
          )}
        </div>

        {/* 7. Curator tip */}
        {stop.look_closer && stop.look_closer.trim() !== "" && (
          <div className="rounded-[var(--radius-control)] bg-ground p-4 shadow-[var(--shadow-raised-sm)]">
            <div className="wall-label mb-1.5 flex items-center gap-2">
              <IconLookCloser size={16} />
              <span>Взгляните ближе: совет куратора</span>
            </div>
            <p className="text-sm leading-relaxed text-ink">{stop.look_closer}</p>
          </div>
        )}
      </div>
    </article>
  );
}
