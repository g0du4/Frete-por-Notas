// Mesma lógica de extração blindada que já existia no viewer.js da extensão,
// só que reaproveitada aqui no backend.

function extrairDadosDoXml(xmlTexto) {
    let nomeDestinatario = 'Destinatário não encontrado';
    let listaItens = [];

    // 1. Destinatário via regex (não depende de DOMParser/namespaces)
    const regexDestinatario = /<dest>[\s\S]*?<xNome>(.*?)<\/xNome>[\s\S]*?<\/dest>/i;
    const matchDest = xmlTexto.match(regexDestinatario);

    if (matchDest && matchDest[1]) {
        nomeDestinatario = matchDest[1];
    } else {
        // Fallback: segundo <xNome> do documento costuma ser o destinatário (o primeiro é o emitente)
        const regexTodosNomes = /<xNome>(.*?)<\/xNome>/gi;
        const todosNomes = [...xmlTexto.matchAll(regexTodosNomes)];
        if (todosNomes.length >= 2) {
            nomeDestinatario = todosNomes[1][1];
        }
    }

    // 2. Itens via regex, bloco a bloco <det>...</det>
    const regexBlocoDet = /<det[^>]*>([\s\S]*?)<\/det>/gi;
    let matchDet;
    let index = 1;

    const getTagValue = (bloco, tag) => {
        const regexTag = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'i');
        const match = bloco.match(regexTag);
        return match ? match[1] : null;
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

module.exports = { extrairDadosDoXml };
