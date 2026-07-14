/**
 * Conventional Commits — the convention Angular itself invented.
 *
 * Not bureaucracy: `npm run release` generates the changelog straight from these messages, so a
 * message that doesn't parse is a changelog entry that doesn't exist.
 *
 * Deliberately no `scope-enum`. A fixed list of allowed scopes only ever rejects commits — it never
 * catches a bug — and the first thing it rejects is usually a scope that should have been on the
 * list. The type is what matters; the scope is a hint to a human.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
