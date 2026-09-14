import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://g0du4.github.io', // ajuste pro seu domínio real do GitHub Pages
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Rota: consultar NFe numa API externa (danferapida)
    const matchNfe = url.pathname.match(/^\/api\/consultar-nfe\/(\d+)$/);
    if (matchNfe) {
      return consultarNfe(matchNfe[1], env);
    }

    // Rotas: notas fiscais no banco Aiven (via Prisma + Hyperdrive)
    if (url.pathname === '/notas-fiscais') {
      return handleNotasFiscais(request, env, ctx);
    }

    return jsonResponse({ sucesso: false, erro: 'Rota não encontrada' }, 404);
  },
};

// ---------- Consulta de NFe (API externa) ----------

async function consultarNfe(chave, env) {
  if (chave.length !== 44) {
    return jsonResponse({ sucesso: false, erro: 'Chave inválida. Precisa ter 44 dígitos.' }, 400);
  }

  const apiKey = env.DANFERAPIDA_API_KEY;
  if (!apiKey) {
    return jsonResponse({ sucesso: false, erro: 'DANFERAPIDA_API_KEY não configurada nas variáveis do Worker.' }, 500);
  }

  try {
    const resposta = await fetch(`https://api.danferapida.com.br/documents/b2b/search/${chave}`, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    });

    const corpo = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      return jsonResponse(
        { sucesso: false, erro: (corpo && (corpo.message || corpo.erro)) || `Erro HTTP ${resposta.status}` },
        502
      );
    }

    if (!corpo || !corpo.xmlCode) {
      return jsonResponse({ sucesso: false, erro: 'A API não retornou o XML esperado.' }, 502);
    }

    return jsonResponse({
      sucesso: true,
      chave: corpo.accessKey,
      xml: corpo.xmlCode,
      dados: extrairDadosDoXml(corpo.xmlCode),
    });
  } catch (e) {
    return jsonResponse({ sucesso: false, erro: `Falha ao consultar a API: ${e.message}` }, 502);
  }
}

function extrairDadosDoXml(xmlTexto) {
  let nomeDestinatario = 'Destinatário não encontrado';
  let listaItens = [];

  const regexDestinatario = /<dest>[\s\S]*?<xNome>(.*?)<\/xNome>[\s\S]*?<\/dest>/i;
  const matchDest = xmlTexto.match(regexDestinatario);

  if (matchDest && matchDest[1]) {
    nomeDestinatario = matchDest[1];
  } else {
    const regexTodosNomes = /<xNome>(.*?)<\/xNome>/gi;
    const todosNomes = [...xmlTexto.matchAll(regexTodosNomes)];
    if (todosNomes.length >= 2) {
      nomeDestinatario = todosNomes[1][1];
    }
  }

  const regexBlocoDet = /<det[^>]*>([\s\S]*?)<\/det>/gi;
  let matchDet;
  let index = 1;

  const getTagValue = (bloco, tag) => {
    const regexTag = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'i');
    const m = bloco.match(regexTag);
    return m ? m[1] : null;
  };

  while ((matchDet = regexBlocoDet.exec(xmlTexto)) !== null) {
    const blocoDet = matchDet[1];
    listaItens.push({
      item: index++,
      descricao: getTagValue(blocoDet, 'xProd') || 'Sem descrição',
      quantidade: getTagValue(blocoDet, 'qCom') || '0',
      valorUnitario: getTagValue(blocoDet, 'vUnCom') || '0',
    });
  }

  return { destinatario: nomeDestinatario, itens: listaItens };
}

// ---------- Notas fiscais no banco (Prisma + Aiven) ----------

async function handleNotasFiscais(request, env, ctx) {
  const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    if (request.method === 'GET') {
      const notas = await prisma.notas_fiscais.findMany({
        include: { itens: true },
        orderBy: { data: 'desc' },
      });
      return jsonResponse(notas);
    }

    if (request.method === 'POST') {
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
      return jsonResponse(novaNota, 201);
    }

    return jsonResponse({ erro: 'Método não suportado nessa rota' }, 405);
  } finally {
    ctx.waitUntil(prisma.$disconnect());
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}