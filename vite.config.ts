import { defineConfig, type Plugin } from "vite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The released game can't talk to anything: a Content Security Policy that allows only its own
 * files, and no network connections at all (no analytics, no ads, no chat, no links out). Only on
 * the built page; the dev server needs its live-reload socket.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function lockedDown(): Plugin {
  return {
    name: "dig-site-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(/<meta charset="UTF-8" \/>/i, (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

/**
 * Dev server only: lets the page save what it draws to `capture/` (not in git), for making the
 * promo video (`src/promo.ts`). POST /__capture/reset empties its frames; /__capture/frame/0001 saves a
 * JPEG; /__capture/audio saves the recorded music; /__capture/manifest the list of shots. Never
 * part of a build.
 */
function capture(): Plugin {
  const dir = resolve(__dirname, "capture");
  return {
    name: "dig-site-capture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__capture", (req, res) => {
        if (req.method !== "POST") return void res.writeHead(405).end();
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const url = req.url ?? "";
          if (url === "/reset") {
            // Just the frames: the recorded music stays.
            rmSync(resolve(dir, "frames"), { recursive: true, force: true });
            mkdirSync(resolve(dir, "frames"), { recursive: true });
          } else if (/^\/frame\/\d{4,5}$/.test(url)) writeFileSync(resolve(dir, "frames", `${url.slice(7)}.jpg`), Buffer.concat(chunks));
          else if (url === "/audio") writeFileSync(resolve(dir, "music.webm"), Buffer.concat(chunks));
          else if (url === "/manifest") writeFileSync(resolve(dir, "manifest.json"), Buffer.concat(chunks));
          else return void res.writeHead(404).end();
          res.writeHead(204).end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [lockedDown(), capture()],
  build: { chunkSizeWarningLimit: 900 },
});
