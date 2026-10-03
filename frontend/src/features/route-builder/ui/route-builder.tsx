import { useState, type FormEvent } from "react";

import { ApiError } from "@/shared/api";

import { generateRoute, type RouteResult } from "../api/generate-route";

export function RouteBuilder() {
  const [audience, setAudience] = useState("");
  const [interests, setInterests] = useState("");
  const [duration, setDuration] = useState(45);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const route = await generateRoute({
        audience: audience.trim(),
        interests: interests
          .split(",")
          .map((interest) => interest.trim())
          .filter(Boolean)
          .slice(0, 8),
        duration_minutes: duration,
        building_id: "116",
      });
      setResult(route);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Не удалось построить маршрут. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <label className="grid gap-2 text-sm font-medium text-stone-800">
          Для кого маршрут?
          <input
            required
            minLength={2}
            maxLength={120}
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="Например: подростки, которые впервые в музее"
            className="rounded-lg border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-stone-800">
          Что интересно? <span className="font-normal text-stone-500">Можно перечислить через запятую</span>
          <input
            maxLength={500}
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
            placeholder="Древний Египет, скульптура, мифы"
            className="rounded-lg border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="grid w-full gap-2 text-sm font-medium text-stone-800 sm:max-w-44">
            Сколько есть времени?
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={240}
                required
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
              />
              <span className="font-normal text-stone-500">мин</span>
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white transition hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Составляем маршрут…" : "Составить маршрут"}
          </button>
        </div>
      </form>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {error}
          {error.includes("YANDEX_FOLDER_ID") && (
            <p className="mt-2">Для генерации маршрута нужно настроить доступ бэкенда к Yandex AI Studio.</p>
          )}
        </div>
      )}

      {result && (
        <div className="grid gap-5">
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-stone-700">
            <p className="font-semibold text-stone-900">
              {result.building_name ?? "Здание музея"} · {result.duration_minutes} минут
            </p>
            <p className="mt-1">{result.explanation}</p>
            <p className="mt-2 text-xs">{result.availability_note}</p>
          </div>

          {result.stops.map(({ exhibit, reason, activity }, index) => (
            <article key={exhibit.id} className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 font-semibold text-amber-950">
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-stone-950">{exhibit.title ?? "Экспонат без названия"}</h2>
                  {exhibit.authors.length > 0 && <p className="mt-1 text-sm text-stone-600">{exhibit.authors.join(", ")}</p>}
                </div>
              </div>

              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {exhibit.date_text && <><dt className="text-stone-500">Дата</dt><dd>{exhibit.date_text}</dd></>}
                {exhibit.material && <><dt className="text-stone-500">Материал</dt><dd>{exhibit.material}</dd></>}
                {exhibit.hall && (
                  <>
                    <dt className="text-stone-500">Место</dt>
                    <dd>
                      {exhibit.hall.floor_number ? `${exhibit.hall.floor_number}-й этаж, ` : ""}
                      {exhibit.hall.number ? `зал ${exhibit.hall.number}` : "зал"}
                      {exhibit.hall.name ? ` — ${exhibit.hall.name}` : ""}
                    </dd>
                  </>
                )}
              </dl>

              <p className="text-sm leading-relaxed text-stone-700">{reason}</p>
              {exhibit.description && <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">{exhibit.description}</p>}
              {exhibit.annotation && <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">{exhibit.annotation}</p>}
              <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
                <span className="font-semibold">Задание-наблюдение: </span>{activity}
              </div>
              {exhibit.source_url && (
                <p className="text-xs text-stone-500">
                  Текст и сведения: Пушкинский музей. {exhibit.image_urls.length > 0 && "Изображения доступны на странице музея. "}
                  <a href={exhibit.source_url} target="_blank" rel="noreferrer" className="underline hover:text-stone-900">
                    Открыть карточку экспоната
                  </a>
                </p>
              )}
            </article>
          ))}
          {result.stops.length === 0 && <p className="rounded-xl border border-stone-200 bg-white p-5">Для этого здания нет подходящих записей в загруженном каталоге.</p>}
          <p className="text-xs text-stone-500">{result.usage_note}</p>
        </div>
      )}
    </section>
  );
}
