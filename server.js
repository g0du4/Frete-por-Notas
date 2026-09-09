const express = require('express');
const cors = require('cors');
const { consultarNFePorChave } = require('./consultaApiOficial');
const { extrairDadosDoXml } = require('./extrairDados');

const app = express();
app.use(cors());
app.use(express.json());

// Rota principal: consulta a NF-e pela chave de acesso via API oficial
// da Danfe Rápida. O navegador chama essa rota local (sem CORS, mesma
// origem), e é o servidor quem chama a API externa com a x-api-key.
app.get('/api/consultar-nfe/:chave', async (req, res) => {
    const chave = (req.params.chave || '').replace(/\D/g, '');

    if (chave.length !== 44) {
        return res.status(400).json({ sucesso: false, erro: 'Chave inválida. Precisa ter 44 dígitos.' });
    }

    const resultado = await consultarNFePorChave(chave);

    if (!resultado.sucesso) {
        return res.status(502).json(resultado);
    }

    resultado.dados = extrairDadosDoXml(resultado.xml);
    return res.json(resultado);
});

app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`Servidor rodando em http://localhost:${PORTA}`));
