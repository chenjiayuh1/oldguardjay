const fs = require('fs');
const path = require('path');

const inputFile = 'all-posts.txt';
const outputDir = 'posts';

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir);

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

let postCount = 0;
let currentLines = [];
let currentDate = '';

for (let line of lines) {
  const trimmed = line.trim();
  
  // Detect any line starting with date pattern
  const dateMatch = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
  
  if (dateMatch) {
    // Save previous post
    if (currentLines.length > 3 && currentDate) {
      const slug = currentDate.replace(/\//g, '-');
      const filename = `${slug}.md`;
      const filepath = path.join(outputDir, filename);

      let title = currentLines[0].replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*/, '').trim();
      if (title.length < 8) title = 'Daily Entry';

      const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${currentDate}"
---

${currentLines.join('\n')}
`;

      fs.writeFileSync(filepath, markdown);
      postCount++;
    }

    currentDate = dateMatch[0];
    currentLines = [line];
  } 
  else if (currentDate) {
    currentLines.push(line);
  }
}

// Save last post
if (currentLines.length > 3 && currentDate) {
  const slug = currentDate.replace(/\//g, '-');
  const filename = `${slug}.md`;
  const filepath = path.join(outputDir, filename);
  let title = currentLines[0].replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*/, '').trim();
  if (title.length < 8) title = 'Daily Entry';

  const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${currentDate}"
---

${currentLines.join('\n')}
`;

  fs.writeFileSync(filepath, markdown);
  postCount++;
}

console.log(`✅ Done! Created ${postCount} posts.`);
