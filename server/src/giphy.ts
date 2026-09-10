export type GiphyKind = 'gif' | 'sticker';

export type GiphyItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
};

type GiphyImageSet = {
  url?: string;
};

type GiphyImages = {
  fixed_width_small?: GiphyImageSet;
  preview_gif?: GiphyImageSet;
  downsized?: GiphyImageSet;
  original?: GiphyImageSet;
  fixed_height?: GiphyImageSet;
};

type GiphyApiItem = {
  id?: string;
  title?: string;
  images?: GiphyImages;
};

type GiphyApiResponse = {
  data?: GiphyApiItem[];
};

function requireApiKey(): string {
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) {
    throw new Error('GIPHY_API_KEY is not configured');
  }
  return key;
}

function normalizeItem(item: GiphyApiItem): GiphyItem | null {
  const id = item.id?.trim();
  if (!id) return null;

  const images = item.images ?? {};
  const url =
    images.downsized?.url ??
    images.fixed_height?.url ??
    images.original?.url ??
    '';
  const previewUrl =
    images.fixed_width_small?.url ??
    images.preview_gif?.url ??
    url;

  if (!url) return null;

  return {
    id,
    title: item.title?.trim() || 'GIF',
    previewUrl,
    url,
  };
}

export async function searchGiphy(
  query: string,
  kind: GiphyKind,
  limit = 24,
): Promise<GiphyItem[]> {
  const apiKey = requireApiKey();
  const resource = kind === 'sticker' ? 'stickers' : 'gifs';
  const trimmed = query.trim();
  const endpoint = trimmed
    ? `https://api.giphy.com/v1/${resource}/search`
    : `https://api.giphy.com/v1/${resource}/trending`;

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(Math.min(Math.max(limit, 1), 50)),
    rating: 'pg-13',
  });
  if (trimmed) {
    params.set('q', trimmed);
  }

  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Giphy request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as GiphyApiResponse;
  const items = Array.isArray(payload.data) ? payload.data : [];
  return items
    .map(normalizeItem)
    .filter((item): item is GiphyItem => item !== null);
}
