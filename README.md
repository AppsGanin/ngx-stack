# ngx-stack — workspace

Angular library giving you native-feeling page stacks: push/pop transitions and an
interactive iOS swipe-to-go-back, without pulling in a UI framework. Built for Capacitor
first; works on the web.

This is the **development workspace**. If you just want to use the library in your own app,
the API docs are in **[`projects/ngx-stack/README.md`](projects/ngx-stack/README.md)**.

| Path                 | What                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| `projects/ngx-stack` | The library. Everything publishable lives here.                           |
| `projects/demo`      | Demo app: both kinds of stack, the swipe, nested stacks.                  |
| `e2e`                | A Playwright script that drives a real browser through the whole surface. |

---

## Running it

### 1. Node

Angular 22 needs Node `^22.22.3 || ^24.15.0 || >=26`. A plain `node -v` of 24.13.x or 24.14.x
is **just** below the line and the CLI will refuse to start with an unhelpful error, so this
bites easily.

There's an `.nvmrc` in the repo:

```bash
nvm use          # reads .nvmrc → 22.22.3
```

This only affects the current terminal tab. New tab, run it again — or set a default once:

```bash
nvm install 24 && nvm alias default 24    # any 24.15+ works
node -v > .nvmrc                          # point .nvmrc at it too
```

### 2. Start

```bash
npm install
npm start        # builds the library, then serves the demo on http://localhost:4200
```

`npm start` builds the library first on purpose — see the gotcha below.

### 3. Play with it

The demo forces `platform: 'ios'` and turns on `swipeWithMouse`, so both the iOS transition
and the edge drag work on a laptop. **Drag from the left edge of the window with the mouse.**

What's worth trying:

- Scroll the list, open a message, swipe back — the list is exactly where you left it, and
  the page was never unmounted.
- Type in the draft field, swipe back halfway, then drag your cursor back to the left and
  release. The swipe aborts, the page is still there, your text is still in it.
- Open **Sheet**, go two steps in, then swipe. It pops a step of the _inner_ stack and the
  URL doesn't move. Swipe again from step 1 — the inner stack has nowhere left to go, so it
  declines and the swipe pops the sheet itself.

---

## Working on the library

The demo imports `ngx-stack` from `dist/ngx-stack`, not from source — that's how the CLI wires
up library workspaces (see `paths` in [`tsconfig.json`](tsconfig.json)). So the library has to
be built at least once before the demo can compile, and rebuilt for every change you want the
demo to pick up.

Two tabs:

```bash
npm run watch:lib     # tab 1 — rebuilds dist/ngx-stack on every change
npm run serve:demo    # tab 2 — picks the rebuild up and reloads
```

> **Don't run a one-shot `ng build ngx-stack` while `ng serve` is up.** It deletes and
> recreates `dist/ngx-stack` wholesale, and vite's file watcher can catch the moment the
> directory doesn't exist — after which it wedges on `Cannot find module 'ngx-stack'` and
> stays wedged until you restart it. Use `watch:lib`, which writes in place.

## Checks

| Command          | What                                                      |
| ---------------- | --------------------------------------------------------- |
| `npm run lint`   | ESLint — TypeScript, Angular, and template accessibility. |
| `npm run format` | Prettier, in place. `format:check` for CI.                |
| `npm test`       | Unit tests (Vitest) on the pure logic.                    |
| `npm run e2e`    | Playwright, driving a real browser.                       |

The e2e suite is the real safety net. It asserts the things that are easy to get subtly wrong and
impossible to see in a screenshot: that the dragged page tracks the finger 1:1, that the page
underneath parallaxes at a third of the speed, that a buried page keeps its scroll offset, that an
inner stack claims the edge gesture from the outer one.

It runs against the **built** demo, not the dev server — the demo imports the library from `dist/`,
and rebuilding under a running dev server races its file watcher:

```bash
npx playwright install chromium    # once

npm run build:demo
npm run serve:dist &               # dist/demo on :4321, with SPA fallback
npm run e2e
```

## Commits and releases

Commits are **Conventional Commits** — the convention Angular itself invented — enforced by a
`commit-msg` hook. `npm run release` generates the changelog straight from them, so a commit message
that doesn't parse is a changelog entry that doesn't exist.

```
feat(tabs): remember each tab's URL across switches
fix(gesture): don't let a nested stack and its parent both go back
```

A `pre-commit` hook runs ESLint and Prettier over the staged files only, so committing one file
doesn't lint the whole workspace.

### How a release actually happens

You choose the version number. No bot infers it, and that is deliberate: for an Angular library the
version _is_ a claim about which Angular it supports — `ngx-stack@23` means Angular 23.

Everything else is done for you. Two ways in, the same verified build out of both — **nothing is ever
built or published from a laptop**:

**A button.** Actions → Release → _Run workflow_, type the version. Pick the branch there too: `main`
for the current Angular, `22.x` for a fix to an old one. CI does the bump, the changelog, the commit
and the tag.

**Or a tag**, if you'd rather read the changelog before it leaves your machine:

```bash
npm run release -- 22.1.0     # bump, changelog, commit, tag — locally
git push --follow-tags        # CI takes it from here
```

Either way it runs [the same CI as every other push](.github/workflows/ci.yml) — reused as a
workflow, not copied, so it can't drift — and publishes with provenance only if that goes green.

### Nothing in package.json is edited by hand

| Field                                     | Written by                                          |
| ----------------------------------------- | --------------------------------------------------- |
| `projects/ngx-stack` → `version`          | `npm run release` (or the button)                   |
| `projects/ngx-stack` → `peerDependencies` | derived from the version — the major _is_ Angular's |
| root `package.json` → `@angular/*`        | `ng update`                                         |
| root `package.json` → `version`           | never. It's private and stays `0.0.0`.              |

The peer range used to be the one thing you had to remember, at exactly the moment (a new Angular
major) when you are already busy forgetting things. It isn't a decision — under the rule it's a
restatement of the version — so it's derived, and `npm run check:versions` fails the build if the
two ever disagree anyway.

Every green push to `main` deploys the demo to GitHub Pages, release or not.

### Repo settings this needs

- **Secret `NPM_TOKEN`** — and the _kind_ of token matters. It must be a **granular access token with
  "bypass 2FA" enabled**, or a classic **automation** token. Anything else is refused:

  ```
  npm error 403 Forbidden - PUT https://registry.npmjs.org/ngx-stack
  Two-factor authentication or granular access token with bypass 2fa enabled is required
  ```

  Which is npm asking CI to type a 2FA code, something no CI can do. `GITHUB_TOKEN` is provided.

- **Pages → Source: GitHub Actions.**

### Releases are safe to re-run

A release is a chain of irreversible acts — a commit, a tag, a publish — and sooner or later one of
them fails halfway through. Every step therefore asks whether it has already happened: if the tag
exists, the bump is skipped; if the version is already on npm, the publish is skipped. Re-running a
release that died at the publish step just publishes.

The workflow also checks out the branch's **current tip** rather than the SHA the run was dispatched
at, because a re-run of a half-finished release must not build on a `main` that has since moved.

## Supporting several Angular versions

**The library's major version _is_ the Angular major version.** `ngx-stack@22` is for Angular 22,
`ngx-stack@23` for Angular 23. `peerDependencies` pin exactly one major, and there is no guessing:

```bash
npm i ngx-stack     # you're on Angular 22 → you get 22.x
```

This is the convention across the Angular ecosystem (Material, ngx-bootstrap, PrimeNG) and it costs
something worth naming: a major bump no longer means "we broke something". Angular 23 shipping is
enough to make ngx-stack 23.0.0, even if nothing here changed. Semver purists will wince. In return,
nobody has to consult a compatibility table to find out which version they can install — and for a
library this deep in Angular's private-ish internals (`RouterOutletContract`, `ChildrenOutletContexts`,
`OutletInjector`), a new Angular major genuinely does tend to break something.

### How several majors stay alive at once

`main` tracks the newest Angular. Older ones live on **maintenance branches** named after their
major:

```
main    → Angular 23 → ngx-stack 23.x → npm dist-tag: latest
22.x    → Angular 22 → ngx-stack 22.x → npm dist-tag: v22-lts
21.x    → Angular 21 → ngx-stack 21.x → npm dist-tag: v21-lts
```

CI runs on every one of them: same lint, same tests, same e2e. A fix that matters to an old Angular
gets cherry-picked to its branch and released from there with its own tag.

The dist-tag is not decoration. `npm publish` moves `latest` by default, so a patch cut from `22.x`
long after 23 is out would silently make `ngx-stack@22` what every new `npm i ngx-stack` installs —
dragging people back an Angular major without a word. `latest` only ever moves from `main`.

### `ng update` migrations — the part most libraries skip

Pinning a peer range only tells people their code is now wrong. Angular's own libraries go further:
`ng update` runs **migration schematics** that fix the consumer's code for them. That is what
[`schematics/migration.json`](projects/ngx-stack/schematics/migration.json) is for.

```bash
ng update ngx-stack     # bumps the version *and* runs every migration between old and new
```

When we rename an input or move an export, the codemod goes in
`projects/ngx-stack/schematics/migrations/vNN/`, keyed by the version it belongs to. The CLI runs
them in order, so an app jumping 21 → 23 gets v22's migrations and then v23's.

> One trap worth knowing about, because it fails **silently**. ng-packagr stamps `"type": "module"`
> into the published package.json, so every `.js` in the tarball is ESM — but the CLI `require()`s
> migrations as CommonJS. Without the sibling `schematics/package.json` saying `"type": "commonjs"`,
> the factory exports nothing, `ng update` runs it, finds no function, and does nothing at all. No
> error. It is checked at build time here.

### Building for a different Angular, step by step

There is no matrix and no conditional compilation. **A branch _is_ an Angular version** — its own
`package.json`, its own lockfile, its own `node_modules`. Building for Angular 22 means checking out
`22.x` and running the same commands you always run.

**When Angular 23 comes out:**

```bash
# 1. Freeze what exists. main is about to become 23; today's main is 22, so give it a home.
git checkout main
git checkout -b 22.x
git push -u origin 22.x            # CI now runs on it, with its own Release PR

# 2. Move main forward.
git checkout main
npx ng update @angular/core @angular/cli
```

`ng update` bumps the workspace's own Angular. Then widen the peer range, and add a migration for
anyone who has to come with you:

```jsonc
// projects/ngx-stack/package.json
"peerDependencies": { "@angular/core": "^23.0.0", ... },
```

```
projects/ngx-stack/schematics/migrations/v23/    ← codemods, if the API moved
projects/ngx-stack/schematics/migration.json     ← register them against "23.0.0"
```

Fix whatever the new Angular broke — for a library this deep in `RouterOutletContract` and
`ChildrenOutletContexts`, expect something — and get CI green. Then cut it:

```bash
npm run release -- 23.0.0
git push --follow-tags
```

`npm run release` refuses to run if the three numbers disagree, so you cannot forget the peer range.

### A bug that needs fixing in both 22 and 23

The normal case, and the whole reason the branches exist.

```bash
# 1. Fix it on main, where the newest Angular lives.
git checkout main
git commit -m "fix(gesture): don't arm inside a horizontal scroller"
git push

# 2. Ship it to everyone on Angular 23.
npm run release -- 23.0.1
git push --follow-tags          # → npm dist-tag: latest

# 3. Take the same commit back to Angular 22.
git checkout 22.x
git cherry-pick <the fix>
git push                        # CI runs on 22.x too — same lint, tests, e2e

# 4. Ship it to everyone still on Angular 22.
npm run release -- 22.0.1
git push --follow-tags          # → npm dist-tag: v22-lts
```

Two releases, two tags, two npm versions. Nothing you do on one branch can touch the other.

**Why the dist-tag matters, concretely.** After step 4, npm holds `23.0.1` (tagged `latest`) and
`22.0.1` (tagged `v22-lts`). And yet:

| Who                                                 | What they get | Why                                                            |
| --------------------------------------------------- | ------------- | -------------------------------------------------------------- |
| An app on Angular 22, with `"ngx-stack": "^22.0.0"` | **22.0.1**    | Their semver range resolves to it. The dist-tag is irrelevant. |
| Someone typing `npm i ngx-stack` fresh              | **23.0.1**    | A bare install follows `latest`.                               |

That is exactly the outcome you want, and it depends entirely on `22.0.1` **not** being published as
`latest`. Publish it plainly and every new project silently installs an Angular-22 package. No error,
no warning. That one line in [`scripts/version.mjs`](scripts/version.mjs) is doing all the work, and
it is why it asks the registry what `latest` currently is instead of trusting a branch name.

**What can't go wrong:** cutting `23.0.1` from the `22.x` branch. `npm run release` runs
`check:versions`, which knows the branch it is standing on and refuses.

### Releasing a fix for an old Angular

```bash
git checkout 22.x
git cherry-pick <the fix from main>
npm run release -- 22.0.1
git push --follow-tags
```

It publishes under the `v22-lts` dist-tag, so `latest` stays on `main`. Anyone on Angular 22 keeps
getting it from `npm i ngx-stack` — their `^22` range resolves to it — without new projects being
dragged backwards.

**What must never happen on a maintenance branch:** a release with the wrong major. Cutting 23.0.0
from `22.x` would publish a version belonging to another branch, over the top of it.
`npm run check:versions` knows the branch it is on and fails first, so you would have to ignore red
CI to manage it.

### In practice, it's two commands

Everything above collapses to this. There is nothing else to remember:

```bash
npm run release -- 23.0.0     # new Angular, or a fix — same command either way
git push --follow-tags
```

The rest is machinery that only speaks up when you're about to do something wrong: the release
refuses a dirty tree, refuses a version that disagrees with the peer range, refuses a major cut from
the wrong branch — and CI refuses a tag that disagrees with the package, and works out the npm
dist-tag by asking the registry rather than trusting anyone's branch name.

### The three numbers that must agree

```
projects/ngx-stack/package.json  version           22.0.0     ← what we publish
projects/ngx-stack/package.json  peerDependencies  ^22.0.0    ← what we claim to support
package.json                     dependencies      ^22.0.0    ← what we actually build against
```

Nothing in Angular's toolchain ties these together. `ng update` will happily bump the third and leave
the other two behind, and the result is a package that lies about what it works with — which npm will
install for someone without a word. `npm run check:versions` runs first in CI for that reason, and it
knows about the branch too.
