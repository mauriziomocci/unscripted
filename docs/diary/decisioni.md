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
- **Stato:** in attesa della decisione del proprietario. Se vuole un pacchetto diverso, la via è un pacchetto in più nel nuovo core dal WI-2, non una modifica del vecchio.

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
