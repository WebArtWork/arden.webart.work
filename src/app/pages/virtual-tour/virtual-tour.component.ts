import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
	AfterViewInit,
	Component,
	ElementRef,
	HostListener,
	OnDestroy,
	PLATFORM_ID,
	ViewChild,
	computed,
	inject,
	signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { companyPhoneHref, companyProfile } from '../../feature/company/company.data';

import {
	BOTTLE_PRODUCTS,
	BOTTLE_SHOP_URL,
	BottlePlacement,
	GUIDE_TARGET,
	GUIDE_TARGET_YAW,
	PanoramaScene,
	SCENES,
	SceneLink,
	TOUR_BOTTLES,
	TOUR_LINKS,
} from './tour.data';

/** Пауза маршруту на старті та після прибуття (дивимось «звідки прийшли») */
const GUIDE_SETTLE = 500;
/** Пауза перед переходом, коли стрілка вже в центрі кадру */
const GUIDE_PAUSE = 1500;
/** Нахил погляду до стрілок на «підлозі» під час маршруту */
const GUIDE_LAT = -15;
/** Колір стрілки, що веде до цільової панорами (режим навігатора та маршрут) */
const GUIDE_ARROW_COLOR = 0x22c55e;

/** Пляшки — спрайти на сфері: відстань від камери, висота при scale=1 (світові одиниці), пропорція фото */
const BOTTLE_DISTANCE = 4;
const BOTTLE_HEIGHT = 0.6;
const BOTTLE_ASPECT = 300 / 450;
const BOTTLES_STORAGE_KEY = 'arden-tour-bottles';
const HQ_STORAGE_KEY = 'arden-tour-hq';
const MIN_FOV = 30;
const MAX_FOV = 90;
const DEFAULT_FOV = 75;
const MAX_LAT = 85;
/** Стрілки лежать на «підлозі»: відстань від камери та висота під нею */
const ARROW_DISTANCE = 3.2;
const ARROW_DEPTH = 1.2;
/** Зсув вказівника, після якого натискання вважається перетягуванням, а не кліком */
const CLICK_TOLERANCE = 6;

const normalizeYaw = (yaw: number) => ((Math.round(yaw) % 360) + 360) % 360;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Component({
	selector: 'app-virtual-tour',
	imports: [NgTemplateOutlet, TranslateDirective],
	templateUrl: './virtual-tour.component.html',
	styles: [
		`
			.tour-shell:fullscreen {
				height: 100vh;
				padding: 1rem;
				background: var(--color-dark);
				grid-template-rows: minmax(0, 1fr);
			}
			.tour-shell:fullscreen .tour-box {
				flex: 1;
				height: 100%;
				min-height: 0;
				max-height: none;
			}
			.tour-strip {
				scrollbar-width: none;
			}
			.tour-strip::-webkit-scrollbar {
				display: none;
			}
		`,
	],
})
export class VirtualTourComponent implements AfterViewInit, OnDestroy {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly _translate = inject(TranslateService);
	readonly logo = companyProfile.logo.replace(/^\//, '');
	readonly companyName = companyProfile.name;
	readonly company = companyProfile;
	readonly phoneHref = companyPhoneHref;
	introTitle = this._translate.translate('Віртуальний тур Arden Palace');
	introText = this._translate.translate(companyProfile.description);
	listTitle = this._translate.translate('Що можна побачити в турі');
	addressText = this._translate.translate(companyProfile.address);
	sceneLabels = SCENES.map((scene) => this._translate.translate(scene.title));
	enterFullscreenLabel = this._translate.translate('На весь екран');
	exitFullscreenLabel = this._translate.translate('Вийти з повноекранного режиму');
	prevLabel = this._translate.translate('Попередня панорама');
	nextLabel = this._translate.translate('Наступна панорама');
	zoomInLabel = this._translate.translate('Наблизити');
	zoomOutLabel = this._translate.translate('Віддалити');
	viewerLabel = this._translate.translate(
		'Панорама 360°. Перетягуйте або використовуйте стрілки, щоб роззирнутися.',
	);
	loadErrorLabel = this._translate.translate('Не вдалося завантажити панораму.');
	guidePlayLabel = this._translate.translate('Автоматичний маршрут до виходу');
	guideStopLabel = this._translate.translate('Зупинити маршрут');
	readonly guideTarget = GUIDE_TARGET;

	scenes: PanoramaScene[] = SCENES;
	/** Скільки мініатюр у лівій колонці (решта — у правій) */
	readonly sideSplit = Math.ceil(this.scenes.length / 2);

	/** Режим розміщення стрілок: /virtual-tour?edit. Нічого не зберігає — лише пише в консоль. */
	readonly editMode = inject(ActivatedRoute).snapshot.queryParamMap.has('edit');
	links = signal<Record<string, SceneLink[]>>(structuredClone(TOUR_LINKS));
	bottles = signal<Record<string, BottlePlacement[]>>(structuredClone(TOUR_BOTTLES));
	readonly bottleProducts = BOTTLE_PRODUCTS;
	bottleProduct = signal(BOTTLE_PRODUCTS[0].id);
	selectedBottle = signal<number | null>(null);
	/** Зібрані товари (product id) — зберігаються в localStorage */
	collected = signal<string[]>([]);
	/** Скільки різних пляшок розставлено в турі (у звичайному режимі = 6) */
	bottleTotal = computed(
		() => new Set(Object.values(this.bottles()).flatMap((list) => list.map((b) => b.product))).size,
	);
	collectedCount = computed(() => {
		const placed = new Set(
			Object.values(this.bottles()).flatMap((list) => list.map((b) => b.product)),
		);
		return this.collected().filter((id) => placed.has(id)).length;
	});
	allCollected = computed(() => this.bottleTotal() > 0 && this.collectedCount() >= this.bottleTotal());
	toast = signal<{ title: string; url: string; count: number; total: number } | null>(null);
	currentYaw = signal(0);
	editTarget = signal('');
	copied = signal(false);
	/** Панель режиму розміщення можна згорнути, щоб не закривала панораму */
	editPanelOpen = signal(true);

	activeIndex = signal(0);
	loading = signal(true);
	/** HQ-режим: панорами 4096×2048 q100 замість типових 2048×1024 q90 */
	hq = signal(false);
	hqLabel = this._translate.translate('Висока якість (HQ)');
	loadError = signal(false);
	isFullscreen = signal(false);
	canFullscreen = signal(false);
	/** Підказка «перетягніть» зникає після першої взаємодії */
	interacted = signal(false);
	ctrlHint = signal(false);
	hoveredArrow = signal<{ title: string; x: number; y: number } | null>(null);
	/** Автоматичний маршрут до виходу */
	guiding = signal(false);
	/** Навігатор: стрілка до виходу зелена, користувач іде сам */
	navigating = signal(false);

	@ViewChild('viewer', { static: false }) private viewerRef?: ElementRef<HTMLDivElement>;
	@ViewChild('viewerContainer', { static: false })
	private viewerContainerRef?: ElementRef<HTMLDivElement>;

	private threeApi?: typeof import('three');
	private camera?: import('three').PerspectiveCamera;
	private renderer?: import('three').WebGLRenderer;
	private material?: import('three').MeshBasicMaterial;
	private arrowGroup?: import('three').Group;
	private bottleGroup?: import('three').Group;
	private bottleTextures = new Map<string, import('three').Texture>();
	private shadowTexture?: import('three').CanvasTexture;
	private hoveredBottle?: BottlePlacement;
	/** Перетягування пляшки в режимі розміщення: індекс і зсув між курсором та основою пляшки */
	private draggingBottle: number | null = null;
	private dragOffset = { yaw: 0, pitch: 0 };
	private toastTimer?: ReturnType<typeof setTimeout>;
	private arrowAssets?: {
		shape: import('three').ShapeGeometry;
		hit: import('three').CircleGeometry;
		hitMaterial: import('three').MeshBasicMaterial;
	};
	private hoveredLink?: SceneLink;
	private resizeObserver?: ResizeObserver;
	private animationFrameId?: number;
	private ctrlHintTimer?: ReturnType<typeof setTimeout>;
	private loadToken = 0;
	private needsRender = true;
	private guideToken = 0;
	/** Плавний поворот камери (маршрут): анімується в циклі рендеру */
	private tween?: {
		fromLon: number;
		toLon: number;
		fromLat: number;
		toLat: number;
		start: number;
		duration: number;
		done: () => void;
	};

	// Напрямок погляду (у градусах) та інерція після відпускання
	private lon = 0;
	private lat = 0;
	private fov = DEFAULT_FOV;
	private velocityLon = 0;
	private velocityLat = 0;

	// Активні вказівники: один — обертання, два — масштабування пальцями
	private pointers = new Map<number, { x: number; y: number }>();
	private dragLast?: { x: number; y: number; time: number };
	private pinchStart?: { distance: number; fov: number };
	private pressStart?: { x: number; y: number };

	@HostListener('document:fullscreenchange')
	onFullscreenChange() {
		this.isFullscreen.set(document.fullscreenElement === this.viewerContainerRef?.nativeElement);
	}

	async ngAfterViewInit() {
		if (!isPlatformBrowser(this.platformId) || !this.viewerRef) return;

		this.canFullscreen.set(!!document.fullscreenEnabled);
		this.viewerRef.nativeElement.addEventListener('wheel', this.onWheel, { passive: false });

		await this.initThree();
		try {
			this.hq.set(localStorage.getItem(HQ_STORAGE_KEY) === '1');
			const saved = JSON.parse(localStorage.getItem(BOTTLES_STORAGE_KEY) ?? '[]');
			if (Array.isArray(saved)) {
				this.collected.set(saved.filter((id): id is string => typeof id === 'string'));
			}
		} catch {}
		this.loadScene(this.activeIndex());

		if (this.editMode) {
			console.info(
				'[virtual-tour] Режим розміщення: наведіть центр (+) на прохід, оберіть кімнату й натисніть «Додати стрілку». Нічого не зберігається.',
			);
			this.logLinks();
		}
	}

	ngOnDestroy() {
		this.stopGuide();
		if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
		clearTimeout(this.ctrlHintTimer);
		clearTimeout(this.toastTimer);
		this.viewerRef?.nativeElement.removeEventListener('wheel', this.onWheel);
		this.resizeObserver?.disconnect();
		this.clearArrows();
		this.clearBottles();
		this.bottleTextures.forEach((texture) => texture.dispose());
		this.shadowTexture?.dispose();
		this.arrowAssets?.shape.dispose();
		this.arrowAssets?.hit.dispose();
		this.arrowAssets?.hitMaterial.dispose();
		this.material?.map?.dispose();
		this.material?.dispose();
		this.renderer?.dispose();
	}

	selectScene(index: number, startLon = 0): Promise<void> {
		const count = this.scenes.length;
		const next = ((index % count) + count) % count;
		if (next === this.activeIndex() && !this.loadError()) return Promise.resolve();

		this.activeIndex.set(next);
		this.editTarget.set('');
		this.selectedBottle.set(null);
		const loaded = this.loadScene(next, startLon);
		// Прокручуємо лише видиму стрічку/колонку мініатюр, а не всю сторінку
		this.viewerContainerRef?.nativeElement
			.querySelectorAll<HTMLElement>(`[data-scene="${next}"]`)
			.forEach((thumb) => {
				const strip = thumb.parentElement;
				if (!strip?.offsetParent) return;
				strip.scrollTo({
					left: thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2,
					top: thumb.offsetTop - (strip.clientHeight - thumb.clientHeight) / 2,
					behavior: 'smooth',
				});
			});
		return loaded;
	}

	/** Веде по стрілках до цільової панорами: повертає камеру до стрілки, чекає секунду й переходить */
	async startGuide() {
		if (this.guiding()) {
			this.stopGuide();
			return;
		}
		const token = ++this.guideToken;
		const active = () => token === this.guideToken;
		this.guiding.set(true);
		this.interacted.set(true);
		this.syncArrows();

		try {
			// старт/прибуття → GUIDE_SETTLE → поворот до стрілки → GUIDE_PAUSE → перехід → …
			while (active() && !this.loadError()) {
				await delay(GUIDE_SETTLE);
				if (!active()) return;
				const from = this.scenes[this.activeIndex()].id;
				if (from === GUIDE_TARGET) break;
				const link = this.findPath(from, GUIDE_TARGET)?.[0];
				if (!link) break;

				await this.rotateTo(link.yaw, GUIDE_LAT);
				if (!active()) return;
				this.setHovered(link);
				await delay(GUIDE_PAUSE);
				if (!active()) return;
				await this.followLink(link);
			}
			if (active() && !this.loadError() && this.scenes[this.activeIndex()].id === GUIDE_TARGET) {
				await this.rotateTo(GUIDE_TARGET_YAW, 0);
			}
		} finally {
			if (active()) this.guiding.set(false);
		}
	}

	/** Зупиняє автоматичний маршрут і будь-який плавний поворот камери */
	stopGuide() {
		const tween = this.tween;
		this.tween = undefined;
		tween?.done();
		if (!this.guiding()) return;
		this.guideToken++;
		this.guiding.set(false);
		this.syncArrows();
	}

	toggleNavigator() {
		this.navigating.update((on) => !on);
		this.interacted.set(true);
		this.syncArrows();
	}

	/** Перемикає HQ і перезавантажує поточну панораму, не змінюючи напрямок погляду */
	toggleHq() {
		this.hq.update((on) => !on);
		try {
			localStorage.setItem(HQ_STORAGE_KEY, this.hq() ? '1' : '0');
		} catch {}
		this.loadScene(this.activeIndex(), 0, true);
	}

	zoom(delta: number) {
		this.setFov(this.fov + delta);
	}

	toggleFullscreen() {
		const container = this.viewerContainerRef?.nativeElement;
		if (!container) return;

		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			container.requestFullscreen();
		}
	}

	sceneTitle(id: string) {
		return this.scenes.find((scene) => scene.id === id)?.title ?? id;
	}

	currentLinks() {
		return this.links()[this.scenes[this.activeIndex()].id] ?? [];
	}

	addLink() {
		const from = this.scenes[this.activeIndex()].id;
		const to = this.editTarget();
		if (!to) return;

		const link = { to, yaw: normalizeYaw(this.lon) };
		this.links.update((links) => ({
			...links,
			[from]: [...(links[from] ?? []).filter((l) => l.to !== to), link],
		}));
		console.info(`[virtual-tour] + ${from} → ${to} @ ${link.yaw}°`);
		this.logLinks();
		this.syncArrows();
	}

	/** Копіює актуальні переходи й пляшки як готовий TS-код для tour.data.ts */
	async copyLinks() {
		const linkRows = Object.entries(this.links()).map(
			([from, list]) =>
				`\t'${from}': [${list.map((link) => `{ to: '${link.to}', yaw: ${link.yaw} }`).join(', ')}],`,
		);
		const bottleRows = Object.entries(this.bottles())
			.filter(([, list]) => list.length)
			.map(
				([from, list]) =>
					`\t'${from}': [${list
						.map(
							(b) =>
								`{ product: '${b.product}', yaw: ${b.yaw}, pitch: ${b.pitch}, scale: ${b.scale} }`,
						)
						.join(', ')}],`,
			);
		const code =
			`export const TOUR_LINKS: Record<string, SceneLink[]> = {\n${linkRows.join('\n')}\n};\n\n` +
			`export const TOUR_BOTTLES: Record<string, BottlePlacement[]> = {\n${bottleRows.join('\n')}\n};`;
		try {
			await navigator.clipboard.writeText(code);
			this.copied.set(true);
			setTimeout(() => this.copied.set(false), 1500);
		} catch {
			console.log(code);
		}
	}

	currentBottles() {
		return this.bottles()[this.scenes[this.activeIndex()].id] ?? [];
	}

	productTitle(id: string) {
		return BOTTLE_PRODUCTS.find((product) => product.id === id)?.title ?? id;
	}

	/** Ставить пляшку основою в центр кадру (+) */
	addBottle() {
		const list = this.currentBottles();
		this.updateBottles([
			...list,
			{
				product: this.bottleProduct(),
				yaw: normalizeYaw(this.lon),
				pitch: Math.round(this.lat),
				scale: 1,
			},
		]);
		this.selectedBottle.set(list.length);
		this.syncBottles();
	}

	/** Розкидає кілька випадкових пляшок по підлозі поточної панорами */
	randomBottles(count = 3) {
		const added = Array.from(
			{ length: count },
			(): BottlePlacement => ({
				product: BOTTLE_PRODUCTS[Math.floor(Math.random() * BOTTLE_PRODUCTS.length)].id,
				yaw: Math.floor(Math.random() * 360),
				pitch: -14 - Math.floor(Math.random() * 18),
				scale: 1,
			}),
		);
		this.updateBottles([...this.currentBottles(), ...added]);
		this.syncBottles();
	}

	selectBottle(index: number) {
		this.selectedBottle.set(this.selectedBottle() === index ? null : index);
		this.syncBottles();
	}

	/** Переносить пляшку в центр кадру (+) */
	moveBottleHere(index: number) {
		this.patchBottle(index, { yaw: normalizeYaw(this.lon), pitch: Math.round(this.lat) });
	}

	setBottleScale(index: number, scale: number) {
		this.patchBottle(index, { scale: Math.round(scale * 100) / 100 });
	}

	removeBottle(index: number) {
		this.updateBottles(this.currentBottles().filter((_, i) => i !== index));
		this.selectedBottle.set(null);
		this.syncBottles();
	}

	private patchBottle(index: number, patch: Partial<BottlePlacement>) {
		this.updateBottles(
			this.currentBottles().map((bottle, i) => (i === index ? { ...bottle, ...patch } : bottle)),
		);
		this.syncBottles();
	}

	private updateBottles(list: BottlePlacement[]) {
		const id = this.scenes[this.activeIndex()].id;
		this.bottles.update((all) => ({ ...all, [id]: list }));
	}

	removeLink(to: string) {
		const from = this.scenes[this.activeIndex()].id;
		this.links.update((links) => {
			const rest = (links[from] ?? []).filter((l) => l.to !== to);
			const next = { ...links, [from]: rest };
			if (!rest.length) delete next[from];
			return next;
		});
		console.info(`[virtual-tour] − ${from} → ${to}`);
		this.logLinks();
		this.syncArrows();
	}

	onPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		this.stopGuide();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (this.editMode && this.grabBottle(event.clientX, event.clientY)) return;
		this.pressStart = this.pointers.size === 1 ? { x: event.clientX, y: event.clientY } : undefined;
		this.velocityLon = 0;
		this.velocityLat = 0;
		this.interacted.set(true);
		this.resetGesture();
	}

	onPointerMove(event: PointerEvent) {
		if (!this.pointers.has(event.pointerId)) {
			if (event.pointerType === 'mouse') this.updateHover(event);
			return;
		}
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (this.draggingBottle !== null) {
			const at = this.pointerToYawPitch(event.clientX, event.clientY);
			if (at) {
				this.patchBottle(this.draggingBottle, {
					yaw: normalizeYaw(at.yaw + this.dragOffset.yaw),
					pitch: Math.max(-85, Math.min(85, at.pitch + this.dragOffset.pitch)),
				});
			}
			return;
		}

		if (this.pinchStart) {
			const distance = this.pinchDistance();
			if (distance > 0) this.setFov((this.pinchStart.fov * this.pinchStart.distance) / distance);
			return;
		}

		if (!this.dragLast) return;
		if (
			this.pressStart &&
			Math.hypot(event.clientX - this.pressStart.x, event.clientY - this.pressStart.y) >
				CLICK_TOLERANCE
		) {
			this.pressStart = undefined;
			this.setHovered(undefined);
		}
		// «Хапаємо» панораму: точка під курсором рухається разом із ним
		const degreesPerPixel = this.fov / (this.viewerRef?.nativeElement.clientHeight || 1);
		const dx = (event.clientX - this.dragLast.x) * degreesPerPixel;
		const dy = (event.clientY - this.dragLast.y) * degreesPerPixel;
		const now = performance.now();
		const dt = Math.max(now - this.dragLast.time, 1);

		this.lon -= dx;
		this.lat = this.clampLat(this.lat + dy);
		this.velocityLon = (-dx / dt) * 16;
		this.velocityLat = (dy / dt) * 16;
		this.dragLast = { x: event.clientX, y: event.clientY, time: now };
		this.needsRender = true;
	}

	onPointerUp(event: PointerEvent) {
		if (!this.pointers.delete(event.pointerId)) return;
		this.draggingBottle = null;
		// Якщо рух зупинився до відпускання — без інерції
		if (this.dragLast && performance.now() - this.dragLast.time > 80) {
			this.velocityLon = 0;
			this.velocityLat = 0;
		}
		// Натискання без перетягування — клік по стрілці
		if (event.type === 'pointerup' && this.pressStart && !this.pointers.size) {
			const bottle = this.bottleAt(event.clientX, event.clientY);
			if (bottle) {
				this.onBottleClick(bottle);
			} else {
				const link = this.linkAt(event.clientX, event.clientY);
				if (link) this.followLink(link);
			}
		}
		this.pressStart = undefined;
		this.resetGesture();
	}

	onPointerLeave() {
		if (!this.pointers.size) this.setHovered(undefined);
	}

	onKeydown(event: KeyboardEvent) {
		const step = 5;
		switch (event.key) {
			case 'ArrowLeft':
				this.lon -= step;
				break;
			case 'ArrowRight':
				this.lon += step;
				break;
			case 'ArrowUp':
				this.lat = this.clampLat(this.lat + step);
				break;
			case 'ArrowDown':
				this.lat = this.clampLat(this.lat - step);
				break;
			case '+':
			case '=':
				this.zoom(-10);
				break;
			case '-':
				this.zoom(10);
				break;
			case 'PageUp':
				this.selectScene(this.activeIndex() - 1);
				break;
			case 'PageDown':
				this.selectScene(this.activeIndex() + 1);
				break;
			default:
				return;
		}
		event.preventDefault();
		this.stopGuide();
		this.interacted.set(true);
		this.needsRender = true;
	}

	/** Колесо масштабує лише з Ctrl або в повноекранному режимі, щоб не перехоплювати прокрутку сторінки */
	private onWheel = (event: WheelEvent) => {
		if (!event.ctrlKey && !this.isFullscreen()) {
			this.ctrlHint.set(true);
			clearTimeout(this.ctrlHintTimer);
			this.ctrlHintTimer = setTimeout(() => this.ctrlHint.set(false), 1500);
			return;
		}
		event.preventDefault();
		this.ctrlHint.set(false);
		this.setFov(this.fov + event.deltaY * 0.05);
	};

	/** Найкоротший шлях по стрілках (BFS) */
	private findPath(from: string, to: string): SceneLink[] | undefined {
		const links = this.links();
		const queue: { id: string; path: SceneLink[] }[] = [{ id: from, path: [] }];
		const seen = new Set([from]);
		while (queue.length) {
			const { id, path } = queue.shift()!;
			if (id === to) return path;
			for (const link of links[id] ?? []) {
				if (seen.has(link.to)) continue;
				seen.add(link.to);
				queue.push({ id: link.to, path: [...path, link] });
			}
		}
		return undefined;
	}

	/** Плавно повертає камеру найкоротшим шляхом */
	private rotateTo(yaw: number, lat: number) {
		const delta = ((((yaw - this.lon) % 360) + 540) % 360) - 180;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.velocityLon = 0;
		this.velocityLat = 0;
		return new Promise<void>((done) => {
			this.tween = {
				fromLon: this.lon,
				toLon: this.lon + delta,
				fromLat: this.lat,
				toLat: lat,
				start: performance.now(),
				duration: reduceMotion ? 0 : Math.min(1800, 500 + Math.abs(delta) * 7),
				done,
			};
			this.needsRender = true;
		});
	}

	private followLink(link: SceneLink): Promise<void> {
		const index = this.scenes.findIndex((scene) => scene.id === link.to);
		if (index < 0) return Promise.resolve();

		// Дивимось у напрямку руху: протилежно до стрілки, що веде назад.
		// Без зворотної стрілки — у тому ж напрямку, куди йшли.
		const from = this.scenes[this.activeIndex()].id;
		const back = this.links()[link.to]?.find((l) => l.to === from);
		this.setHovered(undefined);
		return this.selectScene(index, back ? back.yaw + 180 : link.yaw);
	}

	private logLinks() {
		const links = this.links();
		console.log('[virtual-tour] TOUR_LINKS =\n' + JSON.stringify(links, null, '\t'));
		// Кожен перехід має бути двостороннім, інакше не знаємо, куди дивитися після прибуття
		const oneWay = Object.entries(links).flatMap(([from, list]) =>
			list
				.filter((link) => !links[link.to]?.some((back) => back.to === from))
				.map((link) => `${from} → ${link.to}`),
		);
		if (oneWay.length) {
			console.warn('[virtual-tour] Немає зворотної стрілки для: ' + oneWay.join(', '));
		}
	}

	private resetGesture() {
		const points = [...this.pointers.values()];
		this.pinchStart =
			points.length >= 2 ? { distance: this.pinchDistance(), fov: this.fov } : undefined;
		this.dragLast =
			points.length === 1 ? { ...points[0], time: performance.now() } : undefined;
	}

	private pinchDistance() {
		const [a, b] = [...this.pointers.values()];
		return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
	}

	private clampLat(lat: number) {
		return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
	}

	private setFov(fov: number) {
		this.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, fov));
		if (this.camera) {
			this.camera.fov = this.fov;
			this.camera.updateProjectionMatrix();
		}
		this.needsRender = true;
	}

	/** lon = 0 дивиться в центр еквіректангулярного кадру, додатній lon — поворот праворуч */
	private lonToTheta(lon: number) {
		return ((-90 - lon) * Math.PI) / 180;
	}

	private linkAt(clientX: number, clientY: number): SceneLink | undefined {
		if (!this.threeApi || !this.camera || !this.arrowGroup || !this.viewerRef) return;
		const THREE = this.threeApi;
		const rect = this.viewerRef.nativeElement.getBoundingClientRect();
		const pointer = new THREE.Vector2(
			((clientX - rect.left) / rect.width) * 2 - 1,
			-((clientY - rect.top) / rect.height) * 2 + 1,
		);
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(pointer, this.camera);
		const hit = raycaster.intersectObjects(this.arrowGroup.children, true)[0];
		return hit?.object.userData['link'] as SceneLink | undefined;
	}

	private updateHover(event: PointerEvent) {
		const bottle = this.bottleAt(event.clientX, event.clientY);
		if (bottle && this.viewerRef) {
			this.setHovered(undefined);
			this.hoveredBottle = bottle;
			const rect = this.viewerRef.nativeElement.getBoundingClientRect();
			this.viewerRef.nativeElement.style.cursor = 'pointer';
			this.hoveredArrow.set({
				title: this.productTitle(bottle.product),
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
			});
			return;
		}
		if (this.hoveredBottle) {
			this.hoveredBottle = undefined;
			this.hoveredArrow.set(null);
			if (this.viewerRef) this.viewerRef.nativeElement.style.cursor = '';
		}
		const link = this.linkAt(event.clientX, event.clientY);
		this.setHovered(link);
		if (link && this.viewerRef) {
			const rect = this.viewerRef.nativeElement.getBoundingClientRect();
			this.hoveredArrow.set({
				title: this.sceneTitle(link.to),
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
			});
		}
	}

	private setHovered(link: SceneLink | undefined) {
		if (link === this.hoveredLink) return;
		this.hoveredLink = link;
		if (!link) this.hoveredArrow.set(null);
		if (this.viewerRef) this.viewerRef.nativeElement.style.cursor = link ? 'pointer' : '';

		for (const arrow of this.arrowGroup?.children ?? []) {
			const active = arrow.userData['link'] === link;
			arrow.scale.setScalar(active ? 1.15 : 1);
			const fill = arrow.getObjectByName('fill') as import('three').Mesh | undefined;
			if (fill) (fill.material as import('three').MeshBasicMaterial).opacity = active ? 1 : 0.85;
		}
		this.needsRender = true;
	}

	/** Напрямок (yaw, pitch) під курсором — зворотне до розміщення пляшок на сфері */
	private pointerToYawPitch(clientX: number, clientY: number) {
		if (!this.threeApi || !this.camera || !this.viewerRef) return;
		const THREE = this.threeApi;
		const rect = this.viewerRef.nativeElement.getBoundingClientRect();
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(
			new THREE.Vector2(
				((clientX - rect.left) / rect.width) * 2 - 1,
				-((clientY - rect.top) / rect.height) * 2 + 1,
			),
			this.camera,
		);
		const d = raycaster.ray.direction;
		const theta = (Math.atan2(d.x, d.z) * 180) / Math.PI;
		const pitch = (Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI;
		return { yaw: normalizeYaw(-90 - theta), pitch: Math.round(pitch) };
	}

	/** Режим розміщення: натискання на пляшку вибирає її й дозволяє тягнути замість повороту панорами */
	private grabBottle(clientX: number, clientY: number) {
		const bottle = this.bottleAt(clientX, clientY);
		const index = bottle ? this.currentBottles().indexOf(bottle) : -1;
		const at = this.pointerToYawPitch(clientX, clientY);
		if (!bottle || index < 0 || !at) return false;

		this.draggingBottle = index;
		this.dragOffset = { yaw: bottle.yaw - at.yaw, pitch: bottle.pitch - at.pitch };
		this.selectedBottle.set(index);
		this.pressStart = undefined;
		this.velocityLon = 0;
		this.velocityLat = 0;
		this.syncBottles();
		return true;
	}

	private bottleAt(clientX: number, clientY: number): BottlePlacement | undefined {
		if (!this.threeApi || !this.camera || !this.bottleGroup || !this.viewerRef) return;
		const THREE = this.threeApi;
		const rect = this.viewerRef.nativeElement.getBoundingClientRect();
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(
			new THREE.Vector2(
				((clientX - rect.left) / rect.width) * 2 - 1,
				-((clientY - rect.top) / rect.height) * 2 + 1,
			),
			this.camera,
		);
		const hit = raycaster
			.intersectObjects(this.bottleGroup.children, false)
			.find((h) => h.object.userData['bottle']);
		return hit?.object.userData['bottle'] as BottlePlacement | undefined;
	}

	/** Звичайний режим — збирає пляшку; режим розміщення — вибирає пляшку для правки */
	private onBottleClick(bottle: BottlePlacement) {
		if (!this.editMode) {
			this.collectBottle(bottle);
			return;
		}
		const index = this.currentBottles().indexOf(bottle);
		if (index >= 0) this.selectBottle(index);
	}

	/** Збирає пляшку: вона зникає з туру, прогрес зберігається, показується підказка з посиланням у магазин */
	private collectBottle(bottle: BottlePlacement) {
		if (this.collected().includes(bottle.product)) return;
		this.collected.update((list) => [...list, bottle.product]);
		this.saveCollected();
		this.syncBottles();
		this.setHovered(undefined);
		this.hoveredArrow.set(null);
		if (this.viewerRef) this.viewerRef.nativeElement.style.cursor = '';

		this.toast.set({
			title: this.productTitle(bottle.product),
			url: BOTTLE_SHOP_URL + bottle.product,
			count: this.collectedCount(),
			total: this.bottleTotal(),
		});
		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toast.set(null), 6000);
	}

	/** Починає збір заново: усі пляшки повертаються в тур */
	resetBottles() {
		this.collected.set([]);
		this.saveCollected();
		this.toast.set(null);
		this.syncBottles();
	}

	private saveCollected() {
		try {
			localStorage.setItem(BOTTLES_STORAGE_KEY, JSON.stringify(this.collected()));
		} catch {}
	}

	private getBottleTexture(id: string) {
		let texture = this.bottleTextures.get(id);
		if (!texture && this.threeApi) {
			texture = new this.threeApi.TextureLoader().load(`bottles/${id}.webp`, () => {
				this.needsRender = true;
			});
			texture.colorSpace = this.threeApi.SRGBColorSpace;
			this.bottleTextures.set(id, texture);
		}
		return texture;
	}

	/** М'яка еліптична «контактна тінь» під основою пляшки */
	private getShadowTexture() {
		if (!this.shadowTexture && this.threeApi) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 128;
			const ctx = canvas.getContext('2d')!;
			const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
			gradient.addColorStop(0, 'rgba(255,255,255,1)');
			gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)');
			gradient.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, 128, 128);
			this.shadowTexture = new this.threeApi.CanvasTexture(canvas);
		}
		return this.shadowTexture;
	}

	private clearBottles() {
		if (!this.bottleGroup) return;
		for (const sprite of [...this.bottleGroup.children]) {
			(sprite as import('three').Sprite).material.dispose();
			this.bottleGroup.remove(sprite);
		}
		this.hoveredBottle = undefined;
	}

	/** Перебудовує пляшки поточної панорами: основа стоїть у точці (yaw, pitch) */
	private syncBottles() {
		if (!this.threeApi || !this.bottleGroup) return;
		const THREE = this.threeApi;
		this.clearBottles();
		const selected = this.editMode ? this.selectedBottle() : null;
		const hidden = this.editMode ? null : new Set(this.collected());

		this.currentBottles().forEach((bottle, index) => {
			if (hidden?.has(bottle.product)) return;
			const height = BOTTLE_HEIGHT * bottle.scale;
			const width = height * BOTTLE_ASPECT;
			const position = new THREE.Vector3().setFromSphericalCoords(
				BOTTLE_DISTANCE,
				((90 - bottle.pitch) * Math.PI) / 180,
				this.lonToTheta(bottle.yaw),
			);

			const shadow = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: this.getShadowTexture(),
					color: index === selected ? 0xc9a45c : 0x000000,
					transparent: true,
					opacity: index === selected ? 0.95 : 0.45,
					depthTest: false,
				}),
			);
			shadow.position.copy(position);
			shadow.scale.set(width * 1.9, width * 0.55, 1);
			shadow.renderOrder = 1;

			const sprite = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: this.getBottleTexture(bottle.product),
					transparent: true,
					depthTest: false,
				}),
			);
			sprite.center.set(0.5, 0);
			sprite.position.copy(position);
			sprite.scale.set(width, height, 1);
			sprite.renderOrder = 2;
			sprite.userData['bottle'] = bottle;

			this.bottleGroup!.add(shadow, sprite);
		});
		this.needsRender = true;
	}

	private clearArrows() {
		if (!this.arrowGroup) return;
		for (const arrow of [...this.arrowGroup.children]) {
			arrow.traverse((child) => {
				const material = (child as import('three').Mesh).material as
					| import('three').Material
					| undefined;
				if (material && material !== this.arrowAssets?.hitMaterial) material.dispose();
			});
			this.arrowGroup.remove(arrow);
		}
		this.hoveredLink = undefined;
		this.hoveredArrow.set(null);
	}

	/** Перебудовує стрілки поточної панорами (шеврони на «підлозі», як у Street View) */
	private syncArrows() {
		if (!this.threeApi || !this.arrowGroup || !this.arrowAssets) return;
		const THREE = this.threeApi;
		this.clearArrows();

		const from = this.scenes[this.activeIndex()].id;
		const next =
			this.guiding() || this.navigating() ? this.findPath(from, GUIDE_TARGET)?.[0] : undefined;

		for (const link of this.currentLinks()) {
			const arrow = new THREE.Group();
			arrow.userData['link'] = link;
			arrow.rotation.y = this.lonToTheta(link.yaw) + Math.PI;

			const pivot = new THREE.Group();
			pivot.position.set(0, -ARROW_DEPTH, -ARROW_DISTANCE);
			arrow.add(pivot);

			const shadow = new THREE.Mesh(
				this.arrowAssets.shape,
				new THREE.MeshBasicMaterial({
					color: 0x000000,
					transparent: true,
					opacity: 0.35,
					depthTest: false,
					side: THREE.DoubleSide,
				}),
			);
			shadow.position.set(0, -0.01, 0.04);
			shadow.scale.setScalar(1.12);
			shadow.renderOrder = 1;

			const fill = new THREE.Mesh(
				this.arrowAssets.shape,
				new THREE.MeshBasicMaterial({
					color: link === next ? GUIDE_ARROW_COLOR : 0xffffff,
					transparent: true,
					opacity: 0.85,
					depthTest: false,
					side: THREE.DoubleSide,
				}),
			);
			fill.name = 'fill';
			fill.renderOrder = 2;

			// Невидима, але більша зона кліку
			const hit = new THREE.Mesh(this.arrowAssets.hit, this.arrowAssets.hitMaterial);

			for (const mesh of [shadow, fill, hit]) {
				mesh.userData['link'] = link;
				pivot.add(mesh);
			}
			this.arrowGroup.add(arrow);
		}
		this.needsRender = true;
	}

	private async initThree() {
		const THREE = await import('three');
		this.threeApi = THREE;

		const container = this.viewerRef!.nativeElement;
		const width = container.clientWidth;
		const height = container.clientHeight;

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(this.fov, width / height, 0.1, 1100);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.domElement.style.display = 'block';
		container.appendChild(renderer.domElement);

		// Камера в центрі сфери, текстура дзеркалиться всередину
		const geometry = new THREE.SphereGeometry(500, 60, 40);
		geometry.scale(-1, 1, 1);
		const material = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
		scene.add(new THREE.Mesh(geometry, material));

		// Шеврон у площині XY, вістрям до +Y; після повороту лежить на підлозі вістрям до −Z
		const chevron = new THREE.Shape();
		chevron.moveTo(0, 0.35);
		chevron.lineTo(0.45, -0.1);
		chevron.lineTo(0.45, -0.3);
		chevron.lineTo(0, 0.1);
		chevron.lineTo(-0.45, -0.3);
		chevron.lineTo(-0.45, -0.1);
		chevron.closePath();
		const shape = new THREE.ShapeGeometry(chevron);
		shape.rotateX(-Math.PI / 2);
		const hit = new THREE.CircleGeometry(0.6, 24);
		hit.rotateX(-Math.PI / 2);
		const hitMaterial = new THREE.MeshBasicMaterial({
			transparent: true,
			opacity: 0,
			depthTest: false,
			depthWrite: false,
			side: THREE.DoubleSide,
		});
		this.arrowAssets = { shape, hit, hitMaterial };

		const arrowGroup = new THREE.Group();
		scene.add(arrowGroup);
		const bottleGroup = new THREE.Group();
		scene.add(bottleGroup);

		this.camera = camera;
		this.renderer = renderer;
		this.material = material;
		this.arrowGroup = arrowGroup;
		this.bottleGroup = bottleGroup;

		this.resizeObserver = new ResizeObserver(() => this.onResize());
		this.resizeObserver.observe(container);

		const target = new THREE.Vector3();
		const animate = () => {
			this.animationFrameId = requestAnimationFrame(animate);

			if (this.tween) {
				const { fromLon, toLon, fromLat, toLat, start, duration, done } = this.tween;
				const t = duration ? Math.min((performance.now() - start) / duration, 1) : 1;
				const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
				this.lon = fromLon + (toLon - fromLon) * eased;
				this.lat = fromLat + (toLat - fromLat) * eased;
				this.needsRender = true;
				if (t >= 1) {
					this.tween = undefined;
					done();
				}
			} else if (!this.dragLast && !this.pinchStart) {
				if (Math.abs(this.velocityLon) > 0.01 || Math.abs(this.velocityLat) > 0.01) {
					this.lon += this.velocityLon;
					this.lat = this.clampLat(this.lat + this.velocityLat);
					this.velocityLon *= 0.92;
					this.velocityLat *= 0.92;
					this.needsRender = true;
				}
			}
			if (!this.needsRender) return;
			this.needsRender = false;

			if (this.editMode) this.currentYaw.set(normalizeYaw(this.lon));
			target.setFromSphericalCoords(
				1,
				((90 - this.lat) * Math.PI) / 180,
				this.lonToTheta(this.lon),
			);
			camera.lookAt(target);
			renderer.render(scene, camera);
		};
		animate();
	}

	private onResize() {
		if (!this.renderer || !this.camera || !this.viewerRef) return;
		const container = this.viewerRef.nativeElement;
		const width = container.clientWidth;
		const height = container.clientHeight;
		if (width === 0 || height === 0) return;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.needsRender = true;
	}

	private async loadScene(index: number, startLon = 0, keepView = false) {
		if (!this.threeApi || !this.material || !this.renderer) return;
		const THREE = this.threeApi;
		const token = ++this.loadToken;

		this.loading.set(true);
		this.loadError.set(false);

		try {
			const texture = await new THREE.TextureLoader().loadAsync(
				this.hq() ? this.scenes[index].srcHq : this.scenes[index].src,
			);
			if (token !== this.loadToken) {
				texture.dispose();
				return;
			}
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

			// Не тримаємо попередні текстури: 8K-панорама займає сотні МБ відеопамʼяті
			this.material.map?.dispose();
			this.material.map = texture;
			this.material.color.set(0xffffff);
			this.material.needsUpdate = true;

			if (keepView) {
				this.needsRender = true;
				return;
			}
			this.lon = startLon;
			this.lat = 0;
			this.velocityLon = 0;
			this.velocityLat = 0;
			this.setFov(DEFAULT_FOV);
			this.syncArrows();
			this.syncBottles();

			// Навігатор довів до місця: вимикаємо й показуємо робоче місце (маршрут робить це сам)
			if (this.navigating() && this.scenes[index].id === GUIDE_TARGET) {
				this.navigating.set(false);
				if (!this.guiding()) this.rotateTo(GUIDE_TARGET_YAW, 0);
			}
		} catch {
			if (token === this.loadToken) this.loadError.set(true);
		} finally {
			if (token === this.loadToken) this.loading.set(false);
		}
	}
}
