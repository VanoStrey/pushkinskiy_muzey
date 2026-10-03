import { RouteBuilder } from "@/features/route-builder";
import { apiUrl } from "@/shared/api";

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-7 bg-stone-50 px-4 py-10 text-stone-900 sm:px-8">
      <header className="grid gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-800">IT-Продлёнка · Пушкинский музей</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Соберите свой музейный маршрут</h1>
        <p className="max-w-2xl leading-relaxed text-stone-600">
          Укажите, для кого маршрут, интересы и доступное время. AI выберет экспонаты из официального каталога Главного здания.
        </p>
      </header>
      <RouteBuilder />
      <footer className="text-sm text-stone-500">
        <a href={apiUrl("/docs")} className="underline hover:text-stone-900">Документация API</a>
      </footer>
    </main>
  );
}
