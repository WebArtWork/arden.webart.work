// Rebuilds the bottle overlay images shown in the virtual tour.
//   originals:  sources/bottles/originals/*.webp  (transparent product renders from panacea.market)
//   output:     src/assets/bottles/<product-id>.webp (300x450, alpha kept)
// Run: npm run bottles
// Product ids match the ids on the store (market.zbruchanskidzherela.com.ua/product/<id>)
// and BOTTLE_PRODUCTS in src/app/pages/virtual-tour/tour.data.ts.
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const originalsDir = path.join(rootDir, 'sources/bottles/originals');
const outDir = path.join(rootDir, 'src/assets/bottles');

const products = {
	'arden-1.webp': 'arden-can',
	'arden-2.webp': 'arden-glass',
	'diamond-1.webp': 'diamond-sparkling-can',
	'diamond-2.webp': 'diamond-light-can',
	'diamond-4.webp': 'diamond-light-glass',
	'diamond-5.webp': 'diamond-still-glass',
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const [file, id] of Object.entries(products)) {
	await sharp(path.join(originalsDir, file))
		.resize(300, 450, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.webp({ quality: 88 })
		.toFile(path.join(outDir, `${id}.webp`));
	console.log(`${id} <- ${file}`);
}
