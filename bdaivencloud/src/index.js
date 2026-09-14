import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://g0du4.github.io/Frete-por-Notas/', // troque pelo seu domínio do GitHub Pages
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
    const prisma = new PrismaClient({ adapter });
    const url = new URL(request.url);

    try {
      // GET /notas-fiscais -> lista todas as notas com os itens
      if (url.pathname === '/notas-fiscais' && request.method === 'GET') {
        const notas = await prisma.notas_fiscais.findMany({
          include: { itens: true },
          orderBy: { data: 'desc' },
        });
        return Response.json(notas, { headers: corsHeaders });
      }

      // POST /notas-fiscais -> cria uma nota fiscal com seus itens
      if (url.pathname === '/notas-fiscais' && request.method === 'POST') {
        const body = await request.json();

        const novaNota = await prisma.notas_fiscais.create({
          data: {
            data: new Date(body.data),
            nNF: body.nNF,
            totalCx: body.totalCx,
            pesoKg: body.pesoKg,
            frete: body.frete,
            freteUnitKg: body.freteUnitKg,
            freteUnitCx: body.freteUnitCx,
            fonte: body.fonte,
            destinatario: body.destinatario,
            destCNPJ: body.destCNPJ,
            valorNF: body.valorNF,
            transportadora: body.transportadora,
            itens: {
              create: (body.itens ?? []).map((item) => ({
                item: item.item,
                qtdOriginal: item.qtdOriginal,
                unMedida: item.unMedida,
                qtdcx: item.qtdcx,
                peso: item.peso,
                precoCobrado: item.precoCobrado,
                temExcecao: item.temExcecao ?? false,
                tipoCalculoItem: item.tipoCalculoItem,
                nNf: item.nNf,
              })),
            },
          },
          include: { itens: true },
        });

        return Response.json(novaNota, { status: 201, headers: corsHeaders });
      }

      return new Response('Rota não encontrada', { status: 404, headers: corsHeaders });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    } finally {
      ctx.waitUntil(prisma.$disconnect());
    }
  },
};