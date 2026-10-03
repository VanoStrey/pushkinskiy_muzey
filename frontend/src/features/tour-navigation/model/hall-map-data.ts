/**
 * Grounded spatial metadata for the Main Building of Pushkin Museum (Volkhonka 12).
 * Centroids (cx, cy) are deterministically computed from official SVG floor plans
 * (/maps/main_1floor.svg and /maps/main_2floor.svg).
 */

export interface HallSpatialData {
  hallId: string;
  number: string;
  name: string;
  floor: 1 | 2;
  cx: number;
  cy: number;
}

export const FLOOR_VIEWBOX: Record<1 | 2, string> = {
  1: "0 0 3203.9 2322.7",
  2: "0 0 3203.8 2579",
};

export const HALL_SPATIAL_REGISTRY: Record<string, HallSpatialData> = {
  // --- 1 FLOOR (Залы 1–15) ---
  "186": {
    hallId: "186",
    number: "1",
    name: "Искусство Древнего Египта",
    floor: 1,
    cx: 1721.6,
    cy: 1984.9,
  },
  "187": {
    hallId: "187",
    number: "2",
    name: "Искусство Древнего Ближнего Востока",
    floor: 1,
    cx: 1247.9,
    cy: 1743.6,
  },
  "188": {
    hallId: "188",
    number: "3",
    name: "Троя и раскопки Генриха Шлимана",
    floor: 1,
    cx: 856.9,
    cy: 1352.3,
  },
  "189": {
    hallId: "189",
    number: "4",
    name: "Искусство античного мира. Кипр. Греция. Рим",
    floor: 1,
    cx: 556.8,
    cy: 1015.0,
  },
  "190": {
    hallId: "190",
    number: "5",
    name: "Искусство Северного Причерноморья",
    floor: 1,
    cx: 255.1,
    cy: 713.1,
  },
  "191": {
    hallId: "191",
    number: "6",
    name: "Эллинистический и римский Египет. Коптское искусство",
    floor: 1,
    cx: 1120.6,
    cy: 1210.3,
  },
  "192": {
    hallId: "192",
    number: "7",
    name: "Византийское искусство. Италия VIII–XVI вв.",
    floor: 1,
    cx: 523.5,
    cy: 523.4,
  },
  "193": {
    hallId: "193",
    number: "8",
    name: "Искусство Германии и Нидерландов XV–XVI веков",
    floor: 1,
    cx: 2778.3,
    cy: 1378.3,
  },
  "194": {
    hallId: "194",
    number: "9",
    name: "Искусство Фландрии XVII века",
    floor: 1,
    cx: 2580.6,
    cy: 923.8,
  },
  "195": {
    hallId: "195",
    number: "10",
    name: "Рембрандт и его школа",
    floor: 1,
    cx: 2207.2,
    cy: 577.2,
  },
  "196": {
    hallId: "196",
    number: "11",
    name: "Искусство Голландии XVII века",
    floor: 1,
    cx: 1906.0,
    cy: 310.3,
  },
  "197": {
    hallId: "197",
    number: "14",
    name: "Греческий дворик",
    floor: 1,
    cx: 1452.6,
    cy: 1603.7,
  },
  "198": {
    hallId: "198",
    number: "15",
    name: "Итальянский дворик (рекомендуемая зона отдыха)",
    floor: 1,
    cx: 2271.1,
    cy: 1154.8,
  },

  // --- 2 FLOOR (Залы 16–30) ---
  "199": {
    hallId: "199",
    number: "16",
    name: "Искусство Древней Греции",
    floor: 2,
    cx: 2013.0,
    cy: 967.7,
  },
  "200": {
    hallId: "200",
    number: "16a",
    name: "Искусство Эгейского мира",
    floor: 2,
    cx: 2049.6,
    cy: 1176.6,
  },
  "201": {
    hallId: "201",
    number: "17",
    name: "Искусство Италии XVII–XVIII веков (барокко)",
    floor: 2,
    cx: 1317.7,
    cy: 1025.6,
  },
  "202": {
    hallId: "202",
    number: "18",
    name: "Испанское и итальянское искусство XVII века",
    floor: 2,
    cx: 2606.1,
    cy: 1747.3,
  },
  "203": {
    hallId: "203",
    number: "19",
    name: "Выставочный зал",
    floor: 2,
    cx: 973.1,
    cy: 807.0,
  },
  "204": {
    hallId: "204",
    number: "20",
    name: "Выставочный зал",
    floor: 2,
    cx: 2444.2,
    cy: 2132.4,
  },
  "205": {
    hallId: "205",
    number: "21",
    name: "Искусство Франции XVII века",
    floor: 2,
    cx: 1893.6,
    cy: 2142.5,
  },
  "206": {
    hallId: "206",
    number: "22",
    name: "Искусство Франции XVIII века",
    floor: 2,
    cx: 1574.8,
    cy: 2325.5,
  },
  "207": {
    hallId: "207",
    number: "23",
    name: "Искусство Франции второй половины XVIII – нач. XIX в.",
    floor: 2,
    cx: 1247.8,
    cy: 2000.0,
  },
  "208": {
    hallId: "208",
    number: "24",
    name: "Греческое искусство поздней классики и эллинизма",
    floor: 2,
    cx: 1026.9,
    cy: 1511.1,
  },
  "209": {
    hallId: "209",
    number: "25",
    name: "Искусство Древней Италии и Древнего Рима",
    floor: 2,
    cx: 548.9,
    cy: 1276.0,
  },
  "210": {
    hallId: "210",
    number: "26",
    name: "Европейское искусство Средних веков",
    floor: 2,
    cx: 443.9,
    cy: 861.0,
  },
  "211": {
    hallId: "211",
    number: "27",
    name: "Нидерландская и немецкая скульптура XV–XVI вв.",
    floor: 2,
    cx: 879.5,
    cy: 599.2,
  },
  "212": {
    hallId: "212",
    number: "28",
    name: "Итальянская скульптура XV века",
    floor: 2,
    cx: 1373.3,
    cy: 325.7,
  },
  "213": {
    hallId: "213",
    number: "29",
    name: "Скульптура Микеланджело",
    floor: 2,
    cx: 1913.8,
    cy: 562.1,
  },
  "214": {
    hallId: "214",
    number: "30",
    name: "Белый зал (выставочный)",
    floor: 2,
    cx: 728.5,
    cy: 704.6,
  },
};

/**
 * Finds spatial metadata for a stop by hallId, falling back to hallNumber.
 */
export function getHallSpatialData(
  hallId?: string | null,
  hallNumber?: string | null
): HallSpatialData | null {
  if (hallId && HALL_SPATIAL_REGISTRY[hallId]) {
    return HALL_SPATIAL_REGISTRY[hallId];
  }
  if (hallNumber) {
    const cleanNum = hallNumber.replace(/^Зал\s*/i, "").trim();
    for (const data of Object.values(HALL_SPATIAL_REGISTRY)) {
      if (data.number === cleanNum) {
        return data;
      }
    }
  }
  return null;
}
