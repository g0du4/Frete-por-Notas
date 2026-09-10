// Consulta direta na API oficial da Danfe Rápida — sem navegador, sem automação.
// Documentação: https://danferapida.com.br/integracao
// Versão ES Module (import/export) — compatível com projetos que usam "type": "module".

const BASE_URL = 'https://api.danferapida.com.br';

export async function consultarNFePorChave(chave) {
    const apiKey = process.env.DANFERAPIDA_API_KEY;

    if (!apiKey) {
        return {
            sucesso: false,
            erro: 'Variável de ambiente DANFERAPIDA_API_KEY não definida. Rode "export DANFERAPIDA_API_KEY=SUA_CHAVE" antes.',
        };
    }

    if (!chave || chave.length !== 44) {
        return { sucesso: false, erro: 'Chave inválida. Precisa ter 44 dígitos.' };
    }

    try {
        const resposta = await fetch(`${BASE_URL}/documents/b2b/search/${chave}`, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
        });

        const corpo = await resposta.json().catch(() => null);

        if (!resposta.ok) {
            return {
                sucesso: false,
                status: resposta.status,
                erro: (corpo && (corpo.message || corpo.erro)) || `Erro HTTP ${resposta.status}`,
                detalheCompleto: corpo,
            };
        }

        return {
            sucesso: true,
            chave: corpo.accessKey,
            xml: corpo.xmlCode,
            pdfBase64: corpo.base64Code,
        };
    } catch (e) {
        return { sucesso: false, erro: `Falha de rede: ${e.message}` };
    }
}
