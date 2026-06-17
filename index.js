const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


http.createServer((req, res) => {
  // Libera o acesso para o seu HTML
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'POST') {
    let corpo = '';
    req.on('data', pedaco => corpo += pedaco);
    req.on('end', async () => {
      // Salva direto no Prisma (troque "usuario" pelo nome da sua tabela)
      const dadosSalvos = await prisma.usuario.create({ data: JSON.parse(corpo) });
      res.end(JSON.stringify(dadosSalvos));
    });
  } else {
    res.end(); // Responde rápido a testes do navegador
  }
}).listen(3000, () => console.log('LIGADO!'));
