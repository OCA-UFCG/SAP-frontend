<!-- Escrito à mão. O que o site não diz e o bot precisa saber para ler os dados.
Termos que valem para o site todo (decêndio, CadÚnico) deveriam ir para o
Glossário do site, no Contentful; aí o `npm run guia` os traz para site.md e
podem sair daqui. O que é de um índice só fica no catálogo de índices. -->

# Complemento: como ler os dados do SEDES

## O que os valores significam

- Na maioria dos índices, o valor é a **porcentagem da área do território** em cada classe. Por exemplo, no Monitor de Secas: 40% da área em seca fraca, 25% em seca moderada. As classes de um território somam cerca de 100%.
- **Pobreza (CadÚnico)**: porcentagem das famílias inscritas no CadÚnico que estão em situação de pobreza. Não é a porcentagem da população toda.
- **Registros do S2iD**: contagem de registros de seca e estiagem da Defesa Civil.
- **PIB**: valor em reais. **IDH**: número de 0 a 1.
- Cada índice diz no catálogo o que o valor significa, a unidade e de quando é o dado.

## Territórios (recortes)

O SEDES tem dados para seis níveis territoriais e para o Brasil:

- município (os 5.570 do país);
- estado;
- região (Norte, Nordeste, Centro-Oeste, Sudeste, Sul);
- bioma (Amazônia, Caatinga, Cerrado, Mata Atlântica, Pampa, Pantanal);
- Semiárido (o recorte oficial da Sudene);
- ASD (Áreas Suscetíveis à Desertificação), em duas versões: "Apenas ASD" e "ASD + Entorno".

Estados e recortes têm valor próprio. Em alguns índices esse valor é calculado sobre a área do recorte; em outros, é a soma ou a média dos municípios. O catálogo diz qual.

## Períodos

- **Ano** (2023), **mês** (abril de 2026) ou **decêndio**.
- **Decêndio** é um período de cerca de 10 dias. Cada mês tem três: do dia 1 ao 10, do 11 ao 20 e do 21 ao fim do mês. O dado de um decêndio aparece pela data em que ele começa. Exemplo: o dia 7 de maio está no decêndio que começa em 1º de maio.
- Cada índice tem a sua própria série: alguns começam nos anos 1980, outros têm só alguns anos.

## Previsões

- As previsões vêm do CPTEC/INPE e do INMET, para chuva e temperatura, por mês e por trimestre.
- **Trimestre**: nas previsões trimestrais, o período é o mês em que o trimestre começa. Ex.: o período 2026-11 é o trimestre de novembro de 2026 a janeiro de 2027.
- **Acumulado** (ou média, na temperatura): quanto se espera de chuva no período, em faixas (ex.: "10 a 100 mm/mês").
- **Anomalia**: quanto se espera que fique acima ou abaixo do normal para a época. Na chuva, em mm (ex.: "Abaixo do normal (-90 a -30 mm/mês)"). As classes abaixo do normal são três: levemente abaixo, abaixo e muito abaixo; o mesmo vale acima.
- **Probabilidade**: a chance de ficar abaixo ou acima do normal. Cada classe diz o lado e a faixa de chance (ex.: "40% a 65% (acima da Normal)" = de 40% a 65% de chance de ficar acima do normal). O sinal de menos só indica o lado: "-65% a -40% (abaixo da Normal)" = de 40% a 65% de chance de ficar abaixo do normal. Não existe chance negativa.
- O CPTEC e o INMET usam modelos diferentes e às vezes discordam.
- Previsão não é medição: é uma estimativa para os próximos meses, que pode não se confirmar.

## CadÚnico

O Cadastro Único para Programas Sociais (CadÚnico) é o registro do Governo Federal das famílias de baixa renda, usado para dar acesso a programas sociais. Os índices de pobreza do SEDES são calculados sobre as famílias inscritas nele.

## Como usar a plataforma

- **Monitoramento**: escolha um produto (índice) para ver o mapa do Brasil. Pesquise um estado ou município e escolha a data da análise para ver o detalhamento.
- **Comunicação**: escolha o recorte e o território, marque os produtos e clique em "Gerar relatório". O relatório traz o valor, o mapa e a série de cada produto, e pode ser baixado em PDF.
- **Priorização**: escolha indicadores e dê um peso a cada um para ver quais municípios aparecem como prioridade.

## Sobre este assistente

- É um protótipo. Responde com os dados do tabelão, uma cópia das tabelas que o site usa, feita na data indicada no rodapé da página.
- Pode errar. Para conferir um número, use o botão "Ver no SEDES", que abre o mesmo dado no site.
