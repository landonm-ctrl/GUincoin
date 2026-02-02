export type RecipientType = 'all' | 'managers' | 'employees';

const campaignDistributionService = {
  async sendCampaignEmail(campaignId: string, recipientType: RecipientType) {
    console.log(`[CampaignDistribution] sendCampaignEmail: ${campaignId} to ${recipientType}`);
    return { sent: 0, failed: 0, errors: [] as string[], recipientCount: 0 };
  },

  async postToGoogleChat(campaignId: string, spaceId: string) {
    console.log(`[CampaignDistribution] postToGoogleChat: ${campaignId} -> ${spaceId}`);
    return { success: true };
  },

  async getDistributionStatus(campaignId: string) {
    return { campaignId, emailsSent: 0, chatPosted: false };
  },

  async getDownloadableAssets(campaignId: string) {
    return { campaignId, assets: [] as string[] };
  },
};

export default campaignDistributionService;
