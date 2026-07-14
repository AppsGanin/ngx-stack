import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const OUT = new URL('.', import.meta.url).pathname;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

page.on('pageerror', (e) => console.log('!! PAGE ERROR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('!! CONSOLE ERROR:', m.text());
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const INBOX = ['demo-inbox', 'demo-item', 'demo-notes', 'demo-starred'];
const SEARCH = ['demo-search', 'demo-result'];

/** Every mounted page, across every tab. */
const allPages = () =>
  page.$$eval('.ngx-stack-page', (els) =>
    els.map((e) => ({
      tag: e.firstElementChild.tagName.toLowerCase(),
      x: Math.round(new DOMMatrix(getComputedStyle(e).transform).m41),
      hidden: e.classList.contains('ngx-stack-page--hidden'),
      scrim: Number(getComputedStyle(e.querySelector('.ngx-stack-scrim')).opacity).toFixed(2),
    })),
  );

const countIn = async (tags) => (await allPages()).filter((p) => tags.includes(p.tag)).length;
const visible = async () => (await allPages()).filter((p) => !p.hidden).map((p) => p.tag);
const lastTransition = () => page.evaluate(() => window.__lastTransition);

/**
 * Wait for the stack to stop moving.
 *
 * `min` is a floor, not the wait: after it, this blocks until nothing carries the `--animating`
 * class, which the controller only drops once the transition has finished, the popped page has been
 * destroyed and the router has landed.
 *
 * Sleeping a fixed number of milliseconds is how you get a suite that is green on your laptop and
 * red on a shared runner — which is exactly what happened here. The swipe's commit chain (settle the
 * animation → history.back() → re-activate → destroy the page) fits comfortably in 900ms on this
 * machine and does not on a 2-core CI box, and the test had no way to tell "not finished" from
 * "did not happen".
 */
const settle = async (min = 600) => {
  await page.waitForTimeout(min);
  await page.waitForFunction(
    () => document.querySelectorAll('.ngx-stack-page--animating').length === 0,
    null,
    { timeout: 15_000 },
  );
};

/** Drag from the leading edge all the way across. `rtl` starts at the right instead. */
const swipe = async ({ rtl = false, to } = {}) => {
  const from = rtl ? 386 : 4;
  const target = to ?? (rtl ? 60 : 330);
  await page.mouse.move(from, 500);

  // What the mousedown is about to land on. The gesture listens on the outlet, so this has to be an
  // element inside it — an `inert` ancestor, or anything that swallows the event, and the drag never
  // starts at all.
  const under = await page.evaluate((x) => {
    const el = document.elementFromPoint(x, 500);
    const inertAncestor = el?.closest('[inert]');
    return `${el?.tagName.toLowerCase()}.${el?.className || '-'}${inertAncestor ? ' ← INSIDE [inert]' : ''}`;
  }, from);

  await page.mouse.down();
  await page.mouse.move(rtl ? from - 16 : from + 16, 500, { steps: 2 });
  await page.mouse.move(target, 500, { steps: 10 });

  // Look at the pages while the button is still down. If nothing has moved, the gesture never armed
  // — a different bug from one that armed and then snapped back, and the two are indistinguishable
  // once the mouse is up.
  const dragging = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('.ngx-stack-page')].map((e) => {
      const x = Math.round(new DOMMatrix(getComputedStyle(e).transform).m41);
      return `${e.firstElementChild.tagName.toLowerCase()}@${x}${e.inert ? ' INERT' : ''}${
        e.classList.contains('ngx-stack-page--hidden') ? ' hidden' : ''
      }`;
    });
    return pages.join(', ');
  });

  await page.mouse.up();
  await settle(400);
  return `${dragging} | mousedown hit: ${under}`;
};

const tab = (name) => page.locator(`[data-tab=${name}]`).click();

/** Every page of every tab stays mounted, so scope clicks to the one actually on screen. */
const onTop = (sel) => page.locator(`.ngx-stack-page:not(.ngx-stack-page--hidden) ${sel}`);

/** Go to a tab and unwind it to its root — tapping the tab you're already on does that. */
const tabRoot = async (name) => {
  await tab(name);
  await settle(600);
  await tab(name);
  await settle(800);
};

// ---------------------------------------------------------------------------

await page.goto(`${BASE}/inbox`);
await page.waitForSelector('.ngx-stack-page demo-inbox');

check('root page mounts', (await countIn(INBOX)) === 1);
check('root URL is /inbox', page.url().endsWith('/inbox'));

// ------------------------------------------------------------- scroll state
await page.evaluate(() => (document.querySelector('demo-inbox').scrollTop = 420));

// -------------------------------------------------------------------- push
await page.getByText('Message 12', { exact: true }).click();
await settle(700);
check('push navigated', page.url().endsWith('/inbox/item/12'), page.url());
check('two pages mounted', (await countIn(INBOX)) === 2);
check(
  'only the top page is visible',
  JSON.stringify(await visible()) === JSON.stringify(['demo-item']),
  JSON.stringify(await visible()),
);

const pushEvent = await lastTransition();
check(
  'transitionEnd fired with the right shape',
  pushEvent?.direction === 'forward' && pushEvent.tab === 'inbox' && pushEvent.animated === true,
  JSON.stringify(pushEvent),
);

// ---------------------------------------------------------- component state
await page.locator('demo-item input').fill('survives everything');

// -------------------------------------------------- swipe back, mid-flight
await page.mouse.move(4, 500);
await page.mouse.down();
await page.mouse.move(20, 500, { steps: 2 });
await page.mouse.move(195, 500, { steps: 8 }); // ~50% across a 390px viewport
await page.waitForTimeout(60);

const mid = await allPages();
await page.screenshot({ path: `${OUT}/mid-swipe.png` });

const item = mid.find((p) => p.tag === 'demo-item');
const inbox = mid.find((p) => p.tag === 'demo-inbox');
check(
  'mid-swipe: top page follows the finger 1:1',
  Math.abs(item.x - 191) <= 12,
  `finger moved 191px, page at ${item.x}px`,
);
check(
  'mid-swipe: page underneath parallaxes at ~1/3 speed',
  inbox.x < -40 && inbox.x > -80,
  `inbox at ${inbox.x}px (expect ~-64px)`,
);
check(
  'mid-swipe: scrim fades as the page is uncovered',
  Number(inbox.scrim) > 0.04 && Number(inbox.scrim) < 0.14,
  `opacity=${inbox.scrim}`,
);

// ------------------------------------------------------------ abort a swipe
await page.mouse.move(15, 500, { steps: 8 });
await page.mouse.up();
await settle(700);
check('abort: stayed put', page.url().endsWith('/inbox/item/12'), page.url());
check(
  'abort: page underneath hidden again',
  (await allPages()).find((p) => p.tag === 'demo-inbox').hidden,
);

// --------------------------------------------------------- complete a swipe
const dragging = await swipe();
check(
  'swipe back: URL popped',
  page.url().endsWith('/inbox'),
  `${page.url()} | mid-drag: ${dragging}`,
);
check('swipe back: popped page destroyed', (await countIn(INBOX)) === 1);
const scroll = await page.evaluate(() => document.querySelector('demo-inbox').scrollTop);
check('swipe back: scroll preserved', scroll === 420, `scrollTop=${scroll}`);

const swipeEvent = await lastTransition();
check(
  'transitionEnd reports the swipe as interactive',
  swipeEvent?.direction === 'back' && swipeEvent.interactive === true,
  JSON.stringify(swipeEvent),
);

// ===========================================================================
// TABS — independent stacks
// ===========================================================================

await page.getByText('Message 7', { exact: true }).click();
await settle(600);
await page.locator('demo-item input').fill('draft on item 7');
await page.locator('button', { hasText: 'Push a third page' }).click();
await settle(700);
check('inbox is three deep', (await countIn(INBOX)) === 3);

await tab('search');
await settle(600);
check('tab switch: URL moved to search', page.url().endsWith('/search'), page.url());
check(
  'tab switch: search page visible',
  JSON.stringify(await visible()) === JSON.stringify(['demo-search']),
);
check(
  "tab switch: inbox's 3 pages are STILL MOUNTED, just hidden",
  (await countIn(INBOX)) === 3,
  `inbox pages in DOM: ${await countIn(INBOX)}`,
);

const switchEvent = await lastTransition();
check(
  'tab switch is not animated (it is a cut, not a push)',
  switchEvent?.animated === false && switchEvent.tab === 'search',
  JSON.stringify(switchEvent),
);

await page.locator('[data-test=query]').fill('hello from search');
await page.getByText('Result 3', { exact: true }).click();
await settle(700);
check('search has its own stack', (await countIn(SEARCH)) === 2);
check('inbox stack untouched by search', (await countIn(INBOX)) === 3);

await tab('inbox');
await settle(600);
check('back to inbox: still three deep', (await countIn(INBOX)) === 3);
check(
  'back to inbox: landed where we left it',
  page.url().endsWith('/inbox/item/7/notes'),
  page.url(),
);
check(
  'back to inbox: the buried message draft survived a tab round-trip',
  (await page.locator('demo-item input').inputValue()) === 'draft on item 7',
);

await tab('search');
await settle(600);
check(
  'NgxStackTabs remembered where search was',
  page.url().endsWith('/search/result/3'),
  page.url(),
);
check(
  'search query survived too',
  (await page.locator('[data-test=query]').inputValue()) === 'hello from search',
);

// A swipe inside a tab pops that tab's stack, not the tab itself.
await swipe();
check('swipe inside a tab pops that tab', page.url().endsWith('/search'), page.url());
check('swipe inside a tab left the other tab alone', (await countIn(INBOX)) === 3);

// ===========================================================================
// The three swipe vetoes
// ===========================================================================

await tab('settings');
await settle(600);

// 1. app-wide switch
await page.locator('[data-test=toggle-swipe]').click();
await tab('inbox');
await settle(600);
await swipe();
check(
  'global switch off: gesture does not start',
  page.url().endsWith('/inbox/item/7/notes'),
  page.url(),
);

await tab('settings');
await settle(600);
await page.locator('[data-test=toggle-swipe]').click(); // back on
await tab('inbox');
await settle(600);

// 2. page veto — ngxCanSwipeBack()
await page.locator('[data-test=dirty]').check();
await swipe();
check(
  'page veto: a dirty page refuses the gesture',
  page.url().endsWith('/inbox/item/7/notes'),
  page.url(),
);
await page.locator('[data-test=dirty]').uncheck();
await swipe();
check('page veto lifted: gesture works again', page.url().endsWith('/inbox/item/7'), page.url());

// 3. canDeactivate guard blocks the gesture before it can start
await tab('settings');
await settle(600);
await page.locator('[data-test=go-guarded]').click();
await settle(700);
check('guarded page pushed', page.url().endsWith('/settings/guarded'), page.url());

await swipe();
check(
  'canDeactivate guard: gesture refuses to start (no bounce)',
  page.url().endsWith('/settings/guarded'),
  page.url(),
);

// …but the back button still runs the guard.
page.once('dialog', (d) => d.accept());
await page.locator('[data-test=guarded-back]').click();
await settle(800);
check('guarded page: the back button still works', page.url().endsWith('/settings'), page.url());

// ===========================================================================
// RTL
// ===========================================================================

await page.locator('[data-test=toggle-rtl]').click();
await page.waitForTimeout(200);
await tabRoot('inbox');
await page.getByText('Message 20', { exact: true }).click();
await settle(700);
check('rtl: pushed a page', page.url().endsWith('/inbox/item/20'), page.url());

// The gesture has moved: the left edge is now dead.
await swipe({ rtl: false });
check(
  'rtl: the LEFT edge no longer starts a swipe',
  page.url().endsWith('/inbox/item/20'),
  page.url(),
);

await swipe({ rtl: true });
check('rtl: swiping from the RIGHT edge goes back', page.url().endsWith('/inbox'), page.url());

await page.screenshot({ path: `${OUT}/rtl.png` });

// back to LTR for the rest
await tab('settings');
await settle(600);
await page.locator('[data-test=toggle-rtl]').click();
await page.waitForTimeout(200);

// ===========================================================================
// maxDepth — the cap, and coming back past it
// ===========================================================================

await tabRoot('inbox');
await page.getByText('Message 1', { exact: true }).click();
await settle(600);

// inbox + item/1 = 2. Push four more to reach 6, one past the cap of 5.
for (let i = 0; i < 4; i++) {
  await onTop('[data-test=deeper]').click();
  await settle(500);
}
check(
  'maxDepth: stack capped at 5',
  (await countIn(INBOX)) === 5,
  `pages: ${await countIn(INBOX)}`,
);
check('maxDepth: the deepest page is on top', page.url().endsWith('/inbox/item/5'), page.url());

// The Inbox root fell off the bottom and was destroyed. Walking back to it rebuilds it — and
// still animates as a back, because that is what actually happened.
for (let i = 0; i < 5; i++) {
  await page.goBack();
  await settle(450);
}
check('maxDepth: walked back to a pruned page', page.url().endsWith('/inbox'), page.url());
check('maxDepth: pruned page was rebuilt', await page.locator('demo-inbox').isVisible());
const restoreEvent = await lastTransition();
check(
  'maxDepth: rebuilding a pruned page still reads as a BACK',
  restoreEvent?.direction === 'back',
  JSON.stringify(restoreEvent),
);
check('maxDepth: stack collapsed to just it', (await countIn(INBOX)) === 1);

// ===========================================================================
// Imperative stack + nesting
// ===========================================================================

await tab('settings');
await settle(600);
await page.locator('[data-test=go-sheet]').click();
await settle(700);
const urlAtSheet = page.url();

await page.locator('button', { hasText: 'Continue to brand' }).click();
await settle(700);
await page.locator('button', { hasText: 'Continue to price' }).click();
await settle(700);
check('imperative push works', await page.locator('demo-filter-3').isVisible());
check('imperative push does not touch the URL', page.url() === urlAtSheet, page.url());
check(
  'imperative page received its input',
  (await page.locator('demo-filter-3 code').first().innerText()) === 'shoes',
);

await swipe();
check(
  'nested: swipe inside the sheet pops the INNER stack',
  await page.locator('demo-filter-2').isVisible(),
);
check('nested: the URL did not move', page.url() === urlAtSheet, page.url());

await swipe();
check('nested: still inner', await page.locator('demo-filter-1').isVisible());

// At the inner root the inner stack declines, so the swipe falls through to the outer one.
await swipe();
check(
  'nested: at the inner root, the swipe falls through to the OUTER stack',
  page.url().endsWith('/settings'),
  page.url(),
);

await page.screenshot({ path: `${OUT}/final.png` });

// ===========================================================================
// data: { tab } — a page whose URL doesn't name its tab
// ===========================================================================

await tabRoot('inbox');
await onTop('[data-test=go-starred]').click();
await settle(700);

check('data.tab: pushed /starred', page.url().endsWith('/starred'), page.url());
check(
  'data.tab: it landed on the INBOX stack, not on a stack of its own',
  (await countIn(INBOX)) === 2,
  `inbox pages: ${await countIn(INBOX)}`,
);
check(
  'data.tab: the Inbox tab is still the active one',
  (await page.locator('[data-tab=inbox]').getAttribute('class'))?.includes('active') === true,
);

await swipe();
check('data.tab: swipe returns into the Inbox stack', page.url().endsWith('/inbox'), page.url());

// ===========================================================================
// Plain Angular router: routerLink and replaceUrl
// ===========================================================================

const historyLength = () => page.evaluate(() => history.length);

await page.goto(`${BASE}/search`);
await page.waitForSelector('demo-search');
await settle(500);

// routerLink, with no library API involved anywhere.
await page.locator('a.row', { hasText: 'Result 2' }).click();
await settle(700);
check('routerLink pushes a page', page.url().endsWith('/search/result/2'), page.url());
check('routerLink: stack grew', (await countIn(SEARCH)) === 2);

await onTop('a.big').click();
await settle(700);
check('routerLink again, deeper', (await countIn(SEARCH)) === 3, page.url());

// replaceUrl overwrites the history entry, so the stack must swap its top rather than grow.
const pagesBefore = await countIn(SEARCH);
const historyBefore = await historyLength();
await onTop('[data-test=replace]').click();
await settle(800);

check(
  'replaceUrl: history did not grow',
  (await historyLength()) === historyBefore,
  `${historyBefore} -> ${await historyLength()}`,
);
check(
  'replaceUrl: the stack did not grow either — the top page was swapped',
  (await countIn(SEARCH)) === pagesBefore,
  `${pagesBefore} -> ${await countIn(SEARCH)}`,
);
check('replaceUrl: URL is the new one', page.url().endsWith('/search/result/4'), page.url());

// And back must land on the page *below* the replaced one, not on the page it replaced.
await page.goBack();
await settle(800);
check(
  'replaceUrl: back skips the page that was replaced away',
  page.url().endsWith('/search/result/2'),
  page.url(),
);
check('replaceUrl: stack agrees with history', (await countIn(SEARCH)) === 2);

// ===========================================================================
// Cold deep link — the app opened partway in
// ===========================================================================

// A push notification, a shared URL, a hard refresh three screens deep. The router lands on the
// detail page and, left alone, the stack would have exactly one entry: nothing for a swipe to drag
// into view, and a back button that walks out of the app.
await page.goto(`${BASE}/inbox/item/12/notes`);
await page.waitForSelector('demo-notes');
await settle(800);

check(
  'deep link: the ancestors were rebuilt beneath it',
  (await countIn(INBOX)) === 3,
  `pages: ${JSON.stringify((await allPages()).map((p) => p.tag))}`,
);
check('deep link: URL untouched', page.url().endsWith('/inbox/item/12/notes'), page.url());

// The rebuild intercepts the first navigation *before* anything is recognised, so the deep page is
// built once, at the end, on top of its ancestors. Landing on it first and correcting afterwards
// would build it twice — and run its resolvers twice.
const builds = await page.evaluate(() => window.__notesBuilds);
check('deep link: the deep page was constructed exactly once', builds === 1, `builds=${builds}`);
check(
  'deep link: the deep page is the one on screen',
  JSON.stringify(await visible()) === JSON.stringify(['demo-notes']),
);

await swipe();
check('deep link: swipe works immediately', page.url().endsWith('/inbox/item/12'), page.url());
await swipe();
check('deep link: swipe all the way out', page.url().endsWith('/inbox'), page.url());

// ---------------------------------------------------------------- summary
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
