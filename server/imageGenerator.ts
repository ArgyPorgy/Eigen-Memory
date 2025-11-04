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
  
  // Color scheme
  const bgColor = '#121B2B';
  const boxColor = '#1A2539'; // Rectangle box color
  const scoreColor = '#B7C0E9'; // Score numbers color
  
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
      
      <!-- Main content area -->
      <g>
        <!-- Main title: I just scored [score] points -->
        <text x="${width / 2}" y="360" 
              font-family="Arial, sans-serif" font-size="56" font-weight="bold" 
              fill="white" text-anchor="middle">I just scored ${totalScore.toLocaleString()} points</text>
        
        <!-- Rectangle box under congratulations -->
        <rect x="${width / 2 - 350}" y="400" width="700" height="140" 
              rx="16" fill="${boxColor}" />
        
        <!-- Score display inside the box (large and bold with special color) -->
        <text x="${width / 2}" y="480" 
              font-family="Arial, sans-serif" font-size="72" font-weight="bold" 
              fill="${scoreColor}" text-anchor="middle">
          ${totalScore.toLocaleString()}
        </text>
        
        <!-- CTA: Come play Unmatched by EigenTribe -->
        <text x="${width / 2}" y="570" 
              font-family="Arial, sans-serif" font-size="32" font-weight="600" 
              fill="white" text-anchor="middle">Come play Unmatched by EigenTribe</text>
      </g>
    </svg>
  `;
  
  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return pngBuffer;
}

