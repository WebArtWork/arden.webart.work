import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const outputDirs = [path.join(rootDir, 'dist/app/browser')];

const pages = [{ route: '/' }];

const company = await readJson('src/data/company/company.json');
const siteUrl = trimTrailingSlash(company.siteUrl || 'https://example.com');
const pageSeo = company.pageSeo ?? {};

const indexablePages = pages.filter(({ route }) => isIndexable(route, pageSeo));
const lastmod = new Date().toISOString().slice(0, 10);

await Promise.all(
	outputDirs.map(async (outputDir) => {
		await mkdir(outputDir, { recursive: true });
		await writeFile(
			path.join(outputDir, 'sitemap.xml'),
			buildSitemap(indexablePages, siteUrl, lastmod),
		);
		await writeFile(path.join(outputDir, 'robots.txt'), buildRobots(siteUrl));

		for (const { route } of pages) {
			await injectIntoHead(
				outputDir,
				route,
				buildHead(route, siteUrl, company),
			);
		}
	}),
);

function buildSitemap(pages, siteUrl, lastmod) {
	const urls = pages
		.map(
			({ route }) => `	<url>
		<loc>${escapeXml(toAbsoluteUrl(siteUrl, route))}</loc>
		<lastmod>${lastmod}</lastmod>
	</url>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRobots(siteUrl) {
	return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

/** JSON-LD, added to every prerendered page */
function buildHead(route, siteUrl, company) {
	const jsonLd = JSON.stringify(buildJsonLd(route, siteUrl, company)).replaceAll(
		'\\u003c',
		'\u003c',
	);

	return `<script type="application/ld+json">${jsonLd}</script>`;
}

function buildJsonLd(route, siteUrl, company) {
	const data = company.structuredData ?? {};
	const custom = data.custom ?? {};
	const seo = pageSeo[route] ?? company.defaultSeo ?? {};
	const pageUrl = toAbsoluteUrl(siteUrl, route);
	const image = toAbsoluteUrl(
		siteUrl,
		seo.image ?? company.defaultSeo?.image ?? company.image ?? '',
	);

	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': data.type || 'Organization',
				'@id': `${siteUrl}/#organization`,
				name: company.name,
				url: siteUrl,
				logo: toAbsoluteUrl(siteUrl, company.logo ?? ''),
				image,
				...(company.phone && { telephone: company.phone }),
				...(company.email && { email: company.email }),
				address: {
					'@type': 'PostalAddress',
					...(custom.streetAddress && { streetAddress: custom.streetAddress }),
					...(data.addressLocality && { addressLocality: data.addressLocality }),
					...(custom.addressRegion && { addressRegion: custom.addressRegion }),
					...(custom.postalCode && { postalCode: custom.postalCode }),
					...(data.addressCountry && { addressCountry: data.addressCountry }),
				},
				...(data.sameAs?.length && { sameAs: data.sameAs }),
			},
			{
				'@type': 'WebPage',
				'@id': `${pageUrl}#webpage`,
				url: pageUrl,
				name: seo.title ?? company.title,
				description: seo.description ?? company.description,
				inLanguage: 'uk',
				primaryImageOfPage: image,
				isPartOf: { '@id': `${siteUrl}/#organization` },
				about: { '@id': `${siteUrl}/#organization` },
			},
		],
	};
}

async function injectIntoHead(outputDir, route, html) {
	const file = path.join(outputDir, route === '/' ? '' : route, 'index.html');
	const page = await readFile(file, 'utf8').catch(() => null);

	if (page === null) {
		console.warn(`[seo] ${file} not found, skipping head injection`);
		return;
	}

	if (page.includes('application/ld+json')) {
		return;
	}

	const pageUrl = toAbsoluteUrl(siteUrl, route);
	const locale = company.locale || 'uk_UA';
	const updated = page
		.replace(/(<meta property="og:url" content=")[^"]*"/, `$1${pageUrl}"`)
		.replace(/(<meta property="og:locale" content=")[^"]*"/, `$1${locale}"`)
		.replace('</head>', `    ${html}\n  </head>`);

	await writeFile(file, updated);
}

function isIndexable(route, pageSeo) {
	const robots = pageSeo[route]?.robots;

	return typeof robots !== 'string' || !robots.toLowerCase().includes('noindex');
}

async function readJson(relativePath) {
	return JSON.parse(await readFile(path.join(rootDir, relativePath), 'utf8'));
}

function toAbsoluteUrl(siteUrl, route) {
	if (/^https?:\/\//.test(route)) {
		return route;
	}

	return `${siteUrl}${route === '/' ? '' : route.startsWith('/') ? route : `/${route}`}`;
}

function trimTrailingSlash(value) {
	return value.endsWith('/') ? value.slice(0, -1) : value;
}

function escapeXml(value) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}
