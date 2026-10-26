// Builds the static dev site into site/: bundles web/main.ts with the engine and copies static assets.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const outdir = 'site';
const sha = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
const buildInfo = `Build ${sha} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir);

await build({
  entryPoints: ['web/main.ts'],
  bundle: true,
  minify: true,
  target: 'es2020',
  outfile: `${outdir}/app.js`,
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
    // A browser key, public by design once shipped; restrict it by referrer and API in Google Cloud.
    __GOOGLE_MAPS_API_KEY__: JSON.stringify(process.env.GOOGLE_MAPS_API_KEY ?? ''),
  },
});

for (const f of ['index.html', 'styles.css']) cpSync(`web/${f}`, `${outdir}/${f}`);
console.log(`Built ${outdir}/ (${buildInfo}; maps: ${process.env.GOOGLE_MAPS_API_KEY ? 'Google' : 'keyless'})`);
