import fs from 'fs';
let content = fs.readFileSync('src/services/aiService.ts', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('¡¾ºËÐÄÒªÇó¡¿')) {
     console.log('Found core requirements at line', i);
     for (let j = i; j < i + 6; j++) {
        console.log(lines[j]);
     }
  }
}
