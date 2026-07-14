import assert from 'node:assert/strict';
import { test } from 'node:test';

import { distTagFor, findProblems, peersFor } from './version.mjs';

// ---------------------------------------------------------------------------

test('peer ranges are derived from the version, not typed by hand', () => {
  const peers = peersFor('23.0.0', {
    '@angular/common': '^22.0.0',
    '@angular/core': '^22.0.0',
    '@angular/router': '^22.0.0',
  });

  assert.deepEqual(peers, {
    '@angular/common': '^23.0.0',
    '@angular/core': '^23.0.0',
    '@angular/router': '^23.0.0',
  });
});

test('a non-Angular peer is left alone — its version has nothing to do with ours', () => {
  const peers = peersFor('23.0.0', { '@angular/core': '^22.0.0', 'some-lib': '^4.2.0' });
  assert.equal(peers['some-lib'], '^4.2.0');
  assert.equal(peers['@angular/core'], '^23.0.0');
});

// ---------------------------------------------------------------------------

test('the first release ever becomes latest', () => {
  assert.equal(distTagFor('22.0.0', null), 'latest');
});

test('a patch on the current major becomes latest', () => {
  assert.equal(distTagFor('22.0.1', '22.0.0'), 'latest');
  assert.equal(distTagFor('22.4.0', '22.3.9'), 'latest');
});

test('a new Angular major becomes latest', () => {
  assert.equal(distTagFor('23.0.0', '22.3.1'), 'latest');
});

test('a fix for an older Angular does NOT become latest', () => {
  // The whole reason this function exists. Publishing 22.0.2 as `latest` after 23 is out would
  // silently make every new `npm i ngx-stack` install an Angular-22 package. No error, no warning,
  // just the wrong library.
  assert.equal(distTagFor('22.0.2', '23.1.0'), 'v22-lts');
  assert.equal(distTagFor('21.9.9', '23.1.0'), 'v21-lts');
});

// ---------------------------------------------------------------------------

const aligned = {
  libVersion: '22.0.0',
  peerDependencies: { '@angular/core': '^22.0.0', '@angular/router': '^22.0.0' },
  buildsAgainst: '^22.0.0',
  branch: 'main',
};

test('an aligned workspace has no problems', () => {
  assert.deepEqual(findProblems(aligned), []);
});

test('catches ng update bumping the build and leaving the peer range behind', () => {
  const problems = findProblems({ ...aligned, buildsAgainst: '^23.0.0' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /builds against Angular 23/);
});

test('catches a peer range that disagrees with the version', () => {
  const problems = findProblems({
    ...aligned,
    peerDependencies: { '@angular/core': '^21.0.0' },
  });
  assert.match(problems[0], /must equal the Angular major/);
});

test('catches a major being cut from the wrong maintenance branch', () => {
  const problems = findProblems({
    libVersion: '23.0.0',
    peerDependencies: { '@angular/core': '^23.0.0' },
    buildsAgainst: '^23.0.0',
    branch: '22.x',
  });
  assert.match(problems[0], /Branch 22\.x maintains ngx-stack 22\.x/);
});

test('main can carry any major', () => {
  assert.deepEqual(
    findProblems({
      libVersion: '23.0.0',
      peerDependencies: { '@angular/core': '^23.0.0' },
      buildsAgainst: '^23.0.0',
      branch: 'main',
    }),
    [],
  );
});
