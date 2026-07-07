# Municipal report data API

`GET /api/municipal-report/{codigoIBGE}?period=YYYY` (ou `YYYY-MM`) exige uma sessão autenticada e retorna o contrato `MunicipalReportData` versão 1.

Exemplo resumido:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-07T12:00:00.000Z",
  "requestedPeriod": "2024-01",
  "municipality": { "code": "5200050", "name": "Abadia de Goiás", "uf": "GO" },
  "analyses": [
    {
      "id": "anaseca",
      "alias": "seca",
      "title": "Monitor de Secas",
      "unit": "%",
      "status": "available",
      "requestedPeriod": "2024-01",
      "effectivePeriod": "2024-01",
      "classes": [{ "id": "sem-seca", "label": "Sem seca", "color": "#fff" }],
      "snapshot": {
        "period": "2024-01",
        "label": "Janeiro de 2024",
        "distribution": [
          {
            "id": "sem-seca",
            "label": "Sem seca",
            "color": "#fff",
            "percentage": 62.4
          }
        ],
        "dominantClass": {
          "id": "sem-seca",
          "label": "Sem seca",
          "color": "#fff",
          "percentage": 62.4
        }
      },
      "timeSeries": []
    }
  ],
  "templateVariables": {
    "municipio": "Abadia de Goiás",
    "uf": "GO",
    "codigoMunicipio": "5200050",
    "classe_seca": "Sem seca",
    "percentual_seca": 62.4,
    "periodo_seca": "2024-01"
  }
}
```

Cada análise pode ter estado `available`, `unavailable` ou `period_not_found`. Falhas parciais não invalidam as demais análises. As variáveis são valores estruturados; esta API não interpola templates.

Quando o período solicitado não existe, a API ainda retorna `200` com
`status: "period_not_found"` e os períodos existentes em `timeSeries`. O status
`502` é reservado ao caso em que nenhuma camada configurada pôde ser carregada.

---

## Chart API (geração de imagem)

`GET /api/municipal-report/{codigoIBGE}/chart?period=YYYY-MM&analysis=alias` exige sessão autenticada e retorna um **PNG** do gráfico de série temporal.

### Parâmetros

| Parâmetro  | Tipo  | Obrigatório | Descrição                                                                |
| ---------- | ----- | ----------- | ------------------------------------------------------------------------ |
| `period`   | query | sim         | Período no formato `YYYY` ou `YYYY-MM`                                   |
| `analysis` | query | sim         | Um ou mais IDs/aliases separados por vírgula (ex: `seca`, `seca,aridez`) |

### Comportamento

Retorna sempre um objeto JSON contendo as informações do município, o período solicitado e um array com os gráficos gerados codificados em **base64**:

```json
{
  "municipality": { "code": "2504009", "name": "Campina Grande", "uf": "PB" },
  "requestedPeriod": "2024-01",
  "charts": [
    {
      "analysisId": "anaseca",
      "alias": "seca",
      "title": "Monitor de Secas",
      "period": "2024-01",
      "contentType": "image/png",
      "base64": "iVBORw0KGgo..."
    }
  ]
}
```

### Exemplos

```
GET /api/municipal-report/2504009/chart?period=2024-01&analysis=seca
GET /api/municipal-report/2504009/chart?period=2024&analysis=seca,aridez,degradacao

```

### Como compor uma imagem no html:

```
<img
  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  alt="Monitor de Secas"
/>
```
