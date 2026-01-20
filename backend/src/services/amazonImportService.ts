const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const withTimeout = async (url: string, timeoutMs = 8_000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const normalizeText = (value: string): string =>
  value.replace(/\s+/g, ' ').replace(/[\u0000-\u001F]+/g, '').trim();

const extractMetaContent = (html: string, key: string): string | null => {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const match = html.match(pattern);
  return match ? decodeHtmlEntities(match[1]) : null;
};

const extractTitle = (html: string): string | null => {
  const idMatch = html.match(/id=["']productTitle["'][^>]*>([^<]+)</i);
  if (idMatch) {
    return normalizeText(decodeHtmlEntities(idMatch[1]));
  }
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle) {
    return normalizeText(ogTitle);
  }
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? normalizeText(decodeHtmlEntities(titleMatch[1])) : null;
};

const extractDescription = (html: string): string | null => {
  const metaDescription = extractMetaContent(html, 'description');
  if (metaDescription) {
    return normalizeText(metaDescription);
  }

  const bulletMatch = html.match(/id=["']feature-bullets["'][^>]*>([\s\S]*?)<\/ul>/i);
  if (!bulletMatch) {
    return null;
  }

  const items = [...bulletMatch[1].matchAll(/<span[^>]*class=["'][^"']*a-list-item[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => normalizeText(decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ''))))
    .filter(Boolean);

  return items.length ? items.join(' ') : null;
};

const extractPrice = (html: string): number | null => {
  const candidates = [
    /property=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
    /itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
    /id=["']priceblock_ourprice["'][^>]*>([^<]+)/i,
    /id=["']priceblock_dealprice["'][^>]*>([^<]+)/i,
    /id=["']priceblock_saleprice["'][^>]*>([^<]+)/i,
    /class=["']a-offscreen["'][^>]*>\s*\$?([0-9,]+(?:\.[0-9]{2})?)/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match) {
      const raw = decodeHtmlEntities(match[1])
        .replace(/[^0-9.]/g, '')
        .replace(/,/g, '');
      const value = Number.parseFloat(raw);
      if (!Number.isNaN(value)) {
        return value;
      }
    }
  }

  return null;
};

const extractImageUrls = (html: string): string[] => {
  const urls = new Set<string>();

  const ogImage = extractMetaContent(html, 'og:image');
  if (ogImage) {
    urls.add(ogImage);
  }

  const dynamicImageMatch = html.match(/data-a-dynamic-image=["']([^"']+)["']/i);
  if (dynamicImageMatch) {
    const jsonText = decodeHtmlEntities(dynamicImageMatch[1]);
    try {
      const parsed = JSON.parse(jsonText);
      Object.keys(parsed).forEach((url) => urls.add(url));
    } catch {
      // Ignore parsing errors; fallback to og:image
    }
  }

  return Array.from(urls);
};

const extractAsin = (url: string): string | null => {
  const asinMatch = url.match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})/i);
  return asinMatch ? asinMatch[1].toUpperCase() : null;
};

export interface AmazonProductDetails {
  url: string;
  asin: string | null;
  title: string | null;
  description: string | null;
  imageUrls: string[];
  priceUsd: number | null;
}

export const fetchAmazonProductDetails = async (url: string): Promise<AmazonProductDetails> => {
  let response: Response;
  try {
    response = await withTimeout(url);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Amazon request timed out');
    }
    throw new Error('Amazon request failed');
  }
  if (!response.ok) {
    throw new Error(`Amazon request failed with status ${response.status}`);
  }

  const html = await response.text();
  return {
    url,
    asin: extractAsin(url),
    title: extractTitle(html),
    description: extractDescription(html),
    imageUrls: extractImageUrls(html),
    priceUsd: extractPrice(html),
  };
};

export const extractAmazonListAsins = (html: string): string[] => {
  const asins = new Set<string>();
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/gi,
    /\/gp\/product\/([A-Z0-9]{10})/gi,
    /data-asin=["']([A-Z0-9]{10})["']/gi,
    /data-itemid=["']([A-Z0-9]{10})["']/gi,
    /"asin"\s*:\s*"([A-Z0-9]{10})"/gi,
  ];

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      asins.add(match[1].toUpperCase());
    }
  });

  return Array.from(asins);
};

export const fetchAmazonListAsins = async (url: string): Promise<string[]> => {
  let response: Response;
  try {
    response = await withTimeout(url);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Amazon list request timed out');
    }
    throw new Error('Amazon list request failed');
  }
  if (!response.ok) {
    throw new Error(`Amazon list request failed with status ${response.status}`);
  }
  const html = await response.text();
  return extractAmazonListAsins(html);
};
