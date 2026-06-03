const fs = require('fs');
const path = require('path');

const distPkgPath = path.resolve(__dirname, '..', 'dist', 'package.json');

if (!fs.existsSync(distPkgPath)) {
  console.error('dist/package.json not found — skipping path adaptation');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(distPkgPath, 'utf-8'));

// Strip ./dist/ prefix from top-level entry fields
for (const field of ['main', 'module', 'types']) {
  if (typeof pkg[field] === 'string') {
    pkg[field] = pkg[field].replace(/^dist\//, '');
  }
}

// Strip ./dist/ prefix from exports map
if (pkg.exports) {
  for (const key of Object.keys(pkg.exports)) {
    const entry = pkg.exports[key];
    for (const cond of ['types', 'import', 'require', 'default']) {
      if (typeof entry[cond] === 'string') {
        entry[cond] = entry[cond].replace(/^\.\/dist\//, './');
      }
    }
  }
}

fs.writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('dist/package.json paths adapted for local resolution');
