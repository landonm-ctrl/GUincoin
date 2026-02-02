import prisma from '../config/database';

const accountService = {
  async getOrCreateAccount(userId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: userId },
      include: { account: true },
    });
    if (employee?.account) return employee.account;
    return prisma.account.create({
      data: { employeeId: userId, balance: 0 },
    });
  },

  async getOrCreateAccountForEmployee(employee: { id: string }) {
    return this.getOrCreateAccount(employee.id);
  },
};

export default accountService;
