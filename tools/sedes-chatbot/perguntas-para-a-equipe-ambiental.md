# Perguntas para a equipe de Engenharia Ambiental

O assistente do SEDES responde com os dados do site e com os textos da home, do glossário e do catálogo de índices. Quando um termo não está explicado nesses lugares, ele não tem de onde tirar a explicação: ou diz que não sabe, ou explica de um jeito genérico.

Abaixo estão os pontos em que isso mais acontece, em ordem de importância. Cada item diz o que vimos nos dados e o que precisamos saber. Não precisa responder em texto bonito: uma ou duas frases por item já bastam, e nós colocamos no lugar certo.

## 1. Priorização: critérios cujo valor não bate com a descrição

Conferimos os valores de cada critério nos 5.570 municípios. Em alguns, o número não parece ser o que a descrição diz. Se for erro na planilha, a análise sai errada para quem usa o site também, não só no chat.

1. **Área Degradada.** A descrição diz "área em km²", mas o maior valor é 95,8, em Montadas (PB), que tem 31,8 km² de área total. Altamira (PA), com 159 mil km², tem 0. Parece ser **% da área** do município, não km². Qual é?
2. **Seca Registrada.** A descrição diz "percentual de seca grave, extrema e excepcional em 6 meses". Mas só aparecem 5 valores: 0, 16,7, 33,3, 50 e 100. Isso parece ser **quantos dos 6 meses** tiveram seca grave ou pior (1/6, 2/6, 3/6 e 6/6), e não a porcentagem da área. É isso? Por que não aparecem 4/6 nem 5/6?
3. **População Indígena.** Está marcada como **benefício**, ou seja, quanto mais pessoas indígenas, menor a prioridade do município. É isso mesmo? O valor também é um número absoluto de pessoas, não uma porcentagem, então municípios grandes saem na frente.
4. **Cisternas (consumo, produção e escolares).** São **benefício** e número absoluto. Assim, um município que recebeu muitas cisternas fica com prioridade menor. Mas ter recebido muitas cisternas também pode indicar que a necessidade é grande. Qual leitura a equipe quer?
5. **Mulheres Produtoras e Produtores em Cooperativas.** Só aparecem 5 valores (10, 15, 20, 30 e 55,5 no primeiro; 10, 20, 40, 60 e 100 no segundo). A descrição fala em "percentual máximo". Esses números são o teto de uma faixa do Censo? Como explicar isso a quem usa?
6. **Pobreza Rural.** O código do critério diz 2021, e a descrição diz 2025. De que ano é o dado? É o mesmo número do índice "Pobreza rural (CadÚnico)" do Monitoramento?
7. **Anomalia de Precipitação.** O código diz outubro de 2026, e a descrição diz dezembro de 2026. Qual mês é? É a anomalia em mm do CPTEC? O critério vai ser atualizado quando sair uma previsão nova?
8. **Índice de Seca (SPE).** É um dos quatro critérios padrão do site, e a única explicação é "percentual médio municipal do indicador SPE". O que é o SPE? Percentual de quê, e de qual período? Os valores vão de 0,8 a 40. Um município com 40 está em situação ruim?
9. **Índice de Vulnerabilidade Climática.** Os valores vão de 0 a 66. Qual é a escala, e a partir de quanto o valor é alto?
10. **Índice de Progresso Social.** De que ano é?

## 2. Priorização: como ler o resultado

Hoje o chat sabe explicar a conta: os níveis são relativos ao grupo comparado, e não há ordem dentro de um nível. O que ele não sabe é o que o resultado **significa para quem decide**. Por isso as respostas ficam corretas, mas difíceis de usar.

1. O que um gestor deve fazer com "prioridade muito alta"? É uma lista para olhar primeiro, para destinar recurso, para visitar?
2. Por que os quatro critérios padrão são Aridez, Seca (SPE), Área Degradada e Pobreza Rural? Existe uma combinação recomendada para cada tipo de pergunta, como seca agora, desertificação ou vulnerabilidade social?
3. Quando usar a comparação dentro de cada estado e quando usar a comparação com todos os municípios juntos?
4. Quando usar o cenário pessimista e quando usar o otimista? O site já explica a diferença. Falta dizer quando cada um é o adequado.
5. Ao explicar por que um município ficou num nível, o que é útil dizer: os critérios em que ele está pior, a comparação com os vizinhos, outra coisa?

## 3. Índices do Monitoramento cujas classes não estão explicadas

1. **Índice Combinado de Seca (CDI).** O catálogo explica a cascata (falta de chuva, depois de umidade no solo, depois estresse na vegetação), mas não diz o que são os **Estágios 1, 2 e 3** nem as três classes de **recuperação**. O Estágio 3 é o mais grave? "Recuperação parcial da umidade" quer dizer que o solo se recuperou e a vegetação ainda não?
2. **Índice de Degradação da Terra.** As classes são Nível 5 a Nível 1 e Conservado. O catálogo não diz qual nível é o **mais degradado**. Pelo critério "Área Degradada" da Priorização, que usa os níveis 4 e 5, parece ser o 5. Confirmam? O índice tem só dois anos (2001 e 2021). Os dois são comparáveis?
3. **Índice de Aridez.** O glossário diz que a aridez é calculada sobre cerca de 30 anos. Mas o site tem um valor por ano, de 1980 a 2024. O valor de cada ano é só daquele ano ou de uma janela de 30 anos? E o site tem duas versões, ERA5-Land e BR-DWGD. Quando elas discordam, qual usar?
4. **Monitor de Secas.** O catálogo diz que o mapa mostra "a situação no mês anterior". O período "setembro de 2026" no site é a seca de setembro ou a de agosto?
5. **Dinâmica da Degradação da Terra (ODS 15.3.1).** Quais são os períodos de referência e de relatório?
6. **Produção Primária Bruta** e **Carbono Orgânico do Solo.** As faixas estão em kg C/m² e g/kg. Que faixa é baixa para a Caatinga? Sem isso, o chat só consegue repetir os números.
7. **Mortalidade infantil.** O site mostra a unidade como "%". O valor é por mil nascidos vivos?
8. **Registros do S2iD.** Na planilha, quase todo município tem 0 ou 1 por ano, e a série começa em 1991, embora a descrição diga 2004 a 2025. O 1 quer dizer "um registro" ou "houve registro no ano"?

## 4. Previsões

1. **CPTEC e INMET discordam muito.** Na Paraíba, para dezembro de 2026, o INMET prevê chuva abaixo do normal em 79 dos 80 municípios com seca grave ou pior; o CPTEC, em nenhum. A equipe recomenda uma das fontes, ou o certo é sempre mostrar as duas?
2. **"Normal" é a média de qual período** (por exemplo, 1991 a 2020)?
3. **Erros no catálogo, para corrigir:**
   - "Previsão: Temperatura Mensal Probabilidade | INMET" mostra exatamente os mesmos números da previsão de chuva do INMET. Parece ler a tabela errada.
   - As classes da chuva **trimestral** acumulada estão em "mm/mês". É mm por mês ou mm no trimestre?
   - Uma classe da anomalia de temperatura trimestral do CPTEC está escrita "cima do normal", sem o "A".
   - As 8 previsões por probabilidade têm descrição de uma linha só.

## 5. Para todo o site

1. **Quando um valor é preocupante?** Por exemplo: a partir de quanto da área em seca grave um município merece atenção? Hoje o chat só compara com outros municípios, porque não tem um limite de referência.
2. **Quais índices costumam andar juntos e quais não devem ser comparados?** Isso ajuda nas perguntas de cruzamento, como pobreza com degradação ou seca com aridez.

## Onde colocar as respostas

- **Item 1:** correção na planilha da Priorização: no valor ou na descrição do critério. O chat lê a descrição da planilha.
- **Itens 3 e 4:** na descrição de cada índice no catálogo. Sugestão de roteiro para cada índice, em poucas linhas:
  - o que mede;
  - como ler as classes, e qual é a pior;
  - de quando é o dado;
  - quando um valor é preocupante;
  - o que o índice **não** diz.
- **Itens 2 e 5:** no glossário ou num texto do site sobre a Priorização. Se preferirem não publicar, podem nos mandar o texto, e ele entra só no chat.
