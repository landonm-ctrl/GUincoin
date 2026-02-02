export type PageName = 'home' | 'store' | 'wellness' | 'games';

export const BANNER_DIMENSIONS = {
  hero: { width: 1200, height: 400 },
  sidebar: { width: 300, height: 250 },
  inline: { width: 728, height: 90 },
};

const bannerService = {
  async listBanners(_filters: { position?: string; campaignId?: string; isActive?: boolean }) {
    return [] as any[];
  },

  async getBannerById(id: string) {
    return { id, imageUrl: '', isActive: true, position: 'hero' } as any;
  },

  async createBanner(data: Record<string, unknown>) {
    return data as any;
  },

  async updateBanner(id: string, data: Record<string, unknown>) {
    return { id, ...data } as any;
  },

  async updateBannerImage(id: string, imageUrl: string, _isExternal: boolean, _prompt?: string) {
    return { id, imageUrl } as any;
  },

  async deleteBanner(_id: string) {
    return;
  },

  async toggleBanner(id: string) {
    return { id, isActive: false } as any;
  },
};

export default bannerService;
