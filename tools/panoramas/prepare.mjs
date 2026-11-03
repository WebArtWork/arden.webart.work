// Seed editable source photos without ever overwriting existing retouches.
import { constants } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const originalsDir = path.join(rootDir, 'sources/panoramas/originals');
const retouchedDir = path.join(rootDir, 'sources/panoramas/retouched');
const isImage = (file) => /\.(jpe?g|png|webp)$/i.test(file);

await mkdir(retouchedDir, { recursive: true });
const originals = (await readdir(originalsDir)).filter(isImage).sort();
const retouched = (await readdir(retouchedDir)).filter(isImage);

for (const file of originals) {
	const stem = path.parse(file).name;
	if (retouched.some((candidate) => path.parse(candidate).name === stem)) continue;
	await copyFile(path.join(originalsDir, file), path.join(retouchedDir, file), constants.COPYFILE_EXCL);
	console.log(`Prepared retouched/${file}`);
}
