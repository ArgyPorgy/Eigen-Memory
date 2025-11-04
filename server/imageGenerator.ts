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
  
  // Read and convert Confetti.svg to base64
  const confettiPath = join(__dirname, '..', 'client', 'public', 'Confetti.svg');
  const confettiBuffer = await readFile(confettiPath);
  const confettiBase64 = confettiBuffer.toString('base64');
  const confettiDataUri = `data:image/svg+xml;base64,${confettiBase64}`;
  
  // Dark blue background color and slightly lighter for dialog
  const bgColor = '#000386';
  const dialogColor = '#0a0f9a'; // Slightly lighter dark blue
  
  // Create base SVG for the card matching the design
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="stripePattern" x="0" y="0" width="100" height="20" patternUnits="userSpaceOnUse">
          <image href="${stripeDataUri}" x="0" y="0" width="100" height="20" />
        </pattern>
      </defs>
      
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="${bgColor}" />
      
      <!-- Stripe borders -->
      <rect x="0" y="0" width="${width}" height="30" fill="url(#stripePattern)" />
      <rect x="0" y="${height - 30}" width="${width}" height="30" fill="url(#stripePattern)" />
      
      <!-- Confetti graphic centered above dialog -->
      <image href="${confettiDataUri}" 
             x="${width / 2 - 120}" y="80" 
             width="240" height="240" />
      
      <!-- Main dialog box -->
      <rect x="${width / 2 - 400}" y="280" width="800" height="280" 
            rx="20" fill="${dialogColor}" 
            stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
      
      <!-- Dialog content -->
      <g>
        <!-- Title: Congratulations [Name]! -->
        <text x="${width / 2}" y="340" 
              font-family="Arial, sans-serif" font-size="52" font-weight="bold" 
              fill="white" text-anchor="middle">Congratulations ${firstName}!</text>
        
        <!-- Subtitle: [Name], you have completed the match and earned [score]pts -->
        <text x="${width / 2}" y="390" 
              font-family="Arial, sans-serif" font-size="28" 
              fill="white" text-anchor="middle">
          ${firstName}, you have completed the match and earned ${totalScore.toLocaleString()}pts
        </text>
        
        <!-- Total Score label -->
        <text x="${width / 2}" y="460" 
              font-family="Arial, sans-serif" font-size="24" 
              fill="white" text-anchor="middle">Total Score</text>
        
        <!-- Score display (large and bold) -->
        <text x="${width / 2}" y="520" 
              font-family="Arial, sans-serif" font-size="64" font-weight="bold" 
              fill="white" text-anchor="middle">
          ${totalScore.toLocaleString()} pts
        </text>
      </g>
    </svg>
  `;
  
  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return pngBuffer;
}

