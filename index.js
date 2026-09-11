import "dotenv/config";
import express from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/index.js';
import { readFileSync } from 'fs'; //PARA ACESSAR O HTML sem express

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const prisma = new PrismaClient({ adapter });

const app = express();

app.use(express.json()); // permite receber JSON no body

app.get('/', async (req, res) => {
  res.send(readFileSync('./CalculoFreteNota.html', 'utf-8'));
  const dados = await prisma.notas_fiscais.findMany();
  
  res.json(console.log(dados));
});// INDICA O AQRUIVO QUE DEVE ABRIR AO ACESSAR A PORTA SERVIDOR

app.get('/dados', async (req, res) => {
  
  const dados = await prisma.notas_fiscais.findMany({ 
    include: { itens: true } 
  });
  res.json(dados);
});

