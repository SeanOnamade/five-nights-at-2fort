// Generic transform: converts extracted GameScene methods into a system class
// that holds a typed reference to the scene.
// Usage: node scripts/wrap-system.mjs <extractedFile> <outFile> <keptMethodCsv>
// - keptMethodCsv: methods that move INTO the class (their `this.x()` calls stay `this.`)
// Everything else `this.*` becomes `this.scene.*`.
import fs from 'node:fs';

const [src, out, keptCsv] = process.argv.slice(2);
const kept = keptCsv.split(',');

let t = fs.readFileSync(src, 'utf8');

// method visibility: strip `private ` so the scene can call them
t = t.replace(/^  private /gm, '  ');

// this.<kept>( stays this.<kept>(  |  everything else this.X -> this.scene.X
t = t.replace(/this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (m, name) => {
  if (kept.includes(name)) return m;
  return 'this.scene.' + name;
});

fs.writeFileSync(out, t);
console.log('wrote', out);
const sceneRefs = new Set((t.match(/this\.scene\.[a-zA-Z_$][a-zA-Z0-9_$]*/g) || []).map(s => s.slice('this.scene.'.length)));
console.log('scene members referenced:', [...sceneRefs].sort().join(', '));
