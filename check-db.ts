import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetId = 'cmokwmo0z009kujcsws2q8fy8';
  const targetVisualId = 'D-050';

  console.log(`Searching for: UUID=${targetId}, VisualID=${targetVisualId}`);

  const byId = await prisma.testCase.findUnique({ where: { id: targetId } });
  console.log(`Found by UUID: ${byId ? 'YES (' + byId.testCaseId + ')' : 'NO'}`);

  const byVisual = await prisma.testCase.findFirst({ where: { testCaseId: targetVisualId } });
  console.log(`Found by VisualID: ${byVisual ? 'YES (' + byVisual.id + ')' : 'NO'}`);

  const count = await prisma.testCase.count();
  console.log(`Total count: ${count}`);

  const samples = await prisma.testCase.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log('Latest IDs:', samples.map(s => `${s.testCaseId}:${s.id}`));
  
  process.exit(0);
}

main();
