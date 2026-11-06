const fs = require('fs');
const content = fs.readFileSync('admin.js', 'utf8');
const cmds = new Set();
const regex = /cmd['"]?\s*:\s*['"]([^'"]+)['"]/g;
let match;
while ((match = regex.exec(content)) !== null) {
  cmds.add(match[1]);
}
console.log('admin.js:', Array.from(cmds));
