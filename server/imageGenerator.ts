import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ScoreCardData {
  profileImageUrl?: string | null;
  firstName: string;
  totalScore: number;
  baseScore: number;
  bonus: number;
}

export async function generateScoreCard(data: ScoreCardData): Promise<Buffer> {
  const { profileImageUrl, firstName, totalScore, baseScore, bonus } = data;
  
  // Canvas dimensions
  const width = 1200;
  const height = 628;
  const padding = 60;
  
  // Read and convert stripe.png to base64
  const stripePath = join(__dirname, '..', 'client', 'public', 'stripe.png');
  const stripeBuffer = await readFile(stripePath);
  const stripeBase64 = stripeBuffer.toString('base64');
  const stripeDataUri = `data:image/png;base64,${stripeBase64}`;
  
  // Create base SVG for the card with new color scheme
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="stripePattern" x="0" y="0" width="100" height="20" patternUnits="userSpaceOnUse">
          <image href="${stripeDataUri}" x="0" y="0" width="100" height="20" />
        </pattern>
      </defs>
      
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="#000386" />
      
      <!-- Stripe borders -->
      <rect x="0" y="0" width="${width}" height="30" fill="url(#stripePattern)" />
      <rect x="0" y="${height - 30}" width="${width}" height="30" fill="url(#stripePattern)" />
      
      <!-- Main content area -->
      <g transform="translate(${padding}, ${padding + 50})">
        <!-- Title -->
        <text x="${width / 2 - padding}" y="50" 
              font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
              fill="white" text-anchor="middle">🎉 Congratulations!</text>
        
        <text x="${width / 2 - padding}" y="100" 
              font-family="Arial, sans-serif" font-size="28" 
              fill="white" text-anchor="middle">${firstName} has completed Unmatched!</text>
        
        <!-- Score display white box -->
        <rect x="${width / 2 - padding - 150}" y="150" width="300" height="180" 
              rx="20" fill="white" stroke="#000386" stroke-width="4" />
        
        <text x="${width / 2 - padding}" y="220" 
              font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
              fill="#000386" text-anchor="middle">TOTAL SCORE</text>
        
        <text x="${width / 2 - padding}" y="285" 
              font-family="Arial, sans-serif" font-size="72" font-weight="bold" 
              fill="#000386" text-anchor="middle">${totalScore.toLocaleString()}</text>
        
        <!-- Breakdown -->
        <text x="${width / 2 - padding}" y="380" 
              font-family="Arial, sans-serif" font-size="20" 
              fill="white" text-anchor="middle">
          Base: ${baseScore}pts • Bonus: +${bonus}pts
        </text>
        
        <!-- Call to action -->
        <text x="${width / 2 - padding}" y="450" 
              font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
              fill="white" text-anchor="middle">Play Unmatched Now →</text>
      </g>
    </svg>
  `;
  
  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return pngBuffer;
}

