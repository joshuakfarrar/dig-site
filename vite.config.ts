import { defineConfig, type Plugin } from "vite";

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

export default defineConfig({
  plugins: [lockedDown()],
  build: { chunkSizeWarningLimit: 900 },
});
