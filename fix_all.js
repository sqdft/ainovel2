import fs from 'fs';
let text = fs.readFileSync('src/services/aiService.ts', 'utf8');

const regexMap = /const subStr \= r\.subRealms\?\.map\(.*?join\(.*?\).*?\;/g;
text = text.replace(regexMap, "const subStr = r.subRealms?.map((s, si) => `${isCurrent && si === currentSubIdx ? '¡ö' : '¡ð'} ${s.name}`).join(' ') || '';");

const regexList = /return \`\$\{isCurrent \?.*?subStr\}\`;/g;
text = text.replace(regexList, "return `${isCurrent ? '¡ö' : '¡ð'} ${r.level}. ${r.name} ${subStr}`;");

const regexJoin = /\}\)\.join\('.*?'\);/g;
text = text.replace(regexJoin, "}).join('\\n');");

fs.writeFileSync('src/services/aiService.ts', text, 'utf8');
console.log('Fixed realm string exactly!');
