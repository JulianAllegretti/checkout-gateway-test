import { PrismaService } from './prisma.service';

describe('PrismaService lifecycle', () => {
  it('connects on module init and disconnects on module destroy', async () => {
    const prisma = new PrismaService();
    const connectSpy = jest.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    const disconnectSpy = jest.spyOn(prisma, '$disconnect').mockResolvedValue(undefined);

    await prisma.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);

    await prisma.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
