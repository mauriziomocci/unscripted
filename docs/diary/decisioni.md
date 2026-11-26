# Registro delle decisioni

Ogni decisione presa dalla trinità o dal solo revisore, con le posizioni, i cinque costi (token, tempo, qualità, modo di lavorare, soddisfazione di chi gioca) e lo stato: confermata dal proprietario, ribaltata, in attesa.

## 2026-11-14

### D-14-0: attivazione della modalità totalmente autonoma

- **Parole del proprietario (in chat, 18:45):** «vai in maniera totalmente autonoma, per cui le decisioni falle prendere alla trinità».
- **Forma:** una finestra, perché `pe.autonomy` non è impostato.
  - Perimetro: il WI-1, dalla revisione della spec in avanti.
  - Inizio: 18:45. Fine: 21:00, perché il proprietario non ha indicato un orario e oltre le 21 serve un'autorizzazione esplicita per il lavoro notturno.
  - Aperture: `spec`, `schema`, `design`, `publish`. L'apertura `contract` resta chiusa: con una finestra non si apre mai.
- **Restano al proprietario:**
  - il merge;
  - le installazioni sull'host;
  - le azioni irreversibili;
  - le modifiche ai requisiti. Le deviazioni C1 e C5 della spec rientrano qui: restano proposte, e i task che dipendono da loro sono fermi.
- **Stato:** in attesa di conferma.

### D-14-1: estensione al merge e alle deviazioni

- **Parole del proprietario (in chat, 18:47):** «fai tutto, anche il merge ecc».
- **Cosa apre:**
  - il merge `--no-ff` dei branch del WI-1 nel branch ombrello e poi in `develop`, come prescrive `CLAUDE.md`, sempre dopo la validazione finale interna: suite completa, revisione dell'intero diff, soglia 8/10;
  - le decisioni sulle deviazioni C1 e C5, che passano alla trinità come decisioni provvisorie.
- **Restano chiusi:**
  - `main` e i rilasci;
  - il force-push;
  - le installazioni sull'host, che non servono perché si lavora nei container;
  - le cancellazioni fuori dal worktree;
  - le azioni irreversibili;
  - denaro, credenziali e messaggi a persone.
- **Stato:** in attesa di conferma.

### D-14-2: limiti del modello provvisori (FR-031)

- **Chi ha deciso:** il revisore da solo, perché è un caso tecnico.
- **Problema:** il primo giro di revisione ha mostrato che misurare il limite di chiamate con un golden è un ragionamento circolare: il golden usa tempo finto e latenze scelte da noi.
- **Decisione:** 120 chiamate al minuto e 10 USD al giorno restano valori provvisori di sicurezza, non misurati. Li sostituisce la misura fatta durante le partite di prova con il modello vero che chiudono il WI-2 (isola) e il WI-4 (talk show).
- **I cinque costi:**
  - token: nessuno;
  - tempo: nessuno nel WI-1;
  - qualità: nessun numero inventato spacciato per misura;
  - modo di lavorare: la misura diventa un task tracciato;
  - giocatore: nessun effetto, perché il ritmo lo regolano i limiti di concorrenza.
- **Stato:** in attesa di conferma.

### D-14-3: personaggi pronti (solo proposta)

- **Chi ha deciso:** la trinità, che si limita a proporre: la scelta resta al proprietario, come ha rilevato il secondo giro di revisione.
- **Proposta:** pubblicarli così come sono. Il prompt di handoff chiede di copiare i sorgenti senza modificarli (FR-080), e la build identica byte per byte (SC-003) richiede `archpack.js` intatto.
- **Perché la scelta non è nostra:** lo stesso prompt vieta i nomi reali (sezione 6), e due nomi del pacchetto richiamano figure pubbliche reali. Inoltre il push su un repository pubblico è un rilascio irreversibile.
- **Nel frattempo:** i sorgenti copiati si possono committare in locale, ma non si pubblicano.
- **Stato:** **confermata dal proprietario** il 2026-11-14, in chat: «Sì, così come sono». Il blocco della pubblicazione è tolto: sorgenti copiati, fixture, seed e golden si possono pubblicare, e la CI su GitHub può girare.

### D-14-4: deviazioni C1 e C5 accettate in via provvisoria

- **Chi ha deciso:** la trinità, sotto D-14-1.
- **Decisione:**
  - **C1:** il mock dei golden usa le chiavi `(tipo, numero d'ordine)` e non l'attore, che il codice vecchio non passa nel punto della chiamata. L'ordine delle chiamate resta identico, quindi la coppia identifica ogni chiamata con la stessa precisione.
  - **C5:** nel WI-1 gli store implementano solo i personaggi. Partite ed eventi arrivano nel WI-2, insieme alle loro rotte.
- **I cinque costi:** non si scrive codice senza chi lo usa, il WI-1 resta più piccolo e la verifica non perde precisione.
- **Stato:** in attesa di conferma.

### D-14-5: scelta del modello come regola di gioco (C17)

- **Chi ha deciso:** il revisore da solo, su un rilievo del primo giro.
- **Decisione:** il ripiego dal modello leggero e `G.lightModel` restano in core. La richiesta acquista un campo opzionale, `lowLatency` (chiamato all'inizio `quick`, nome scartato perché nel codice vecchio `quick` indica il modello leggero), che si aggiunge alla porta del prompt di handoff senza togliere nulla. Senza questo campo il comportamento del codice vecchio (tre insiemi di opzioni, `engine.js:8-10`) non è riproducibile.
- **Stato:** in attesa di conferma.

### D-14-6: S-08 tiene le attese sul server (D5), e un giro di verifica in più

- **Problema:** il terzo giro di revisione ha trovato che la correzione del secondo giro ("calcola tutto il core") riapriva la decisione D5 senza il proprietario. D5 vuole che per l'app web sia il server a calcolare le attese.
- **Chi ha deciso:** il revisore da solo, perché è un caso tecnico.
- **Decisione:** si rispetta D5 senza deviare. Il server calcola l'attesa con la stessa `BackoffPolicy` del core, come fa già con le regole dell'archivio; l'artifact la calcola nel browser. I tentativi li conta solo il core. La richiesta riceve il campo opzionale `attempt`; il contratto si congela solo al merge del WI-1, quindi ora aggiungerlo non è una modifica di un contratto consegnato.
- **Alternativa scartata:** portare al proprietario una deviazione da D5. Costa meno codice, ma riapre una decisione già chiusa.
- **Giro in più:** il tetto di tre giri è raggiunto con 0 rilievi critici e 1 importante, ora corretto. Il coordinatore decide un quarto giro limitato alle modifiche del terzo, perché l'approvazione della spec richiede un verdetto CONVERGED. Costa pochi minuti e poco budget (siamo all'8% della settimana, con il tetto di oggi al 20%).
- **Stato:** in attesa di conferma.

### D-14-7: approvazione della spec del WI-1 (apertura `spec`)

- **Chi ha deciso:** la trinità. Il coordinatore ha fatto da Domenico. Il giudizio sulle prove viene dai revisori avversariali, due agenti indipendenti con mandato ostile. Riccardo non è entrato: la spec non cambia interfacce oltre a quelle del codice vecchio, e le sue regole sull'interfaccia sono nell'FR-075.
- **Apertura usata:** `spec`, della finestra D-14-0, con le estensioni di D-14-1.
- **Il ciclo, giro per giro:**
  - Revisore A, giro 1: `VERDICT: NOT CONVERGED`, `FINDINGS: 2/14/18`, `COVERAGE: partial`.
  - Revisore A, giro 2: `VERDICT: NOT CONVERGED`, `FINDINGS: 0/5/11`, `COVERAGE: partial`.
  - Revisore A, giro 3: `VERDICT: NOT CONVERGED`, `FINDINGS: 0/1/6`, `COVERAGE: partial`.
  - Revisore A, giro di verifica (D-14-6): `VERDICT: CONVERGED`, `FINDINGS: 0/0/3`, `COVERAGE: partial`.
  - Revisore B, indipendente, copertura completa (spec intera, diari del giocatore, documentazione di Vite, nginx, Fastify, Drizzle, fake-timers e fake-indexeddb, più di 60 citazioni verificate): `VERDICT: NOT CONVERGED`, `FINDINGS: 0/9/12`, `COVERAGE: full`.
  - Revisore B, giro 2: `VERDICT: NOT CONVERGED`, `FINDINGS: 0/2/9`, `COVERAGE: full`.
  - Revisore B, giro 3, che chiude il ciclo: `VERDICT: CONVERGED`, `FINDINGS: 0/0/4`, `COVERAGE: full`. I 4 minori sono stati corretti subito dopo, e la spec finale ha md5 `f48b108e2a3e14e5dda17c05f7b89ff6`.
- **Perché si approva nonostante i giri parziali di A:** i giri del revisore A sono rimasti a copertura parziale. Il revisore B però ha ricoperto da capo l'intero perimetro, ha trovato quello che A non aveva visto, e ha chiuso con copertura piena. Nessun rilievo critico o importante è rimasto aperto.
- **I cinque costi:**
  - token: circa il 3% della settimana per tutto il ciclo;
  - tempo: circa un'ora;
  - qualità: 7 giri di revisione e oltre 50 difetti corretti prima di scrivere codice;
  - modo di lavorare: le spec del WI-2 e successivi possono riusare lo stesso schema;
  - giocatore: le regole dell'archivio riprendono quelle del codice vecchio riga per riga.
- **Restano al proprietario:** la pubblicazione dei personaggi pronti, le aggiunte al contratto della sezione 2.9, e la conferma delle decisioni provvisorie da D-14-2 a D-14-6.
- **Stato:** approvata in via provvisoria, in attesa di conferma.

### D-14-8: il plan si rimanda a una nuova sessione

- **Chi ha deciso:** la trinità, con il coordinatore nel ruolo di Domenico.
- **Situazione:** alle 19:46 mancavano 74 minuti allo stop delle 21:00. Il plan di Spec Kit richiede `research.md`, `data-model.md`, i contratti, `quickstart.md`, il controllo della costituzione e un giro di revisione. Le versioni delle dipendenze vanno verificate nella documentazione.
- **Ancora da scegliere:** se fare il plan sul branch ombrello o su un branch proprio del WI-1, come chiede la D6.
- **Decisione:** fermarsi a un punto pulito e fare il plan in una sessione nuova.
- **Perché:**
  - un plan a metà, senza revisione, è peggio di un punto di arresto pulito;
  - il contesto della sessione che coordina è al 45%, e le regole sulla gestione dei token chiedono una sessione nuova per ogni blocco grande.
- **I cinque costi:**
  - token: si risparmia la rilettura di una sessione lunga;
  - tempo: una sera persa;
  - qualità: invariata;
  - modo di lavorare: rispettato;
  - giocatore: nessun effetto.
- **Stato:** in attesa di conferma.

### Non deciso, riservato al proprietario

Le aggiunte al contratto API previste dal WI-2 in poi (sezione 2.9 della spec). La regola «un contratto consegnato non cambia» le riserva al proprietario: servono il suo permesso esplicito o un profilo `pe.autonomy` con `contract`. Il WI-1 non ne dipende.

## 2026-11-17

### D-17-0: decisione del proprietario e modalità autonoma

- **Decisione del proprietario (in chat, 14:46):** «deve entrare tutto». Tutto ciò che l'artifact ha guadagnato fra il 14 e il 17 novembre (la Venture e le modifiche ad archivio, report e romanzi) entra nella v1, senza rimandare niente. Il riferimento vincolante diventa `unscripted-reference/2026-11-17/`.
- **Autonomia (in chat, 14:53):** «vai in totale autonomia, qualunque decisione spetterà alla trinità». La forma è una finestra, perché `pe.autonomy` non è impostato.
  - Perimetro: i passi 1-6 della richiesta del 17 novembre, cioè verificare il riferimento, leggere i documenti, progettare gli emendamenti, revisionarli, committare, aggiornare diario e registro e fare il resoconto.
  - Inizio: 14:53. Fine: 21:00, perché il proprietario non ha indicato un orario.
  - Aperture: `spec`, `schema`, `design`, `publish`. L'apertura `contract` resta chiusa.
- **Restano al proprietario:** il codice (lo vieta la richiesta stessa), i merge e le modifiche ai requisiti. Fra queste ultime c'è la domanda Q-17-1 sulle parti progettate ma non costruite nell'artifact.
- **Stato:** registrato.

### D-17-1: un giro di verifica oltre il tetto

- **Chi ha deciso:** il coordinatore, nel ruolo di Domenico.
- **Situazione:** il terzo giro di revisione dell'emendamento si è chiuso con `NOT CONVERGED`, `0/1/4`, `COVERAGE: full`. L'unico rilievo importante erano quattro funzioni previste in `ux-ponte.md` e mai costruite, che sono state aggiunte a Q-17-1. Il tetto di tre giri era stato raggiunto.
- **Decisione:** un giro di verifica limitato alle correzioni del terzo giro, perché per approvare la spec serve un verdetto.
- **Esito:** `VERDICT: CONVERGED`, `FINDINGS: 0/0/3`, `COVERAGE: full`. I tre minori sono stati corretti subito.
- **I cinque costi:**
  - token: pochi;
  - tempo: circa 6 minuti;
  - qualità: c'è un verdetto, invece di un'approvazione su un giro chiuso NOT CONVERGED;
  - modo di lavorare: lo stesso schema della D-14-6;
  - giocatore: nessun effetto.
- **Stato:** in attesa di conferma.

### D-17-2: approvazione dell'emendamento 1 (apertura `spec`)

- **Chi ha deciso:** la trinità. Il coordinatore ha fatto da Domenico, e il giudizio sulle prove viene dal revisore avversariale, un agente indipendente con mandato ostile. Riccardo non è entrato: l'emendamento non progetta interfacce nuove, ma riporta quelle dell'artifact.
- **Apertura usata:** `spec`, della finestra D-17-0.
- **Il ciclo:**
  - giro 1: `VERDICT: NOT CONVERGED`, `FINDINGS: 1/10/9`, `COVERAGE: partial`;
  - giro 2: `VERDICT: NOT CONVERGED`, `FINDINGS: 0/3/4`, `COVERAGE: partial`;
  - giro 3: `VERDICT: NOT CONVERGED`, `FINDINGS: 0/1/4`, `COVERAGE: full`;
  - giro di verifica (D-17-1), che chiude il ciclo: `VERDICT: CONVERGED`, `FINDINGS: 0/0/3`, `COVERAGE: full`. I tre minori sono stati corretti subito dopo.
- **Cosa è stato approvato:** `specs/20261113-111328-v1-port/amendment-2026-11-17.md`, con le voci da AM-01 a AM-18. Sono applicate a `spec.md`, e tutte le citazioni ora puntano al riferimento del 17 novembre.
- **Correzioni principali rispetto al passaggio del proprietario:**
  - l'asset dello stile arriva nel WI-2, non nel WI-5;
  - il tetto di dimensione passa a 1.700.000 byte;
  - il banco golden esegue anche STYLE;
  - la chiave del ruolo resta `role`;
  - i tipi di chiamata della Venture entrano subito nell'enum, prima del congelamento;
  - nuovo tipo `archive-generate`;
  - gli id `f_` del pacchetto futuro contano come id del codice vecchio;
  - nuove tabelle `records` e `missions`;
  - il WI-7 si colloca tra il WI-4 e il WI-5.
- **I cinque costi:**
  - token: circa 6 punti della settimana per lettura, progetto e revisione;
  - tempo: circa due ore;
  - qualità: 4 giri e oltre 50 rilievi corretti prima di scrivere codice;
  - modo di lavorare: lo stesso schema del 14 novembre;
  - giocatore: tutto ciò che l'artifact fa il 17 novembre ha un posto nella v1.
- **Restano al proprietario:**
  - Q-17-1: le parti progettate ma non costruite nell'artifact;
  - Q-17-2: la pubblicazione delle 45 schede nuove;
  - le aggiunte al contratto API (sezione 2.9).
- **Stato:** approvata in via provvisoria, in attesa di conferma.

## 2026-11-26

### D-26-0: totale autonomia per la giornata

- **Autonomia (in chat, 11:55):** «Ricomincia in totale autonomia, io non sarò disponibile oggi». La forma è una finestra, perché `pe.autonomy` non è impostato.
  - Perimetro: il passo successivo del port v1 dopo l'emendamento 1, cioè il plan del WI-1 su un branch Spec Kit creato dall'ombrello, la sua revisione avversariale, i task e, se il tempo basta, l'inizio dell'implementazione con l'emendamento 1.1.0 della costituzione come primo commit.
  - Inizio: 11:55. Fine: 21:00, la fine dell'orario d'ufficio, perché il proprietario non ha indicato un orario. Nessun lavoro notturno.
  - Aperture: `spec`, `schema`, `design`, `publish`. L'apertura `contract` resta chiusa.
- **Lettura della frase:** la considero il via libera chiesto il 17 novembre per passare al plan del WI-1. Non la considero una risposta a Q-17-1, che il proprietario ha detto di voler discutere («Ne parliamo»): il WI-1 non dipende da Q-17-1, perché la Venture arriva nel WI-7.
- **Restano al proprietario:** Q-17-1 e Q-17-2, perché cambiano o allargano ciò che ha chiesto; le aggiunte al contratto API; i merge in `develop` e `main`; le modifiche ai file di istruzioni e alla memoria.
- **Budget:** consumo settimanale 41% alle 11:55, reset il 27 novembre alle 06:00. Tetto di oggi: (85% − 41%) / 1 giorno = 44 punti, cioè fino all'85%; la riserva del 15% resta intatta.
- **Stato:** registrato.

### D-26-1: il riferimento è cambiato, prima del plan serve l'emendamento 2

- **Chi ha deciso:** il coordinatore, nel ruolo di Domenico per la scelta di cosa fare prima; Matteo da solo per il modo tecnico di fissare il riferimento.
- **Fatti verificati alle 12:20:**
  - la cartella `unscripted-reference/2026-11-17/` è stata aggiornata sul posto dopo la mia verifica del 17: file datati 17 novembre 15:24 e 16:47 e 23 novembre 13:52;
  - `talk.js` ha ora md5 `90845a15d9f1eafb8f0b467305a74298`, non più `b66bdbd7dd5c6340737c2da7426e0f46` scritto nella spec;
  - ci sono file nuovi: `qualita.js`, `romanzo.js`, `romanzoui.js`, `tests/quality.test.js`, `tests/romanzo.test.js`, `tools/bench_books.js`;
  - `python3 build.py x` produce oggi `live.html` di 1.529.486 byte con md5 `2374c745827c2b2e57fd6dd493d32e03`, diversa da tutte le pagine di `published/`, la più recente delle quali è `1794931182-d6d3` del 17 alle 17:01;
  - i tre test (`venture`, `romanzo`, `quality`) stampano `ALL OK`;
  - il `HANDOFF.md` del riferimento ha una sezione 7 sul nuovo ambiente «Il romanzo», con un WI-8 proposto dal proprietario; la copia nel repository ha invece l'aggiunta del 23 novembre sulla qualità della prosa.
- **Decisione:** il plan del WI-1 aspetta un emendamento 2 della spec, con la stessa procedura del primo (tre passi, FAQ, revisione avversariale fino a CONVERGED). Il motivo è che FR-011 deve contenere tutti i tipi di chiamata prima che il contratto si congeli con il merge del WI-1, e che le citazioni e le checksum della spec puntano a uno stato che non esiste più.
- **Modo tecnico (Matteo):** non scrivo nulla nella cartella di riferimento, che il proprietario vuole intatta. Fisso lo stato con un manifesto di checksum di ogni file sorgente, salvato nella cartella della spec. L'oracolo è la pagina pubblicata `esperimento-sociale-1795438262-299a.html` del 23 novembre, che il proprietario ha salvato nella cartella del diario dell'artifact (`Diario/docs/esperimento-sociale/2026-11-23/artefatto/`): ha md5 `2374c745827c2b2e57fd6dd493d32e03` e 1.529.486 byte, identica byte per byte a ciò che `python3 build.py` produce oggi dai sorgenti.
- **Posizioni:** fare subito il plan del WI-1 costerebbe meno oggi, ma porterebbe a un plan su un enum incompleto e su citazioni sbagliate, da rifare.
- **I cinque costi:**
  - token: circa 8-12 punti della settimana;
  - tempo: due o tre ore, quindi il plan del WI-1 forse slitta a domani;
  - qualità: il plan nasce su un riferimento verificato;
  - modo di lavorare: lo stesso schema del 17;
  - giocatore: il romanzo e la qualità della prosa entrano nella v1, come chiede «deve entrare tutto».
- **Stato:** provvisoria, in attesa di conferma.

### D-26-2: emendamento 2 approvato in via provvisoria

- **Chi ha deciso:** la trinità. Il coordinatore ha fatto da Domenico; il giudizio sulle prove viene dal revisore avversariale, un agente indipendente con mandato ostile. Riccardo non è entrato sulle interfacce, che l'emendamento riporta dall'artifact senza progettarne di nuove; sull'API il punto delicato, il campo per la scelta del modello, è uscito dal WI-1 proprio per il motivo che una revisione di esperienza dell'API avrebbe sollevato (un nome ambiguo e valori legati al fornitore).
- **Apertura usata:** `spec`, della finestra D-26-0; per i quattro valori di `games.environment` anche `schema`.
- **Il ciclo:**
  - giro 1: `VERDICT: NOT CONVERGED`, `FINDINGS: 1/8/12`, `COVERAGE: full`;
  - giro 2: `VERDICT: NOT CONVERGED`, `FINDINGS: 0/1/10`, `COVERAGE: full`;
  - giro di verifica, che chiude il ciclo: `VERDICT: CONVERGED`, `FINDINGS: 0/0/2`, `COVERAGE: full`. I due minori sono stati corretti subito dopo.
- **Cosa è stato approvato:** `specs/20261113-111328-v1-port/amendment-2026-11-26.md`, voci da AM2-01 ad AM2-14, e il manifesto `reference-2026-11-23.md5`. Le scelte principali:
  - il riferimento è lo stato del 23 novembre, fissato dal manifesto; l'oracolo è la pagina pubblicata `1795438262-299a`;
  - il WI-8 Romanzo si colloca dopo il WI-5;
  - i 19 tipi di chiamata del romanzo entrano subito nell'enum, con i nomi italiani del codice;
  - l'archivio del WI-1 riceve la sezione «📖 Romanzo»;
  - nessun campo nuovo nel contratto del WI-1 per la scelta del modello: diventa un'aggiunta pianificata del WI-8;
  - il difetto dell'età a 95 si porta com'è ed è tracciato per il WI-6;
  - la corsa critica di `llm.js:48` si corregge nel core, con riga di parità e test.
- **I cinque costi:**
  - token: circa 10 punti della settimana fra inventario, progetto e tre giri di revisione;
  - tempo: circa un'ora e mezza;
  - qualità: 3 giri e 35 rilievi corretti prima di scrivere codice, fra cui un errore di contratto che sarebbe stato permanente;
  - modo di lavorare: lo stesso schema del 17, con agenti in parallelo;
  - giocatore: il romanzo entra nella v1, con lo strato di qualità della prosa.
- **Restano al proprietario:** Q-26-1 (nomi di persone reali in `qualita.js:26` e nei test di qualità), Q-17-1, Q-17-2, le aggiunte pianificate al contratto (sezione 2.9, ora con tre righe nuove).
- **Stato:** approvata in via provvisoria, in attesa di conferma.
