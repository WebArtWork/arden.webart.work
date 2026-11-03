// Rebuilds the web panoramas from the editable source layer.
//   originals:  sources/panoramas/originals/*.JPG     (untouched photos, equirectangular 2:1, sorted by file name)
//   retouched:  sources/panoramas/retouched/<same name>.{webp,png,jpg}  required editable source
//   output:     src/assets/sphere/pano-<n>.webp      default quality (2048x1024, q90)
//               src/assets/sphere/hq/pano-<n>.webp   HQ toggle      (4096x2048, q100)
//               src/assets/sphere/thumbs/pano-<n>.webp
// Run: npm run panoramas
// The n-th file (by name) becomes pano-<n>; keep SCENES in src/app/pages/virtual-tour/tour.data.ts in sync.
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const originalsDir = path.join(rootDir, 'sources/panoramas/originals');
const retouchedDir = path.join(rootDir, 'sources/panoramas/retouched');
const outDir = path.join(rootDir, 'src/assets/sphere');

const variants = [
	{ dir: '', width: 2048, quality: 90 },
	{ dir: 'hq', width: 4096, quality: 100 },
];

const files = (await readdir(originalsDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const retouched = (await readdir(retouchedDir)).filter((f) =>
	/\.(jpe?g|png|webp)$/i.test(f),
);

/** Resolve every editable source before changing any generated files. */
function pickSource(file) {
	const stem = path.parse(file).name;
	const matches = retouched.filter((f) => path.parse(f).name === stem);
	if (matches.length !== 1) {
		throw new Error(
			`Expected one retouched source for ${file}, found ${matches.length}. ` +
				'Run npm run panoramas:prepare for missing sources; keep only one file per photo stem.',
		);
	}
	return { source: path.join(retouchedDir, matches[0]), label: `retouched/${matches[0]}` };
}

if (!files.length) throw new Error('No original panoramas found.');
const sources = files.map(pickSource);

await rm(outDir, { recursive: true, force: true });
await mkdir(path.join(outDir, 'thumbs'), { recursive: true });
await mkdir(path.join(outDir, 'hq'), { recursive: true });

for (const [index, file] of files.entries()) {
	const id = `pano-${index + 1}`;
	const { source, label } = sources[index];
	const { width: sourceWidth } = await sharp(source).metadata();
	if (sourceWidth < variants[variants.length - 1].width) {
		console.warn(`  note: ${label} is only ${sourceWidth}px wide, so it is not upscaled to HQ size`);
	}
	for (const { dir, width, quality } of variants) {
		await sharp(source)
			.rotate()
			.resize(width, width / 2, { withoutEnlargement: true })
			.webp({ quality, smartSubsample: true })
			.toFile(path.join(outDir, dir, `${id}.webp`));
	}
	await sharp(source)
		.rotate()
		.resize(320, 180, { fit: 'cover' })
		.webp({ quality: 75 })
		.toFile(path.join(outDir, 'thumbs', `${id}.webp`));
	console.log(`${id} <- ${label}`);
}
