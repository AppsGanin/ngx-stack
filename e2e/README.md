# e2e

`swipe.e2e.mjs` drives a real browser through the whole surface: push, pop, an aborted swipe,
a completed swipe, the browser back button, `root()`, the imperative stack, and the
nested-stack case where an inner stack has to claim the edge gesture from the outer one.

It also asserts the things that are easy to get subtly wrong and impossible to notice in a
screenshot — that the dragged page tracks the finger 1:1 (a non-linear scrub is _the_ tell
that a swipe-back was done on the web), that the page underneath parallaxes at a third of the
speed, and that a buried page keeps its scroll offset.

Playwright is not a dependency of this workspace. To run it:

```bash
npm i -D playwright && npx playwright install chromium

ng build ngx-stack && ng build demo
node e2e/serve.mjs &          # serves dist/demo/browser on :4321 with SPA fallback
node e2e/swipe.e2e.mjs
```

Run it against the **built** demo, not `ng serve`: the demo imports the library from
`dist/ngx-stack` (see `tsconfig.json` paths), and rebuilding the library under a running dev
server races its file watcher.
