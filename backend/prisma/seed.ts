import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.payment.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();

  await prisma.product.createMany({
    data: [
      {
        name: 'Wireless Headphones',
        description: 'Over-ear, active noise cancellation, 30h battery life.',
        unitPriceAmount: 350000,
        taxRate: 0.19,
        stock: 12,
        imageUrl: 'https://placehold.co/600x600/1a1a2e/ffffff?text=Wireless+Headphones',
        isFeatured: true,
        currency: 'COP',
      },
      {
        name: 'Mechanical Keyboard',
        description: 'Hot-swappable switches, per-key RGB.',
        unitPriceAmount: 420000,
        taxRate: 0.19,
        stock: 8,
        imageUrl: 'https://placehold.co/600x600/16213e/ffffff?text=Mechanical+Keyboard',
        isFeatured: false,
        currency: 'COP',
      },
      {
        name: 'Reusable Notebook',
        description: 'Dot-grid, wipeable pages, IVA-exempt stationery category.',
        unitPriceAmount: 65000,
        taxRate: 0,
        stock: 25,
        imageUrl: 'https://placehold.co/600x600/0f3460/ffffff?text=Reusable+Notebook',
        isFeatured: false,
        currency: 'COP',
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
