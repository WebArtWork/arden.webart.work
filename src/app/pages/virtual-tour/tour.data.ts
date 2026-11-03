export type PanoramaScene = {
	id: string;
	title: string;
	/** Типова якість: еквіректангулярна панорама 2:1, WebP 2048×1024, q90 */
	src: string;
	/** Висока якість (перемикач HQ): WebP 4096×2048, q100 */
	srcHq: string;
	thumb: string;
};

/** Стрілка переходу: yaw — напрямок у градусах (0 = центр панорами, за годинниковою стрілкою) */
export type SceneLink = { to: string; yaw: number };

/**
 * Сцени туру. Файли лежать у assets/sphere/<id>.webp (типова), assets/sphere/hq/<id>.webp (HQ) та assets/sphere/thumbs/<id>.webp.
 * Порядок = порядок мініатюр.
 */
export const SCENES: PanoramaScene[] = [
	{ id: 'pano-1', title: 'Холл' },
	{ id: 'pano-2', title: 'Холл, ліфти' },
	{ id: 'pano-3', title: 'Коридор, вихід' },
	{ id: 'pano-4', title: 'Коридор' },
	{ id: 'pano-5', title: 'Лікувальний зал' },
	{ id: 'pano-6', title: 'Лікувальний зал, інший ракурс' },
	{ id: 'pano-7', title: 'Лікувальний зал, кушетки' },
	{ id: 'pano-8', title: 'Коридор, інший ракурс' },
	{ id: 'pano-9', title: 'Процедурна, пост' },
	{ id: 'pano-10', title: 'Процедурна' },
	{ id: 'pano-11', title: 'Коридор, диван' },
	{ id: 'pano-12', title: 'Ігрова кімната' },
].map((scene) => ({
	...scene,
	src: `sphere/${scene.id}.webp`,
	srcHq: `sphere/hq/${scene.id}.webp`,
	thumb: `sphere/thumbs/${scene.id}.webp`,
}));

/**
 * Переходи між панорамами.
 * Налаштовується у режимі розміщення (/?edit): кнопка «Копіювати» віддає готовий код для вставки сюди.
 * Кожен перехід має бути двостороннім.
 */
export const TOUR_LINKS: Record<string, SceneLink[]> = {
	'pano-1': [{ to: 'pano-2', yaw: 261 }],
	'pano-2': [{ to: 'pano-1', yaw: 286 }, { to: 'pano-3', yaw: 19 }],
	'pano-3': [{ to: 'pano-2', yaw: 198 }, { to: 'pano-4', yaw: 11 }],
	'pano-4': [{ to: 'pano-3', yaw: 265 }, { to: 'pano-5', yaw: 176 }, { to: 'pano-8', yaw: 84 }],
	'pano-5': [{ to: 'pano-4', yaw: 62 }, { to: 'pano-7', yaw: 200 }],
	'pano-6': [{ to: 'pano-7', yaw: 151 }],
	'pano-7': [{ to: 'pano-5', yaw: 197 }, { to: 'pano-6', yaw: 331 }],
	'pano-8': [{ to: 'pano-4', yaw: 136 }, { to: 'pano-9', yaw: 228 }, { to: 'pano-11', yaw: 318 }],
	'pano-9': [{ to: 'pano-6', yaw: 121 }, { to: 'pano-10', yaw: 19 }],
	'pano-10': [{ to: 'pano-9', yaw: 243 }],
	'pano-11': [{ to: 'pano-8', yaw: 112 }, { to: 'pano-12', yaw: 29 }],
	'pano-12': [{ to: 'pano-11', yaw: 221 }],
};

/** Панорама — ціль кнопки «До виходу» (навігатор і автомаршрут) */
export const GUIDE_TARGET = 'pano-3';
/** Куди дивитися по прибутті */
export const GUIDE_TARGET_YAW = 0;

/** Товар Panacea, який можна розмістити в турі (id = id на market.zbruchanskidzherela.com.ua) */
export type BottleProduct = { id: string; title: string };

/** Фото: assets/bottles/<id>.webp (npm run bottles). Клік по пляшці веде на BOTTLE_SHOP_URL + id */
export const BOTTLE_PRODUCTS: BottleProduct[] = [
	{ id: 'arden-can', title: 'PANACEA Arden, 0,5 л, банка' },
	{ id: 'arden-glass', title: 'PANACEA Arden, 0,5 л, скло' },
	{ id: 'diamond-sparkling-can', title: 'PANACEA Diamond, сильногазована, банка' },
	{ id: 'diamond-light-can', title: 'PANACEA Diamond, слабогазована, банка' },
	{ id: 'diamond-light-glass', title: 'PANACEA Diamond, слабогазована, скло' },
	{ id: 'diamond-still-glass', title: 'PANACEA Diamond, негазована, скло' },
];

export const BOTTLE_SHOP_URL = 'https://market.zbruchanskidzherela.com.ua/product/';

/**
 * Пляшка в панорамі: yaw — напрямок (як у стрілок), pitch — кут до підлоги/столу, де стоїть основа
 * (0 = горизонт, мінус = вниз), scale — розмір (1 = типовий).
 */
export type BottlePlacement = { product: string; yaw: number; pitch: number; scale: number };

/**
 * Пляшки для збору: по одній на кожен товар, у різних панорамах. Клік по пляшці збирає її (зникає з туру,
 * прогрес у localStorage, лічильник n/6). Початкове розташування випадкове — підправляється в режимі
 * розміщення (/?edit): кнопка «Копіювати» віддає TOUR_LINKS і TOUR_BOTTLES для вставки сюди.
 * Збір рахується по товару (product), тому кожен товар має стояти в турі один раз.
 */
export const TOUR_BOTTLES: Record<string, BottlePlacement[]> = {};
