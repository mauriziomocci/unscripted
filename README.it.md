# Unscripted

[English](README.md) | Italiano

[![Licenza: MIT](https://img.shields.io/badge/licenza-MIT-blue.svg)](LICENSE)
[![Stato](https://img.shields.io/badge/stato-pre--release-yellow.svg)]()

> Un palcoscenico per personaggi artificiali dotati di libero arbitrio. Tu
> scrivi chi sono, scegli la scena, tiri qualche filo dalla cabina di regia.
> Le loro battute non le scrive nessuno.

## L'idea

Unscripted è un gioco di personaggi che nessuno sceneggia.

Ogni personaggio è una scheda scritta: nome, età, storia, convinzioni, paure,
modo di parlare, un paio di segreti e di obiettivi nascosti, e cosa pensa
degli altri. Un modello linguistico interpreta ogni personaggio, una decisione
o una battuta alla volta, usando solo quello che quel personaggio sa. Quello
che succede non è previsto: alleanze, rancori, battute, litigi, gentilezze e
cattiverie nascono dai personaggi stessi.

I personaggi stanno in un archivio e possono essere messi in **ambienti**
diversi, i palcoscenici del gioco. Le stesse persone si comportano in modo
diverso su un'isola deserta e sotto le luci di uno studio televisivo, e
possono portarsi dietro i ricordi da un palcoscenico all'altro.

Tu non sei un personaggio. Sei il regista: guardi e, quando vuoi, intervieni.

## Gli ambienti

### L'isola

Un gruppo di naufraghi si risveglia su un'isola deserta. Devono trovare
acqua, cibo e riparo, e convivere. Ognuno decide da solo cosa fare, di chi
fidarsi e cosa dire. Meteo, animali, fuoco, fame e noia sono simulati;
possono arrivare tempeste, incendi e navi di passaggio.

Da regista puoi aggiungere risorse, cambiare il tempo, suggerire un pensiero a
qualcuno, riunire tutti attorno al fuoco per discutere, far arrivare un nuovo
naufrago, oppure lasciar correre. I personaggi possono morire, e in quella
storia la morte è definitiva.

### Il talk show

Un talk show televisivo di seconda serata, con un conduttore e fino a otto
ospiti presi dall'archivio. Tutti ascoltano tutti: gli ospiti rispondono al
conduttore, entrano nelle discussioni degli altri, interrompono, si schierano,
borbottano, si alzano in piedi e puntano il dito. Il conduttore modera, e tu
stai in regia.

Dalla regia puoi parlare nell'auricolare del conduttore, parlare in onda in
modo che tutti ti sentano, suggerire pensieri a chiunque, guidare applausi e
fischi del pubblico, chiamare un faccia a faccia, una domanda a bruciapelo o
un televoto, e lanciare colpi di scena: una telefonata in diretta, uno
spettatore che urla, un ex che entra in studio, un messaggio anonimo, un
vecchio video imbarazzante. Durante la pubblicità gli ospiti credono che i
microfoni siano spenti.

### Altri in arrivo

Gli ambienti condividono personaggi, archivio e resoconti, quindi se ne
possono aggiungere di nuovi senza riscrivere il resto.

## Cosa ne ricavi

- Un palcoscenico 3D dal vivo, con fumetti, regia delle inquadrature e
  reazioni.
- Una cronaca o trascrizione di tutto quello che è stato detto e fatto.
- Un resoconto per ogni sessione: indicatori per ogni personaggio, grafo delle
  relazioni, momenti migliori e un PDF impaginato come un libro.
- Un racconto in forma di romanzo, fedele a nomi e avvenimenti.
- Un archivio di personaggi da modificare, importare da file Markdown,
  versionare e riusare tra una storia e l'altra. Chi muore resta nell'archivio
  come deceduto.

## Come è fatto

Unscripted esiste in due forme che condividono sempre lo stesso motore di
gioco:

| Forma | Cos'è | Modello linguistico |
|---|---|---|
| **App web** (questo repository) | Front end React e un piccolo back end Node, avviati con Docker Compose | API di Anthropic Claude, oppure qualsiasi modello locale servito da [LM Studio](https://lmstudio.ai/) |
| **Artifact di Claude** | Una sola pagina autosufficiente che gira dentro claude.ai | Il piano Claude di chi la apre |

La logica di gioco vive in un unico pacchetto condiviso. Entrambe le forme
vengono costruite da lì, quindi non possono disallinearsi.

```
unscripted/
  packages/core/     motore di gioco: personaggi, isola, talk show, prompt, resoconti
  apps/web/          front end React (Vite, three.js)
  apps/server/       back end Node: proxy verso i modelli, elenco modelli, salvataggi e archivio
  apps/artifact/     costruzione dell'artifact a pagina singola dallo stesso core
  compose/           Dockerfile ed entrypoint
  docs/              note di progetto e specifiche
```

### Modelli linguistici

- **Claude (API)**: si imposta `ANTHROPIC_API_KEY` nell'ambiente del back end.
  La chiave non arriva mai al browser.
- **In locale, con LM Studio**: si avvia il server locale di LM Studio sulla
  macchina host. Il back end lo raggiunge su
  `http://host.docker.internal:1234/v1` (API compatibile con OpenAI). Il gioco
  elenca i modelli caricati e permette di sceglierne uno, separatamente per i
  personaggi principali e per le chiamate leggere di sottofondo. I modelli che
  seguono bene le istruzioni e producono JSON affidabile danno i risultati
  migliori.

## Stato

Pre-release. L'artifact di Claude è già giocabile; l'app web è in costruzione
a partire dallo stesso motore. Le istruzioni di installazione verranno
aggiunte qui appena sarà pronta la prima versione con Docker Compose.

## Contribuire

I contributi sono benvenuti. Leggi [`CLAUDE.md`](CLAUDE.md) per le
convenzioni del progetto: flusso di lavoro, nomi dei branch, formato dei
commit, checklist di revisione del codice e regole sulla documentazione.
Codice, commenti e documentazione sono in inglese; il README è tenuto in
inglese e in italiano, allineati.

## Licenza

[MIT](LICENSE)
