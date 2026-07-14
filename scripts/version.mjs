import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Everything that follows from one rule: **the library's major version is the Angular major it
 * supports.** `ngx-stack@23` means Angular 23, and that is the only compatibility table anyone
 * should ever need.
 *
 * Three commands, because the rule has to be enforced in three places:
 *
 *   check              on every push — the three version numbers still agree
 *   dist-tag <ver>     at publish time — an old major must not become npm's `latest`
 *   release <ver>      when you cut one — stamp, changelog, commit, tag
 *
 *   npm run check:versions
 *   npm run release -- 22.1.0
 */

const LIB = 'projects/ngx-stack/package.json';
const ROOT = 'package.json';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** `^22.0.0` → 22, `22.1.3` → 22 */
const majorOf = (range) => Number(String(range).replace(/^\D*/, '').split('.')[0]);

// ---------------------------------------------------------------------------
// The two decisions worth testing
// ---------------------------------------------------------------------------

/**
 * Which npm dist-tag a version should be published under.
 *
 * The single most dangerous line in the release. `npm publish` moves `latest` by default — so a
 * patch cut for Angular 22, long after 23 is out, would quietly make ngx-stack@22 the version that
 * every new `npm i ngx-stack` installs, dragging people back an entire Angular major. Nothing
 * errors. Nothing looks wrong. It is just suddenly the wrong package.
 *
 * Stated against what is *already published*, not against the branch we're standing on: a branch
 * name is a convention somebody can get wrong, the registry is a fact.
 */
export function distTagFor(version, currentLatest) {
  if (!currentLatest) return 'latest'; // nothing published yet — this is release number one
  if (majorOf(version) >= majorOf(currentLatest)) return 'latest';
  return `v${majorOf(version)}-lts`; // a real release, but not the default one
}

/**
 * Everything that has to be true for the rule to hold. Returns the problems, empty if there are none.
 *
 * These drift silently. `ng update` bumps the Angular we build against and leaves the peer range
 * behind; a breaking change lands on a maintenance branch and the next release claims a major that
 * belongs to another branch. Each one publishes a package that lies about what it works with.
 */
/**
 * The peer ranges a given library version must declare.
 *
 * Derived, never typed. Under the rule, `ngx-stack@23` supports Angular 23 and nothing else — so the
 * peer range isn't a decision anyone gets to make, it's a restatement of the version. Leaving it to
 * be edited by hand just creates one more thing to forget, right at the moment (a new Angular major)
 * when you are already busy forgetting things.
 *
 * Non-Angular peers, if we ever grow any, are left alone: their versions have nothing to do with ours.
 */
export function peersFor(version, existingPeers) {
  const range = `^${majorOf(version)}.0.0`;

  return Object.fromEntries(
    Object.entries(existingPeers).map(([name, current]) => [
      name,
      name.startsWith('@angular/') ? range : current,
    ]),
  );
}

export function findProblems({ libVersion, peerDependencies, buildsAgainst, branch }) {
  const problems = [];
  const libMajor = majorOf(libVersion);

  for (const [name, range] of Object.entries(peerDependencies)) {
    if (majorOf(range) !== libMajor) {
      problems.push(
        `peerDependencies["${name}"] is ${range}, but ngx-stack is ${libVersion}. ` +
          `The library major must equal the Angular major it supports.`,
      );
    }
  }

  if (majorOf(buildsAgainst) !== libMajor) {
    problems.push(
      `The workspace builds against Angular ${majorOf(buildsAgainst)}, but ngx-stack is ` +
        `${libVersion}. We would ship a package built on one Angular and declaring another.`,
    );
  }

  // A maintenance branch is named after the major it maintains.
  const maintenance = branch ? /^(\d+)\.x$/.exec(branch) : null;
  if (maintenance && Number(maintenance[1]) !== libMajor) {
    problems.push(
      `Branch ${branch} maintains ngx-stack ${maintenance[1]}.x, but the version here is ` +
        `${libVersion}. A breaking change on a maintenance branch is the usual cause — it belongs ` +
        `on main.`,
    );
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

function capture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** In CI the branch is handed to us; locally ask git — but a fresh repo has no HEAD to ask about. */
const currentBranch = () =>
  process.env.GITHUB_REF_NAME ?? capture('git rev-parse --abbrev-ref HEAD');

function check() {
  const lib = read(LIB);
  const root = read(ROOT);
  const branch = currentBranch();

  const problems = findProblems({
    libVersion: lib.version,
    peerDependencies: lib.peerDependencies,
    buildsAgainst: root.dependencies['@angular/core'],
    branch,
  });

  if (problems.length > 0) {
    console.error('\nAngular version alignment is broken:\n');
    for (const problem of problems) console.error(`  ✖ ${problem}\n`);
    process.exit(1);
  }

  const angular = majorOf(root.dependencies['@angular/core']);
  console.log(
    `ngx-stack ${lib.version} ↔ Angular ${angular}: aligned${branch ? ` (branch: ${branch})` : ''}`,
  );
}

function release(version) {
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
    console.error('usage: npm run release -- <version>     e.g. npm run release -- 22.1.0');
    process.exit(1);
  }

  // A dirty tree means the tag would point at a commit that doesn't contain what you tested.
  if (capture('git status --porcelain')) {
    console.error('The working tree is dirty. Commit or stash first.');
    process.exit(1);
  }

  const lib = read(LIB);
  lib.version = version;
  // Derived from the version, so there is nothing to edit by hand and nothing to forget.
  lib.peerDependencies = peersFor(version, lib.peerDependencies);
  writeFileSync(LIB, `${JSON.stringify(lib, null, 2)}\n`);

  // Still checked, because the *build* is not derived: cutting 23.0.0 without having run `ng update`
  // first would ship a package built on Angular 22 and declaring 23.
  check();

  // The Angular preset is not a coincidence — Angular invented this commit convention.
  run('npx conventional-changelog -p angular -i CHANGELOG.md -s -r 0');

  run(`git add ${LIB} CHANGELOG.md`);
  run(`git commit -m "chore(release): ${version}"`);
  run(`git tag -a v${version} -m "ngx-stack ${version}"`);

  console.log(`
Tagged v${version}. Nothing has been published yet.

  git push --follow-tags

That push runs CI and, if it goes green, publishes to npm.
`);
}

// ---------------------------------------------------------------------------

if (process.argv[1]?.endsWith('version.mjs')) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'check':
      check();
      break;

    case 'dist-tag': {
      const [version, override] = args;
      // The override exists so this is testable, and so CI can print it without a network round-trip.
      const latest = override ?? capture('npm view ngx-stack version');
      process.stdout.write(distTagFor(version, latest));
      break;
    }

    case 'release':
      release(args[0]);
      break;

    default:
      console.error('usage: node scripts/version.mjs <check | dist-tag <ver> | release <ver>>');
      process.exit(1);
  }
}
