/**
 * A busca de território: nomes com erro de digitação, com a UF junto, com
 * apóstrofo, e nomes que servem a mais de um território.
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  buscarTerritorios,
  distancia,
  encerrarFerramentas,
  separarUf,
} from "../ferramentas.ts";

after(() => encerrarFerramentas());

test("separa a UF escrita junto do nome", () => {
  assert.deepEqual(separarUf("Campina Grande - PB"), {
    nome: "Campina Grande",
    uf: "PB",
  });
  assert.deepEqual(separarUf("Petrolina/PE"), { nome: "Petrolina", uf: "PE" });
  assert.deepEqual(separarUf("Sousa (pb)"), { nome: "Sousa", uf: "PB" });
  // "II" não é UF: o nome fica inteiro.
  assert.deepEqual(separarUf("Pedro II"), { nome: "Pedro II" });
});

test("conta as letras de diferença entre dois nomes", () => {
  assert.equal(distancia("joaopesoa", "joaopessoa"), 1);
  assert.equal(distancia("cajazieras", "cajazeiras"), 2);
  assert.equal(distancia("patos", "patos"), 0);
});

test("acha o município com a UF no nome ou sem o apóstrofo", () => {
  assert.match(buscarTerritorios("Campina Grande - PB"), /2504009/);
  assert.match(buscarTerritorios("Olho dagua do Borges"), /2408409/);
  // Um nome que existe por inteiro não tem a "UF" cortada.
  assert.match(buscarTerritorios("Pedro II"), /2207900/);
});

test("nome com erro de digitação traz o mais parecido, com o aviso", () => {
  const saida = buscarTerritorios("Cajazieras");
  assert.match(saida, /2503704 \| Cajazeiras/);
  assert.match(saida, /erro de digitação/);
  // Outro país não vira um município de nome parecido.
  assert.match(buscarTerritorios("Argentina"), /Nenhum território/);
  assert.doesNotMatch(buscarTerritorios("Argentina"), /Arantina/);
});

test("avisa quando o nome serve a territórios de tipos diferentes", () => {
  const sp = buscarTerritorios("São Paulo");
  assert.match(sp, /\| estado \|/);
  assert.match(sp, /\| municipio \|/);
  assert.match(sp, /tipos diferentes/);
  // A lagoa gaúcha atende pelo nome sem "Área Operacional".
  const lagoa = buscarTerritorios("Lagoa dos Patos");
  assert.match(lagoa, /4300002/);
  assert.match(lagoa, /3137304/);
  // Homônimos continuam pedindo a UF.
  assert.match(buscarTerritorios("Santa Luzia"), /4 municípios com esse nome/);
  assert.doesNotMatch(buscarTerritorios("Santa Luzia", "PB"), /ATENÇÃO/);
});
