import sharp from 'sharp';

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
  
  // Create base SVG for the card
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background gradient -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a0a2e;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0f3460;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)" />
      
      <!-- Decorative circles -->
      <circle cx="${width * 0.9}" cy="${height * 0.1}" r="80" fill="#4ECDC4" opacity="0.1" />
      <circle cx="${width * 0.1}" cy="${height * 0.9}" r="100" fill="#FF6B6B" opacity="0.1" />
      
      <!-- Main content area -->
      <g transform="translate(${padding}, ${padding})">
        <!-- Title -->
        <text x="${width / 2 - padding}" y="80" 
              font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
              fill="#4ECDC4" text-anchor="middle">🎉 Congratulations!</text>
        
        <text x="${width / 2 - padding}" y="140" 
              font-family="Arial, sans-serif" font-size="28" 
              fill="#E0E0E0" text-anchor="middle">${firstName} has completed Unmatched!</text>
        
        <!-- Score display -->
        <rect x="${width / 2 - padding - 150}" y="200" width="300" height="200" 
              rx="20" fill="url(#scoreGradient)" />
        
        <text x="${width / 2 - padding}" y="290" 
              font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
              fill="#1a0a2e" text-anchor="middle">TOTAL SCORE</text>
        
        <text x="${width / 2 - padding}" y="350" 
              font-family="Arial, sans-serif" font-size="72" font-weight="bold" 
              fill="#1a0a2e" text-anchor="middle">${totalScore.toLocaleString()}</text>
        
        <!-- Breakdown -->
        <text x="${width / 2 - padding}" y="500" 
              font-family="Arial, sans-serif" font-size="20" 
              fill="#B0B0B0" text-anchor="middle">
          Base: ${baseScore}pts • Bonus: +${bonus}pts
        </text>
        
        <!-- Call to action -->
        <text x="${width / 2 - padding}" y="580" 
              font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
              fill="#4ECDC4" text-anchor="middle">Play Unmatched Now →</text>
      </g>
      
      <!-- Bottom decoration -->
      <rect x="${width / 2 - 150}" y="${height - 40}" width="300" height="8" 
            rx="4" fill="#4ECDC4" />
    </svg>
  `;
  
  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return pngBuffer;
}

