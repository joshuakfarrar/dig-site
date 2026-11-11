// Runs a JS expression in the game's web view on a connected Android tablet and prints the result:
// how the store purchases were tested from a computer. Debug builds only (MainActivity turns web
// debugging on just for them). First forward the web view's DevTools port, with the app running:
//   adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof io.github.joshuakfarrar.digsite)
// then, for example:
//   node tools/webview-eval.mjs "Capacitor.Plugins.Store.buy({id:'full_game'})"
// A promise is waited for (two minutes at most). Needs Node 22 or later (its built-in WebSocket).
const expr = process.argv[2];
const pages = await (await fetch("http://localhost:9222/json")).json();
const page = pages.find((p) => p.type === "page") ?? pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
const result = await new Promise((resolve) => {
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id === 1) resolve(d.result);
  };
  ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true, timeout: 120000 } }));
});
console.log(JSON.stringify(result.result?.value ?? result.exceptionDetails ?? result, null, 1));
ws.close();
