/* ---------- shared writing style for every novel and story (island, talk show, Venture) ----------
   One place to change how all the books read. Loaded as a classic script before the engine and the UI,
   so the constant is visible to both. The style is described in plain traits as well as by name, so the model
   follows the traits even if it knows the author only vaguely. The traits follow what critics and Asimov himself
   say of his fiction: one cardinal rule, to be clear; spare description; plot carried mainly by dialogue;
   characters sketched lightly, with one quick telling detail when they first appear; often a newcomer or one
   viewpoint through whom the reader discovers the world. */
/** Prose style used by every novel and story prompt. */
const NOVEL_STYLE = `STILE: scrivi alla maniera di Isaac Asimov, la cui regola era una sola: essere chiaro.
- Prosa piana e funzionale, frasi brevi, lessico semplice e preciso. Pochissimi aggettivi, nessuna metafora ricercata, niente enfasi, niente toni solenni, lirici o drammatici, niente frasi a effetto in fondo ai paragrafi, nessuna morale.
- La storia avanza soprattutto con i dialoghi: i personaggi ragionano ad alta voce, discutono, si contraddicono e arrivano alle conclusioni passo dopo passo. Le informazioni che il lettore deve sapere arrivano dentro le conversazioni, non da spiegazioni del narratore.
- Descrizioni minime e concrete, ma il lettore sa sempre dove si trova: all'inizio di ogni scena una o due frasi precise su luogo, momento e chi è presente; poi niente descrizioni superflue.
- Apri le scene nel mezzo dell'azione o di una conversazione, di solito dal punto di vista di un personaggio che osserva e capisce le cose insieme al lettore; il mondo (epoca, luogo, situazione) si scopre attraverso i suoi occhi, mai dato per scontato.
- PERSONAGGI: nessun elenco e nessuna presentazione a scheda. Ogni persona si presenta la prima volta che entra in scena nel romanzo, dentro la scena: nome, ruolo, e al massimo UN dettaglio concreto e veloce (un tratto fisico, un gesto, un modo di parlare), in una sola frase o anche meno. Il resto del carattere si capisce da quello che dice e fa, mai da descrizioni psicologiche del narratore. Chi è già comparso in un capitolo precedente non va ripresentato. Le schede dei personaggi che ricevi sono appunti per te: non copiarle e non riassumerle.
- Ironia asciutta e garbata, ogni tanto una battuta secca.`;

/**
 * Author styles the novel environment can choose from, each described in plain traits (the model follows the
 * traits even when it knows the author only vaguely). Imitating a manner of writing is allowed; copying sentences,
 * characters or worlds of these authors never is, and every prompt says so.
 */
const NOVEL_STYLES = {
  asimov: { name: 'Isaac Asimov', text: NOVEL_STYLE },
  christie: { name: 'Agatha Christie', text: `STILE: scrivi alla maniera di Agatha Christie. Prosa limpida e svelta, dialoghi brillanti e un po' formali, descrizioni brevissime. Ogni personaggio entra con un tratto o un'abitudine in poche parole. Gli indizi stanno in bella vista dentro conversazioni normali, travestiti da dettagli di colore; il lettore deve poter indovinare, ma non facilmente. Ironia garbata sulle manie delle persone. Ritmo a scene brevi, ognuna con una piccola rivelazione o un sospetto nuovo.` },
  simenon: { name: 'Georges Simenon', text: `STILE: scrivi alla maniera di Simenon. Frasi brevi, parole semplici, atmosfera concreta (pioggia, odori, stanze, piccoli gesti). Attenzione alla psicologia delle persone comuni più che all'enigma. Pochi aggettivi, nessun commento morale. Il protagonista osserva, ascolta, capisce a poco a poco.` },
  chandler: { name: 'Raymond Chandler', text: `STILE: scrivi alla maniera di Chandler. Prima persona del protagonista, ironia amara, similitudini taglienti e originali (mai riprese da altri), dialoghi secchi pieni di sottintesi. Città e notte come presenze. Il protagonista ha un codice morale suo in un mondo che non ne ha.` },
  king: { name: 'Stephen King', text: `STILE: scrivi alla maniera di Stephen King. Vita quotidiana concreta e dettagliata (marche, abitudini, debiti, piccole città), voce interiore dei personaggi in corsivo o tra parentesi, dialoghi naturali e coloriti. Il pericolo cresce dentro la normalità; si vede poco, si sente molto. Personaggi veri prima che spaventati.` },
  tolkien: { name: 'J.R.R. Tolkien', text: `STILE: scrivi alla maniera di Tolkien. Respiro ampio, paesaggi e cammino descritti con cura, senso di una storia antica dietro ogni luogo, nomi coerenti con le lingue dei popoli. Toni alti nei momenti solenni, quotidiani e caldi nelle soste. Profondità accennata e non spiegata. Il bene arriva come grazia preparata da lontano.` },
  adams: { name: 'Douglas Adams e Terry Pratchett', text: `STILE: scrivi in modo comico assurdo, alla maniera di Douglas Adams e Terry Pratchett. Logica rigorosa applicata a premesse folli, digressioni che più avanti si rivelano importanti, battute che ritornano, un narratore che commenta con ironia. Mai battute volgari o crudeli; l'assurdo non bara mai rispetto alle sue regole.` },
  dick: { name: 'Philip K. Dick', text: `STILE: scrivi alla maniera di Philip K. Dick. Prosa diretta e un po' nervosa, personaggi comuni e stanchi, tecnologia quotidiana e leggermente sbagliata. La realtà a poco a poco non torna: dettagli che cambiano, ricordi che non coincidono. Domande su cosa sia reale e cosa sia umano, senza risposte facili.` },
  calvino: { name: 'Italo Calvino', text: `STILE: scrivi alla maniera di Calvino. Leggerezza, esattezza, immagini nitide; fantastico raccontato con precisione quasi scientifica; frasi pulite, ironia lieve, gusto per le strutture e i giochi. Niente pesantezza, niente effetti facili.` },
};
