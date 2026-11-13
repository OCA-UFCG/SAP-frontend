<!--
Como a Priorização funciona, para o bot explicar os resultados de
priorizar_municipios. Vai inteiro para o prompt do sistema (prompt-sistema.ts).
Fontes: os textos da aba Priorização do site (src/translations/pt/AnalyzeForm.json
e Map.json do SAP-frontend) e o código do backend SAP-analise-multicriterial
(app/services/analysis e pre_processing), conferidos em 12/11/2026.
Material novo da equipe sobre como interpretar os critérios e os níveis entra aqui.
-->

# Priorização (análise multicritério)

A Priorização é uma aba da plataforma SEDES. A pessoa escolhe indicadores (os critérios), dá a cada um uma importância de 1 a 10 e o sistema classifica os municípios de uma área em 5 níveis de prioridade de intervenção: muito alta, alta, média, baixa e muito baixa. O resultado sai num mapa, numa planilha e num relatório ("Síntese da Priorização").

## De onde vêm os dados

Os critérios e os valores dos municípios vêm de uma planilha que a equipe do SEDES mantém, relida a cada 30 minutos. Não são os índices do tabelão: um critério com nome parecido com um índice (ex.: "Seca Registrada" e o Monitor de Secas) pode ter outro período ou outra conta. Use a descrição do critério para dizer de quando é o dado.

## Opções da análise (textos do site)

- Indicadores: "Selecione e ajuste a importância relativa de cada indicador para a tomada de decisão. O peso atribuído (de 1 a 10) será normalizado automaticamente para que a soma total seja igual a 100%."
- Benefício e custo: "Benefício: quanto maior o valor, melhor a situação do município, reduzindo a prioridade de intervenção. Custo: quanto maior o valor, pior a situação, aumentando a prioridade de intervenção." Cada critério já vem com o seu tipo; a pessoa não escolhe.
- Área de interesse: "o recorte geográfico onde a análise será aplicada": Brasil, um estado, uma região, um bioma, o Semiárido ou ASD e entorno.
- Granularidade do ranking: "nível em que as cidades serão comparadas". Com "Estadual", cada estado é comparado só consigo mesmo; com "Todos", todos os municípios da área entram numa comparação só. No chat é o parâmetro comparar_dentro_de. O padrão do site é Estadual.
- Limiares (configurações avançadas): "O limiar de Indiferença define o limite para considerar alternativas equivalentes; o de Preferência estabelece a diferença necessária para que uma alternativa seja considerada superior; e o de Veto atua como um fator restritivo, impedindo a sobreclassificação se houver uma diferença extrema." Padrão: 0,02, 0,1 e 0,5.
- Cenários: "O ELECTRE TRI-B produz dois procedimentos de atribuição, otimista e pessimista, que podem divergir quando um município está na fronteira entre duas classes." O pessimista (padrão) põe esse município na classe de maior prioridade das duas: "mais conservadora e adequada a contextos de política pública onde é preferível não subestimar a prioridade de um território". O otimista põe na de menor prioridade e "reserva as classes mais altas aos territórios em que a prioridade não deixa dúvida".

## Como a conta é feita (do código do backend)

1. Ficam de fora os municípios sem valor em algum critério escolhido. O resultado diz quantos e quais.
2. Dentro de cada grupo de comparação, cada critério é reescalado de 0 a 1 entre o menor e o maior valor do grupo. Nos critérios de custo a escala é invertida, para 1 ser sempre a melhor situação.
3. As fronteiras entre os 5 níveis são os percentis 20, 40, 60 e 80 de cada critério no grupo.
4. O método ELECTRE TRI-B compara cada município com essas fronteiras, critério a critério, pesando pelos pesos, com os limiares acima e um corte de 70% de concordância.

Consequências para explicar um resultado:

- O nível é relativo ao grupo: "prioridade muito alta" quer dizer em situação pior que a maioria dos municípios do mesmo grupo nos critérios escolhidos, não um valor absoluto. Comparando dentro de cada estado, um município de prioridade alta num estado pode estar melhor que um de prioridade baixa em outro.
- Os níveis não têm tamanhos iguais: as fronteiras são por critério, e o número de municípios em cada nível depende de como os critérios se combinam.
- Dentro de um nível não há ordem: o método não diz qual município de prioridade muito alta é "o primeiro".
- Mudar os critérios, os pesos, a área ou a comparação muda o resultado. Diga sempre a configuração usada.
- Para explicar por que um município ficou num nível, use a coluna "situação pior que (% do grupo)" de cada critério: perto de 100% puxa a prioridade para cima, perto de 0% puxa para baixo. É uma explicação aproximada; o método não soma notas.
