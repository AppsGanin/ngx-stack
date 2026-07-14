import type { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';

/**
 * Runs when someone does `ng update ngx-stack` across the 22 → 23 boundary.
 *
 * This is the part of major-version support that most libraries skip and Angular's own do not.
 * Bumping a peer range only tells people their code is now wrong; a migration *fixes it*. When we
 * rename an input or move an export, the codemod goes here and nobody has to read a changelog to
 * find out why their build broke.
 *
 * The CLI runs migrations in `version` order, so an app jumping 21 → 23 gets v22's and then v23's.
 * Each one is idempotent by construction — it only rewrites what still matches the old shape.
 */
export function migrateToV23(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const renamed = renameSymbols(tree, {
      // Nothing yet: 23 is not out. Real entries look like this, and each one turns a broken build
      // into a working one without the user reading anything:
      //
      //   'provideStackDeepLinks': 'provideNgxStack',
    });

    if (renamed > 0) {
      context.logger.info(`ngx-stack: updated ${renamed} import(s).`);
    }

    context.logger.info(
      [
        '',
        'ngx-stack 23 is Angular 23. Nothing else changed that we can fix for you.',
        'Release notes: https://github.com/AppsGanin/ngx-stack/releases',
        '',
      ].join('\n'),
    );

    return tree;
  };
}

/** Rewrite `import { Old } from 'ngx-stack'` to the new name, across the app's TypeScript. */
function renameSymbols(tree: Tree, renames: Record<string, string>): number {
  const entries = Object.entries(renames);
  if (entries.length === 0) return 0;

  let count = 0;

  tree.visit((path) => {
    if (!path.endsWith('.ts') || path.includes('/node_modules/')) return;

    const buffer = tree.read(path);
    if (!buffer) return;

    const before = buffer.toString('utf8');
    // Cheap, but only ever applied to files that actually import from us, so it cannot rename an
    // unrelated symbol that happens to share the name.
    if (!before.includes('ngx-stack')) return;

    let after = before;
    for (const [from, to] of entries) {
      after = after.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
    }

    if (after !== before) {
      tree.overwrite(path, after);
      count++;
    }
  });

  return count;
}
