import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import http from 'http';
import { AppError } from '../utils/errors';
import campaignService from './campaignService';

// Image size configurations
export type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';

export interface ImageGenerationResult {
  url: string;
  localPath: string;
  filename: string;
}

export interface CampaignImagesResult {
  banner?: ImageGenerationResult;
  poster?: ImageGenerationResult;
  emailBanner?: ImageGenerationResult;
  chatImage?: ImageGenerationResult;
}

/**
 * Unified image types for the generator.
 */
export type UnifiedImageType =
  | 'campaign_banner'
  | 'campaign_poster'
  | 'email_banner'
  | 'chat_image'
  | 'sidebar_banner'
  | 'header_banner'
  | 'footer_banner'
  | 'background_banner';

/**
 * Guided prompt options for image generation.
 */
export interface GuidedPromptOptions {
  mood?: 'energetic' | 'calm' | 'professional' | 'playful' | 'inspiring';
  style?: 'photorealistic' | 'illustrated' | 'abstract' | 'minimalist' | 'fan_art';
  subject?: string;
  colorPreference?: string;
  excludeElements?: string[];
  // TV show themed fan art options
  tvShowTheme?: string;  // e.g., "The Office", "Game of Thrones", "Stranger Things"
  tvShowElements?: string;  // Specific elements to include, e.g., "dragons", "Dunder Mifflin office"
}

/**
 * Theme colors that can be extracted from an image.
 */
export interface ExtractedThemeColors {
  primaryColor: string;
  primaryHoverColor: string;
  primaryLightColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textPrimaryColor: string;
  textSecondaryColor: string;
  navTextColor: string;
  navTextInactiveColor: string;
  navTextHoverColor: string;
}

/**
 * Image type configurations with sizes and descriptions.
 */
export const IMAGE_TYPE_CONFIG: Record<UnifiedImageType, {
  size: ImageSize;
  width: number;
  height: number;
  label: string;
  description: string;
}> = {
  campaign_banner: {
    size: '1792x1024',
    width: 1792,
    height: 1024,
    label: 'Campaign Banner',
    description: 'Wide landscape banner for campaign headers (16:9)',
  },
  campaign_poster: {
    size: '1024x1792',
    width: 1024,
    height: 1792,
    label: 'Campaign Poster',
    description: 'Tall portrait poster for printing or display',
  },
  email_banner: {
    size: '1792x1024',
    width: 1792,
    height: 1024,
    label: 'Email Banner',
    description: 'Header image for campaign emails',
  },
  chat_image: {
    size: '1024x1024',
    width: 1024,
    height: 1024,
    label: 'Chat Image',
    description: 'Square image for chat announcements',
  },
  sidebar_banner: {
    size: '1024x1792',
    width: 160,
    height: 600,
    label: 'Sidebar Banner',
    description: 'Vertical banner for left/right sidebars (160x600)',
  },
  header_banner: {
    size: '1792x1024',
    width: 728,
    height: 90,
    label: 'Header Banner',
    description: 'Leaderboard banner for page header (728x90)',
  },
  footer_banner: {
    size: '1792x1024',
    width: 728,
    height: 90,
    label: 'Footer Banner',
    description: 'Leaderboard banner for page footer (728x90)',
  },
  background_banner: {
    size: '1792x1024',
    width: 1920,
    height: 1080,
    label: 'Background Banner',
    description: 'Full page background image (1920x1080)',
  },
};

// Prompt templates for consistent branding
const PROMPT_TEMPLATES = {
  banner: (theme: string, description: string) =>
    `Create a professional corporate wellness campaign banner image. Theme: ${theme}. ${description}. Style: Modern, clean, corporate-friendly. Do not include any text in the image. Use vibrant but professional colors. The image should inspire health and wellness. High quality, photorealistic.`,

  poster: (theme: string, description: string) =>
    `Create a professional wellness campaign poster background image. Theme: ${theme}. ${description}. Style: Modern, inspiring, portrait orientation with space at the top for text overlay. Do not include any text. Corporate wellness aesthetic. High quality, photorealistic.`,

  emailBanner: (theme: string, description: string) =>
    `Create a compact email header banner for a wellness campaign. Theme: ${theme}. ${description}. Style: Clean, professional, suitable for email header. Do not include any text. Bright and engaging but professional. High quality.`,

  chatImage: (theme: string, description: string) =>
    `Create a square image for a wellness campaign announcement in a chat application. Theme: ${theme}. ${description}. Style: Eye-catching, modern, suitable for Google Chat. Do not include any text. Engaging and professional. High quality.`,

  // Banner-specific templates with composition guidance
  sidebarBanner: (theme: string, description: string) =>
    `Create a vertical banner image (tall and narrow, 160x600 aspect ratio) for a website sidebar. Theme: ${theme}. ${description}. IMPORTANT COMPOSITION: Place the main subject/focal point in the CENTER of the image vertically, as the image will be cropped to fit a tall narrow space. Avoid placing important elements at the very top or bottom edges. Style: Eye-catching, modern, professional. The design should work well when viewed as a narrow vertical strip. Do not include any text. Use engaging visuals that draw attention. High quality.`,

  headerBanner: (theme: string, description: string) =>
    `Create a wide horizontal banner image for a website header (728x90 leaderboard format). Theme: ${theme}. ${description}. IMPORTANT COMPOSITION: Place the main subject/focal point in the CENTER of the image horizontally, as the image will be cropped to fit an extremely wide and short banner. The visible area will be a thin horizontal strip from the middle of the image. Avoid placing important elements at the top or bottom edges - they will be cropped out. Create a design with visual interest spread horizontally across the center band. Style: Clean, professional, modern. Do not include any text. High quality.`,

  footerBanner: (theme: string, description: string) =>
    `Create a wide horizontal banner image for a website footer (728x90 leaderboard format). Theme: ${theme}. ${description}. IMPORTANT COMPOSITION: Place the main subject/focal point in the CENTER of the image horizontally, as the image will be cropped to fit an extremely wide and short banner. The visible area will be a thin horizontal strip from the middle of the image. Avoid placing important elements at the top or bottom edges - they will be cropped out. Create a design with visual interest spread horizontally across the center band. Style: Clean, professional, modern. Do not include any text. High quality.`,

  backgroundBanner: (theme: string, description: string) =>
    `Create a full-page website background image (1920x1080). Theme: ${theme}. ${description}. IMPORTANT: This will be used as a subtle background behind website content. Create a design that is visually interesting but NOT distracting - the main focus should remain on the website content that will overlay this image. Use soft, muted colors or subtle gradients. Avoid high-contrast elements, bright spots, or busy patterns in the center of the image where content will be displayed. The edges can have more visual interest. Consider adding a subtle vignette or gradient that darkens towards the center to improve content readability. Style: Elegant, atmospheric, suitable as a background. Do not include any text. High quality.`,
};

/**
 * Build a guided prompt from structured options.
 */
function buildGuidedPrompt(options: GuidedPromptOptions): string {
  const parts: string[] = [];

  // TV Show Theme - handled separately with stronger, more specific prompts
  if (options.tvShowTheme) {
    // Don't add anything here - TV show themes use specialized templates
    // Just return a marker that generateUnified will detect
    return `__TV_SHOW_THEME__:${options.tvShowTheme}:${options.tvShowElements || ''}`;
  }

  // Mood
  const moodDescriptions: Record<string, string> = {
    energetic: 'dynamic, vibrant, full of energy',
    calm: 'serene, peaceful, soothing',
    professional: 'corporate, polished, business-appropriate',
    playful: 'fun, whimsical, lighthearted',
    inspiring: 'motivational, uplifting, empowering',
  };
  if (options.mood) {
    parts.push(`Mood: ${moodDescriptions[options.mood]}`);
  }

  // Style
  const styleDescriptions: Record<string, string> = {
    photorealistic: 'photorealistic, high-quality photography style',
    illustrated: 'illustrated, digital art style',
    abstract: 'abstract, geometric, artistic',
    minimalist: 'minimalist, clean, simple',
    fan_art: 'creative fan art style, artistic interpretation, stylized illustration',
  };
  if (options.style) {
    parts.push(`Style: ${styleDescriptions[options.style]}`);
  }

  // Subject
  if (options.subject) {
    parts.push(`Subject: ${options.subject}`);
  }

  // Color preference
  if (options.colorPreference) {
    parts.push(`Color palette: ${options.colorPreference}`);
  }

  // Exclusions
  if (options.excludeElements && options.excludeElements.length > 0) {
    parts.push(`Do not include: ${options.excludeElements.join(', ')}`);
  }

  return parts.join('. ');
}

/**
 * Build a TV show themed prompt that captures the visual style effectively.
 */
function buildTvShowPrompt(showName: string, elements: string, imageType: UnifiedImageType): string {
  // Get composition guidance based on image type
  let compositionGuide = '';
  switch (imageType) {
    case 'sidebar_banner':
      compositionGuide = 'The image should be composed for a tall, narrow vertical format (160x600). Place key visual elements in the center vertically.';
      break;
    case 'header_banner':
    case 'footer_banner':
      compositionGuide = 'The image should be composed for an extremely wide, short horizontal format (728x90). Spread visual interest horizontally across the center band. Avoid placing important elements at top or bottom edges.';
      break;
    case 'background_banner':
      compositionGuide = 'This is a full-page background. Keep the center area subtle and less busy so content can overlay it. Visual interest can be stronger at the edges.';
      break;
    default:
      compositionGuide = '';
  }

  // Build a strong, specific prompt for the TV show theme
  const prompt = `Create artwork in the distinctive visual style of "${showName}".

CRITICAL: Capture the iconic art style, color palette, and aesthetic that makes "${showName}" instantly recognizable. Match the animation style, line work, shading techniques, and characteristic look of the show.

${elements ? `Include themed elements like: ${elements}` : `Include recognizable environmental elements, props, and scenery from "${showName}".`}

Style guidelines:
- Use the exact color palette and saturation levels typical of "${showName}"
- Match the distinctive character design proportions and art style (but create original characters, not copyrighted ones)
- Include background elements, locations, and props that are characteristic of the show
- Capture the mood and atmosphere that "${showName}" is known for

${compositionGuide}

Do not include any text, watermarks, or signatures. Create a high-quality image that fans of "${showName}" would immediately recognize as being in that show's style.`;

  return prompt;
}

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const campaignUploadDir = path.join(uploadDir, 'campaigns');

// Ensure campaign upload directory exists
if (!fs.existsSync(campaignUploadDir)) {
  fs.mkdirSync(campaignUploadDir, { recursive: true });
}

/**
 * Service for generating AI images using OpenAI's DALL-E 3.
 */
export class AIImageService {
  private openai: OpenAI | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.isConfigured = true;
    } else {
      console.warn('[AIImageService] OPENAI_API_KEY not configured. Image generation will be disabled.');
    }
  }

  /**
   * Check if the service is properly configured.
   */
  isAvailable(): boolean {
    return this.isConfigured && this.openai !== null;
  }

  /**
   * Ensure campaign directory exists.
   */
  private ensureCampaignDir(campaignId: string): string {
    const dir = path.join(campaignUploadDir, campaignId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Download an image from a URL and save it locally.
   */
  private downloadImage(url: string, filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filepath);

      protocol
        .get(url, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            // Handle redirects
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              file.close();
              fs.unlinkSync(filepath);
              this.downloadImage(redirectUrl, filepath).then(resolve).catch(reject);
              return;
            }
          }

          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          file.close();
          fs.unlinkSync(filepath);
          reject(err);
        });
    });
  }

  /**
   * Generate an image using DALL-E 3.
   */
  async generateImage(
    prompt: string,
    size: ImageSize,
    campaignId: string,
    imageType: string
  ): Promise<ImageGenerationResult> {
    if (!this.openai) {
      throw new AppError('AI image generation is not configured. Please set OPENAI_API_KEY.', 503);
    }

    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'standard',
        style: 'vivid',
      });

      if (!response.data || response.data.length === 0) {
        throw new AppError('Failed to generate image: No data returned', 500);
      }
      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new AppError('Failed to generate image: No URL returned', 500);
      }

      // Download and save locally
      const dir = this.ensureCampaignDir(campaignId);
      const filename = `${imageType}-${uuidv4()}.png`;
      const localPath = path.join(dir, filename);

      await this.downloadImage(imageUrl, localPath);

      // Build public URL
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const publicUrl = `${baseUrl}/api/files/campaigns/${campaignId}/${filename}`;

      return {
        url: publicUrl,
        localPath,
        filename,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('[AIImageService] Image generation failed:', error);
      throw new AppError('Failed to generate image. Please try again.', 500);
    }
  }

  /**
   * Generate a banner image (16:9 landscape).
   */
  async generateBanner(
    campaignId: string,
    theme: string,
    description: string
  ): Promise<ImageGenerationResult> {
    const prompt = PROMPT_TEMPLATES.banner(theme, description);
    return this.generateImage(prompt, '1792x1024', campaignId, 'banner');
  }

  /**
   * Generate a poster image (portrait).
   */
  async generatePoster(
    campaignId: string,
    theme: string,
    description: string
  ): Promise<ImageGenerationResult> {
    const prompt = PROMPT_TEMPLATES.poster(theme, description);
    return this.generateImage(prompt, '1024x1792', campaignId, 'poster');
  }

  /**
   * Generate an email banner image.
   */
  async generateEmailBanner(
    campaignId: string,
    theme: string,
    description: string
  ): Promise<ImageGenerationResult> {
    const prompt = PROMPT_TEMPLATES.emailBanner(theme, description);
    return this.generateImage(prompt, '1792x1024', campaignId, 'email-banner');
  }

  /**
   * Generate a chat image (square).
   */
  async generateChatImage(
    campaignId: string,
    theme: string,
    description: string
  ): Promise<ImageGenerationResult> {
    const prompt = PROMPT_TEMPLATES.chatImage(theme, description);
    return this.generateImage(prompt, '1024x1024', campaignId, 'chat');
  }

  /**
   * Generate all campaign images at once.
   */
  async generateCampaignImages(
    campaignId: string,
    customPrompt?: string,
    options?: {
      generateBanner?: boolean;
      generatePoster?: boolean;
      generateEmailBanner?: boolean;
      generateChatImage?: boolean;
    }
  ): Promise<CampaignImagesResult> {
    const campaign = await campaignService.getCampaignById(campaignId);
    const theme = (campaign.theme as { presetName?: string })?.presetName || 'corporate wellness';
    const description = customPrompt || campaign.description || campaign.name;

    const opts = {
      generateBanner: true,
      generatePoster: true,
      generateEmailBanner: true,
      generateChatImage: true,
      ...options,
    };

    const results: CampaignImagesResult = {};
    const updateData: {
      bannerImageUrl?: string;
      posterImageUrl?: string;
      emailBannerUrl?: string;
      chatImageUrl?: string;
      aiPromptUsed?: string;
    } = {
      aiPromptUsed: description,
    };

    // Generate images in parallel for efficiency
    const promises: Promise<void>[] = [];

    if (opts.generateBanner) {
      promises.push(
        this.generateBanner(campaignId, theme, description).then((result) => {
          results.banner = result;
          updateData.bannerImageUrl = result.url;
        })
      );
    }

    if (opts.generatePoster) {
      promises.push(
        this.generatePoster(campaignId, theme, description).then((result) => {
          results.poster = result;
          updateData.posterImageUrl = result.url;
        })
      );
    }

    if (opts.generateEmailBanner) {
      promises.push(
        this.generateEmailBanner(campaignId, theme, description).then((result) => {
          results.emailBanner = result;
          updateData.emailBannerUrl = result.url;
        })
      );
    }

    if (opts.generateChatImage) {
      promises.push(
        this.generateChatImage(campaignId, theme, description).then((result) => {
          results.chatImage = result;
          updateData.chatImageUrl = result.url;
        })
      );
    }

    // Wait for all generations to complete
    await Promise.all(promises);

    // Update campaign with image URLs
    await campaignService.updateCampaignImages(campaignId, updateData);

    return results;
  }

  /**
   * Regenerate a specific image type.
   */
  async regenerateImage(
    campaignId: string,
    imageType: 'banner' | 'poster' | 'emailBanner' | 'chatImage',
    customPrompt?: string
  ): Promise<ImageGenerationResult> {
    const campaign = await campaignService.getCampaignById(campaignId);
    const theme = (campaign.theme as { presetName?: string })?.presetName || 'corporate wellness';
    const description = customPrompt || campaign.aiPromptUsed || campaign.description || campaign.name;

    let result: ImageGenerationResult;

    switch (imageType) {
      case 'banner':
        result = await this.generateBanner(campaignId, theme, description);
        await campaignService.updateCampaignImages(campaignId, { bannerImageUrl: result.url });
        break;
      case 'poster':
        result = await this.generatePoster(campaignId, theme, description);
        await campaignService.updateCampaignImages(campaignId, { posterImageUrl: result.url });
        break;
      case 'emailBanner':
        result = await this.generateEmailBanner(campaignId, theme, description);
        await campaignService.updateCampaignImages(campaignId, { emailBannerUrl: result.url });
        break;
      case 'chatImage':
        result = await this.generateChatImage(campaignId, theme, description);
        await campaignService.updateCampaignImages(campaignId, { chatImageUrl: result.url });
        break;
      default:
        throw new AppError(`Unknown image type: ${imageType}`, 400);
    }

    return result;
  }

  /**
   * Get all assets for a campaign.
   */
  async getCampaignAssets(campaignId: string): Promise<{
    bannerImageUrl: string | null;
    posterImageUrl: string | null;
    emailBannerUrl: string | null;
    chatImageUrl: string | null;
    aiPromptUsed: string | null;
  }> {
    const campaign = await campaignService.getCampaignById(campaignId);
    return {
      bannerImageUrl: campaign.bannerImageUrl,
      posterImageUrl: campaign.posterImageUrl,
      emailBannerUrl: campaign.emailBannerUrl,
      chatImageUrl: campaign.chatImageUrl,
      aiPromptUsed: campaign.aiPromptUsed,
    };
  }

  /**
   * Delete campaign images from disk.
   */
  async deleteCampaignImages(campaignId: string): Promise<void> {
    const dir = path.join(campaignUploadDir, campaignId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /**
   * Generate a unified image with type selector and optional guided prompt.
   */
  async generateUnified(
    imageType: UnifiedImageType,
    options: {
      targetId: string; // campaignId or bannerId
      targetType: 'campaign' | 'banner';
      customPrompt?: string;
      guidedOptions?: GuidedPromptOptions;
      theme?: string;
    }
  ): Promise<ImageGenerationResult> {
    if (!this.openai) {
      throw new AppError('AI image generation is not configured. Please set OPENAI_API_KEY.', 503);
    }

    const config = IMAGE_TYPE_CONFIG[imageType];
    const theme = options.theme || 'corporate wellness';

    // Build the prompt
    let description: string;
    let prompt: string;

    if (options.customPrompt) {
      description = options.customPrompt;
    } else if (options.guidedOptions) {
      description = buildGuidedPrompt(options.guidedOptions);
    } else {
      description = 'Professional corporate design';
    }

    // Check if this is a TV show theme (indicated by special marker from buildGuidedPrompt)
    if (description.startsWith('__TV_SHOW_THEME__:')) {
      // Parse the TV show theme data
      const parts = description.split(':');
      const showName = parts[1] || '';
      const elements = parts[2] || '';

      // Use the specialized TV show prompt builder
      prompt = buildTvShowPrompt(showName, elements, imageType);
    } else {
      // Use the standard templates for non-TV show content
      switch (imageType) {
        case 'campaign_banner':
          prompt = PROMPT_TEMPLATES.banner(theme, description);
          break;
        case 'campaign_poster':
          prompt = PROMPT_TEMPLATES.poster(theme, description);
          break;
        case 'email_banner':
          prompt = PROMPT_TEMPLATES.emailBanner(theme, description);
          break;
        case 'chat_image':
          prompt = PROMPT_TEMPLATES.chatImage(theme, description);
          break;
        case 'sidebar_banner':
          prompt = PROMPT_TEMPLATES.sidebarBanner(theme, description);
          break;
        case 'header_banner':
          prompt = PROMPT_TEMPLATES.headerBanner(theme, description);
          break;
        case 'footer_banner':
          prompt = PROMPT_TEMPLATES.footerBanner(theme, description);
          break;
        case 'background_banner':
          prompt = PROMPT_TEMPLATES.backgroundBanner(theme, description);
          break;
        default:
          prompt = PROMPT_TEMPLATES.banner(theme, description);
      }
    }

    // Generate the image
    const result = await this.generateImage(
      prompt,
      config.size,
      options.targetId,
      imageType.replace('_', '-')
    );

    return result;
  }

  /**
   * Generate theme colors from an image using GPT-4 Vision.
   * Analyzes the image and suggests complementary theme colors.
   */
  async generateThemeColorsFromImage(imageUrl: string): Promise<ExtractedThemeColors | null> {
    if (!this.openai) {
      throw new AppError('AI service is not configured. Please set OPENAI_API_KEY.', 503);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a color palette expert. Analyze images and extract a cohesive color theme suitable for a web application.

Return colors in RGB format (space-separated values like "37 99 235" for a blue).
Ensure good contrast ratios:
- Text colors should have at least 4.5:1 contrast with background
- Navigation text should be clearly readable
- Primary hover should be slightly darker than primary
- Primary light should be a very light tint of primary

Return ONLY a valid JSON object with these exact keys:
primaryColor, primaryHoverColor, primaryLightColor, secondaryColor, accentColor, backgroundColor, surfaceColor, textPrimaryColor, textSecondaryColor, navTextColor, navTextInactiveColor, navTextHoverColor`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and extract a cohesive color theme for a web application. Return only the JSON object.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const colors = JSON.parse(jsonMatch[0]) as ExtractedThemeColors;
      return colors;
    } catch (error) {
      console.error('[AIImageService] Failed to extract theme colors:', error);
      return null;
    }
  }

  /**
   * Get image type configuration.
   */
  getImageTypeConfig(imageType: UnifiedImageType) {
    return IMAGE_TYPE_CONFIG[imageType];
  }

  /**
   * Get all image type configurations.
   */
  getAllImageTypeConfigs() {
    return IMAGE_TYPE_CONFIG;
  }

  /**
   * Generate a banner image for the banner system.
   */
  async generateBannerImage(
    bannerId: string,
    position: 'sidebar_left' | 'sidebar_right' | 'header' | 'footer' | 'background',
    options: {
      customPrompt?: string;
      guidedOptions?: GuidedPromptOptions;
      theme?: string;
    }
  ): Promise<ImageGenerationResult> {
    // Map position to image type
    const imageTypeMap: Record<string, UnifiedImageType> = {
      sidebar_left: 'sidebar_banner',
      sidebar_right: 'sidebar_banner',
      header: 'header_banner',
      footer: 'footer_banner',
      background: 'background_banner',
    };

    const imageType = imageTypeMap[position];

    return this.generateUnified(imageType, {
      targetId: bannerId,
      targetType: 'banner',
      customPrompt: options.customPrompt,
      guidedOptions: options.guidedOptions,
      theme: options.theme,
    });
  }
}

export default new AIImageService();
