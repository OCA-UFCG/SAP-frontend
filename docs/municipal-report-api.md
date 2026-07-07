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
