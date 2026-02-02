export const gameEngine = {
  async getGameConfig(type: string) {
    return { type, enabled: false, config: {} } as any;
  },
};

export const jackpotService = {
  async toggleJackpot(jackpotId: string) {
    return { id: jackpotId, isActive: false, name: '', active: false } as any;
  },

  async adminAdjustBalance(jackpotId: string, amount: number, _adminId: string, _reason?: string) {
    return { id: jackpotId, name: '', balance: amount, newBalance: amount } as any;
  },

  async triggerScheduledDrawing(jackpotId: string) {
    return { id: jackpotId, drawn: false, winner: null, amount: 0 } as any;
  },

  async initializeJackpots() {
    console.log('[Games] Jackpots initialized');
  },

  async getJackpotStatus() {
    return [] as any[];
  },
};
