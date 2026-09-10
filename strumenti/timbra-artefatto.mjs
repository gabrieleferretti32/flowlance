#!/usr/bin/env node
/**
 * Timbra il sito appena costruito.
 *
 * Gira dentro `npm run build`, fra `next build` e la verifica dei link: da quel
 * momento `out/` porta con sé l'impronta del sorgente da cui è nato, e ogni
 * strumento che lo misura può accorgersi se nel frattempo è invecchiato.
 *
 * Se `next build` fallisce, questo non gira: il timbro resta quello di prima,
 * il sorgente nel frattempo è cambiato, e le verifiche si fermano invece di
 * misurare la cartella di ieri. È il punto.
 */
import { timbra } from "./artefatto.mjs";

const t = timbra();
console.log(`Timbro: ${t.quanti} file di sorgente, ${t.pagine} pagine · ${t.impronta.slice(0, 16)}…`);
