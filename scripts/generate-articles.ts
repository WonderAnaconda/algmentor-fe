import fs from 'fs';
import path from 'path';

const articlesDir = path.join(__dirname, '../src/content/articles');
const outputFile = path.join(__dirname, '../src/content/articles.generated.ts');

function extractMetadataAndContent(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const metadataMatch = content.match(/<!--METADATA\s*([\s\S]*?)\s*-->/);
  if (!metadataMatch) {
    throw new Error(`No metadata found in article: ${filePath}`);
  }
  const metadata = JSON.parse(metadataMatch[1]);
  const html = content.replace(/<!--METADATA[\s\S]*?-->/, '').trim();
  return { metadata, html };
}

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.html'));
const articles = files.map(file => {
  const slug = file.replace('.html', '').replace(/\s+/g, '-');
  const { metadata, html } = extractMetadataAndContent(path.join(articlesDir, file));
  return {
    slug,
    ...metadata,
    html: html.replace(/`/g, '\u0060') // escape backticks for TS
  };
});

const ts = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Run scripts/generate-articles.ts to regenerate.

export interface Article {
  slug: string;
  title: string;
  description: string;
  image: string;
  publishedAt: string;
  readingTime: string;
  html: string;
}

export const articles: Article[] = ${JSON.stringify(articles, null, 2)};
`;

fs.writeFileSync(outputFile, ts);
console.log(`Generated ${outputFile} with ${articles.length} articles.`); 