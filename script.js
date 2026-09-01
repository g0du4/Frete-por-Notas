 pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    var ST = {
        transportadoras: JSON.parse(localStorage.getItem('fn_v4_transp') || '[]'),
        destinatarios: JSON.parse(localStorage.getItem('fn_v4_dest') || '[]'),
        registros: JSON.parse(localStorage.getItem('fn_v4_regs') || '[]'),
        rules: JSON.parse(localStorage.getItem('fn_v4_rules') || '{"nome":1,"qtdcx":2,"pesocx":5}'),
        lote: [],
        idNotaSelecionadaLote: null
    };
    
    var excelConfig = JSON.parse(localStorage.getItem('fn_v4_excel_cfg') || '{"headerBg":"#1e40af","headerColor":"#ffffff","headerFontSize":"12px","dataFontSize":"11px","dataAlign":"left","showTotals":true,"totalBg":"#f1f5f9","totalColor":"#1e293b","totalFontSize":"11px"}');
    
    // VARIÁVEIS DE CONTEXTO DO MENU FLUTUANTE
    var menuFloatCtx = { idNota: null, idTransp: null };

    var EXPORT_FIELDS_DEFAULT = [
        { key: 'data',          label: 'Data',              defaultHeader: 'Data',            defaultAtivo: true  },
        { key: 'nNF',           label: 'Número da NF',      defaultHeader: 'Numero NF',       defaultAtivo: true  },
        { key: 'totalCx',       label: 'Total Caixas',      defaultHeader: 'Total Cx',        defaultAtivo: true  },
        { key: 'pesoKg',        label: 'Peso Total (Kg)',   defaultHeader: 'Peso Kg',         defaultAtivo: true  },
        { key: 'frete',         label: 'Frete Total (R$)',  defaultHeader: 'Frete Total R$',  defaultAtivo: true  },
        { key: 'freteUnitKg',   label: 'Frete por Kg (R$)', defaultHeader: 'Frete por Kg',   defaultAtivo: true  },
        { key: 'freteUnitCx',   label: 'Frete por Cx (R$)', defaultHeader: 'Frete por Caixa',defaultAtivo: true  },
        { key: 'fonte',         label: 'Tipo (XML/PDF)',     defaultHeader: 'Fonte',          defaultAtivo: false },
        { key: 'emitente',      label: 'Emitente',          defaultHeader: 'Emitente',        defaultAtivo: false },
        { key: 'destinatario',  label: 'Destinatário',      defaultHeader: 'Destinatario',    defaultAtivo: false },
        { key: 'destCNPJ',      label: 'CNPJ Destinatário', defaultHeader: 'CNPJ',            defaultAtivo: false },
        { key: 'valorNF',       label: 'Valor da NF (R$)',  defaultHeader: 'Valor NF',        defaultAtivo: false },
        { key: 'transportadora',label: 'Transportadora',    defaultHeader: 'Transportadora',  defaultAtivo: false }
    ];

    function carregarConfigExportacao() {
        var salvo = localStorage.getItem('fn_v4_export_fields');
        if (salvo) {
            try {
                var parsed = JSON.parse(salvo);
                var keysExistentes = parsed.map(function(f){ return f.key; });
                EXPORT_FIELDS_DEFAULT.forEach(function(def) {
                    if (!keysExistentes.includes(def.key)) {
                        parsed.push({ key: def.key, ativo: def.defaultAtivo, header: def.defaultHeader, headerBg: '', headerColor: '', dataBg: '', border: true });
                    }
                });
                // Garante novos campos em entradas antigas
                parsed.forEach(function(f) {
                    if (f.headerBg === undefined) f.headerBg = '';
                    if (f.headerColor === undefined) f.headerColor = '';
                    if (f.dataBg === undefined) f.dataBg = '';
                    if (f.border === undefined) f.border = true;
                });
                return parsed;
            } catch(e) {}
        }
        return EXPORT_FIELDS_DEFAULT.map(function(f) {
            return { key: f.key, ativo: f.defaultAtivo, header: f.defaultHeader, headerBg: '', headerColor: '', dataBg: '', border: true };
        });
    }

    var exportFieldsConfig = carregarConfigExportacao();

    var histSortCol = 'data';
    var histSortAsc = false;
    var histVisaoAtual = 'nota';

    var _pressTimer = null;
    var _copiouAgora = false;

    // EVENTO GLOBAL PARA FECHAR MENU FLUTUANTE SE CLICAR FORA
    document.addEventListener('click', function(e) {
        var menu = document.getElementById('menu-float-transp');
        if(menu && menu.style.display === 'block' && !menu.contains(e.target) && !e.target.classList.contains('select-transp-lote')) {
            menu.style.display = 'none';
            renderLoteCompleto(); // Reseta visualmente a seleção do select caso tenha cancelado
        }
    });

    function toggleSection(element) {
        var body = element.nextElementSibling;
        var icon = element.querySelector('.toggle-icon');
        const openAnterior = document.querySelector('.config-body.open');

        if (openAnterior) {
            openAnterior.classList.remove('open');
            openAnterior.previousElementSibling.querySelector('.toggle-icon').classList.remove('ti-chevron-up');
            openAnterior.previousElementSibling.querySelector('.toggle-icon').classList.add('ti-chevron-down'); 
        }
        if(body !== openAnterior){
            body.classList.add('open');
            icon.classList.remove('ti-chevron-down');
            icon.classList.add('ti-chevron-up');
            element.closest('.config-card').previousElementSibling?.scrollIntoView({ behavior: "auto", block: "start", inline: "center" });
        }
    }

    function mostrarToast(msg) {
        var div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1e40af;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:9999;transition:opacity 0.4s;';
        document.body.appendChild(div);
        setTimeout(function(){ div.style.opacity='0'; }, 1600);
        setTimeout(function(){ div.remove(); }, 2000);
    }

    function mostrarToastAviso(msg) {
        var existing = document.getElementById('toast-aviso-unico');
        if (existing) existing.remove();
        var div = document.createElement('div');
        div.id = 'toast-aviso-unico';
        div.innerHTML = '<span style="font-size:16px;">⚠️</span><span>' + msg + '</span>';
        div.style.cssText = 'position:fixed;bottom:24px;right:24px;display:flex;align-items:center;gap:10px;background:#fff;color:#92400e;border:1.5px solid #fbbf24;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.13);z-index:9999;transition:opacity 0.4s;';
        document.body.appendChild(div);
        setTimeout(function(){ div.style.opacity='0'; }, 2400);
        setTimeout(function(){ div.remove(); }, 2900);
    }

      // ── MODAL DE CONFIRMAÇÃO ──────────────────────────────────────────────────
    function abrirModal(titulo, mensagem, fnConfirmar) {
        document.getElementById('modal-confirm-title').textContent = titulo;
        document.getElementById('modal-confirm-msg').textContent = mensagem;
        var overlay = document.getElementById('modal-confirm-overlay');
        var btnConfirm = document.getElementById('modal-confirm-btn');
        // Remove listener anterior para não acumular
        var novoBtn = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(novoBtn, btnConfirm);
        novoBtn.addEventListener('click', function() {
            fecharModal();
            fnConfirmar();
        });
        overlay.classList.add('aberto');
    }

    function fecharModal() { document.getElementById('modal-confirm-overlay').classList.remove('aberto'); }

    // Fechar modal clicando fora da caixa
    document.getElementById('modal-confirm-overlay').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });

    function copiarColuna(col) {
        var valores = ST.registros.map(function(r){ return r[col] !== undefined ? r[col] : ''; });
        var texto = valores.join('\n');
        navigator.clipboard.writeText(texto).then(function(){
            mostrarToast('✓ Coluna copiada (' + valores.length + ' valores)');
        });
    }

    function persistirDados() {
        localStorage.setItem('fn_v4_transp', JSON.stringify(ST.transportadoras));
        localStorage.setItem('fn_v4_dest', JSON.stringify(ST.destinatarios));
        localStorage.setItem('fn_v4_regs', JSON.stringify(ST.registros));
        localStorage.setItem('fn_v4_rules', JSON.stringify(ST.rules));
    }

    function formatarMoeda(v) {
        return 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatarPeso(v) {
        var num = parseFloat(v || 0);
        var str = num.toFixed(3); 
        str = str.replace(/\.?0+$/, ''); 
        return str.replace('.', ',');
    }

    function formatarDoc(v) {
        if (!v) return '';
        v = String(v).replace(/\D/g, "");
        if (v.length === 14) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        if (v.length === 11) return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        return v;
    }

    function parseNumeroBR(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        var s = String(val).trim();
        s = s.replace(/\s/g, '');
        if (s.includes(',') && s.includes('.')) {
            if (s.indexOf('.') < s.indexOf(',')) { s = s.replace(/\./g, ''); s = s.replace(',', '.'); }
            else { s = s.replace(/,/g, ''); }
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        }
        return parseFloat(s) || 0;
    }
    
    function parseBRDate(str) {
        if (!str) return '0000-00-00';
        var parts = str.split('/');
        if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];
        return str;
    }

    function exibirAlertaGlobal(idElem, msg, tipo) {
        var el = document.getElementById(idElem);
        if(!el) return;
        el.style.display = 'flex';
        el.className = 'alert alert-' + (tipo || 'info');
        var icon = 'ti-info-circle';
        if(tipo === 'success') icon = 'ti-circle-check';
        if(tipo === 'warn') icon = 'ti-alert-triangle';
        if(tipo === 'error') icon = 'ti-alert-octagon';
        el.innerHTML = '<i class="ti ' + icon + '"></i><span>' + msg + '</span>';
    }

    function switchTab(tabId, event) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        if(event) event.target.closest('.tab').classList.add('active');
        document.getElementById('panel-' + tabId).classList.add('active');
        if (tabId === 'historico') { renderHistoricoCompleto();/* carregarHistoricoDoBanco(); */ }
        if (tabId === 'config') { renderConfiguracoes(); }
    }

    function toggleVisibilidadeCarregamento(visivel, msg) {
        var bar = document.getElementById('load-bar');
        bar.style.display = visivel ? 'flex' : 'none';
        if(msg) document.getElementById('load-text').textContent = msg;
    }

    function salvarRegrasConfig() {
        ST.rules = {
            nome: parseInt(document.getElementById('cfg-p-nome').value) || 1,
            qtdcx: parseInt(document.getElementById('cfg-p-qtdcx').value) || 2,
            pesocx: parseInt(document.getElementById('cfg-p-pesocx').value) || 5
        };
        persistirDados();
        mostrarToast('Regras de extração atualizadas com sucesso!');
    }

    function salvarConfigExcel() {
        excelConfig = {
            headerBg:      document.getElementById('cfg-ex-bg').value,
            headerColor:   document.getElementById('cfg-ex-color').value,
            headerFontSize:document.getElementById('cfg-ex-font').value,
            dataFontSize:  document.getElementById('cfg-ex-data-font').value,
            dataAlign:     document.getElementById('cfg-ex-align').value,
            showTotals:    document.getElementById('cfg-ex-totals').checked,
            totalBg:       document.getElementById('cfg-ex-total-bg').value,
            totalColor:    document.getElementById('cfg-ex-total-color').value,
            totalFontSize: document.getElementById('cfg-ex-total-font').value,
            titleText:     document.getElementById('cfg-ex-title').value,
            titleBg:       document.getElementById('cfg-ex-title-bg').value,
            titleColor:    document.getElementById('cfg-ex-title-color').value,
            titleFontSize: document.getElementById('cfg-ex-title-font').value
        };
        localStorage.setItem('fn_v4_excel_cfg', JSON.stringify(excelConfig));
        mostrarToast('Layout do Excel salvo com sucesso!');
    }

    async function onFilesSelected(e) {
        var files = Array.from(e.target.files);
        if(!files.length) return;
        
        document.getElementById('import-alert').style.display = 'none';
        toggleVisibilidadeCarregamento(true, "Iniciando processamento de " + files.length + " arquivo(s)...");

        for (var i = 0; i < files.length; i++) {
            toggleVisibilidadeCarregamento(true, "Processando (" + (i + 1) + "/" + files.length + "): " + files[i].name);
            await processarArquivoIndividual(files[i]);
        }

        toggleVisibilidadeCarregamento(false);
        if(ST.lote.length > 0) {
            ST.idNotaSelecionadaLote = ST.lote[0].id;
        }
        renderLoteCompleto();
        document.getElementById('fileFiles').value = '';
    }

    // ===================================================================
    // SUPORTE A ARQUIVOS COMPACTADOS (.zip, .rar, .7z, .tar, .gz, .bz2 ...)
    // ===================================================================
    // Estratégia:
    //  - .zip é lido com a biblioteca JSZip (carregada no <head>, roda 100%
    //    no navegador, sem depender de WebWorker/WASM externo).
    //  - .rar, .7z, .tar, .gz, .tgz, .bz2, .tbz2 são lidos com a biblioteca
    //    libarchive.js (WASM), carregada sob demanda (só baixa quando o
    //    usuário realmente envia um desses formatos).
    //  - Depois de extraído, cada arquivo interno volta para
    //    processarArquivoIndividual(), então XML/PDF dentro são processados
    //    normalmente e arquivos compactados DENTRO de outros compactados
    //    (zip dentro de zip, por exemplo) também são resolvidos, até um
    //    limite de profundidade para evitar loop infinito.

    var EXTENSOES_ZIP = ['.zip'];
    var EXTENSOES_COMPACTADAS_GENERICO = ['.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.tbz2', '.tbz'];
    var PROFUNDIDADE_MAXIMA_COMPACTADOS = 6;

    function terminaComAlgumaExtensao(nomeMinusculo, listaExtensoes) {
        return listaExtensoes.some(function(ext) { return nomeMinusculo.endsWith(ext); });
    }

    // Carrega a lib libarchive.js (ES module) uma única vez, sob demanda,
    // via import() dinâmico — assim o restante do app continua funcionando
    // como script clássico normal, sem precisar virar type="module".
    var _libArchivePromiseCache = null;
    function carregarLibArchive() {
        if (!_libArchivePromiseCache) {
            var VERSAO_LIBARCHIVE = '2.0.2';
            var baseUrl = 'https://cdn.jsdelivr.net/npm/libarchive.js@' + VERSAO_LIBARCHIVE + '/dist/';
            _libArchivePromiseCache = import(baseUrl + 'libarchive.js').then(function(mod) {
                mod.Archive.init({ workerUrl: baseUrl + 'worker-bundle.js' });
                return mod.Archive;
            });
        }
        return _libArchivePromiseCache;
    }

    async function solicitarSenhaSeNecessario(archive, nomeArquivo) {
        try {
            var temSenha = await archive.hasEncryptedData();
            if (temSenha === true) {
                var senha = window.prompt('O arquivo "' + nomeArquivo + '" está protegido por senha.\nDigite a senha para continuar:');
                if (senha) { await archive.usePassword(senha); }
            }
        } catch (errSenha) {
            // Nem todo formato consegue informar se há senha; segue sem bloquear.
        }
    }

    // Extrai um .zip usando JSZip e reprocessa cada arquivo interno.
    async function processarArquivoZip(file, profundidade) {
        try {
            toggleVisibilidadeCarregamento(true, 'Abrindo arquivo compactado: ' + file.name + '...');
            var zip = await JSZip.loadAsync(file);
            var entradas = [];
            zip.forEach(function(caminhoRelativo, zipEntry) {
                if (!zipEntry.dir) entradas.push(zipEntry);
            });

            if (!entradas.length) {
                mostrarToastAviso('Nenhum arquivo encontrado dentro de: ' + file.name);
                return;
            }

            for (var i = 0; i < entradas.length; i++) {
                var zipEntry = entradas[i];
                var nomeBase = zipEntry.name.split('/').pop();
                if (!nomeBase) continue;
                toggleVisibilidadeCarregamento(true, 'Extraindo de ' + file.name + ': ' + zipEntry.name);
                var blobConteudo = await zipEntry.async('blob');
                var arquivoExtraido = new File([blobConteudo], nomeBase, { type: 'application/octet-stream' });
                await processarArquivoIndividual(arquivoExtraido, profundidade);
            }
        } catch (err) {
            console.error('Erro ao abrir ZIP "' + file.name + '":', err);
            mostrarToastAviso('Não foi possível abrir "' + file.name + '". Verifique se o arquivo não está corrompido ou protegido por senha (ZIP com senha/AES não é suportado).');
        }
    }

    // Extrai .rar, .7z, .tar, .gz, .tgz, .bz2, .tbz2 usando libarchive.js
    // e reprocessa cada arquivo interno.
    async function processarArquivoCompactadoGenerico(file, profundidade) {
        try {
            toggleVisibilidadeCarregamento(true, 'Abrindo arquivo compactado: ' + file.name + '...');
            var Archive = await carregarLibArchive();
            var archive = await Archive.open(file);

            await solicitarSenhaSeNecessario(archive, file.name);

            await archive.extractFiles();
            var listaArquivos = await archive.getFilesArray();

            if (!listaArquivos.length) {
                mostrarToastAviso('Nenhum arquivo encontrado dentro de: ' + file.name);
                return;
            }

            for (var i = 0; i < listaArquivos.length; i++) {
                var entrada = listaArquivos[i];
                var caminhoExibicao = (entrada.path || '') + entrada.file.name;
                toggleVisibilidadeCarregamento(true, 'Extraindo de ' + file.name + ': ' + caminhoExibicao);
                await processarArquivoIndividual(entrada.file, profundidade);
            }
        } catch (err) {
            console.error('Erro ao abrir arquivo compactado "' + file.name + '":', err);
            mostrarToastAviso('Não foi possível abrir "' + file.name + '". Formato não suportado, arquivo corrompido ou senha incorreta.');
        }
    }

    function processarArquivoIndividual(file, profundidade) {
        profundidade = profundidade || 0;
        return new Promise(function(resolve) {
            var extensao = file.name.toLowerCase();
            var dentroDoLimite = profundidade < PROFUNDIDADE_MAXIMA_COMPACTADOS;

            if (dentroDoLimite && terminaComAlgumaExtensao(extensao, EXTENSOES_ZIP)) {
                processarArquivoZip(file, profundidade + 1).then(resolve).catch(function(e) { console.error(e); resolve(); });
            } else if (dentroDoLimite && terminaComAlgumaExtensao(extensao, EXTENSOES_COMPACTADAS_GENERICO)) {
                processarArquivoCompactadoGenerico(file, profundidade + 1).then(resolve).catch(function(e) { console.error(e); resolve(); });
            } else if (!dentroDoLimite && (terminaComAlgumaExtensao(extensao, EXTENSOES_ZIP) || terminaComAlgumaExtensao(extensao, EXTENSOES_COMPACTADAS_GENERICO))) {
                console.warn('Profundidade máxima de arquivos compactados aninhados atingida em: ' + file.name);
                resolve();
            } else if (extensao.endsWith('.xml')) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    executarParseXML(ev.target.result, file.name);
                    resolve();
                };
                reader.onerror = function() { resolve(); };
                reader.readAsText(file, 'UTF-8');
            } else if (extensao.endsWith('.pdf')) {
                var reader2 = new FileReader();
                reader2.onload = function(ev) {
                    executarParsePDF(ev.target.result, file.name).then(resolve);
                };
                reader2.onerror = function() { resolve(); };
                reader2.readAsArrayBuffer(file);
            } else {
                resolve();
            }
        });
    
    }

    function executarParseXML(conteudoTxt, nomeArquivo) {
        try {
            var parser = new DOMParser();
            var xmlDoc = parser.parseFromString(conteudoTxt, 'text/xml');
            
            function buscarTag(pai, tag) {
                var elementos = pai.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', tag);
                if(!elementos.length) elementos = pai.getElementsByTagName(tag);
                return elementos.length ? elementos[0].textContent : '';
            }

            function buscarListaTags(tag) {
                var elementos = xmlDoc.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', tag);
                if(!elementos.length) elementos = xmlDoc.getElementsByTagName(tag);
                return Array.from(elementos);
            }

            var nNF = buscarTag(xmlDoc, 'nNF') || '—';
            var dhEmi = buscarTag(xmlDoc, 'dhEmi') || buscarTag(xmlDoc, 'dEmi') || '';
            var dataFormatada = dhEmi ? dhEmi.slice(0, 10).split('-').reverse().join('/') : '—';
            
            var emitBlocos = buscarListaTags('emit');
            var emitenteNome = emitBlocos.length ? buscarTag(emitBlocos[0], 'xNome') : '—';
            
            var destBlocos = buscarListaTags('dest');
            var destNome = destBlocos.length ? buscarTag(destBlocos[0], 'xNome') : '—';
            var destCNPJ = destBlocos.length ? (buscarTag(destBlocos[0], 'CNPJ') || buscarTag(destBlocos[0], 'CPF')) : '';
            
            destCNPJ = formatarDoc(destCNPJ);

            var pesoBrutoTotalNF = 0;
            buscarListaTags('vol').forEach(function(v) {
                var p = v.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', 'pesoL');
                if(!p.length) p = v.getElementsByTagName('pesoL');
                if(!p.length) p = v.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', 'pesoB');
                if(!p.length) p = v.getElementsByTagName('pesoB');
                if(p.length) pesoBrutoTotalNF += parseFloat(p[0].textContent) || 0;
            });

            var valorTotalNF = 0;
            var icmsTot = buscarListaTags('ICMSTot');
            if(icmsTot.length) valorTotalNF = parseFloat(buscarTag(icmsTot[0], 'vNF')) || 0;

            var itensNota = [];
            buscarListaTags('det').forEach(function(detElement) {
                var prodElement = detElement.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', 'prod')[0] || detElement.getElementsByTagName('prod')[0];
                if(!prodElement) return;

                var xProd = buscarTag(prodElement, 'xProd') || '—';
                var infAdProdEl = detElement.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', 'infAdProd');
                if (!infAdProdEl.length) infAdProdEl = detElement.getElementsByTagName('infAdProd');
                var infAdProd = infAdProdEl.length ? infAdProdEl[0].textContent : '';

                var qtdcxXml = 0, pesocxXml = 0;
                if (infAdProd && infAdProd.includes('|')) {
                    var partesAd = infAdProd.split('|').map(function(p){ return p.trim(); });
                    qtdcxXml = Math.round(parseNumeroBR(partesAd[0] || '0'));
                    if (partesAd.length >= 5) {
                        pesocxXml = parseNumeroBR(partesAd[4]);
                    } else if (partesAd.length >= 4) {
                        pesocxXml = parseNumeroBR(partesAd[3]);
                    }
                }

                var qCom = parseFloat(buscarTag(prodElement, 'qCom')) || 0;
                var uCom = buscarTag(prodElement, 'uCom') || 'UN';
                var vUnCom = parseFloat(buscarTag(prodElement, 'vUnCom')) || 0;
                var vProd = parseFloat(buscarTag(prodElement, 'vProd')) || 0;

                itensNota.push({
                    descRaw: infAdProd || xProd,
                    nome: xProd.trim(),
                    qtdcx: qtdcxXml,
                    pesocx: pesocxXml,
                    qtdOriginal: qCom,
                    unidadeMedida: uCom,
                    vUnitario: vUnCom,
                    vTotalItem: vProd,
                    tipoCalculoItem: 'auto',
                    precoManual: null 
                });
            });

            var notaImportada = {
                id: 'nf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                nNF: nNF,
                dataStr: dataFormatada,
                emitNome: emitenteNome,
                destNome: destNome,
                destCNPJ: destCNPJ,
                pesoB: pesoBrutoTotalNF,
                itens: itensNota,
                vNF: valorTotalNF,
                arquivo: nomeArquivo,
                fonte: 'XML',
                transpId: obterTranspIdPorCliente(destCNPJ, destNome),
                modalidadeCobranca: obterModalidadeCliente(destCNPJ || destNome),
                freteCalculado: 0,
                transpNome: ''
            };
            ST.lote.push(notaImportada);
            setTimeout(function(){ processarCalculosDeFreteNota(notaImportada.id); },0);
        } catch(err) {}
    }

async function executarParsePDF(arrayBuffer, nomeArquivo) {
        try {
            var documentoPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            var todasLinhas  = [];

            for (var pg = 1; pg <= documentoPdf.numPages; pg++) {
                var pagina      = await documentoPdf.getPage(pg);
                var content     = await pagina.getTextContent();
                var grupos = {};
                content.items.forEach(function(item) {
                    var y = Math.round(item.transform[5]);
                    if (!grupos[y]) grupos[y] = [];
                    grupos[y].push(item);
                });
                var ys = Object.keys(grupos).map(Number).sort(function(a,b){ return b-a; });
                ys.forEach(function(y) {
                    var txtLinha = grupos[y]
                        .sort(function(a,b){ return a.transform[4]-b.transform[4]; })
                        .map(function(i){ return i.str; })
                        .join(' ')
                        .replace(/\s+/g,' ')
                        .trim();
                    if (txtLinha) todasLinhas.push(txtLinha);
                });
            }

            var processado = extrairDadosDeTextoDanfe(todasLinhas, nomeArquivo);
            ST.lote.push(processado);
            setTimeout(function(){ processarCalculosDeFreteNota(processado.id); }, 0);
        } catch(e) { console.error('Erro PDF:', e); }
    }


    function extrairDadosDeTextoDanfe(linhas, nomeArquivo) {
        if (typeof linhas === 'string') { linhas = linhas.split('\n'); }

        var textoFlat = linhas.join(' ');

        var nNF = '—';
        var mNF = textoFlat.match(/N\.\s*([\d][\d\.]+)/);
        if (mNF) nNF = mNF[1].replace(/\./g, '');

        var dataStr = '—';
        for (var li = 0; li < linhas.length; li++) {
            var mData = linhas[li].match(/Dt\.Emiss[aã]o:\s*(\d{2}-\d{2}-\d{4})/i);
            if (mData) { dataStr = mData[1].replace(/-/g, '/'); break; }
        }
        if (dataStr === '—') {
            var mD = textoFlat.match(/(\d{2}-\d{2}-\d{4})/);
            if (mD) dataStr = mD[1].replace(/-/g, '/');
        }

        var destNome = '—', destCNPJ = '';
        for (var li = 0; li < linhas.length; li++) {
            if (/NOME\s*\/\s*RAZ[ÃA]O SOCIAL/i.test(linhas[li]) && /CNPJ\/CPF/i.test(linhas[li])) {
                var proxLinha = linhas[li + 1] || '';
                var mDest = proxLinha.match(/^(.+?)\s+\d{4,6}\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+/);
                if (mDest) {
                    destNome = mDest[1].trim();
                    destCNPJ = mDest[2];
                } else {
                    var mDest2 = proxLinha.match(/^(.+?)\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
                    if (mDest2) { destNome = mDest2[1].trim(); destCNPJ = mDest2[2]; }
                }
                break;
            }
        }
        if (!destCNPJ) {
            var cnpjs = textoFlat.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g) || [];
            if (cnpjs.length >= 2) destCNPJ = cnpjs[1];
            else if (cnpjs.length === 1) destCNPJ = cnpjs[0];
        }

        var emitNome = '—';
        for (var li = 0; li < linhas.length; li++) {
            if (/^SAMBA /i.test(linhas[li]) || /FRUTAS TROPICAIS/i.test(linhas[li])) {
                emitNome = linhas[li].trim(); break;
            }
        }

        var pesoB = 0, pesoL = 0;
        for (var li = 0; li < linhas.length; li++) {
            if (/PESO BRUTO/i.test(linhas[li]) && /PESO L[ÍI]QUIDO/i.test(linhas[li])) {
                var lPeso = (linhas[li + 1] || '');
                var todosKg = lPeso.match(/([\d\.]+,[\d]+)\s*Kg/gi) || [];
                if (todosKg.length >= 2) {
                    pesoB = parseNumeroBR(todosKg[0].replace(/Kg/i,'').trim());
                    pesoL = parseNumeroBR(todosKg[1].replace(/Kg/i,'').trim());
                } else if (todosKg.length === 1) {
                    pesoB = parseNumeroBR(todosKg[0].replace(/Kg/i,'').trim());
                }
                break;
            }
        }
        var pesoPadrao = pesoL > 0 ? pesoL : pesoB;

        var vNF = 0;
        for (var li = 0; li < linhas.length; li++) {
            if (/VALOR TOTAL DA NOTA/i.test(linhas[li])) {
                var lVals = (linhas[li + 1] || '');
                var nums = lVals.match(/[\d\.]+,[\d]{2}/g) || [];
                if (nums.length) { vNF = parseNumeroBR(nums[nums.length - 1]); break; }
                var mInline = linhas[li].match(/([\d\.]+,[\d]{2})\s*$/);
                if (mInline) { vNF = parseNumeroBR(mInline[1]); break; }
            }
        }

        var idxInicio = -1, idxFim = linhas.length;
        for (var li = 0; li < linhas.length; li++) {
            if (/DADOS DOS PRODUTOS/i.test(linhas[li])) { idxInicio = li + 1; }
            if (idxInicio > 0 && /C[ÁA]LCULO DO ISSQN/i.test(linhas[li])) { idxFim = li; break; }
        }
        if (idxInicio >= 0 && /C[ÓO]D\.?\s*PROD/i.test(linhas[idxInicio])) idxInicio++;

        var RE_DADOS = /(\d{1,6})\s+(\d{8})\s+(\d{3})\s+(\d{4})\s+(KG|UN|CX|PC|CT|BJ)\s+([\d,\.]+)\s+([\d,\.]+)/i;
        var RE_DADOS_PARCIAL = /(\d{8})\s+(\d{3})\s+(\d{4})\s+(KG|UN|CX|PC|CT|BJ)\s+([\d,\.]+)\s+([\d,\.]+)/i;
        var RE_INLINE = /^(\d{1,6})\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ].+?\|.+?)\s+(\d{8})\s+(\d{3})\s+(\d{4})\s+(KG|UN|CX|PC|CT)\s+([\d,\.]+)\s+([\d,\.]+)/i;
        var RE_LOTE3  = /^(\d{6})(?:\s*\|\s*([\d,\.]+))?/;
        var RE_FEIRNOVA = /^(\d{1,3})\s+(?:\d{8})\s+\d{3}\s+\d{4}\s+(KG|UN|CX|PC|CT)\s+([\d,\.]+)\s+([\d,\.]+)[\s\d,\.]+([A-Z\u00C0-\u00FF][^|]+?)\|\s*([\d,\.]+)\s*\|\s*$/i;

        // NOVO: variante de RE_DADOS / RE_DADOS_PARCIAL para quando a coluna UN. vem colada
        // a um número (ex: "CX18" = caixa de 18un, sem espaço entre a sigla e o número).
        // Layout observado nos DANFEs "Rio Sul" (Seropédica / Itaguaí). Exige pelo menos 1 dígito
        // colado (\d{1,3}), então NUNCA compete com as regex originais acima — só é tentada
        // depois que RE_DADOS e RE_DADOS_PARCIAL já falharam. Isso preserva 100% o comportamento
        // já validado para os outros fornecedores/layouts.
        var RE_DADOS_UNIDCOLADA = /(\d{1,6})\s+(\d{8})\s+(\d{3})\s+(\d{4})\s+(KG|UN|CX|PC|CT|BJ)\d{1,3}\s+([\d,\.]+)\s+([\d,\.]+)/i;
        var RE_DADOS_PARCIAL_UNIDCOLADA = /(\d{8})\s+(\d{3})\s+(\d{4})\s+(KG|UN|CX|PC|CT|BJ)\d{1,3}\s+([\d,\.]+)\s+([\d,\.]+)/i;

        var itens = [];
        var li = idxInicio;
        while (li >= 0 && li < idxFim) {
            var linha = linhas[li].trim();

            var mbFN = RE_FEIRNOVA.exec(linha);
            if (mbFN) {
                var un    = mbFN[2].toUpperCase(); 
                var qtdKg = parseNumeroBR(mbFN[3]); 
                var vUnit = parseNumeroBR(mbFN[4]); 
                var nome  = mbFN[5].trim();          
                var qtdcx = parseNumeroBR(mbFN[6]); 
                var linhaB = (linhas[li + 1] || '').trim();
                var linhaC = (linhas[li + 2] || '').trim();
                var linhaD = (linhas[li + 3] || '').trim();
                var pesocx = 0;
                var segB = linhaB.split('|').map(function(s){ return s.trim(); });
                for (var sb = segB.length - 1; sb >= 0; sb--) {
                    var val = segB[sb].replace(/\s+[\d,\.]+\s*$/, '').trim();
                    if (/^[\d,\.]+$/.test(val) && parseNumeroBR(val) > 0) {
                        pesocx = parseNumeroBR(val); break;
                    }
                }
                if (pesocx === 0 && un === 'KG') pesocx = qtdKg;
                if (nome && nome.length >= 3) {
                    itens.push({ descRaw: nome, nome: nome, qtdcx: qtdcx, pesocx: pesocx,
                        qtdOriginal: qtdKg, unidadeMedida: un, vUnitario: vUnit,
                        vTotalItem: qtdKg * vUnit, tipoCalculoItem: 'auto', precoManual: null });
                }
                li += 2; continue;
            }

            var mb1 = RE_INLINE.exec(linha);
            if (mb1) {
                var descRaw = mb1[2].trim();
                var un      = mb1[6].toUpperCase();
                var qtdKg   = parseNumeroBR(mb1[7]);
                var vUnit   = parseNumeroBR(mb1[8]);
                var partes  = descRaw.split('|').map(function(p){ return p.trim(); });
                var nome    = partes[0];
                var qtdcx   = parseNumeroBR(partes[1] || '0');
                var pesocx  = parseNumeroBR(partes[4] || '0');
                if (qtdcx === 0 && un === 'KG') { pesocx = qtdKg; }
                if (nome && nome.length >= 3 && !/BOL=|Venc=|OUT=/i.test(nome)) {
                    itens.push({ descRaw:descRaw, nome:nome, qtdcx:qtdcx, pesocx:pesocx,
                        qtdOriginal:qtdKg, unidadeMedida:un, vUnitario:vUnit,
                        vTotalItem:qtdKg*vUnit, tipoCalculoItem:'auto', precoManual:null });
                }
                li++; continue;
            }

            var temPipe  = linha.indexOf('|') >= 0;
            var iniciaMaiusc = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(linha);
            var naoEDados = !RE_DADOS.test(linha);
            if (temPipe && iniciaMaiusc && naoEDados && !/BOL=|Venc=|OUT=/i.test(linha)) {
                var descLinha1 = linha;
                var linhaDados = (linhas[li + 1] || '').trim();
                var md = RE_DADOS.exec(linhaDados);
                if (!md) md = RE_DADOS_UNIDCOLADA.exec(linhaDados); // NOVO: fallback unidade colada (ex: CX18)
                var mdParcial = !md ? RE_DADOS_PARCIAL.exec(linhaDados) : null;
                if (!md && !mdParcial) mdParcial = RE_DADOS_PARCIAL_UNIDCOLADA.exec(linhaDados); // NOVO
                if (md || mdParcial) {
                    var _m     = md || mdParcial;
                    var _off   = md ? 0 : -1; // parcial: grupos deslocados (sem cod_prod)
                    var un     = _m[md ? 5 : 4].toUpperCase();
                    var qtdKg  = parseNumeroBR(_m[md ? 6 : 5]);
                    var vUnit  = parseNumeroBR(_m[md ? 7 : 6]);
                    var linhaLote = (linhas[li + 2] || '').trim();
                    var descCompleta = descLinha1.replace(/\s*Lote:\s*$/i, '');
                    var pesocx = 0;
                    var qtdcx  = 0;
                    var li_avancar = 2; // default: pula desc + dados

                    // Padrão 1: RE_LOTE3 — começa com 6 dígitos: "062026 | 20,0000"
                    var temLote3 = RE_LOTE3.test(linhaLote);
                    // Padrão 2: ^Lote: — "Lote: 062026 | 18,0000"
                    var temLoteDireto = /^Lote:/i.test(linhaLote);
                    // Padrão 3: PALAVRA | Lote: ... | num — "MDG | Lote:..." ou "PAPAIA | Lote:..."
                    var RE_SIGLALOTE = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-z]+\s*\|.*Lote:.*\|\s*([\d,\.]+)/i;
                    var mSiglaLote = RE_SIGLALOTE.exec(linhaLote);
                    // Padrão 4: começa com | — "| Lote: 062026 | 15,0000" (Laranja Baia)
                    var mPipeLote = /^\|\s*Lote:\s*\d+\s*\|\s*([\d,\.]+)/.exec(linhaLote);
                    // Padrão 5: só número — "18,0000" (Berinjela, Inhame, Maca Gala)
                    var mSoNum = /^([\d,\.]+)$/.exec(linhaLote.trim());
                    // Padrão 6: qtdcx | SIGLA | Lote: ... | pesocx — "1,0000 | CPG | Lote: 062026 | 1,2000" (Morango, Uva)
                    var mQtdLote = /^([\d,\.]+)\s*\|.*Lote:.*\|\s*([\d,\.]+)/i.exec(linhaLote);
                    // Padrão 7: vFCP — "240.00 | vFCP: 4.80" (Banana Passas — qtdcx já está no desc, pesocx = qtdKg)
                    var temVFCP = /vFCP/i.test(linhaLote);

                    if (temLote3 || temLoteDireto) {
                        var loteSemPref = linhaLote.replace(/^Lote:\s*/i, '');
                        var segs = loteSemPref.split('|').map(function(s){ return s.trim(); });
                        for (var sl = segs.length - 1; sl >= 0; sl--) {
                            if (/^[\d,\.]+$/.test(segs[sl]) && parseNumeroBR(segs[sl]) > 0) {
                                pesocx = parseNumeroBR(segs[sl]); break;
                            }
                        }
                        descCompleta += ' | ' + loteSemPref;
                        li_avancar = 3;
                    } else if (mQtdLote && !mSiglaLote) {
                        // Padrão 6: qtdcx e pesocx vêm inteiramente da linhaLote
                        qtdcx = parseNumeroBR(mQtdLote[1]);
                        pesocx = parseNumeroBR(mQtdLote[2]);
                        li_avancar = 3;
                    } else if (mSiglaLote) {
                        // Padrão 3: PAPAIA | Lote: ... | pesocx
                        pesocx = parseNumeroBR(mSiglaLote[1]);
                        li_avancar = 3;
                    } else if (mPipeLote) {
                        // Padrão 4: | Lote: 062026 | 15,0000
                        pesocx = parseNumeroBR(mPipeLote[1]);
                        li_avancar = 3;
                    } else if (mSoNum) {
                        // Padrão 5: só o peso numa linha isolada
                        pesocx = parseNumeroBR(mSoNum[1]);
                        li_avancar = 3;
                    } else if (temVFCP) {
                        // Padrão 7: vBCFCP — pesocx está na linhaDados antes do NCM: "25 CPG | Lote: | 4,8000 | vBCFCP: NCM..."
                        var mPesoBCFCP = /\|\s*([\d,\.]+)\s*\|\s*vBCFCP/i.exec(linhaDados);
                        pesocx = mPesoBCFCP ? parseNumeroBR(mPesoBCFCP[1]) : qtdKg;
                        li_avancar = 3;
                    } else {
                        li_avancar = 2;
                    }

                    // qtdcx: se ainda 0, extrai do desc (partes[1])
                    var partes = descCompleta.split('|').map(function(p){ return p.trim(); });
                    var nome   = partes[0].trim();
                    if (qtdcx === 0) {
                        qtdcx = parseNumeroBR(partes[1] || '0');
                    }
                    // pesocx fallback: varre partes da desc de trás pra frente
                    if (pesocx === 0) {
                        for (var pi = partes.length - 1; pi >= 2; pi--) {
                            if (/^[\d,\.]+$/.test(partes[pi].trim()) && parseNumeroBR(partes[pi]) > 0) {
                                pesocx = parseNumeroBR(partes[pi]); break;
                            }
                        }
                    }
                    if (qtdcx === 0 && un === 'KG') { pesocx = qtdKg; }
                    // Fallback BJ/UN: se qtdcx ainda zerado, usa quantidade da NF
                    if (qtdcx === 0 && (un === 'BJ' || un === 'UN')) { qtdcx = qtdKg; }
                    li += li_avancar;
                    if (nome && nome.length >= 3) {
                        itens.push({ descRaw:descCompleta, nome:nome, qtdcx:qtdcx, pesocx:pesocx,
                            qtdOriginal:qtdKg, unidadeMedida:un, vUnitario:vUnit,
                            vTotalItem:qtdKg*vUnit, tipoCalculoItem:'auto', precoManual:null });
                    }
                    continue;
                } else {
                    var descCompleta = descLinha1.replace(/\s*Lote:\s*$/i, '');
                    var partes = descCompleta.split('|').map(function(p){ return p.trim(); });
                    var nome  = partes[0].trim();
                    var temPalavraReal = /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-záàâãéêíóôõúç]{4,}/.test(nome);
                    if (!temPalavraReal) { li++; continue; }
                    var qtdcx = parseNumeroBR(partes[1] || '0');
                    var pesocx = 0;
                    for (var pi = partes.length - 1; pi >= 2; pi--) {
                        var seg = partes[pi].trim();
                        if (/^[\d,\.]+$/.test(seg) && parseNumeroBR(seg) > 0) {
                            pesocx = parseNumeroBR(seg); break;
                        }
                    }
                    var numsDadosFallback = linhaDados.match(/([\d]+[,\.][\d]+)/g) || [];
                    var qtdKg = numsDadosFallback.length ? parseNumeroBR(numsDadosFallback[numsDadosFallback.length - 2] || '0') : 0;
                    var vUnit = numsDadosFallback.length ? parseNumeroBR(numsDadosFallback[numsDadosFallback.length - 1] || '0') : 0;
                    var mUN = linhaDados.match(/\b(KG|UN|CX|PC|CT)\b/i);
                    var un = mUN ? mUN[1].toUpperCase() : 'KG';
                    if (qtdcx === 0 && un === 'KG') { pesocx = qtdKg; }
                    // Fallback BJ/UN: se qtdcx ainda zerado, usa quantidade da NF
                    if (qtdcx === 0 && (un === 'BJ' || un === 'UN')) { qtdcx = qtdKg; }
                    if (nome && nome.length >= 3) {
                        itens.push({ descRaw:descCompleta, nome:nome, qtdcx:qtdcx, pesocx:pesocx,
                            qtdOriginal:qtdKg, unidadeMedida:un, vUnitario:vUnit,
                            vTotalItem:qtdKg*vUnit, tipoCalculoItem:'auto', precoManual:null });
                    }
                    li += 2; continue;
                }
            }
            li++;
        }

        return {
            id:       'nf_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
            nNF:      nNF,
            dataStr:  dataStr,
            emitNome: emitNome,
            destNome: destNome,
            destCNPJ: destCNPJ,
            pesoB:    pesoPadrao,
            itens:    itens,
            vNF:      vNF,
            arquivo:  nomeArquivo,
            fonte:    'PDF',
            transpId: obterTranspIdPorCliente(destCNPJ, destNome),
            freteCalculado: 0,
            transpNome: ''
        };
    }


    function obterTranspIdPorCliente(cnpj, nome) {
        var chave = cnpj || nome || '';
        if (!chave) return '';
        var chaveNorm = chave.toLowerCase().replace(/[\s\.\/\-]/g,'');
        var regra = ST.destinatarios.find(function(x) {
            if (!x.cnpj) return false;
            var xNorm = x.cnpj.toLowerCase().replace(/[\s\.\/\-]/g,'');
            return xNorm === chaveNorm || chaveNorm.includes(xNorm) || xNorm.includes(chaveNorm);
        });
        return (regra && regra.transpId) ? regra.transpId : '';
    }

    function obterModalidadeCliente(chaveCliente) {
        if(!chaveCliente) return 'kg';
        var chaveNorm = chaveCliente.toLowerCase().replace(/[\s\.\/\-]/g,'');
        var d = ST.destinatarios.find(function(x) {
            if (!x.cnpj) return false;
            var xNorm = x.cnpj.toLowerCase().replace(/[\s\.\/\-]/g,'');
            return xNorm === chaveNorm || chaveNorm.includes(xNorm) || xNorm.includes(chaveNorm);
        });
        return d ? d.modal : 'kg';
    }

    function processarCalculosDeFreteNota(idNota) {
        var nf = ST.lote.find(n => n.id === idNota);
        if(!nf) return;

        var modalidadePadraoCliente = nf.modalidadeCobranca || obterModalidadeCliente(nf.destCNPJ || nf.destNome);
        var transp = ST.transportadoras.find(t => t.id === nf.transpId);

        if (!transp) {
            nf.freteCalculado = 0;
            nf.transpNome = '';
            return;
        }

        nf.transpNome = transp.nome;
        var somatorioFrete = 0;
        var somatorioFreteNormal = 0;
        var somatorioFreteExcecao = 0;
        var totalPesoBrutoItensCalculado = 0;
        var totalPesoNormal = 0;
        var totalPesoExcecao = 0;
        var totalCxNormal = 0;
        var totalCxExcecao = 0;

        nf.itens.forEach(function(it) {
            var modCalculoReal = modalidadePadraoCliente;
            var temExcecao = false;
            var precoExcecao = 0;
            var modExcecao = '';

            if (transp.excecoesProdutos && transp.excecoesProdutos.length > 0) {
                var nomeNorm = it.nome.toLowerCase().trim();
                var exc = transp.excecoesProdutos.find(function(e) {
                    return nomeNorm.includes(e.nomeProd.toLowerCase().trim());
                });
                
                if (exc) {

                    
                    if(it.pesocx === 0 && exc.pesoRegra){
                        it.qtdcx = it.qtdOriginal / (it.pesocx = exc.pesoRegra);
                    }// ↑ Verifica se há regra cadastrada de peso fixo e aplica
                
                    var pesoMaxExc = parseNumeroBR(exc.pesoMax || '0');
                    var pesoOk = pesoMaxExc <= 0 || it.pesocx <= pesoMaxExc;
                    if (pesoOk) {
                        temExcecao = true;
                        precoExcecao = parseNumeroBR(exc.preco);
                        modExcecao = exc.tipoCobranca;
                        modCalculoReal = modExcecao;
                    }
                }
            }

            it.temExcecao = temExcecao;
            it.tipoCalculoItem = temExcecao ? modCalculoReal + ' (Exc)' : modCalculoReal;

            var pesoCalculadoItem = (it.qtdcx === 0) ? it.pesocx : (it.qtdcx * it.pesocx);
            totalPesoBrutoItensCalculado += pesoCalculadoItem;

            var precoBase = modCalculoReal === 'cx' ? parseNumeroBR(transp.pCx) : parseNumeroBR(transp.pKg);
            if (temExcecao) precoBase = precoExcecao;

            var modalEfetivo = (it.qtdcx === 0) ? 'kg' : modCalculoReal;
            var valorItem = modalEfetivo === 'cx' ? (it.qtdcx * precoBase) : (pesoCalculadoItem * precoBase);

            if (it.precoManual !== null && it.precoManual !== undefined && it.precoManual !== '' && !isNaN(parseFloat(it.precoManual))) {
                precoBase = parseNumeroBR(it.precoManual);
                valorItem = modCalculoReal === 'cx' ? (it.qtdcx * precoBase) : (pesoCalculadoItem * precoBase);
            }


                


            it.precoCobrado = precoBase;
            somatorioFrete += valorItem;

            // Acumula separado normal vs exceção
            if (temExcecao) {
                somatorioFreteExcecao += valorItem;
                totalPesoExcecao += pesoCalculadoItem;
                totalCxExcecao += it.qtdcx;
            } else {
                somatorioFreteNormal += valorItem;
                totalPesoNormal += pesoCalculadoItem;
                totalCxNormal += it.qtdcx;
            }
        });

        nf.pesoCalculado      = totalPesoBrutoItensCalculado;
        nf.pesoNormal         = totalPesoNormal;
        nf.pesoExcecao        = totalPesoExcecao;
        nf.totalCxNormal      = totalCxNormal;
        nf.totalCxExcecao     = totalCxExcecao;
        nf.freteNormal        = somatorioFreteNormal;
        nf.freteExcecao       = somatorioFreteExcecao;
        nf.temItensExcecao    = nf.itens.some(function(it){ return it.temExcecao; });

        if (totalPesoBrutoItensCalculado === 0 && modalidadePadraoCliente === 'kg') {
            somatorioFrete = nf.pesoB * parseNumeroBR(transp.pKg);
        }

        nf.freteCalculado = somatorioFrete;
    }

    function renderLoteCompleto() {
        var container = document.getElementById('lote-container');
        if (!ST.lote.length) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';
        document.getElementById('txt-lote-count').textContent = ST.lote.length + " nota(s) carregada(s) no lote atual";

        var totalPesoLote = 0, totalCxLote = 0, totalValorNotasLote = 0, totalFreteLote = 0;
        ST.lote.forEach(function(nf) {
            totalPesoLote += (nf.pesoCalculado > 0 ? nf.pesoCalculado : nf.pesoB);
            totalValorNotasLote += nf.vNF;
            totalFreteLote += (nf.freteCalculado || 0);
            nf.itens.forEach(function(it) { totalCxLote += it.qtdcx; });
        });

        document.getElementById('lote-totais-cards').innerHTML =
            '<div class="tot-card"><div class="tot-label">Peso Bruto Lote</div><div class="tot-val">' + formatarPeso(totalPesoLote) + ' kg</div></div>' +
            '<div class="tot-card"><div class="tot-label">Qtd Caixas Lote</div><div class="tot-val">' + totalCxLote.toFixed(0) + ' cx</div></div>' +
            '<div class="tot-card"><div class="tot-label">Valor Total NFs</div><div class="tot-val">' + formatarMoeda(totalValorNotasLote) + '</div></div>' +
            '<div class="tot-card"><div class="tot-label">Frete Estimado Total</div><div class="tot-val">' + formatarMoeda(totalFreteLote) + '</div></div>';

        var rootGridCards = document.getElementById('lote-cards-root');
        rootGridCards.innerHTML = '';

       
        ST.lote.forEach(function(nf) {
            var aberto = (ST.idNotaSelecionadaLote === nf.id);
            var modalidadeCliente = nf.modalidadeCobranca || obterModalidadeCliente(nf.destCNPJ || nf.destNome);

            var divCard = document.createElement('div');
            divCard.className = 'lote-card' + (aberto ? ' selected' : '');

            var totalCxNota = nf.itens.reduce(function(acc, i){ return acc + i.qtdcx; }, 0);
            var pesoTotal   = (nf.pesoCalculado > 0 ? nf.pesoCalculado : nf.pesoB);

            
            temItemSemPeso = nf.itens.some(function(it) {
                               
                var mod = it.tipoCalculoItem.replace(' (Exc)', '').toLowerCase(); 

                
                if(it.precoCobrado < 0.01) return true
                if (mod === 'cx' ) { 
                            return !(it.qtdcx > 0) ;                    
                } else {                          
                            return !(((it.qtdcx === 0) ? it.pesocx  : (it.qtdcx * it.pesocx)) > 0 ) ; 
                }     
                
        });            

            var statusOk = nf.itens.length > 0 && nf.freteCalculado > 0 && !temItemSemPeso ;
           
            var statusBadge = statusOk
                ? '<span class="badge bg-ok">Ok</span>'
                : '<span class="badge bg-warn">Verificar</span>';

            var optTransp = '<option value="">Transportadora...</option>';
            ST.transportadoras.forEach(function(t) {
                optTransp += '<option value="'+t.id+'"'+(nf.transpId===t.id?' selected':'')+'>'+t.nome+'</option>';
            });

            divCard.innerHTML =
                '<div class="lote-card-title">NF ' + nf.nNF + '</div>' +
                '<div style="display:flex;flex-direction:column;flex:1;overflow:hidden;">' +
                    '<div class="lote-card-sub">' + nf.destNome + '</div>' +
                    (nf.destCNPJ ? '<div style="font-size:10px;color:var(--color-text-muted);">' + nf.destCNPJ + '</div>' : '') +
                '</div>' +
                '<span class="badge bg-' + nf.fonte.toLowerCase() + '" style="flex-shrink:0;">' + nf.fonte + '</span>' +
                statusBadge +
                '<span style="font-size:11px;color:var(--color-text-muted);white-space:nowrap;flex-shrink:0;">' +
                    formatarPeso(pesoTotal) + ' kg · ' + totalCxNota.toFixed(0) + ' cx · ' + formatarMoeda(nf.freteCalculado > 0 ? nf.freteCalculado : nf.vNF) +
                '</span>' +
                '<span class="card-transp-placeholder"></span>';


            
            var selEl = document.createElement('select');
            selEl.className = 'input-edit select-transp-lote';
            selEl.style.cssText = 'min-width:150px; flex-shrink:0; font-size:11px;';
            selEl.innerHTML = optTransp;

            
            
            // LÓGICA DO MENU FLUTUANTE — aparece só na primeira nota do lote
            (function(nfId){ 
                selEl.onchange = function(e){ 
                    e.stopPropagation(); 
                    if(!this.value) {
                        alterarTransportadoraNota(nfId, '');
                        return;
                    }
                    var isPrimeiraNota = ST.lote.length > 0 && ST.lote[0].id === nfId;
                    if (isPrimeiraNota) {
                        var rect = this.getBoundingClientRect();
                        var menu = document.getElementById('menu-float-transp');
                        menu.style.display = 'block';
                        menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
                        menu.style.left = (rect.left + window.scrollX - 100) + 'px';
                        menuFloatCtx.idNota = nfId;
                        menuFloatCtx.idTransp = this.value;
                    } else {
                        alterarTransportadoraNota(nfId, this.value);
                    }
                }; 
            })(nf.id);

            selEl.onclick = function(e){ e.stopPropagation(); };
            divCard.querySelector('.card-transp-placeholder').replaceWith(selEl);

            (function(nfId){
                divCard.onclick = function(e) {
                    if (e.target.closest('select') || e.target.closest('.lote-card-toggle')) return;
                    ST.idNotaSelecionadaLote = (ST.idNotaSelecionadaLote === nfId) ? null : nfId;
                    renderLoteCompleto();

                    var cardAberto = rootGridCards.querySelector('.lote-card.selected');
                    if (ST.idNotaSelecionadaLote === nfId && cardAberto) {
                           
                        cardAberto.scrollIntoView({ behavior: "auto", block: "start", inline: "center" });
                    }
                };

                var btnToggle = divCard.querySelector('.lote-card-toggle');
                if (btnToggle) {
                    btnToggle.onclick = function(e) {
                        e.stopPropagation();
                        ST.idNotaSelecionadaLote = (ST.idNotaSelecionadaLote === nfId) ? null : nfId;
                        renderLoteCompleto();
                    };
                }
            })(nf.id);

            rootGridCards.appendChild(divCard);

            var divItens = document.createElement('div');
            divItens.className = 'lote-card-itens' + (aberto ? ' aberto' : '');

            if (aberto) {
                var tabelaHtml =
                    '<div class="table-wrap">' +
                    '<table>' +
                    '<thead><tr>' +
                    '<th>Produto</th>' +
                    '<th style="width:80px;text-align:center;">Qtd NF</th>' +
                    '<th style="width:100px;">Qtd Cx</th>' +
                    '<th style="width:110px;">Kg / Cx</th>' +
                    '<th style="width:110px;">Peso Total</th>' +
                    '<th style="width:100px;">Valor Item</th>' +
                    '<th style="width:70px;">Modal</th>' +
                    '<th style="width:110px;">Preço Unit.</th>' +
                    '</tr></thead>' +
                    '<tbody id="itens-tbody-' + nf.id + '"></tbody>' +
                    '</table>' +
                    '</div>';

                var modalOpts = '<option value="kg"' + (modalidadeCliente==='kg'?' selected':'') + '>Por KG</option>' +
                                '<option value="cx"' + (modalidadeCliente==='cx'?' selected':'') + '>Por Caixa</option>';

                divItens.innerHTML =
                    '<div style="background: var(--color-bg-main);border-radius: 8px;padding: 9px;display: flex;align-items: center;justify-content: space-between;flex-wrap: wrap;gap: 16px;margin: 10px;border: 1px solid var(--color-border-light);">' +
                        '<span style="font-size:11px;font-weight:600;color:var(--color-text-sub);">Cobrança:</span>' +
                        '<select class="input-edit" style="font-size:11px;padding:3px 6px;width: 7%;" onchange="alterarModalidadeNota(\''+nf.id+'\',this.value)">'+modalOpts+'</select>' +
                        '<span style="margin-left:auto;font-size:22px; font-weight:800; color:var(--color-success);">Valor → '+formatarMoeda(nf.freteCalculado)+'</span>' +
                    '</div>' +
                    tabelaHtml;

                divItens.style.borderRadius = '0 0 6px 6px';
                rootGridCards.appendChild(divItens);

                var tbody = divItens.querySelector('#itens-tbody-' + nf.id);
                nf.itens.forEach(function(it, index) {
                    var pesoTotalItem = (it.qtdcx === 0) ? it.pesocx : (it.qtdcx * it.pesocx);
                    var tr = document.createElement('tr');
                    // Destaque visual para itens com exceção
                    var excLabel = it.temExcecao ? ' <span style="font-size: 11px;color: #ff0000;font-weight: 700;">(exc)</span>' : '';
                    tr.innerHTML =
                        '<td style="font-weight:500;">' + it.nome + excLabel + '</td>' +
                        '<td style="text-align:center;color:var(--color-text-sub);">' + it.qtdOriginal + ' ' + it.unidadeMedida + '</td>' +
                        '<td><input type="number" class="input-edit" step="1" value="'+it.qtdcx+'" onchange="atualizarDadosItemLote(\''+nf.id+'\','+index+',\'qtdcx\',this.value)"></td>' +
                        '<td><input type="number" class="input-edit" step="0.001" value="'+it.pesocx+'" onchange="atualizarDadosItemLote(\''+nf.id+'\','+index+',\'pesocx\',this.value)"></td>' +
                        '<td style="font-weight:600;color:var(--color-text-sub);">' + formatarPeso(pesoTotalItem) + ' kg</td>' +
                        '<td>' + formatarMoeda(it.vTotalItem) + '</td>' +
                        '<td style="font-weight:600; font-size:10px;">' + (it.tipoCalculoItem||'kg').toUpperCase() + '</td>' +
                        '<td><input type="number" class="input-edit" step="0.0001" value="'+(it.precoManual != null ? it.precoManual : (it.precoCobrado||0))+'" onchange="atualizarDadosItemLote(\''+nf.id+'\','+index+',\'precoManual\',this.value)"></td>';
                    tbody.appendChild(tr);
                });
                // Rodapé discreto se houver itens de exceção
                if (nf.temItensExcecao) {
                    var trSep = document.createElement('tr');
                    trSep.innerHTML = '<td colspan="8" style="background:#fef9c3;padding:5px 10px;font-size:11px;font-weight:700;color:#92400e;border-top:2px solid #f59e0b;">' +
                        '⚡ Exceção: ' + formatarMoeda(nf.freteExcecao) + ' · ' +
                        'Normal: ' + formatarMoeda(nf.freteNormal) + ' · ' +
                        'Total: ' + formatarMoeda(nf.freteCalculado) +
                        '</td>';
                    tbody.appendChild(trSep);
                }
            } else {
                rootGridCards.appendChild(divItens);
            } 
        });
    
    }

    // AÇÕES DO MENU FLUTUANTE
    function execFloatTransp(acao) {
        document.getElementById('menu-float-transp').style.display = 'none';
        var idNota = menuFloatCtx.idNota;
        var idTransp = menuFloatCtx.idTransp;
        if(!idNota || !idTransp) return;

        var nf = ST.lote.find(n => n.id === idNota);
        if(!nf) return;

        if(acao === 'vincular') {
            // Transportadora e modalidade vêm sempre da primeira nota do lote
            var nfRef = ST.lote[0];
            var transpIdRef = nfRef ? (nfRef.transpId || idTransp) : idTransp;
            var modalidadeReferencia = nfRef ? (nfRef.modalidadeCobranca || 'kg') : 'kg';

            // Coleta todos os CNPJs/nomes distintos do lote
            var cnpjsVistos = {};
            ST.lote.forEach(function(n) {
                var chaveN = (n.destCNPJ || n.destNome || '').trim();
                if (!chaveN) return;
                var norm = chaveN.toLowerCase().replace(/[\s\.\/\-]/g,'');
                if (!cnpjsVistos[norm]) cnpjsVistos[norm] = chaveN;
            });

            // Para cada CNPJ distinto: atualiza ou cria regra em ST.destinatarios
            Object.keys(cnpjsVistos).forEach(function(norm) {
                var chaveN = cnpjsVistos[norm];
                var regra = ST.destinatarios.find(function(x) {
                    return x.cnpj.toLowerCase().replace(/[\s\.\/\-]/g,'') === norm;
                });
                if (regra) {
                    regra.transpId = transpIdRef;
                    regra.modal = modalidadeReferencia;
                } else {
                    ST.destinatarios.push({
                        id: 'd_' + Date.now() + '_' + norm.slice(0,6),
                        cnpj: chaveN,
                        transpId: transpIdRef,
                        modal: modalidadeReferencia
                    });
                }
            });

            persistirDados();
            renderConfiguracoes();
            mostrarToast('Todos os CNPJs do lote vinculados nas configurações!');

            // Aplica transportadora E modalidade a todas as notas do lote
            ST.lote.forEach(function(n) {
                n.transpId = transpIdRef;
                n.modalidadeCobranca = modalidadeReferencia;
                n.itens.forEach(function(it) {
                    it.tipoCalculoItem = modalidadeReferencia;
                    it.precoManual = null;
                });
                processarCalculosDeFreteNota(n.id);
            });
        } 
        else if(acao === 'todos') {
            ST.lote.forEach(function(n) {
                n.transpId = idTransp;
                n.modalidadeCobranca = ST.lote[0].modalidadeCobranca;
                processarCalculosDeFreteNota(n.id);
            });
            mostrarToast('Transportadora aplicada a todo o lote atual.');
        }
        else if(acao === 'apenas') {
            nf.transpId = idTransp;
            processarCalculosDeFreteNota(idNota);
        }

        renderLoteCompleto();
    }

    function alterarModalidadeNota(idNota, modalidade) {
        var nf = ST.lote.find(n => n.id === idNota);
        if(!nf) return;
        nf.modalidadeCobranca = modalidade;
        
        nf.itens.forEach(function(it){
            it.tipoCalculoItem = modalidade;
            it.precoManual = null;
        });
        processarCalculosDeFreteNota(idNota);
        renderLoteCompleto();
    }

    function atualizarDadosItemLote(idNota, indexItem, campo, valor) {
        var nf = ST.lote.find(n => n.id === idNota);
        if(!nf) return; 

        if (campo === 'nome' || campo === 'tipoCalculoItem') {
            nf.itens[indexItem][campo] = valor;
        } else {
            nf.itens[indexItem][campo] = parseNumeroBR(valor);
        }

        var novoPesoCapa = 0;
        nf.itens.forEach(function(i) { novoPesoCapa += (i.qtdcx * i.pesocx); });
        if(novoPesoCapa > 0) nf.pesoB = novoPesoCapa;

        //alert( document.querySelector('#itens-tbody-' + nf.id +' tr:nth-of-type('+ (indexItem+1) +') td:nth-of-type(7)').textContent); 
        //alert( document.getElementById('itens-tbody-' + nf.id).querySelectorAll('tr')[indexItem].querySelectorAll('td')[6].innerText  );
        cobrancaTipo = document.querySelector('#itens-tbody-' + nf.id +' tr:nth-of-type('+ (indexItem+1) +') td:nth-of-type(7)').textContent;
        
            // CONDIÇÕES PARA ENTRAR NO IF
        c1 = nf.itens[indexItem] === ST.lote[0].itens[0];
        c2 = campo === 'pesocx';

        if(c1 && c2 ){
            abrirModal(
                'ALTERAR KG / CX',
                'Deseja alterar o peso por caixa de todos os itens em todas as notas ?',
                function() { 
                    ST.lote.forEach(function(n) { //PARA ALTERAR TODOS OS PESOS DOS ITENS DO LOTE
                        n.itens.forEach(function(it) { 
                            it.qtdcx =  it.qtdOriginal / valor;
                            it.pesocx = valor
                        });
                        processarCalculosDeFreteNota(n.id);
                    
                    });
                    renderLoteCompleto();
                mostrarToast('\u2713 Conluído com sucesso. \n'+ (ST.lote.length > 1 ? 'Foram alteradas '+ ST.lote.length +' notas.': 'A nota foi alterada') );
            });  

        }
        if(campo === 'pesocx' &&  valor > 0) nf.itens[indexItem].qtdcx = nf.itens[indexItem].qtdOriginal / valor ; 

        processarCalculosDeFreteNota(idNota);
        renderLoteCompleto();
    
    }

    function alterarTransportadoraNota(idNota, idTransp) {
        // Função agora usada apenas para quando o select é limpo ("Nenhuma transportadora")
        var nfIndex = ST.lote.findIndex(n => n.id === idNota);
        if(nfIndex === -1) return;
        ST.lote[nfIndex].transpId = idTransp;
        processarCalculosDeFreteNota(ST.lote[nfIndex].id);
        renderLoteCompleto();
    }

    function limparLoteAtual() {
        ST.lote = [];
        ST.idNotaSelecionadaLote = null;
        renderLoteCompleto();
    }

    function salvarLoteCompleto() {
        if(!ST.lote.length) return;
        var contagemSalvos = 0;

        ST.lote.forEach(function(nf) {
            var tsBase = Date.now() + Math.random();
            var idPrincipal = tsBase;

            var itensNormais   = nf.itens.filter(function(it){ return !it.temExcecao; });
            var itensExcecao   = nf.itens.filter(function(it){ return it.temExcecao; });
            var temExc         = nf.temItensExcecao && itensExcecao.length > 0;

            // Usa valores separados se disponíveis, senão usa totais
            var pesoNorm = temExc ? (nf.pesoNormal || 0)   : ((nf.pesoCalculado > 0) ? nf.pesoCalculado : nf.pesoB);
            var pesoExc  = temExc ? (nf.pesoExcecao || 0)  : 0;
            var cxNorm   = temExc ? (nf.totalCxNormal || 0) : nf.itens.reduce(function(a,i){ return a+i.qtdcx; }, 0);
            var cxExc    = temExc ? (nf.totalCxExcecao || 0): 0;
            var frNorm   = temExc ? (nf.freteNormal || 0)   : nf.freteCalculado;
            var frExc    = temExc ? (nf.freteExcecao || 0)  : 0;

            // Registro PRINCIPAL (itens normais)
            if(nf.itens.filter(it => !it.temExcecao).length > 0) {
            ST.registros.unshift({
                id: idPrincipal,
                data: nf.dataStr,
                nNF: nf.nNF,
                emitente: nf.emitNome,
                destinatario: nf.destNome,
                destCNPJ: nf.destCNPJ,
                pesoKg: pesoNorm,
                totalCx: cxNorm,
                valorNF: nf.vNF,
                transportadora: nf.transpNome || 'Sem Transportadora',
                frete: frNorm,
                freteUnitKg: pesoNorm > 0 ? frNorm / pesoNorm : 0,
                freteUnitCx: cxNorm  > 0 ? frNorm / cxNorm  : 0,
                fonte: nf.fonte,
                isExcecao: false,
                itens: JSON.parse(JSON.stringify(temExc ? itensNormais : nf.itens))
            });
            }
            contagemSalvos++;
   
           
            // Registro de EXCEÇÃO (apenas itens com exceção)
            if (temExc) {
                ST.registros.unshift({
                    id: tsBase + 0.5,
                    nfOrigemId: idPrincipal,
                    data: nf.dataStr,
                    nNF: nf.nNF,
                    emitente: nf.emitNome,
                    destinatario: nf.destNome,
                    destCNPJ: nf.destCNPJ,
                    pesoKg: pesoExc,
                    totalCx: cxExc,
                    valorNF: 0,
                    transportadora: nf.transpNome || 'Sem Transportadora',
                    frete: frExc,
                    freteUnitKg: pesoExc > 0 ? frExc / pesoExc : 0,
                    freteUnitCx: cxExc  > 0 ? frExc / cxExc  : 0,
                    fonte: nf.fonte,
                    isExcecao: true,
                    itens: JSON.parse(JSON.stringify(itensExcecao))
                });
            }
        });

        persistirDados();
        limparLoteAtual();
        exibirAlertaGlobal('import-alert', "Sucesso! " + contagemSalvos + " notas fiscais foram processadas e salvas no histórico definitivo.", 'success');
    }

            //INCLUSÃO NO BANCO TESTE INICIAL
      async function enviarParaBanco() {
        for (const nf of ST.lote) {
            
            const dados = {
                data: nf.dataStr,
                nNF: nf.nNF,
                frete: nf.freteCalculado,
                destinatario: nf.destNome,
                destCNPJ: nf.destCNPJ,
                valorNF: nf.vNF,
                transportadora: nf.transpNome || 'Sem Transportadora',
                fonte: nf.fonte,
                totalCx: nf.totalCx,
                pesoKg: nf.pesoCalculado,
                freteUnitKg: nf.freteUnitKg , 
                freteUnitCx: nf.freteUnitCx ,
            };

            for (const it of nf.itens) {
                const item = {
                    nome: it.nome,
                    qtdOriginal: it.qtdOriginal,
                    unMedida: it.unidadeMedida,
                    qtdcx: it.qtdcx,
                    pesocx: it.pesocx,
                    precoCobrado: it.precoManual || it.precoExcecao || it.precoCobrado || 0 ,
                    temExcecao: it.temExcecao,
                    tipoCalculoItem: it.tipoCalculoItem,
                    vTotalItem: it.vTotalItem,
            
                };                

                if (!dados.itens) dados.itens = [];

                dados.itens.push(item);
            }

             
           const resposta = await fetch('http://localhost:3000/salvar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
                console.log(dados);
                console.log(await resposta.json());
            
        }

        limparLoteAtual();
        mostrarToast('Dados enviados para o servidor com sucesso!');
       
}

    function renderHistoricoCompleto() {
        var selectFiltro = document.getElementById('filter-transp');
        var valorSelecionadoPreviamente = selectFiltro.value;
        
        selectFiltro.innerHTML = '<option value="">🚚 Todas as Transportadoras</option>';
        var listasUnicasTransp = [...new Set(ST.registros.map(r => r.transportadora))];
        listasUnicasTransp.forEach(function(t) {
            if(t) selectFiltro.innerHTML += '<option value="' + t + '" ' + (valorSelecionadoPreviamente === t ? 'selected' : '') + '>' + t + '</option>';
        });

        var chkAll = document.getElementById('chk-all-hist');
        if(chkAll) chkAll.checked = false;

        renderHistoricoFiltrado();
    }

    function sortHist(col) {
        if (histSortCol === col) {
            histSortAsc = !histSortAsc;
        } else {
            histSortCol = col;
            histSortAsc = true;
        }
        renderHistoricoFiltrado();
    }

    function renderHistoricoFiltrado() {
        var filtroDestinatario = document.getElementById('filter-dest').value.toLowerCase().trim();
        var filtroTransportadora = document.getElementById('filter-transp').value;
        var dStart = document.getElementById('filter-date-start').value;
        var dEnd = document.getElementById('filter-date-end').value;

        var filtrados = ST.registros.filter(function(r) {
            var q = filtroDestinatario;
            var matchDest = !q || (r.destinatario||'').toLowerCase().includes(q)
                || (r.destCNPJ||'').toLowerCase().includes(q)
                || (r.emitente||'').toLowerCase().includes(q)
                || (r.nNF||'').toLowerCase().includes(q)
                || (r.transportadora||'').toLowerCase().includes(q)
                || (r.data||'').toLowerCase().includes(q)
                || (r.fonte||'').toLowerCase().includes(q)
                || String(r.valorNF||'').includes(q)
                || String(r.frete||'').includes(q);
            var matchTransp = !filtroTransportadora || r.transportadora === filtroTransportadora;
            var rDateStr = parseBRDate(r.data);
            var matchDate = true;
            if (dStart && rDateStr < dStart) matchDate = false;
            if (dEnd && rDateStr > dEnd) matchDate = false;
            return matchDest && matchTransp && matchDate;
        });

        filtrados.sort(function(a, b) {
            var valA = a[histSortCol];
            var valB = b[histSortCol];
            if (histSortCol === 'data') { valA = parseBRDate(a.data); valB = parseBRDate(b.data); }
            else if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
            if (valA < valB) return histSortAsc ? -1 : 1;
            if (valA > valB) return histSortAsc ? 1 : -1;
            return 0;
        });

        var totalPesoH = 0, totalCxH = 0, totalFreteH = 0;
        filtrados.forEach(function(r) {
            totalPesoH += (parseFloat(r.pesoKg) || 0);
            totalCxH += (parseFloat(r.totalCx) || 0);
            totalFreteH += (parseFloat(r.frete) || 0);
        });

        document.getElementById('h-card-nfs').textContent = filtrados.length;
        document.getElementById('h-card-peso').textContent = formatarPeso(totalPesoH) + " kg";
        document.getElementById('h-card-cx').textContent = totalCxH.toFixed(0) + " cx";
        document.getElementById('h-card-frete').textContent = formatarMoeda(totalFreteH);

        if (histVisaoAtual === 'produto') {
            renderVisaoPorProduto(filtrados);
            return;
        }
        if (histVisaoAtual === 'loja') {
            renderVisaoPorLoja(filtrados);
            return;
        }

        var tbody = document.getElementById('hist-table-tbody');
        tbody.innerHTML = '';

        if (!filtrados.length) {
            document.getElementById('hist-empty').style.display = 'block';
            return;
        }
        document.getElementById('hist-empty').style.display = 'none';

        var chkAll = document.getElementById('chk-all-hist');
        if(chkAll) chkAll.checked = false;

        filtrados.forEach(function(r) {
            var isExc    = r.isExcecao === true;
            var fonteBadge = '<span class="badge bg-' + r.fonte.toLowerCase() + '">' + r.fonte + '</span>';
            
            var trPrincipal = document.createElement('tr');
            trPrincipal.innerHTML =
                '<td style="text-align:center;"><input type="checkbox" class="chk-hist-row" value="' + r.id + '"></td>' +
                '<td>' + r.data + '</td>' +
                '<td style="font-weight:600;">' + r.nNF + (isExc ? ' <span style="font-size:10px;color: #3d5aef;font-weight: 800;">exc</span>' : '') + '</td>' +
                '<td>' + fonteBadge + '</td>' +
                '<td title="' + r.destinatario + '" style="max-width:228px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;padding-right: 0.5%;">' + r.destinatario + '</td>' +
                '<td style="font-weight:600; color:var(--color-text-sub);">' + formatarPeso(r.pesoKg) + ' kg</td>' +
                '<td style="font-weight:600; color:var(--color-text-sub);">' + parseFloat(r.totalCx).toFixed(0) + ' cx</td>' +
                '<td>' + (isExc ? '<span style="color:#92400e;font-size:11px;">—</span>' : formatarMoeda(r.valorNF)) + '</td>' +
                '<td><span style="font-size:11px; font-weight:600; color:var(--color-primary);">' + r.transportadora + '</span></td>' +
                '<td><input type="number" class="input-edit" style="font-weight:700; color:var(--color-success); width: 50%;" step="0.01" value="' + parseFloat(r.frete).toFixed(2) + '" onchange="editarFreteDiretoNoHistorico(' + r.id + ', this.value)"></td>' +
                '<td style="color:var(--color-text-sub); font-family:monospace;">' + formatarMoeda(r.freteUnitKg) + '</td>' +
                '<td style="color:var(--color-text-sub); font-family:monospace;">' + formatarMoeda(r.freteUnitCx) + '</td>' +
                '<td style="text-align:center;">' +
                    '<button class="btn sm" onclick="alternarExibicaoItensHistorico(\'' + r.id + '\')" title="Ver Itens"><i class="ti ti-list"></i></button>' +
                    '<button class="btn sm danger" onclick="excluirItemDoHistorico(' + r.id + ')" title="Excluir"><i class="ti ti-trash"></i></button>' +
                '</td>';
            tbody.appendChild(trPrincipal);
                
            var trItensOcultos = document.createElement('tr');
            
            trItensOcultos.id = 'hist-det-row-' + r.id;

            trItensOcultos.style.display = 'none';
            
            var htmlSubTabelaItens =
                '<td colspan="13" style="background:var(--color-bg-main); padding:12px 24px;">' +
                    '<div style="border:1px solid var(--color-border); border-radius:6px; background:#fff; padding:10px;">' +
                        '<h4 style="font-size:12px; font-weight:700; margin-bottom:8px; color:var(--color-text-main);"><i class="ti ti-box-seam"></i> Abertura Cadastrada de Itens da NF-e</h4>' +
                        '<table style="width:100%; border-collapse:collapse; font-size:11px; text-align:left;">' +
                            '<thead><tr style="border-bottom:1px solid var(--color-border-light); color:var(--color-text-muted); font-weight:600;">' +
                                '<th style="padding:4px 6px;">Nome do Produto</th>' +
                                '<th style="padding:4px 6px;">Qtd Caixas</th>' +
                                '<th style="padding:4px 6px;">Peso / Caixa</th>' +
                                '<th style="padding:4px 6px;">Peso Total</th>' +
                                '<th style="padding:4px 6px;">Frete / Kg</th>' +
                                '<th style="padding:4px 6px;">Frete / Cx</th>' +
                                '<th style="padding:4px 6px;">Modalidade</th>' +
                            '</tr></thead><tbody>';
            if(r.itens && r.itens.length) {
                var pesoTotalNota = r.itens.reduce(function(s, it){ return s + (it.qtdcx * it.pesocx); }, 0) || 0; //aqui
                var totalCxNota   = r.itens.reduce(function(s, it){ return s + it.qtdcx; }, 0) || 0; //aqui
                var freteNota     = r.frete || 0;

                r.itens.forEach(function(it) {
                    var pesoItem  = it.qtdcx * it.pesocx || it.qtdOriginal;
                    var propPeso  = pesoTotalNota > 0 ? pesoItem / pesoTotalNota : 0;
                    var freteItem = freteNota * propPeso;
                    var freteKg   = pesoItem > 0 ? it.precoCobrado : 0;
                    var freteCx   = it.qtdcx > 0 ? it.precoCobrado : 0;

                    htmlSubTabelaItens +=
                        '<tr style="border-bottom:1px solid #f8fafc;">' +
                            '<td style="padding:5px 6px; font-weight:500;">' + (it.nome || it.item) + '</td>' +
                            '<td style="padding:5px 6px;">' + it.qtdcx.toFixed(0) + ' cx</td>' +
                            '<td style="padding:5px 6px;">' + formatarPeso(it.pesocx) + ' kg</td>' +
                            '<td style="padding:5px 6px; font-weight:600;">' + formatarPeso(pesoItem) + ' kg</td>' +
                            '<td style="padding:5px 6px; color:var(--color-primary); font-weight:600;">' + formatarMoeda(freteKg) + '</td>' +
                            '<td style="padding:5px 6px; color:var(--color-primary); font-weight:600;">' + formatarMoeda(freteCx) + '</td>' +
                            '<td style="padding:5px 6px;"><span class="badge bg-xml">' + (it.tipoCalculoItem || 'auto') + '</span></td>' +
                        '</tr>';
                });

            } else {
                htmlSubTabelaItens += '<tr><td colspan="7" style="padding:8px; color:var(--color-text-muted); text-align:center;">Não existem detalhes estruturados de itens salvos nesta nota.</td></tr>';
            }

            htmlSubTabelaItens += '</tbody></table></div></td>';
            trItensOcultos.innerHTML = htmlSubTabelaItens;
            tbody.appendChild(trItensOcultos);
        });
    }

    // ALTERNA ENTRE VISÃO "POR NOTA" E VISÃO "POR PRODUTO" NO HISTÓRICO
    function alternarVisaoHistorico(modo) {
        histVisaoAtual = modo;
        document.getElementById('btn-view-nota').classList.toggle('active', modo === 'nota');
        document.getElementById('btn-view-produto').classList.toggle('active', modo === 'produto');
        document.getElementById('btn-view-loja').classList.toggle('active', modo === 'loja');
        document.getElementById('view-por-nota').style.display = modo === 'nota' ? '' : 'none';
        document.getElementById('view-por-produto').style.display = modo === 'produto' ? '' : 'none';
        document.getElementById('view-por-loja').style.display = modo === 'loja' ? '' : 'none';
        document.getElementById('produto-view-controls').style.display = (modo === 'produto' || modo === 'loja') ? 'flex' : 'none';
        renderHistoricoFiltrado();
    }

    // Agrupa os itens dos registros informados por nome de produto, separando
    // itens normais dos itens em exceção. Usado no modo "Total do Período".
    function agregarItensPorProduto(regs) {
        var mapaNormal = {}, mapaExcecao = {};
        var ordemNormal = [], ordemExc = [];

        regs.forEach(function(r) {
            if (!r.itens || !r.itens.length) return;
            r.itens.forEach(function(item) {
                var isExc = (item.temExcecao !== undefined) ? !!item.temExcecao : !!r.isExcecao;
                var alvo = isExc ? mapaExcecao : mapaNormal;
                var ordem = isExc ? ordemExc : ordemNormal;

                var nomeOriginal = item.nome || item.item || 'Produto sem nome';
                var chave = nomeOriginal.toLowerCase().trim();

                var pesoItem = (item.qtdcx === 0 || !item.qtdcx) ? (item.pesocx || 0) : (item.qtdcx * item.pesocx);
                var cobradoPorCaixa = (item.tipoCalculoItem || '').toLowerCase().indexOf('cx') === 0;
                var freteItem = cobradoPorCaixa ? ((item.qtdcx || 0) * (item.precoCobrado || 0)) : (pesoItem * (item.precoCobrado || 0));

                if (!alvo[chave]) {
                    alvo[chave] = { nome: nomeOriginal, totalKg: 0, totalCx: 0, totalFrete: 0, notas: {} };
                    ordem.push(chave);
                }
                var g = alvo[chave];
                g.totalKg += pesoItem;
                g.totalCx += (item.qtdcx || 0);
                g.totalFrete += freteItem;
                g.notas[(r.nNF || '') + '|' + r.id] = true;
            });
        });

        function finalizar(mapa, ordem) {
            return ordem.map(function(chave) {
                var g = mapa[chave];
                g.numNotas = Object.keys(g.notas).length;
                return g;
            });
        }

        return { normal: finalizar(mapaNormal, ordemNormal), excecao: finalizar(mapaExcecao, ordemExc) };
    }

    // Agrupa os itens dos registros informados por DATA (linha principal), e dentro de
    // cada data acumula os totais por produto (aberto só ao expandir). Usado no modo "Por Data".
    function agregarPorData(regs) {
        var mapaNormalData = {}, mapaExcData = {};
        var ordemNormalData = [], ordemExcData = [];

        regs.forEach(function(r) {
            if (!r.itens || !r.itens.length) return;
            var dataChave = r.data || '—';
            r.itens.forEach(function(item) {
                var isExc = (item.temExcecao !== undefined) ? !!item.temExcecao : !!r.isExcecao;
                var mapaData = isExc ? mapaExcData : mapaNormalData;
                var ordemData = isExc ? ordemExcData : ordemNormalData;

                var nomeOriginal = item.nome || item.item || 'Produto sem nome';
                var chaveProd = nomeOriginal.toLowerCase().trim();

                var pesoItem = (item.qtdcx === 0 || !item.qtdcx) ? (item.pesocx || 0) : (item.qtdcx * item.pesocx);
                var cobradoPorCaixa = (item.tipoCalculoItem || '').toLowerCase().indexOf('cx') === 0;
                var freteItem = cobradoPorCaixa ? ((item.qtdcx || 0) * (item.precoCobrado || 0)) : (pesoItem * (item.precoCobrado || 0));

                if (!mapaData[dataChave]) {
                    mapaData[dataChave] = { data: dataChave, totalKg: 0, totalCx: 0, totalFrete: 0, produtos: {}, ordemProdutos: [] };
                    ordemData.push(dataChave);
                }
                var diaObj = mapaData[dataChave];
                diaObj.totalKg += pesoItem;
                diaObj.totalCx += (item.qtdcx || 0);
                diaObj.totalFrete += freteItem;

                if (!diaObj.produtos[chaveProd]) {
                    diaObj.produtos[chaveProd] = { nome: nomeOriginal, totalKg: 0, totalCx: 0, totalFrete: 0, notas: {} };
                    diaObj.ordemProdutos.push(chaveProd);
                }
                var pObj = diaObj.produtos[chaveProd];
                pObj.totalKg += pesoItem;
                pObj.totalCx += (item.qtdcx || 0);
                pObj.totalFrete += freteItem;
                pObj.notas[(r.nNF || '') + '|' + r.id] = true;
            });
        });

        function finalizarDatas(mapaData, ordemData) {
            var arr = ordemData.map(function(dataChave) {
                var diaObj = mapaData[dataChave];
                diaObj.produtosArr = diaObj.ordemProdutos.map(function(chaveProd) {
                    var p = diaObj.produtos[chaveProd];
                    p.numNotas = Object.keys(p.notas).length;
                    return p;
                });
                return diaObj;
            });
            arr.sort(function(a, b) {
                var da = parseBRDate(a.data), db = parseBRDate(b.data);
                return da < db ? -1 : (da > db ? 1 : 0);
            });
            return arr;
        }

        return { normal: finalizarDatas(mapaNormalData, ordemNormalData), excecao: finalizarDatas(mapaExcData, ordemExcData) };
    }

    // Renderiza a tabela (minimalista) de um bloco de produtos — modo "Total do Período"
    function renderBlocoProdutos(lista, unidade, detalhe, isExcecao) {
        if (!lista.length) return '';

        var corBg = isExcecao ? '#fffbeb' : '#fff';
        var detalhado = detalhe === 'detalhado';

        var html = '<div class="table-wrap" style="margin-bottom:14px;' + (isExcecao ? 'border-color:#fde68a;' : '') + '">' +
            '<table class="app-table" style="background:' + corBg + ';">' +
            '<thead><tr>' +
                '<th>Produto</th>' +
                '<th style="width:120px;">Total (' + (unidade === 'kg' ? 'Kg' : 'Cx') + ')</th>' +
                (detalhado ? '<th style="width:80px;">Nº Notas</th>' : '') +
                '<th style="width:120px;">Frete Total</th>' +
                (detalhado ? '<th style="width:100px;">R$ / Kg</th><th style="width:100px;">R$ / Cx</th>' : '') +
            '</tr></thead><tbody>';

        lista.forEach(function(g) {
            var totalPrincipal = unidade === 'kg' ? g.totalKg : g.totalCx;
            var freteUnitKg = g.totalKg > 0 ? g.totalFrete / g.totalKg : 0;
            var freteUnitCx = g.totalCx > 0 ? g.totalFrete / g.totalCx : 0;

            html += '<tr>' +
                '<td style="font-weight:600;">' + g.nome + '</td>' +
                '<td style="font-weight:600;color:var(--color-text-sub);">' + (unidade === 'kg' ? formatarPeso(totalPrincipal) + ' kg' : totalPrincipal.toFixed(0) + ' cx') + '</td>' +
                (detalhado ? '<td style="text-align:center;color:var(--color-text-sub);">' + g.numNotas + '</td>' : '') +
                '<td style="font-weight:700;color:var(--color-success);">' + formatarMoeda(g.totalFrete) + '</td>' +
                (detalhado ? '<td style="font-family:monospace;color:var(--color-text-sub);">' + formatarMoeda(freteUnitKg) + '</td><td style="font-family:monospace;color:var(--color-text-sub);">' + formatarMoeda(freteUnitCx) + '</td>' : '') +
            '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    // Renderiza o bloco no modo "Por Data": uma linha resumida por dia (com o total do dia
    // na unidade escolhida); ao clicar, expande e mostra a quantidade de cada produto naquele dia.
    function renderBlocoPorData(lista, unidade, detalhe, isExcecao, idPrefix) {
        if (!lista.length) return '';

        var corBg = isExcecao ? '#fffbeb' : '#fff';
        var detalhado = detalhe === 'detalhado';

        var html = '<div class="table-wrap" style="margin-bottom:14px;' + (isExcecao ? 'border-color:#fde68a;' : '') + '">' +
            '<table class="app-table" style="background:' + corBg + ';">' +
            '<thead><tr>' +
                '<th style="width:26px;"></th>' +
                '<th>Data</th>' +
                '<th style="width:120px;">Total (' + (unidade === 'kg' ? 'Kg' : 'Cx') + ')</th>' +
                '<th style="width:120px;">Frete do Dia</th>' +
            '</tr></thead><tbody>';

        lista.forEach(function(dia, idx) {
            var rowId = idPrefix + '-' + idx;
            var totalPrincipal = unidade === 'kg' ? dia.totalKg : dia.totalCx;

            html += '<tr style="cursor:pointer;" onclick="alternarLinhaPorData(\'' + rowId + '\')">' +
                '<td style="text-align:center;color:var(--color-text-muted);" id="' + rowId + '-icon"><i class="ti ti-chevron-right"></i></td>' +
                '<td style="font-weight:600;">' + dia.data + '</td>' +
                '<td style="font-weight:600;color:var(--color-text-sub);">' + (unidade === 'kg' ? formatarPeso(totalPrincipal) + ' kg' : totalPrincipal.toFixed(0) + ' cx') + '</td>' +
                '<td style="font-weight:700;color:var(--color-success);">' + formatarMoeda(dia.totalFrete) + '</td>' +
            '</tr>';

            html += '<tr id="' + rowId + '" style="display:none;">' +
                '<td colspan="4" style="padding:0;background:var(--color-bg-main);">' +
                    '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
                    '<thead><tr style="color:var(--color-text-muted);">' +
                        '<th style="padding:5px 10px 5px 38px;text-align:left;">Produto</th>' +
                        '<th style="padding:5px 10px;text-align:left;width:110px;">Total (' + (unidade === 'kg' ? 'Kg' : 'Cx') + ')</th>' +
                        (detalhado ? '<th style="padding:5px 10px;width:70px;">Nº Notas</th>' : '') +
                        '<th style="padding:5px 10px;text-align:left;width:110px;">Frete</th>' +
                        (detalhado ? '<th style="padding:5px 10px;width:90px;">R$/Kg</th><th style="padding:5px 10px;width:90px;">R$/Cx</th>' : '') +
                    '</tr></thead><tbody>';

            dia.produtosArr.forEach(function(p) {
                var totalProd = unidade === 'kg' ? p.totalKg : p.totalCx;
                var freteUnitKg = p.totalKg > 0 ? p.totalFrete / p.totalKg : 0;
                var freteUnitCx = p.totalCx > 0 ? p.totalFrete / p.totalCx : 0;
                html += '<tr style="border-top:1px solid var(--color-border-light);">' +
                    '<td style="padding:5px 10px 5px 38px;">' + p.nome + '</td>' +
                    '<td style="padding:5px 10px;">' + (unidade === 'kg' ? formatarPeso(totalProd) + ' kg' : totalProd.toFixed(0) + ' cx') + '</td>' +
                    (detalhado ? '<td style="padding:5px 10px;text-align:center;">' + p.numNotas + '</td>' : '') +
                    '<td style="padding:5px 10px;color:var(--color-success);font-weight:600;">' + formatarMoeda(p.totalFrete) + '</td>' +
                    (detalhado ? '<td style="padding:5px 10px;font-family:monospace;">' + formatarMoeda(freteUnitKg) + '</td><td style="padding:5px 10px;font-family:monospace;">' + formatarMoeda(freteUnitCx) + '</td>' : '') +
                '</tr>';
            });

            html += '</tbody></table></td></tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    // Expande/recolhe a linha de detalhe por produto de uma data específica (modo "Por Data")
    function alternarLinhaPorData(rowId) {
        var el = document.getElementById(rowId);
        var icon = document.getElementById(rowId + '-icon');
        if (!el) return;
        var aberto = el.style.display !== 'none';
        el.style.display = aberto ? 'none' : 'table-row';
        if (icon) icon.innerHTML = aberto ? '<i class="ti ti-chevron-right"></i>' : '<i class="ti ti-chevron-down"></i>';
    }

    // Monta a visão "Por Produto" completa: separa por transportadora (se houver mais de uma),
    // e dentro de cada uma mostra os itens normais e, à parte, apenas as somatórias de exceção.
    function renderVisaoPorProduto(filtrados) {
        var container = document.getElementById('view-por-produto');
        var unidade = document.getElementById('prod-view-unidade').value;
        var modo = document.getElementById('prod-view-modo').value;
        var detalhe = document.getElementById('prod-view-detalhe').value;

        if (!filtrados.length) {
            container.innerHTML = '<div class="empty-view"><i class="ti ti-inbox"></i>Nenhum registro encontrado para os filtros informados.</div>';
            return;
        }

        var mapaTransp = {};
        var ordemTransp = [];
        filtrados.forEach(function(r) {
            var t = r.transportadora || 'Sem Transportadora';
            if (!mapaTransp[t]) { mapaTransp[t] = []; ordemTransp.push(t); }
            mapaTransp[t].push(r);
        });

        var mostrarHeaderTransp = ordemTransp.length > 1;
        var html = '';

        ordemTransp.forEach(function(nomeTransp, idxTransp) {
            var regsTransp = mapaTransp[nomeTransp];

            if (mostrarHeaderTransp) {
                html += '<div style="display:flex;align-items:center;gap:8px;margin:18px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--color-primary);">' +
                            '<i class="ti ti-truck" style="color:var(--color-primary);"></i>' +
                            '<span style="font-size:13px;font-weight:700;color:var(--color-primary);">' + nomeTransp + '</span>' +
                        '</div>';
            }

            if (modo === 'data') {
                var agregadoData = agregarPorData(regsTransp);

                if (!agregadoData.normal.length && !agregadoData.excecao.length) {
                    html += '<div class="empty-view" style="padding:16px;"><i class="ti ti-inbox"></i>Nenhum item estruturado salvo para estas notas.</div>';
                    return;
                }

                html += renderBlocoPorData(agregadoData.normal, unidade, detalhe, false, 'pv-' + idxTransp + '-n');

                if (agregadoData.excecao.length) {
                    html += '<div style="font-size:11px;font-weight:700;color:#92400e;margin:10px 0 4px;">⚡ Itens em Exceção (somatórias por data)</div>';
                    html += renderBlocoPorData(agregadoData.excecao, unidade, detalhe, true, 'pv-' + idxTransp + '-e');
                }
            } else {
                var agregado = agregarItensPorProduto(regsTransp);

                if (!agregado.normal.length && !agregado.excecao.length) {
                    html += '<div class="empty-view" style="padding:16px;"><i class="ti ti-inbox"></i>Nenhum item estruturado salvo para estas notas.</div>';
                    return;
                }

                html += renderBlocoProdutos(agregado.normal, unidade, detalhe, false);

                if (agregado.excecao.length) {
                    html += '<div style="font-size:11px;font-weight:700;color:#92400e;margin:10px 0 4px;">⚡ Itens em Exceção (somatórias)</div>';
                    html += renderBlocoProdutos(agregado.excecao, unidade, detalhe, true);
                }
            }
        });

        container.innerHTML = html;
    }

    // Monta a visão "Distribuição por Loja": agrupa os registros pelo nome do
    // destinatário (loja) e, dentro de cada loja, soma todos os produtos iguais
    // em uma tabela (mesma lógica de agregação usada na visão "Por Produto",
    // só que a chave de agrupamento passa a ser a loja em vez da transportadora).
    function renderVisaoPorLoja(filtrados) {
        var container = document.getElementById('view-por-loja');
        var unidade = document.getElementById('prod-view-unidade').value;
        var modo = document.getElementById('prod-view-modo').value;
        var detalhe = document.getElementById('prod-view-detalhe').value;

        if (!filtrados.length) {
            container.innerHTML = '<div class="empty-view"><i class="ti ti-inbox"></i>Nenhum registro encontrado para os filtros informados.</div>';
            return;
        }

        var mapaLoja = {};
        var ordemLoja = [];
        filtrados.forEach(function(r) {
            var loja = r.destinatario || 'Sem Destinatário';
            if (!mapaLoja[loja]) { mapaLoja[loja] = []; ordemLoja.push(loja); }
            mapaLoja[loja].push(r);
        });

        ordemLoja.sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });

        var html = '';

        ordemLoja.forEach(function(nomeLoja, idxLoja) {
            var regsLoja = mapaLoja[nomeLoja];

            var pesoLoja = 0, cxLoja = 0, freteLoja = 0;
            regsLoja.forEach(function(r) {
                pesoLoja += (parseFloat(r.pesoKg) || 0);
                cxLoja += (parseFloat(r.totalCx) || 0);
                freteLoja += (parseFloat(r.frete) || 0);
            });

            html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:18px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--color-primary);flex-wrap:wrap;">' +
                        '<div style="display:flex;align-items:center;gap:8px;">' +
                            '<i class="ti ti-building-store" style="color:var(--color-primary);"></i>' +
                            '<span style="font-size:13px;font-weight:700;color:var(--color-primary);">' + nomeLoja + '</span>' +
                            '<span style="font-size:11px;color:var(--color-text-muted);">(' + regsLoja.length + ' nota' + (regsLoja.length > 1 ? 's' : '') + ')</span>' +
                        '</div>' +
                        '<div style="display:flex;gap:14px;font-size:11px;color:var(--color-text-sub);">' +
                            '<span><b>' + formatarPeso(pesoLoja) + ' kg</b></span>' +
                            '<span><b>' + cxLoja.toFixed(0) + ' cx</b></span>' +
                            '<span style="color:var(--color-success);"><b>' + formatarMoeda(freteLoja) + '</b></span>' +
                        '</div>' +
                    '</div>';

            if (modo === 'data') {
                var agregadoData = agregarPorData(regsLoja);

                if (!agregadoData.normal.length && !agregadoData.excecao.length) {
                    html += '<div class="empty-view" style="padding:16px;"><i class="ti ti-inbox"></i>Nenhum item estruturado salvo para estas notas.</div>';
                    return;
                }

                html += renderBlocoPorData(agregadoData.normal, unidade, detalhe, false, 'pl-' + idxLoja + '-n');

                if (agregadoData.excecao.length) {
                    html += '<div style="font-size:11px;font-weight:700;color:#92400e;margin:10px 0 4px;">⚡ Itens em Exceção (somatórias por data)</div>';
                    html += renderBlocoPorData(agregadoData.excecao, unidade, detalhe, true, 'pl-' + idxLoja + '-e');
                }
            } else {
                var agregado = agregarItensPorProduto(regsLoja);

                if (!agregado.normal.length && !agregado.excecao.length) {
                    html += '<div class="empty-view" style="padding:16px;"><i class="ti ti-inbox"></i>Nenhum item estruturado salvo para estas notas.</div>';
                    return;
                }

                html += renderBlocoProdutos(agregado.normal, unidade, detalhe, false);

                if (agregado.excecao.length) {
                    html += '<div style="font-size:11px;font-weight:700;color:#92400e;margin:10px 0 4px;">⚡ Itens em Exceção (somatórias)</div>';
                    html += renderBlocoProdutos(agregado.excecao, unidade, detalhe, true);
                }
            }
        });

        container.innerHTML = html;
    }

async function carregarHistoricoDoBanco() {
    try {
        // 1. Busca os dados da sua API/Banco
        const resposta = await fetch('http://localhost:3000/dados');
        const dadosDB = await resposta.json();

        // 2. Mapeia os campos do banco para o padrão do ST.registros
        ST.registros = dadosDB.map(nota => {
            return {
                id: nota.id || Date.now() + Math.random(), // Mantém um ID para os botões de editar/excluir funcionarem
                data: formatarDataDBParaTela(nota.data),   // Converte DateTime para "DD/MM/YYYY"
                nNF: String(nota.nNF),
                totalCx: Number(nota.totalCx || 0),
                pesoKg: Number(nota.pesoKg || 0),
                frete: Number(nota.frete || 0),
                freteUnitKg: Number(nota.freteUnitKg || 0),
                freteUnitCx: Number(nota.freteUnitCx || 0),
                fonte: nota.fonte || '',
                destinatario: nota.destinatario || '',
                destCNPJ: nota.destCNPJ || '',
                valorNF: Number(nota.valorNF || 0),
                transportadora: nota.transportadora || '',
                isExcecao: false, // Campo que o seu JS usa para pintar a linha
                itens: nota.itens || [] // Se a sua API trouxer os itens, coloque aqui
            };
        });        

    } catch (erro) {
        console.error("Erro ao buscar histórico:", erro);
        mostrarToastAviso("Carregando histórico do navegador");
    }
    renderHistoricoCompleto();
}

// Função auxiliar para converter o DateTime do banco para "DD/MM/YYYY"
function formatarDataDBParaTela(dataISO) {
    if (!dataISO) return '—';
    const d = new Date(dataISO);
    // Adiciona o zero à esquerda se necessário
    const dia = String(d.getUTCDate()).padStart(2, '0');
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    const ano = d.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
}

    function toggleAllHist(chk) {
        var checkboxes = document.querySelectorAll('.chk-hist-row');
        checkboxes.forEach(function(c) { c.checked = chk.checked; });
    }

    function excluirSelecionadosHistorico() {
        var checkboxes = document.querySelectorAll('.chk-hist-row:checked');
        if (checkboxes.length === 0) { mostrarToastAviso('Selecione ao menos um registro para excluir.'); return; }
        var idsToRemove = Array.from(checkboxes).map(function(c){ return c.value; });
        // Inclui também registros de exceção vinculados aos principais selecionados
        var idsExcVinc = ST.registros
            .filter(function(r){ return r.nfOrigemId && idsToRemove.includes(String(r.nfOrigemId)); })
            .map(function(r){ return String(r.id);   });
        var todosIds = idsToRemove.concat(idsExcVinc);
        ST.registros = ST.registros.filter(function(r){ return !todosIds.includes(String(r.id)); });
        persistirDados();
        renderHistoricoCompleto();
    }

    function editarFreteDiretoNoHistorico(idReg, novoValorFreteString) {
        var reg = ST.registros.find(x => x.id === idReg);
        if(!reg) return;
        var valorNumerico = parseNumeroBR(novoValorFreteString);
        reg.frete = valorNumerico;
        reg.freteUnitKg = reg.pesoKg > 0 ? (valorNumerico / reg.pesoKg) : 0;
        reg.freteUnitCx = reg.totalCx > 0 ? (valorNumerico / reg.totalCx) : 0;
        persistirDados();
        renderHistoricoFiltrado();
    }

    function alternarExibicaoItensHistorico(idReg) {            
        
        var el = document.getElementById('hist-det-row-' +  idReg);
        if(!el) return;
        el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
    }

     async function excluirItemDoHistorico(idReg) {

        try {
            
          const resposta = await fetch('http://localhost:3000/deletar', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: idReg })
                });

                console.log(await resposta.json());
            
        } catch (error) {
         console.log('Erro ao deletrar → ' + error)   
        }

        var reg = ST.registros.find(function(r){ return r.id === idReg; });
        ST.registros = ST.registros.filter(function(r){

            if (r.id == idReg) return false;
            // Remove exceção vinculada ao principal excluído
            if (!reg.isExcecao && r.nfOrigemId === idReg) return false;
            
            return true;
        });
        persistirDados();
        renderHistoricoCompleto();
    }

    function formatarMoedaExport(v) {
        return 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // Extratores de campo ÚNICOS, usados tanto pela cópia (Ctrl+V) quanto pela exportação (CSV/Excel).
    // Assim, os campos exibidos/ativos na aba Configurações valem igualmente para as duas ações.
    function obterExtratoresCamposExportacao(comSufixoExcecao) {
        return {
            data:           function(r){ return r.data || ''; },
            nNF:            function(r){ return r.nNF || ''; },
            fonte:          function(r){ return (r.fonte || '') + (comSufixoExcecao && r.isExcecao ? '-EXC' : ''); },
            emitente:       function(r){ return r.emitente || ''; },
            destinatario:   function(r){ return r.destinatario || ''; },
            destCNPJ:       function(r){ return r.destCNPJ || ''; },
            pesoKg:         function(r){ return formatarPeso(r.pesoKg || 0); },
            totalCx:        function(r){ return parseFloat(r.totalCx || 0).toFixed(0); },
            valorNF:        function(r){ return formatarMoedaExport(r.valorNF || 0); },
            transportadora: function(r){ return r.transportadora || ''; },
            frete:          function(r){ return formatarMoedaExport(r.frete || 0); },
            freteUnitKg:    function(r){ return formatarMoedaExport(r.freteUnitKg || 0); },
            freteUnitCx:    function(r){ return formatarMoedaExport(r.freteUnitCx || 0); }
        };
    }

    // Uma nota de EXCEÇÃO pode ter vários produtos com preços negociados diferentes
    // (ex.: banana a R$0,85/kg, laranja a R$0,24/kg). O registro salvo soma tudo numa
    // única linha, então aqui "abrimos" essa linha em uma linha por preço distinto,
    // recalculando caixas/peso/frete apenas com os itens daquele preço.
    function expandirRegistrosPorPrecoExcecao(registros) {
        var resultado = [];

        registros.forEach(function (r) {
            if (!r.isExcecao || !r.itens || !r.itens.length) {
                resultado.push(r);
                return;
            }

            var grupos = {};
            var ordemPrecos = [];

            r.itens.forEach(function (item) {
                var precoChave = parseFloat(item.precoCobrado || 0).toFixed(4);
                if (!grupos[precoChave]) {
                    grupos[precoChave] = { caixas: 0, peso: 0, frete: 0 };
                    ordemPrecos.push(precoChave);
                }

                var pesoItem = (item.qtdcx === 0) ? (item.pesocx || 0) : (item.qtdcx * item.pesocx);
                var cobradoPorCaixa = (item.tipoCalculoItem || '').toLowerCase().indexOf('cx') === 0;
                var freteItem = cobradoPorCaixa
                    ? (item.qtdcx * item.precoCobrado)
                    : (pesoItem * item.precoCobrado);

                grupos[precoChave].caixas += (item.qtdcx || 0);
                grupos[precoChave].peso += pesoItem;
                grupos[precoChave].frete += freteItem;
            });

            // Só 1 preço na nota inteira: mantém a linha como está, sem alterações
            if (ordemPrecos.length <= 1) {
                resultado.push(r);
                return;
            }

            // Mais de 1 preço: gera uma linha por preço distinto
            ordemPrecos.forEach(function (precoChave) {
                var g = grupos[precoChave];
                resultado.push(Object.assign({}, r, {
                    totalCx: g.caixas,
                    pesoKg: g.peso,
                    frete: g.frete,
                    freteUnitKg: g.peso > 0 ? g.frete / g.peso : 0,
                    freteUnitCx: g.caixas > 0 ? g.frete / g.caixas : 0
                }));
            });
        });

        return resultado;
    }

    // Monta cabeçalho + matriz de linhas a partir dos campos ATIVOS configurados em Configurações
    // (exportFieldsConfig), na ordem em que foram configurados, para a lista de registros informada.
    function montarMatrizExportacao(registros, comSufixoExcecao) {
        var registrosExpandidos = expandirRegistrosPorPrecoExcecao(registros);

        var FIELD_EXTRACTORS = obterExtratoresCamposExportacao(comSufixoExcecao);
        var camposAtivos = exportFieldsConfig.filter(function(f){ return f.ativo; });
        if (!camposAtivos.length) return null;

        var cabecalho = camposAtivos.map(function(f){ return f.header || f.key; });
        var linhasMatriz = registrosExpandidos.map(function(r) {
            return camposAtivos.map(function(f) {
                var extrator = FIELD_EXTRACTORS[f.key];
                return extrator ? extrator(r) : (r[f.key] || '');
            });
        });

        return { camposAtivos: camposAtivos, cabecalho: cabecalho, linhasMatriz: linhasMatriz, registros: registrosExpandidos };
    }

    function copiarDadosExportacao() {
        // 1. Descobre quais linhas estão sendo exibidas na tela (já respeitando os
        //    filtros de destinatário/transportadora/data aplicados no histórico)
        var checkboxesNaTela = Array.from(document.querySelectorAll('#hist-table-tbody .chk-hist-row'));
        if (!checkboxesNaTela.length) {
            return mostrarToastAviso('Nenhum dado filtrado na tela para copiar.');
        }

        // 2. Se houver checkboxes marcados, usa só os selecionados.
        //    Se nenhum estiver marcado, usa TODOS os que estão filtrados/visíveis na tela.
        var checkboxesMarcados = checkboxesNaTela.filter(function (c) { return c.checked; });
        var checkboxesAlvo = checkboxesMarcados.length ? checkboxesMarcados : checkboxesNaTela;

        var idsAlvo = checkboxesAlvo.map(function (c) { return c.value; });

        // 3. Recupera os registros completos (na mesma ordem exibida na tela)
        var registrosAlvo = idsAlvo
            .map(function (id) { return ST.registros.find(function (r) { return String(r.id) === String(id); }); })
            .filter(Boolean);

        if (!registrosAlvo.length) {
            return mostrarToastAviso('Nenhum registro válido encontrado para copiar.');
        }

        // 4. Usa exatamente os mesmos campos ATIVOS configurados na aba Configurações
        //    (os mesmos que valem para a exportação em CSV/Excel)
        var matriz = montarMatrizExportacao(registrosAlvo, true);
        if (!matriz) {
            return mostrarToastAviso('Nenhum campo ativo para cópia. Configure na aba Configurações.');
        }

        var textoClipboard = matriz.cabecalho.join('\t') + '\n' +
            matriz.linhasMatriz.map(function (l) { return l.join('\t'); }).join('\n');

        // 5. Enviar todo o texto gerado para a área de transferência do Windows/Mac
        navigator.clipboard.writeText(textoClipboard).then(function () {
            mostrarToast('✓ ' + matriz.linhasMatriz.length + ' linha(s) copiada(s) com sucesso! Cole na sua planilha (Ctrl+V).');
        }).catch(function (err) {
            console.error("Erro ao copiar para a área de transferência: ", err);
            alert('Falha ao copiar dados. O navegador bloqueou a ação: ' + err);
        });
    }

    function copiarDadosExportacao2() {
        if(!ST.registros.length) return mostrarToastAviso('Nenhum dado salvo para copiar.');

        var matriz = montarMatrizExportacao(ST.registros, true);
        if (!matriz) return mostrarToastAviso('Nenhum campo ativo para cópia. Configure na aba Configurações.');

        var textoFinal = matriz.cabecalho.join('\t') + '\n' + matriz.linhasMatriz.map(l => l.join('\t')).join('\n');

        navigator.clipboard.writeText(textoFinal).then(function() {
            mostrarToast('✓ Dados copiados com sucesso! Cole na sua planilha (Ctrl+V).');
        }).catch(function(err) {
            alert('Falha ao copiar dados. O navegador bloqueou a ação: ' + err);
        });
    }

    function exportData(tipoFormatacao) {
        if(!ST.registros.length) return mostrarToastAviso('Nenhum dado salvo para exportação.');

        var matriz = montarMatrizExportacao(ST.registros, false);
        if (!matriz) return alert('Nenhum campo ativo para exportação. Configure os campos na aba Configurações.');

        var camposAtivos  = matriz.camposAtivos;
        var cabecalho     = matriz.cabecalho;
        var linhasMatriz  = matriz.linhasMatriz;

        if (tipoFormatacao === 'csv') {
            var stringCsvConteudo = '\uFEFF' + cabecalho.join(';') + '\n' + linhasMatriz.map(l => l.join(';')).join('\n');
            var blobObj = new Blob([stringCsvConteudo], { type: 'text/csv;charset=utf-8;' });
            acionarDownloadDispositivo(blobObj, 'relatorio_fretes_' + new Date().toISOString().slice(0,10) + '.csv');
        } else {
            var isMoeda = { frete: true, freteUnitKg: true, freteUnitCx: true, valorNF: true };
            var isPeso  = { pesoKg: true };
            
            var dataAlign    = excelConfig.dataAlign    || 'left';
            var dataFontSize = excelConfig.dataFontSize || '11px';
            var numCols      = camposAtivos.length;

            // Linha de TÍTULO da planilha (acima dos cabeçalhos)
            var titleHtml = '';
            if (excelConfig.titleText) {
                var tBg    = excelConfig.titleBg    || '#1e40af';
                var tColor = excelConfig.titleColor || '#ffffff';
                var tFont  = excelConfig.titleFontSize || '16px';
                titleHtml = '<tr><td colspan="' + numCols + '" style="background:' + tBg + ';color:' + tColor +
                    ';font-size:' + tFont + ';font-weight:bold;padding:10px 14px;border:1px solid #cbd5e1;text-align:center;">' +
                    escHtml(excelConfig.titleText) + '</td></tr>';
            }

            // Cabeçalhos com cor por coluna (usa cor do campo se definida, senão usa global)
            var thHtml = camposAtivos.map(function(f, i) {
                var fBg    = (f.headerBg    && f.headerBg    !== '#ffffff') ? f.headerBg    : excelConfig.headerBg;
                var fColor = (f.headerColor && f.headerColor !== '#000000') ? f.headerColor : excelConfig.headerColor;
                var borda  = f.border !== false ? '1px solid #cbd5e1' : 'none';
                return '<th style="background:' + fBg + ';color:' + fColor + ';font-size:' + excelConfig.headerFontSize +
                    ';font-weight:bold;padding:6px 10px;border:' + borda + ';">' + (f.header || f.key) + '</th>';
            }).join('');

            var trRows = matriz.registros.map(function(r, rowIdx) {
                var linha = linhasMatriz[rowIdx];
                var isExcRow = r.isExcecao === true;
                var tds = camposAtivos.map(function(f, i) {
                    var val   = linha[i];
                    // Exceção: só coluna de valor unitário tem fundo diferenciado
                    var isUnitCol = (f.key === 'freteUnitKg' || f.key === 'freteUnitCx');
                    var dBg = (isExcRow && isUnitCol) ? '#e0f2fe'
                            : ((f.dataBg && f.dataBg !== '#ffffff') ? f.dataBg : '');
                    var borda = f.border !== false ? '1px solid #e2e8f0' : 'none';
                    var style = 'padding:5px 10px;border:' + borda + ';font-size:' + dataFontSize + ';text-align:' + dataAlign + ';'
                        + (dBg ? 'background:' + dBg + ';' : '');
                    if (isMoeda[f.key]) {
                        style += 'mso-number-format:"R\\#\\ ##0\\.00";text-align:right;';
                    } else if (isPeso[f.key]) {
                        style += 'text-align:right;';
                    }
                    return '<td style="' + style + '">' + val + '</td>';
                }).join('');
                return '<tr>' + tds + '</tr>';
            }).join('');

            var tbodyHtml = trRows;

            if (excelConfig.showTotals) {
                var keysToSum = { pesoKg: true, totalCx: true, valorNF: true, frete: true };
                var totalsMap = {};
                
                matriz.registros.forEach(r => {
                    camposAtivos.forEach(f => {
                        if (keysToSum[f.key]) {
                            totalsMap[f.key] = (totalsMap[f.key] || 0) + parseFloat(r[f.key] || 0);
                        }
                    });
                });

                var totalBg    = excelConfig.totalBg    || '#f1f5f9';
                var totalColor = excelConfig.totalColor || '#1e293b';
                var totalFSize = excelConfig.totalFontSize || '11px';
                var tdTotals = camposAtivos.map(function(f, idx) {
                    var style = 'padding:5px 10px;border:1px solid #e2e8f0;font-weight:bold;background:'+totalBg+';color:'+totalColor+';font-size:'+totalFSize+';';
                    if (keysToSum[f.key]) {
                        var val = totalsMap[f.key];
                        var strVal = '';
                        if (isMoeda[f.key]) {
                             style += 'mso-number-format:"R\\#\\ ##0\\.00";text-align:right;';
                             strVal = formatarMoedaExport(val);
                        } else if (f.key === 'pesoKg') {
                             style += 'text-align:right;';
                             strVal = formatarPeso(val);
                        } else if (f.key === 'totalCx') {
                             strVal = val.toFixed(0);
                        }
                        return '<td style="' + style + '">' + strVal + '</td>';
                    } else {
                        return '<td style="' + style + '">' + (idx === 0 ? 'TOTAIS GERAIS' : '') + '</td>';
                    }
                }).join('');
                
                tbodyHtml += '<tr>' + tdTotals + '</tr>';
            }

            var tabelaHtml =
                '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
                '<head><meta charset="UTF-8">' +
                '<style>table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;}</style></head><body>' +
                '<table>' +
                (titleHtml ? '<thead>' + titleHtml + '<tr>' + thHtml + '</tr></thead>' : '<thead><tr>' + thHtml + '</tr></thead>') +
                '<tbody>' + tbodyHtml + '</tbody>' +
                '</table></body></html>';

            var blobObjExcel = new Blob(['\uFEFF' + tabelaHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            acionarDownloadDispositivo(blobObjExcel, 'relatorio_fretes_' + new Date().toISOString().slice(0,10) + '.xls');
        }
    }

    function acionarDownloadDispositivo(blob, nomeArquivoCompleto) {
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nomeArquivoCompleto;
        link.click();
    }

    var _dragSrcIdx = null;

    function renderExportFieldsConfig() {
        var root = document.getElementById('cfg-export-fields-list');
        if (!root) return;

        root.innerHTML = exportFieldsConfig.map(function(f, idx) {
            var def = EXPORT_FIELDS_DEFAULT.find(function(d){ return d.key === f.key; });
            var label = def ? def.label : f.key;
            var ordemNum = exportFieldsConfig.slice(0, idx).filter(function(x){ return x.ativo; }).length + (f.ativo ? 1 : 0);
            var hBg    = f.headerBg    || '#1e40af';
            var hColor = f.headerColor || '#ffffff';
            var dBg    = f.dataBg      || '#ffffff';
            var border = f.border !== false;
            return (
                '<div class="export-field-row" draggable="true"' +
                ' data-idx="' + idx + '"' +
                ' ondragstart="onExportDragStart(event, ' + idx + ')"' +
                ' ondragover="onExportDragOver(event)"' +
                ' ondrop="onExportDrop(event, ' + idx + ')"' +
                ' ondragend="onExportDragEnd(event)"' +
                ' ondragleave="onExportDragLeave(event)">' +
                // arraste
                '<span class="drag-handle"><i class="ti ti-grip-vertical"></i></span>' +
                // numero de ordem
                '<div class="field-order ' + (f.ativo ? '' : 'disabled') + '">' + (f.ativo ? ordemNum : '—') + '</div>' +
                // toggle ativo + label
                '<label style="display:flex; align-items:center; gap:7px; cursor:pointer; flex:0.3;">' +
                    '<input type="checkbox" ' + (f.ativo ? 'checked' : '') + ' onchange="toggleExportField(' + idx + ', this.checked)">' +
                    '<span class="field-label">' + label + '</span>' +
                '</label>' +
                // cabeçalho editável
                '<div class="field-custom-label">' +
                    '<input type="text" value="' + escHtml(f.header) + '" placeholder="' + (def ? def.defaultHeader : '') + '"' +
                    ' title="Cabeçalho personalizado"' +
                    ' oninput="atualizarHeaderExportField(' + idx + ', this.value)"' +
                    (f.ativo ? '' : ' disabled') + '>' +
                '</div>' +
                // cor fundo cabeçalho
                '<div class="field-color">' +
                    '<label></label>' +
                    '<input type="color" value="' + hBg + '" title="Cor de fundo deste cabeçalho"' +
                    ' onchange="atualizarCorExportField(' + idx + ',\'headerBg\',this.value)">' +
                '</div>' +
                // cor fonte cabeçalho
                '<div class="field-color">' +
                    '<label></label>' +
                    '<input type="color" value="' + hColor + '" title="Cor da fonte deste cabeçalho"' +
                    ' onchange="atualizarCorExportField(' + idx + ',\'headerColor\',this.value)">' +
                '</div>' +
                // cor fundo dados
                '<div class="field-color">' +
                    '<label></label>' +
                    '<input type="color" value="' + dBg + '" title="Cor de fundo das células de dados"' +
                    ' onchange="atualizarCorExportField(' + idx + ',\'dataBg\',this.value)">' +
                '</div>' +
                // borda
                '<div class="field-border">' +
                    '<label></label>' +
                    '<input type="checkbox" ' + (border ? 'checked' : '') + ' title="Exibir borda nesta coluna"' +
                    ' onchange="atualizarCorExportField(' + idx + ',\'border\',this.checked)">' +
                '</div>' +
                '</div>'
            );
        }).join('');

        atualizarPreviewExportacao();
    }

    function atualizarCorExportField(idx, campo, valor) {
        exportFieldsConfig[idx][campo] = valor;
    }

    function escHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function toggleExportField(idx, ativo) {
        exportFieldsConfig[idx].ativo = ativo;
        renderExportFieldsConfig();
    }
    function atualizarHeaderExportField(idx, valor) {
        exportFieldsConfig[idx].header = valor;
        atualizarPreviewExportacao();
    }

    function atualizarPreviewExportacao() {
        var ativos = exportFieldsConfig.filter(function(f){ return f.ativo; });
        var count = document.getElementById('cfg-export-active-count');
        if (count) count.textContent = ativos.length;
        var preview = document.getElementById('cfg-export-preview');
        if (!preview) return;
        if (!ativos.length) {
            preview.innerHTML = '<span style="font-size:11px; color:var(--color-text-muted); font-style:italic;">Nenhum campo ativo.</span>';
            return;
        }
        preview.innerHTML = ativos.map(function(f, i) {
            return '<span class="export-preview-badge"><span style="font-weight:700; color:var(--color-primary); margin-right:3px;">' + (i+1) + '</span>' + escHtml(f.header || f.key) + '</span>';
        }).join('');
    }

    function salvarConfigExportacao() {
        var inputs = document.querySelectorAll('#cfg-export-fields-list .field-custom-label input[type="text"]');
        inputs.forEach(function(inp, i) {
            if (exportFieldsConfig[i]) exportFieldsConfig[i].header = inp.value;
        });
        localStorage.setItem('fn_v4_export_fields', JSON.stringify(exportFieldsConfig));
        renderExportFieldsConfig();
        mostrarToast('Configuração de exportação salva com sucesso!');
    }

    function resetarConfigExportacao() {
        if (!confirm('Restaurar configuração de exportação para o padrão original?')) return;
        exportFieldsConfig = EXPORT_FIELDS_DEFAULT.map(function(f) {
            return { key: f.key, ativo: f.defaultAtivo, header: f.defaultHeader };
        });
        localStorage.removeItem('fn_v4_export_fields');
        renderExportFieldsConfig();
    }

    function onExportDragStart(e, idx) {
        _dragSrcIdx = idx;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }
    function onExportDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }
    function onExportDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }
    function onExportDrop(e, targetIdx) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        if (_dragSrcIdx === null || _dragSrcIdx === targetIdx) return;
        var moved = exportFieldsConfig.splice(_dragSrcIdx, 1)[0];
        exportFieldsConfig.splice(targetIdx, 0, moved);
        _dragSrcIdx = null;
        renderExportFieldsConfig();
    }
    function onExportDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.export-field-row').forEach(function(r){ r.classList.remove('drag-over'); });
        _dragSrcIdx = null;
    }

    function renderConfiguracoes() {
        document.getElementById('cfg-p-nome').value = ST.rules.nome || 1;
        document.getElementById('cfg-p-qtdcx').value = ST.rules.qtdcx || 2;
        document.getElementById('cfg-p-pesocx').value = ST.rules.pesocx || 5;

        document.getElementById('cfg-ex-bg').value = excelConfig.headerBg || '#1e40af';
        document.getElementById('cfg-ex-color').value = excelConfig.headerColor || '#ffffff';
        document.getElementById('cfg-ex-font').value = excelConfig.headerFontSize || '12px';
        document.getElementById('cfg-ex-data-font').value = excelConfig.dataFontSize || '11px';
        document.getElementById('cfg-ex-align').value = excelConfig.dataAlign || 'left';
        document.getElementById('cfg-ex-totals').checked = excelConfig.showTotals !== false;
        document.getElementById('cfg-ex-total-bg').value = excelConfig.totalBg || '#f1f5f9';
        document.getElementById('cfg-ex-total-color').value = excelConfig.totalColor || '#1e293b';
        document.getElementById('cfg-ex-total-font').value = excelConfig.totalFontSize || '11px';
        document.getElementById('cfg-ex-title').value = excelConfig.titleText || '';
        document.getElementById('cfg-ex-title-bg').value = excelConfig.titleBg || '#1e40af';
        document.getElementById('cfg-ex-title-color').value = excelConfig.titleColor || '#ffffff';
        document.getElementById('cfg-ex-title-font').value = excelConfig.titleFontSize || '16px';

        renderExportFieldsConfig();

        var rootT = document.getElementById('cfg-list-transportadoras');
        if(!ST.transportadoras.length) {
            rootT.innerHTML = '<div class="empty-view" style="padding:15px;">Nenhuma transportadora cadastrada no sistema.</div>';
        } else {
            rootT.innerHTML = ST.transportadoras.map(function(t) {
                var excecoesHtml = '';
                if(t.excecoesProdutos && t.excecoesProdutos.length > 0) {
                    excecoesHtml = t.excecoesProdutos.map(function(exc, idx) {
                        return '<div class="item-exc">' +
                            '<span>Produto: <strong>' + exc.nomeProd + '</strong> · Modal: <strong>' + exc.tipoCobranca.toUpperCase() + '</strong> · Preço: <strong>R$ ' + parseFloat(exc.preco).toFixed(2) + '</strong>' + (exc.pesoMax > 0 ? ' · Peso máx: <strong>' + parseFloat(exc.pesoMax).toFixed(2) + ' kg</strong>' : '') + '</span>' +
                            '<button class="btn sm danger" onclick="removerExcecaoProduto(\'' + t.id + '\', ' + idx + ')"><i class="ti ti-trash"></i></button>' +
                            '</div>';
                    }).join('');
                } else {
                    excecoesHtml = '<div style="font-size:11px; color:var(--color-text-muted); font-style:italic;">Sem exceções. Usa valor padrão.</div>';
                }

                return (
                    '<div class="cards-transp">' +
                        '<div class="list-transp">' +
                            '<div style="font-size:13px;"><strong>' + t.nome + '</strong> <span style="color:var(--color-text-sub); margin-left:12px;">Padrão: R$ ' + parseFloat(t.pKg).toFixed(2) + '/Kg · R$ ' + parseFloat(t.pCx).toFixed(2) + '/Cx</span></div>' +
                            '<button class="btn sm danger" onclick="removerTransportadora(\'' + t.id + '\')"><i class="ti ti-trash"></i> Remover Transportadora</button>' +
                        '</div>' +
                        '<div style="margin-left:10px; border-left:3px solid var(--color-border); padding-left:12px;">' +
                            '<div class="list-exc">Exceções por Produto <i class="ti ti-info-circle" title="Sobrepõe o valor padrão caso o nome do produto na NF seja idêntico"></i></div>' +
                            excecoesHtml +
                        '</div>' +
                    '</div>'
                );
            }).join('');
        }

        var optTransp = '<option value="PRIMEIRO">Transportadora...</option>';
             ST.transportadoras.forEach(function(t) {
                optTransp += '<option value="'+t.id+'">'+t.nome+'</option>';
            });
        document.getElementById('transpExc').innerHTML = optTransp;  

        var rootD = document.getElementById('cfg-list-destinatarios');
        var selCfgT = document.getElementById('cfg-d-transp');
        if (selCfgT) {
            selCfgT.innerHTML = '<option value="">Nenhuma</option>';
            ST.transportadoras.forEach(function(t){ selCfgT.innerHTML += '<option value="'+t.id+'">'+t.nome+'</option>'; });
        }
        if(!ST.destinatarios.length) {
            rootD.innerHTML = '<div class="empty-view" style="padding:15px;">Nenhuma regra customizada para destinatários.</div>';
        } else {
            rootD.innerHTML = ST.destinatarios.map(function(d) {
                var txtMod = d.modal === 'kg' ? 'Por Peso Bruto (Kg)' : d.modal === 'cx' ? 'Por Caixa (Cx)' : 'Misto';
                var tObj = ST.transportadoras.find(function(t){ return t.id === d.transpId; });
                var transpLabel = tObj ? '🚚 '+tObj.nome : '';
                return (
                    '<div style="display:flex; justify-content:space-between; align-items:center; background:var(--color-bg-main); padding:8px 12px; border-radius:6px; margin-bottom:6px; font-size:12px;">' +
                        '<div style="flex:1;">CNPJ/Nome: <strong>' + d.cnpj + '</strong> <span class="badge bg-xml" style="margin-left:8px;">' + txtMod + '</span> <span style="margin-left:8px; color:var(--color-primary);">' + transpLabel + '</span></div>' +
                        '<button class="btn sm danger" onclick="removerRegraDestinatario(\'' + d.id + '\')"><i class="ti ti-trash"></i></button>' +
                    '</div>'
                );
            }).join('');
        }
    }

    function adicionarNovaTransportadora() {
        var nome = document.getElementById('cfg-t-nome').value.trim();
       
        if (!nome) return alert('Informe o nome da transportadora.');


        var existe = ST.transportadoras.find(e => e.nome.toLowerCase() === nome.toLowerCase());
        if(existe) {
            existe.pKg = document.getElementById('cfg-t-pkg').value || 0,
            existe.pCx = document.getElementById('cfg-t-pcx').value || 0
        } else {
            ST.transportadoras.push({
                id: 't_' + Date.now(),
                nome: nome,
                pKg: document.getElementById('cfg-t-pkg').value || 0,
                pCx: document.getElementById('cfg-t-pcx').value || 0,
                excecoesProdutos: []
            });
        }

        persistirDados();
        document.getElementById('cfg-t-nome').value = '';
        document.getElementById('cfg-t-pkg').value = '';
        document.getElementById('cfg-t-pcx').value = '';
        renderConfiguracoes();
        renderLoteCompleto();
        mostrarToast('Transportadora cadastrada com sucesso.');
    }

    function adicionarExcecao() {
     
        var nomeInput = document.getElementById('exc-nome-geral').value.trim();
        var tipoCobranca = document.getElementById('exc-tipo-geral').value;
        var precoInput = parseNumeroBR(document.getElementById('exc-preco-geral').value);

        if(!nomeInput) return alert('Digite o nome do produto para a exceção.');

        var transp = ST.transportadoras.find(t => t.id === document.getElementById('transpExc').value );
        if(!transp) return;
        if(!transp.excecoesProdutos) transp.excecoesProdutos = [];

        
        var pesoMaxInput = parseNumeroBR(document.getElementById('exc-pesomx-geral').value || '0');
        var pesoExKg = parseNumeroBR(document.getElementById('exc-exckg-geral').value || '0');
        
        var existe = transp.excecoesProdutos.find(e => e.nomeProd.toLowerCase() === nomeInput.toLowerCase());
        if(existe) {
            existe.tipoCobranca = tipoCobranca;
            existe.preco = precoInput;
            existe.pesoMax = pesoMaxInput;
        } else {
            transp.excecoesProdutos.push({
                nomeProd: nomeInput,
                tipoCobranca: tipoCobranca,
                preco: precoInput,
                pesoMax: pesoMaxInput,
                pesoRegra: pesoExKg
        
            });
        }
        
        persistirDados();
        renderConfiguracoes();
        document.getElementById('transpExc').selectedIndex = 0;
        document.getElementById('exc-nome-geral').value= null;
        document.getElementById('exc-tipo-geral').selectedIndex = 0;
        document.getElementById('exc-preco-geral').value = null;
        document.getElementById('exc-pesomx-geral').value = null;
        document.getElementById('exc-exckg-geral').value = null;
        document.getElementById('transpExc').focus();
        
        ST.lote.forEach(function(nf){processarCalculosDeFreteNota(nf.id);});
        renderLoteCompleto();
        mostrarToast('Exceção cadastrada com sucesso!');
          
    }
      
    function removerTransportadora(id) {
        ST.transportadoras = ST.transportadoras.filter(t => t.id !== id);
        persistirDados();
        renderConfiguracoes();
    }

    function removerExcecaoProduto(idTransp, indexExcecao) {
        var transp = ST.transportadoras.find(t => t.id === idTransp);
        if(!transp || !transp.excecoesProdutos) return;
        transp.excecoesProdutos.splice(indexExcecao, 1);
        persistirDados();
        renderConfiguracoes();
    }

    function adicionarRegraDestinatario() {
        var chave = document.getElementById('cfg-d-chave').value.trim();
        if(!chave) return alert('Informe o CNPJ ou Nome de identificação do cliente.');
        ST.destinatarios.push({
            id: 'd_' + Date.now(),
            cnpj: chave,
            transpId: document.getElementById('cfg-d-transp').value,
            modal: document.getElementById('cfg-d-modal').value
        });
        persistirDados();
        document.getElementById('cfg-d-chave').value = '';
        renderConfiguracoes();
        mostrarToast('Regra de cliente cadastrada.');
    }

    function removerRegraDestinatario(id) {
        ST.destinatarios = ST.destinatarios.filter(d => d.id !== id);
        persistirDados();
        renderConfiguracoes();
    }

    function inicializarPressLongo() {
        var colunas = ['data','nNF','fonte','destinatario','pesoKg','totalCx','valorNF','transportadora','frete','freteUnitKg','freteUnitCx'];
        colunas.forEach(function(col) {
            var th = document.getElementById('th-' + col);
            if (!th) return;
            th.addEventListener('click', function(){ if(!_copiouAgora) sortHist(col); _copiouAgora = false; });
            th.addEventListener('mousedown', function(){ _pressTimer = setTimeout(function(){ _copiouAgora = true; copiarColuna(col); }, 1000); });
            th.addEventListener('mouseup', function(){ clearTimeout(_pressTimer); });
            th.addEventListener('mouseleave', function(){ clearTimeout(_pressTimer); });
        });
    }
    
    inicializarPressLongo();
     
    renderConfiguracoes();