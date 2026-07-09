# Evento e il Fediverso: ricerca su federazione e condivisione decentralizzata di eventi

**Data:** 9 luglio 2026 — **Destinatario:** maintainer di Evento — **Base:** dati di ricerca verificati con fact-checking (i claim smentiti in verifica sono stati corretti nel testo; i punti non confermabili sono segnalati come "da confermare")

## Executive summary

- **Il fit elegante esiste, ma è limitato al livello "read-only".** Poiché l'intero evento è codificato nell'URL, Evento può servire — senza alcun database — una rappresentazione ActivityStreams 2.0 dell'evento, un file ICS e markup h-event/schema.org, tutti calcolati al volo decodificando l'URL. Questo rende gli eventi *raggiungibili* dal Fediverso e dai calendari senza tradire "No Login, No Data".
- **La federazione piena è architettonicamente incompatibile con l'app attuale.** Follower, consegna push, RSVP e inbox richiedono attori persistenti, chiavi di firma, code di consegna e stato lato server: nessun progetto open source leggero (Gathio, Gancio, Mobilizon) federa senza persistenza, e ogni framework serio (Fedify) richiede come minimo un key-value store.
- **Il beneficio della federazione ActivityPub, per un publisher senza follower, parte da zero.** ActivityPub è push-to-inbox: senza follower, relay o admin che scelgono di seguire l'attore di Evento, gli oggetti pubblicati non raggiungono nessuno. Mastodon, dove sta la maggioranza degli utenti, non rende gli oggetti Event come eventi ma come "titolo + link". Il rapporto costo/beneficio della federazione piena è quindi sfavorevole.
- **Il valore immediato più alto per riga di codice è nei formati "noiosi":** export ICS generato lato client (libreria `ics`, licenza ISC) e link "aggiungi al calendario", seguiti — con cautele di sicurezza — dal pre-rendering di microformati. L'unica federazione strutturalmente compatibile con l'architettura stateless è un opzionale "pubblica su Nostr" interamente client-side (NIP-52), il cui pubblico però oggi è minuscolo.

---

## Il vincolo di fondo — la tensione tra "No Login, No Data" e la federazione

Evento non ha database, account né storage lato server: l'evento *è* l'URL (JSON codificato in Base64 nel path `/event/<encoded>`), validato lato client e renderizzato nel browser. L'unico componente serverless esistente (l'accorciatore di URL nelle Netlify Functions) è dichiaratamente non persistente.

ActivityPub — il protocollo di federazione del Fediverso (raccomandazione W3C dal gennaio 2018) — assume esattamente l'opposto. I suoi requisiti strutturali sono quattro:

1. **ID stabili e dereferenziabili**: ogni oggetto (evento) e ogni attore (chi pubblica) deve avere un URL HTTPS che, interrogato con il content type `application/activity+json`, restituisce l'oggetto in formato JSON-LD.
2. **Un attore con coppia di chiavi crittografiche**: praticamente tutti i server del Fediverso (Mastodon incluso) richiedono che le richieste in ingresso alla inbox siano firmate con *HTTP Signatures*; le istanze in "authorized fetch" firmano e possono richiedere firme anche sulle GET.
3. **Una collezione di follower persistente**: la federazione è *push-based* — il server deve ricordare chi lo segue e consegnare le attività firmate alle loro inbox, con retry.
4. **Una inbox sempre attiva**: per ricevere qualunque cosa (Follow, RSVP, commenti) serve un endpoint che assorbe POST non richiesti dall'intera rete.

Il punto (1) è l'unico che Evento ottiene quasi gratis: dato che l'URL contiene già tutto l'evento, una Netlify Function può restituire l'oggetto AS2 in modo deterministico e stateless. I punti (2)–(4) richiedono invece stato durevole. La chiave di firma può vivere in una variabile d'ambiente (un segreto dell'operatore, non un dato utente: filosoficamente accettabile), ma follower, code di consegna e stato degli RSVP sono un database sotto altro nome. Gli RSVP sono il caso peggiore: le liste dei partecipanti sono dati personali, in contraddizione diretta con "No Data"; accettarli e scartarli renderebbe gli RSVP una menzogna.

Il resto del report esamina area per area dove passa esattamente questa linea di frattura.

---

## ActivityPub e ActivityStreams 2.0 per gli eventi

### Panoramica

ActivityStreams 2.0 (AS2, raccomandazione W3C dal maggio 2017) è il vocabolario dati del Fediverso e definisce un tipo di oggetto `Event` le cui proprietà (`name`, `startTime`/`endTime` in ISO 8601, `location` come oggetto `Place`, `summary`/`content`, `url`, `attributedTo`) mappano quasi 1:1 sul modello di Evento: un evento di Evento può essere espresso senza perdite come documento JSON AS2. AS2 include già anche l'intero vocabolario RSVP (`Invite`, `Join`, `Leave`, `Accept`, `TentativeAccept`, `Reject`, `TentativeReject`). ActivityPub è il trasporto: gli oggetti hanno ID HTTPS stabili, sono pubblicati da attori e consegnati alle inbox altrui.

Il profilo di interoperabilità pratico per gli eventi è **FEP-8a8e** ("A common approach to using the Event object type", CC0-1.0, nel repo `fediverse/fep` su Codeberg). È ancora una **bozza**: secondo l'aggiornamento di giugno 2026 del progetto Event Federation, è in un giro finale di rifinitura basato sulle implementazioni di Gancio, Mobilizon, LAUTI e del plugin WordPress "Event Bridge for ActivityPub", con l'intenzione di marcarla poi FINAL. Punti rilevanti: `endTime` è obbligatorio (con un marcatore esplicito per gli eventi a durata aperta) ed è stata aggiunta una collezione `organizers`. Il pattern di **un unico attore di istanza di tipo Application** (es. `events@istanza.tld`) che pubblica tutti gli eventi — il modello di Gancio — è documentato e discusso nel contesto della FEP, il che significherebbe che account per-utente non sono necessari per federare eventi; *nota: che la FEP stessa "sancisca" formalmente questo pattern non è stato verificabile in fase di fact-checking (le fonti primarie erano irraggiungibili) — è plausibile ma da confermare sul testo della FEP.*

La superficie server minima per essere visibili dal Fediverso è: (1) l'evento servito come `application/activity+json` a un ID stabile; (2) un documento attore con chiave pubblica RSA; (3) WebFinger (RFC 7033, l'endpoint `/.well-known/webfinger` che risolve `@events@evento.example` nell'URL dell'attore — la documentazione di Mastodon lo indica come necessario per la piena interoperabilità); (4) HTTP Signatures per qualunque cosa "attiva"; (5) una inbox se si vuole ricevere qualcosa. **Il sottoinsieme read-only (punti 1–3) è realizzabile senza alcun database**, come dimostrano più implementazioni ActivityPub documentate su siti statici (Kinlan, maho.dev, il server single-file di Terence Eden — che però, per supportare i follow, deve già salvare file su disco).

Sul fronte firme: Mastodon richiede firme HTTP (schema draft-cavage) su tutte le consegne alla inbox; il supporto in ricezione a RFC 9421 (HTTP Message Signatures, lo standard IETF del 2024) è arrivato in Mastodon 4.4 dietro feature flag ed è attivo di default dalla 4.5 — *in ricezione*: Mastodon non firma ancora in uscita con RFC 9421, e accetta entrambi gli schemi. La tecnica del "double-knocking" (provare uno schema di firma e ripiegare sull'altro) è la raccomandazione del report SWICG ed è implementata da Fedify — non una caratteristica di Mastodon, come talvolta riportato.

**Il tetto del beneficio**: Mastodon non ha supporto di prima classe per gli eventi. La sua documentazione classifica `Event` tra i tipi "convertiti": viene mostrato come testo (content o name) con l'URL appeso e il summary come content warning — non come card calendario. Il rendering reale degli eventi esiste solo nell'angolo event-native del Fediverso: Mobilizon, Gancio, Friendica (che importa gli eventi nel calendario dell'utente) e il plugin WordPress; GoToSocial non supporta affatto il tipo Event.

### Tecnologie

| Tecnologia | Licenza | Maturità |
|---|---|---|
| ActivityStreams 2.0 (incl. `as:Event`) | Specifica W3C (royalty-free) | Finale — Recommendation dal 2017 |
| ActivityPub | Specifica W3C | Finale — Recommendation dal 2018 |
| WebFinger (RFC 7033) | Standard IETF aperto | Finale (2013); banale da implementare per un singolo attore |
| HTTP Signatures (draft-cavage / RFC 9421) | IETF | draft-cavage: bozza scaduta ma standard de facto del Fediverso; RFC 9421: finale (2024), adozione in corso |
| FEP-8a8e | CC0-1.0 | **Bozza attiva**, rifinitura finale a giugno 2026 |
| Fedify (framework TS) | MIT | Produzione, molto attivo (v2.3.1, giugno 2026) — ma richiede KV store |
| Mastodon (come consumatore) | AGPL-3.0-only | Produzione — rendering Event solo "convertito" |

### Fit con Evento

C'è un incastro genuinamente elegante: l'URL di Evento può diventare un ID ActivityPub dereferenziabile a costo zero di storage (content negotiation in una Netlify Function). Aggiungendo un attore statico di istanza (chiave in un secret Netlify) e una risposta WebFinger statica, gli eventi diventano *fetchabili*: incollare un link di Evento nella ricerca di Mastodon/Mobilizon/Gancio produrrebbe un oggetto risolvibile, e le piattaforme event-native lo mostrerebbero come vero evento. Caveat anche qui: FEP-8a8e vuole `endTime` obbligatorio (Evento ha un solo datetime: servirebbe una fine o il marcatore open-ended); l'immutabilità è forzata (modificare un evento crea un nuovo URL = nuovo oggetto: le attività `Update` non hanno senso e le copie stantie non si correggono). Tutto ciò che va oltre la fetchabilità — follower, consegna push, RSVP — richiede persistenza ed è un bivio architetturale, non un incremento. Se l'obiettivo è "eventi che la gente mette in calendario", il semplice export ICS rende più valore per riga di codice dell'intera federazione AP.

---

## Mobilizon come caso di studio

### Panoramica

Mobilizon è la piattaforma-bandiera degli eventi federati (Elixir/Phoenix + Vue, PostgreSQL, AGPL-3.0, con codice di federazione in parte derivato da Pleroma). Lanciata da Framasoft nel 2020, la manutenzione è passata **nel 2024 all'associazione francese Kaihuri** (repo canonico `framagit.org/kaihuri/mobilizon`), con finanziamento NLnet/NGI0 Commons Fund da gennaio 2025. Il progetto è vivo: **l'ultima release stabile è la 5.2.4 (giugno 2026)** — il dato "5.1.2" circolato in una prima stesura della ricerca è stato smentito in verifica: dal 2025 sono uscite 5.1.4, 5.1.5, 5.2.0–5.2.4. Cadenza modesta, team piccolo, dipendenza da grant. Nota di licenza: il file LICENSE usa il testo "or-later" ma le parti derivate da Pleroma sono marcate `AGPL-3.0-only` e non esiste una dichiarazione SPDX a livello progetto — chi avesse bisogno di un identificativo definitivo dovrebbe chiedere upstream.

Tecnicamente, Mobilizon implementa **solo la parte server-to-server** di ActivityPub, con HTTP Signatures sulle consegne (niente Linked Data Signatures: ri-scarica i contenuti invece di fidarsi dei payload inoltrati — quindi gli oggetti devono restare fetchabili a lungo termine). Poiché AS2 "puro" è troppo povero per eventi reali, estende `Event` con proprietà schema.org (`location`/`Place`/`PostalAddress`, capienza) e un namespace custom `mz:` (`mz:joinMode`, `mz:participationMessage`). Gli RSVP sono attività `Join` a cui si risponde con `Accept`/`Reject`.

L'interoperabilità reale è più stretta del marketing: la federazione a piena fedeltà (gruppi, RSVP, discussioni) funziona solo Mobilizon-con-Mobilizon. Da Mastodon si possono seguire attori Mobilizon e vedere i nuovi eventi nel feed come post ordinari (titolo + link), e i commenti federano indietro, ma **non si può fare RSVP da Mastodon** e Mastodon non renderà mai (a oggi: nessuna feature evento nelle 4.4/4.5/4.6) l'oggetto come evento. Un supporto più ricco esiste in Gancio, Friendica e Hubzilla (per Pleroma il supporto agli eventi "Mobilizon-compatibili" esiste come merge request/fork Rebased, ma non è confermato che sia in una release stabile mainline — da considerare più debole).

### Fit con Evento

Evento non può diventare un peer di federazione di Mobilizon senza abbandonare i suoi principi: servono ID persistenti, un attore con WebFinger e chiavi, e stato server-side per follower e flussi Join/Accept. Ciò che Evento *può* fare a basso costo è servire la rappresentazione AS2 dell'evento usando il vocabolario documentato di Mobilizon (schema.org + estensioni), che è il formato de facto degli eventi federati — senza inventare nulla. Nota di licenza: Mobilizon è AGPL, quindi copiarne il codice in un progetto con licenza diversa non è possibile; implementarne il *vocabolario documentato* è invece libero. Un'alternativa pragmatica e interessante: Mobilizon espone un'**API GraphQL con registrazione di applicazioni OAuth2** e scope `write:event:create/update/delete` — un pulsante opt-in "pubblica su un'istanza Mobilizon" delegherebbe a terzi tutta la persistenza e la federazione (vedi sezione serverless).

---

## Strumenti open source leggeri: Gathio, Gancio e affini

### Panoramica

**Gathio** è filosoficamente il progetto più vicino a Evento: pagine evento "autodistruggenti, condivisibili, senza registrazione" (**GPL-3.0-or-later** — non "only" come inizialmente riportato; TypeScript/Express; ultima release **v1.6.3 del 7 luglio 2025** — la data "2026" circolata era errata di un anno). Ma anche prima di federare, Gathio non è mai stato "no data": salva ogni evento in MongoDB, autorizza le modifiche con una password generata / link segreto (email opzionale) e mitiga la ritenzione **cancellando automaticamente eventi ed email 7 giorni dopo la fine dell'evento**. La sua federazione (FEDERATION.md) rende **ogni evento un attore ActivityPub di prima classe**: URI, inbox/outbox, follower e coppia di chiavi propri; gli utenti del Fediverso *seguono l'evento*; gli RSVP arrivano come risposte a un sondaggio `Question` o come `Accept/Event`; alla scadenza parte un `Delete/Actor` verso i follower. Lezione: Gathio ha mantenuto "no login" intatto anche federando (capability URL, attori per-evento), ma ha pagato la federazione con database, ID stabili, gestione chiavi e inbox sempre attiva — limitando il danno con ritenzione a tempo, non con ritenzione zero.

**Gancio** (AGPL-3.0, Node/Vue, SQLite di default o MariaDB/PostgreSQL; stabile 1.28.2, 2.0.0-beta.4 del 30 giugno 2026; finanziato NLnet) sceglie la forma ActivityPub più economica: **un solo attore di istanza di tipo Application** (`relay@istanza.tld`) che pubblica ogni evento come oggetto AS2 Event ai follower; dalla v1.9.0 un'istanza può anche *seguire* altri attori Gancio/Mobilizon/WordPress per ingerirne gli eventi; gli eventi federati vengono rimossi dopo la fine. Rilevante per l'etica di Evento: Gancio supporta l'**invio anonimo di eventi (attivo di default)**, con approvazione di un admin/editor e identità del proponente mai mostrata. Ma richiede comunque database, account admin e un processo server persistente.

Tra i pari: il plugin WordPress **Event Bridge for ActivityPub** (1.0.0, febbraio 2025) innesta la federazione su uno store esistente riusando l'infrastruttura attori del plugin ActivityPub di WordPress; **LAUTI** (AGPL-3.0, Go) sta introducendo nel 2026 una federazione basata, come Gancio, su un singolo attore di istanza; **apevents** (MIT, Rust) è sperimentale; **Friendica** (AGPL-3.0) e **Hubzilla** (MIT) sono utili soprattutto come *consumatori* (calendari integrati).

**Il pattern trasversale, verificato:** ogni progetto di questa rassegna, incluso il più minimalista, tiene eventi, follower e chiavi HTTP-signature lato server. Nessuno federa da un payload stateless codificato nell'URL.

### Fit con Evento

I pari dimostrano che **"No Login" è preservabile** (capability URL alla Gathio, invio anonimo alla Gancio) e che il costo privacy è delimitabile (auto-cancellazione a tempo, `Delete/Actor` ai follower). Dimostrano anche che **"No Data" non lo è**, per la federazione attiva. Se un giorno Evento volesse federare davvero, i modelli sono due: quello di Gathio (copia memorizzata, opt-in, a scadenza automatica — ammettendo che *quegli* eventi rinunciano al "No Data") o quello, più economico, di Gancio (un attore, una chiave, eventi come oggetti). In alternativa, delegare: pubblicare su un'istanza Gancio/Gathio esistente via API, restando stateless. Gradiente di licenze se si pensa a riuso di codice: Gathio GPL-3.0-or-later, Gancio e Mobilizon AGPL — obblighi copyleft rilevanti solo in caso di vendoring, non di imitazione del design.

---

## Librerie e framework ActivityPub per JavaScript/Node

### Panoramica

Il panorama a metà 2026 ha **una sola opzione production-grade**: **Fedify** (`@fedify/fedify`, MIT, v2.3.1 pubblicata il 27 giugno 2026, ~5.600 commit, sponsor aziendali Ghost e AltStore; alimenta il servizio ActivityPub di Ghost e Hollo). Gestisce vocabolario, WebFinger, HTTP Signatures (incluso il double-knocking tra draft-cavage e RFC 9421), inbox/outbox e code di consegna; gira su Node ≥22, Deno ≥2, Bun, con supporto di prima classe per Cloudflare Workers e Deno Deploy; esiste un adapter ufficiale **`@fedify/fastify`** (v2.3.1) che combacerebbe col server Fastify di Evento. Il punto duro, verificato sui manuali: **l'opzione `kv` (key-value store) è documentata come "Required"** e una message queue è "highly recommended" in produzione; i driver ufficiali coprono PostgreSQL, Redis, MySQL, SQLite, Deno KV, Cloudflare KV — **Netlify e AWS Lambda non sono target di deployment documentati e non esiste un driver per Netlify Blobs**.

Le alternative sono di fatto morte: **activitypub-express** ("apex", MIT) è ferma a release e ultimo commit del 12 febbraio 2024, con MongoDB come unico backend incluso; **activity-kit** (MIT) è senza commit dal novembre 2023 e si autodefinisce "still incomplete"; **express-activitypub** di dariusk è dichiaratamente solo didattico. Un mattoncino di basso livello utile: **activitypub-http-signatures** (ISC, v2.5.0 del 2024) fa solo firma/verifica di HTTP Signatures e potrebbe alimentare un approccio DIY in una singola Netlify Function — ma anche lì tutto il resto (attori, follower, retry) sarebbe fatto a mano.

### Fit con Evento

Nessuna libreria rimuove il disallineamento, perché il disallineamento sta nel protocollo, non nel tooling. Adottare Fedify significherebbe aggiungere almeno un KV store esterno e realisticamente una coda — cioè rinunciare a "No Data" a livello server e probabilmente anche a Netlify come piattaforma (i target serverless documentati sono Workers e Deno Deploy). Quello che si può fare *senza* framework è il gradino read-only: servire l'evento come JSON-LD AS2 via content negotiation, decodificato al volo dal Base64 — zero storage, zero dipendenze oltre alla costruzione del JSON.

---

## Standard classici di interoperabilità: iCalendar/ICS, RSS/Atom, WebSub, h-event

### Panoramica

Questo strato si divide nettamente in due per Evento.

**Gruppo 1 — nessuno stato necessario.** iCalendar (RFC 5545, standard IETF dal 2009, esteso da RFC 7986; MIME `text/calendar`) è la lingua franca dei calendari, consumata da Apple/Google/Outlook/Thunderbird. Un `VEVENT` può essere generato **interamente lato client** dal payload già presente nell'URL e offerto come download Blob ("aggiungi al calendario"): ~50 righe fatte a mano oppure una libreria open source — il pacchetto npm **`ics`** (licenza ISC, v3.12.0 di aprile 2026, uso browser documentato) o **`datebook`** (MIT, TypeScript, genera anche gli URL Google/Yahoo/Outlook). Attenzione al popolare web component **`add-to-calendar-button`**: è **Elastic License 2.0, source-available ma non open source approvato OSI** — in contrasto con la preferenza dichiarata di Evento. Accanto alla via ICS ci sono gli schemi URL dei vendor (Google `calendar/render?action=TEMPLATE`, Outlook `deeplink/compose`): pura costruzione di stringhe client-side a zero dipendenze, ma **non documentati né garantiti ufficialmente dai vendor** — il riferimento de facto è il repo comunitario `InteractionDesignFoundation/add-event-to-calendar-docs`. Un piccolo passo in più: una Netlify Function stateless `/ics/<encoded>` che decodifica e restituisce `text/calendar` abiliterebbe anche i link `webcal://` (schema de facto di origine Apple, non standard IETF) e l'ICS fetchabile da macchine — sempre senza salvare nulla.

**Gruppo 2 — presuppone ciò che Evento non ha.** RSS 2.0 e Atom (RFC 4287) descrivono *collezioni* di entry con ID stabili: Evento non ha alcuna lista di eventi lato server da enumerare, quindi non c'è nulla da mettere in un feed senza introdurre storage. WebSub (raccomandazione W3C 2018, notifiche push di URL che cambiano) è ancora peggio: richiede topic URL mutabili, un hub e sottoscrittori con callback HTTP raggiungibile in rete — un browser non può nemmeno essere sottoscrittore — e gli eventi di Evento sono immutabili per costruzione (modifica = nuovo URL), quindi non esistono "aggiornamenti" da spingere.

**In mezzo, e filosoficamente il match migliore: microformats2 h-event.** È una specifica living-draft in pubblico dominio (CC0) che rende *la pagina stessa dell'evento* l'oggetto machine-readable (`p-name`, `dtstart`, `dtend`, `p-location`): niente API, niente storage — pensiero IndieWeb "il tuo URL è il dato", letteralmente il modello di Evento. Il problema è il rendering: Evento costruisce il DOM lato client, e i parser di microformati (come i crawler) leggono l'HTML grezzo **senza eseguire JavaScript** — il markup h-event solo client-side sarebbe invisibile proprio ai consumatori a cui è destinato. Il rimedio stateless è una edge/serverless function che pre-renderizza l'HTML con h-event (e opzionalmente JSON-LD schema.org/Event per i motori di ricerca) decodificando l'URL per-request. Gli RSVP in stile IndieWeb (Webmention, raccomandazione W3C 2017) richiederebbero invece di *ricevere e conservare* menzioni — di nuovo storage, a meno di delegare a un servizio terzo, il che indebolisce la filosofia più che preservarla. Da segnalare anche jsCalendar (RFC 8984, eventi in JSON): concettualmente vicino al payload di Evento, ma con supporto dei consumer molto indietro rispetto a ICS.

### Fit con Evento

È lo strato con **più interoperabilità reale per riga di codice** di tutta la ricerca, proprio perché ICS e h-event trattano un URL autocontenuto come l'oggetto — il modello dati nativo di Evento. ICS client-side e link vendor: fit perfetto, zero costi architetturali (con l'avvertenza che i link vendor instradano i dati dell'evento verso quei fornitori al click). Endpoint `/ics/` e pre-rendering h-event: fit buono ma introducono rendering server di contenuto utente, con le implicazioni di sicurezza discusse più avanti. RSS/Atom e WebSub: non adottabili senza persistenza; da accantonare.

---

## Protocolli decentralizzati alternativi: Nostr (NIP-52) e AT Protocol

### Panoramica

**Nostr** inverte il modello: un evento è un JSON firmato con una chiave secp256k1 e pubblicato via WebSocket **direttamente dal browser** verso relay pubblici indipendenti; chiunque può rileggerlo interrogando i relay per filtro, senza rapporti di follow. La specifica **NIP-52 "Calendar Events"** (bozza/opzionale nel repo `nostr-protocol/nips`) definisce i kind *addressable* 31922 (eventi su data), 31923 (eventi su orario, con timestamp Unix e timezone opzionale), 31924 (calendari) e 31925 (RSVP con stato accepted/declined/tentative). Correzione emersa in verifica: **i tag obbligatori sono `d` (identificatore), `title` E `start`** — non solo i primi due. La NIP-52 omette deliberatamente gli eventi ricorrenti. La libreria client standard, **nostr-tools**, è in **pubblico dominio (Unlicense)**, browser-first, con sole dipendenze crittografiche @noble/@scure, attivamente mantenuta (v2.23.9 su npm, 1° luglio 2026). L'adozione reale però è sottile: il client di punta per NIP-52, **Flockstr** (MIT), non ha commit dall'ottobre 2024 — di fatto non mantenuto (il sito flockstr.com risulta ancora raggiungibile ma non è stato verificabile direttamente).

**AT Protocol** (il protocollo di Bluesky; implementazione di riferimento MIT/Apache-2.0, molto attiva) ha come app eventi di riferimento **Smoke Signal** (MIT, riscritta in Rust, su tangled.sh), i cui schemi sono migrati nei lexicon comunitari **`community.lexicon.calendar.event`** e **`.rsvp`** (repo `lexicon-community/lexicon`, MIT, attivo a luglio 2026): `name` e `createdAt` obbligatori, `startsAt`/`endsAt`, `mode` (virtuale/in presenza/ibrido), `status`, `locations` opzionali — un superset pulito dei campi di Evento e un buon riferimento di design anche senza federazione. Il vincolo strutturale, verificato sulla documentazione ufficiale: **scrivere un record richiede un account atproto autenticato** (DID + PDS + OAuth o sessione legacy) — non esiste un percorso di scrittura anonimo — mentre **leggere record pubblici via XRPC non richiede account**.

### Fit con Evento

Nostr è **l'unica opzione decentralizzata che preserva la forma serverless di Evento**: un pulsante opt-in "pubblica su Nostr" implementato interamente client-side (nostr-tools) che firma un kind-31923 con una coppia di chiavi usa-e-getta generata nel browser (o con l'estensione NIP-07 del visitatore) e lo spinge a qualche relay pubblico gratuito. Evento non gestisce né server né database. Ma piega, non mantiene, la promessa: (1) l'evento **persiste su relay di terzi** che Evento non controlla, con cancellazione solo advisory (NIP-09) — l'opposto filosofico de "l'URL è l'unica copia"; (2) modificare o cancellare richiede di conservare la chiave di firma (una chiave usa-e-getta rende l'evento incorreggibile per sempre); (3) i relay gratuiti non garantiscono persistenza (publish-and-hope); (4) il pubblico dei client calendario Nostr oggi è minuscolo. AT Protocol è un fit peggiore per la pubblicazione ("No Login" violato direttamente); l'angolo realistico è read-only (consumare eventi pubblici via XRPC) e l'adozione del vocabolario dei lexicon come target di mapping.

---

## Federare da un'architettura serverless/statica: vincoli e pattern

### Panoramica

Il prior art esiste ma è ammonitore. **lesspub** (BSD-2-Clause), ActivityPub serverless per blog statici su Netlify Functions, funzionava salvando follower e reply come JSON committati nel repo GitHub via API e la chiave RSA in variabili d'ambiente — dimostra che il pattern è possibile, ma è fermo a settembre 2023. **Wildebeest** (Apache-2.0), il server Mastodon-compatibile di Cloudflare su Workers, è archiviato e non mantenuto. **Hollo** (AGPL-3.0, v0.9.7 dell'8 luglio 2026), il più piccolo server "vero" costruito su Fedify, richiede comunque PostgreSQL e un processo long-lived. Il segnale di rischio manutentivo è forte.

Sul lato piattaforma, i numeri verificati di Netlify: **Netlify Blobs** (l'unica persistenza nativa) ha oggetti fino a 5 GB, **consistenza eventuale di default** (propagazione ≤60 s, strong consistency opt-in) e **last-write-wins senza controllo di concorrenza** — due Follow che arrivano insieme possono perdersi un follower; le Functions hanno timeout sincroni di 10 s (free) / 26 s (Pro), Background Functions fino a 15 minuti sui piani a crediti, e **non esiste una coda di messaggi durevole nativa** — che è esattamente ciò che la consegna ActivityPub vuole.

Le due vie di **delega** che evitano tutto questo: (a) **Bridgy Fed** (CC0, servizio ospitato attivo) rende un sito seguibile da Mastodon senza codice AP, scoprendo i contenuti via feed RSS/Atom o microformats2 — ma richiederebbe un feed (quindi una collezione persistente) e la reach è "follower del sito", non oggetti Event strutturati; (b) un **bot su un'istanza Mobilizon** via API GraphQL (app OAuth2 con scope `write:event:*`): una Netlify Function pubblica l'evento opt-in su Mobilizon, che diventa un vero AS2 Event federato in tutto l'ecosistema, con zero plumbing di protocollo in Evento — al costo di un'identità bot, della dipendenza dalle policy dell'istanza, e della persistenza dell'evento su un server terzo (un confine di *consenso*, non una violazione architetturale, purché detto chiaramente all'utente).

### Fit con Evento

La self-federation piena contraddice il design; la delega no. Se si vuole reach federata reale con un solo segreto da gestire e zero codice di protocollo, **la delega batte la self-federation**: pulsante esplicito opt-in "pubblica questo evento nel Fediverso" via bot Mobilizon (o, a sforzo minore ma minore fedeltà, Bridgy Fed su un feed di eventi opt-in), avvisando l'utente che l'opt-in significa persistenza su un server terzo.

---

## Scoperta federata e reach realistica per un publisher stateless senza follower

### Panoramica

Questa è l'analisi che ribalta il conto economico. ActivityPub è push-to-inbox: **un attore con zero follower consegna a nessuno**, e non esiste un meccanismo pull a livello di rete che compensi. Gli hashtag non federano da soli (una ricerca hashtag su un'istanza Mastodon vede solo i post che quell'istanza ha già ricevuto via follow o relay); la ricerca full-text opt-in di Mastodon 4.2 (flag `indexable`, settembre 2023) risolve il problema del consenso, non quello della reach. I workaround — i **relay ActivityPub** (handshake di Follow che richiede un vero server AP) e l'essere seguiti deliberatamente — presuppongono entrambi che Evento operi come server AP persistente. Il progetto **FASP/Fediscovery** (provider di scoperta condivisi, finanziato NGI, guidato da Mastodon gGmbH) è a specifiche v0.1 con solo supporto sperimentale dietro feature flag in Mastodon 4.4: non è un percorso su cui contare oggi.

Per gli eventi in particolare, i canali di ingestione sono curati da umani: **Gancio** ingerisce eventi remoti tramite il follow admin di "istanze/attori fidati" (funzione arrivata tra v1.10.2 e v1.15.1, dic 2023–apr 2024) — gli admin seguono fonti locali e curate; un attore Evento generico mondiale che emette eventi one-off di sconosciuti è un target di follow implausibile, e attori per-città richiederebbero esattamente l'infrastruttura multi-attore persistente che Evento rifiuta. La ricerca globale integrata di **Mobilizon** è stata dismessa nel frontend dalla 5.1.0 e l'indice superstite (search.mobilizon.fr) crawla solo ~95 istanze Mobilizon: Evento non può comparirvi.

**Nostr inverte il modello di scoperta** ed è l'unico strutturalmente compatibile: i relay sono store interrogabili per filtro (kind 31922/31923) senza follow; pubblicare su qualche grande relay pubblico rende l'evento immediatamente interrogabile da qualunque client o indexer (aggregatori stile nostr.band). Il limite onesto resta il pubblico: la popolazione che sfoglia calendari Nostr è minuscola rispetto anche a una sola istanza Mastodon di media taglia.

### Fit con Evento

Per ActivityPub, **il killer è la scoperta, non l'emissione**: senza follower/relay/admin che seguono, un Evento federante emetterebbe oggetti nel vuoto, e ottenere reach diversa da zero richiede tutto lo stato persistente più *lavoro sociale per-community* che il modello anonimo di Evento non può fare. Questo sposta la federazione AP piena da "beneficio modesto" a "beneficio quasi nullo a costo architetturale alto". La superficie di scoperta realistica di Evento resta la ricerca web ordinaria — che è esattamente ciò che alimentano h-event e JSON-LD schema.org. *(Nota: quest'area e la successiva non hanno passato un giro di fact-checking formale nei dati di ricerca; i punti fattuali chiave — flag `indexable` in 4.2, ricerca globale Mobilizon, follow fidato di Gancio — sono citati dalle fonti elencate ma vanno trattati con un grado di fiducia leggermente inferiore alle aree verificate.)*

---

## Abuso, spam e rischio di reputazione del dominio

### Panoramica

Il rischio centrale è concreto e ben documentato altrove: **qualunque endpoint `/event/<encoded>` che renderizza lato server JSON fornito dall'attaccante** (come HTML, h-event, JSON-LD, ICS o AS2) trasforma Evento in un host di contenuti gratuito, anonimo e first-party — lo stesso pattern di abuso degli URL shortener e degli hosting statici gratuiti. Il caso di studio è la stessa `*.netlify.app`: usata di routine per pagine di phishing, presente nei listing di minacce, con sottodomini legittimi flaggati per errore da Google Safe Browsing. Safe Browsing e Search Console operano a **granularità di sito/hostname**: per Evento, che serve tutto da un unico dominio, un'ondata di phishing riuscita renderizzata sotto `/event/...` può far comparire l'interstitial "Sito ingannevole" sull'intera app, con remediation (rimozione + review Search Console) che richiede giorni o settimane. E il design senza database toglie le leve normali di takedown: non c'è nulla da cancellare. Le mitigazioni stateless possibili: (a) **non renderizzare lato server** — la decodifica client-side attuale è la difesa accidentale dell'architettura; (b) **firma HMAC del payload** con chiave server rotabile (nginx secure_link, route firmate alla Laravel: pattern decennale) — non vaglia il contenuto, ma prova che l'URL è stato "coniato" tramite Evento (abilitando rate-limiting alla creazione) e offre un kill-switch di massa via rotazione della chiave, che però **invalida tutti i vecchi URL**, rompendo la promessa "i link vivono per sempre"; (c) denylist di hash-di-URL nel deploy o in una edge function — stato camuffato da configurazione, un redeploy per takedown; (d) interstitial permanenti "contenuto fornito dall'utente" — proteggono la reputazione, degradano il prodotto.

Sul fronte Fediverso, la **defederazione è concreta e in pratica permanente**: i domain block di Mastodon a severità "suspend" tagliano tutta la federazione e coprono automaticamente i sottodomini; gli admin si coordinano via #FediBlock e importano blocklist condivise machine-readable (FediBlockHole, liste stile Oliphant). L'ondata di spam del febbraio 2024 mostra il riflesso della community: blocchi in massa entro 24–48 ore, sblocchi trascinati per mesi, nessun processo di appello centrale. Un attore che firma in AS2 qualunque cosa chiunque digiti in un URL è esattamente il profilo per cui quelle liste esistono.

Infine il costo operativo di una **inbox aperta su Netlify Functions**: ogni consegna va verificata (firma draft-cavage, con fetch della chiave dell'attore remoto — non cacheable senza storage) ed è **fatturata per invocazione, senza cap di costo**; il rumore di fondo del Fediverso è dominato da tempeste di `Delete` (issue Mastodon #23175 e #20406 documentano flood e ri-consegne dello stesso Delete centinaia di volte) che Evento non potrebbe comunque processare, non avendo stato da cui cancellare. Il rate limiting nativo di Netlify (edge, max 2 ruleset per progetto, per IP) è debole contro traffico distribuito proveniente da migliaia di server legittimi. Conclusione di design: se Evento federa, deve essere **publish-only** (niente inbox, o una inbox che risponde 202 e scarta tutto), e non dovrebbe mai firmare payload controllati dall'attaccante in oggetti AS2 senza un livello di minting/rate-limit — e una storia di anti-abuso credibile richiede almeno stato a livello di configurazione (chiavi rotabili, denylist deployabili): un arretramento materiale, seppur minimo, da "No Data".

---

## Tabella comparativa

| Tecnologia / approccio | Licenza | Maturità | Complessità di adozione | Compatibilità con l'architettura attuale |
|---|---|---|---|---|
| Export ICS client-side (lib `ics`) | ISC (lib); RFC 5545 standard aperto | Finale/attiva (v3.12.0, 04/2026) | Molto bassa | **Piena** — zero server, zero dati |
| `datebook` (ICS + link vendor) | MIT | Attiva | Molto bassa | **Piena** |
| `add-to-calendar-button` | **Elastic-2.0 (non OSI)** | Attiva | Bassa | Piena tecnicamente, **in conflitto con la preferenza open source** |
| Link "aggiungi a Google/Outlook" | Proprietari, non documentati ufficialmente | De facto stabili, non garantiti | Molto bassa | Piena (ma silos vendor) |
| Endpoint stateless `/ics/<encoded>` + `webcal://` | — | Pattern consolidato | Bassa | Alta — nessuno storage; rischio reputazione da valutare |
| h-event + JSON-LD via pre-rendering edge | CC0 (spec) | Living draft stabile | Media | Alta — stateless, ma introduce rendering server di contenuto utente (rischio abuso) |
| AS2 Event via content negotiation + attore statico + WebFinger | Spec W3C/IETF | Finale (spec); pattern dimostrato su siti statici | Media | Alta — read-only, chiave in env var, zero DB |
| FEP-8a8e (profilo eventi) | CC0-1.0 | **Bozza** (rifinitura finale, 06/2026) | Media (vincolo endTime) | Alta come formato target read-only |
| Fedify (federazione piena) | MIT | Produzione, molto attiva | Alta | **Bassa** — richiede KV store (+ coda); Netlify non è target documentato |
| activitypub-express / activity-kit | MIT | **Ferme dal 2024 / 2023** | Alta | Molto bassa — richiedono MongoDB, non mantenute |
| Nostr NIP-52 via nostr-tools (client-side) | Unlicense (lib); NIP bozza | Lib attiva; ecosistema client debole (Flockstr fermo da 10/2024) | Bassa | **Alta lato Evento** — ma dati persistono su relay terzi; pubblico minimo |
| AT Protocol / lexicon `community.lexicon.calendar.*` | MIT / MIT+Apache-2.0 | Attivi | Alta (scrittura) | **Bassa per pubblicare** (account obbligatorio); ok read-only |
| Delega: bot su istanza Mobilizon (GraphQL OAuth2) | Mobilizon AGPL-3.0 | Attiva (5.2.4, 06/2026, Kaihuri) | Media | Media-alta — un secret, zero protocollo; evento persistito da terzi (opt-in esplicito) |
| Delega: Bridgy Fed | CC0 | Servizio attivo | Bassa-media | Media — richiede però un feed (collezione persistente) |
| Modello Gathio (evento = attore, auto-expiry) | GPL-3.0-or-later | Attiva (v1.6.3, 07/2025) | Alta | **Bassa** — richiede database; preserva solo "No Login" |
| Modello Gancio (singolo attore d'istanza) | AGPL-3.0 | Attiva (1.28.2; 2.0 beta 06/2026) | Alta | **Bassa** — DB e processo persistente |
| RSS/Atom, WebSub, Webmention-RSVP | Standard aperti | Finali | — | **Incompatibili** senza collezioni/stato persistenti |

---

## Raccomandazioni

### Breve termine — interoperabilità immediata senza tradire l'architettura

1. **Export ICS generato lato client** con la libreria `ics` (ISC) o `datebook` (MIT): il singolo intervento a più alto valore e più basso costo dell'intera ricerca. Zero server, zero dati che lasciano il browser, compatibilità con ogni app calendario (inclusi gli import di Mobilizon/Friendica/Hubzilla). Evitare `add-to-calendar-button` per la licenza Elastic-2.0, non OSI.
2. **Link "aggiungi a Google/Outlook/Yahoo Calendar"** costruiti client-side: gratis, ma da affiancare sempre al download ICS aperto e con la consapevolezza che sono schemi non garantiti dai vendor.
3. **Adeguare il modello dati in vista del futuro**: valutare un campo di fine evento opzionale (FEP-8a8e rende `endTime` obbligatorio, con marcatore open-ended) e usare i lexicon `community.lexicon.calendar.event` e il vocabolario Mobilizon come riferimenti di mapping.
4. **Se si aggiunge qualunque rendering server** (endpoint `/ics/`, pre-rendering h-event/JSON-LD per i motori di ricerca — che restano la superficie di scoperta realistica di Evento): farlo consapevoli del rischio di reputazione del dominio. La decodifica client-side attuale è una difesa accidentale ma reale; qualunque output first-party di contenuto utente andrebbe accompagnato da mitigazioni (minting con firma HMAC e rate-limiting alla creazione, denylist deployabile, etichettatura "contenuto fornito dall'utente"), accettando che una storia anti-abuso credibile richiede almeno stato a livello di configurazione.

### Medio termine — presenza read-only nel Fediverso

5. **Content negotiation ActivityStreams 2.0 su `/event/<encoded>`**: una Netlify Function che, alla richiesta di `application/activity+json`, restituisce l'oggetto AS2 `Event` (profilo FEP-8a8e, vocabolario location alla Mobilizon) decodificato deterministicamente dall'URL. Zero storage.
6. **Un attore statico di istanza + WebFinger**: un documento attore `Application` (es. `events@evento.example`) con chiave RSA in un secret Netlify e una risposta WebFinger statica. Con questo, incollare un link Evento nella ricerca di Mastodon/Mobilizon/Gancio produce un oggetto risolvibile; le piattaforme event-native lo mostrano come vero evento. Aspettative da gestire: su Mastodon il rendering resta "titolo + link"; nessuna consegna push, nessuna comparsa organica in timeline o ricerche; le istanze in authorized-fetch complicano il quadro. Il pattern a singolo attore è quello di Gancio ed è discusso in FEP-8a8e (la sua sanzione formale nel testo della FEP è **da confermare**).
7. **Opzionale: pulsante "pubblica su Nostr" interamente client-side** (nostr-tools, Unlicense; kind 31923 con tag `d`, `title` e `start` obbligatori), come unica forma di federazione a costo di stato nullo per Evento — presentata come opt-in esplicito, spiegando che l'evento persisterà su relay di terzi con cancellazione solo best-effort, che perdere la chiave usa-e-getta rende l'evento immodificabile, e che il pubblico dei client calendario Nostr oggi è molto piccolo (il client di punta è fermo da fine 2024).

### Lungo termine — federazione piena, e cosa comporterebbe davvero

8. **Trattare la federazione piena come un bivio, non un incremento.** Diventare seguibili e spingere eventi nelle timeline richiede: follower persistenti, code di consegna con retry, inbox sempre attiva con verifica firme (fetch delle chiavi remote non cacheabile senza storage), doveri di moderazione, e l'esposizione al rischio di defederazione via blocklist condivise — il tutto per una reach che *parte da zero* e cresce solo con lavoro sociale per-community che il modello anonimo di Evento non può svolgere. Tecnicamente significherebbe Fedify (MIT, l'unica opzione mantenuta; esiste `@fedify/fastify`) più un KV store e una coda, e realisticamente una migrazione da Netlify verso Cloudflare Workers o Deno Deploy. Il prior art serverless (lesspub, Wildebeest) è tutto abbandonato.
9. **Se la domanda degli utenti per la federazione si materializzasse, preferire la delega alla self-federation**: un pulsante opt-in "pubblica nel Fediverso" che posta l'evento su un'istanza Mobilizon tramite bot OAuth2 (scope `write:event:*`) o su un'istanza Gancio — reach federata reale, un solo segreto da gestire, zero codice di protocollo, con l'utente informato che quell'evento viene persistito su un server terzo (confine di consenso, non violazione architetturale).
10. **Se invece si scegliesse la self-federation**, i modelli da copiare sono noti: quello di Gancio (un attore, una chiave, database minimo) o quello di Gathio (eventi opt-in memorizzati con auto-cancellazione 7 giorni dopo la fine e `Delete/Actor` ai follower) — entrambi dimostrano che **"No Login" può sopravvivere alla federazione** (capability URL, invio anonimo), ma nessuno dei due preserva "No Data". In ogni caso: **publish-only** — nessuna inbox aperta, o una inbox che risponde 202 e scarta, per non pagare per sempre le tempeste di `Delete` del Fediverso su fatturazione per-invocazione senza cap. RSVP federati: da escludere finché la filosofia regge — sono per definizione dati personali memorizzati.

---

## Fonti

**Specifiche e standard**
- https://www.w3.org/TR/activitystreams-vocabulary/
- https://www.w3.org/TR/activitystreams-core/
- https://www.w3.org/TR/activitypub/
- https://www.w3.org/news/2017/activitystreams-2-0-is-now-a-w3c-recommendation/
- https://www.w3.org/news/2018/activitypub-is-now-a-w3c-recommendation/
- https://www.w3.org/TR/2018/REC-websub-20180123/
- https://www.w3.org/wiki/ActivityPub/Primer/Delete_activity
- https://github.com/w3c/activitypub/issues/294
- https://www.rfc-editor.org/info/rfc9421/
- https://www.rfc-editor.org/rfc/rfc9421.html
- https://www.rfc-editor.org/info/rfc5545/
- https://www.rfc-editor.org/info/rfc4287/
- https://swicg.github.io/activitypub-http-signature/
- https://codeberg.org/fediverse/fep
- https://microformats.org/wiki/h-event
- https://en.wikipedia.org/wiki/WebSub

**FEP-8a8e / Event Federation**
- https://event-federation.eu/2026/06/19/process-on-feps/
- https://event-federation.eu/2025/04/23/progress-on-the-fep-for-event-objects/
- https://event-federation.eu/2025/01/02/the-latest-additions-to-fep-8a8e-a-common-approach-to-using-the-event-object-type/
- https://event-federation.eu/2025/02/11/event-bridge-for-activitypub-1-0-0/
- https://validate.event-federation.eu/
- https://codeberg.org/Event-Federation/wordpress-event-bridge-for-activitypub
- https://wordpress.org/plugins/event-bridge-for-activitypub/
- https://socialhub.activitypub.rocks/t/events-interoperability-validation-minimum-requirements-common-extensions/3849

**Mastodon**
- https://docs.joinmastodon.org/spec/activitypub/
- https://docs.joinmastodon.org/spec/security/
- https://docs.joinmastodon.org/spec/webfinger/
- https://docs.joinmastodon.org/methods/admin/domain_blocks/
- https://github.com/mastodon/mastodon/pull/34814
- https://github.com/mastodon/mastodon/issues/29905
- https://github.com/mastodon/mastodon/issues/24079
- https://github.com/mastodon/mastodon/issues/23175
- https://github.com/mastodon/mastodon/issues/20406
- https://github.com/tootsuite/mastodon/issues/10286
- https://github.com/mastodon/mastodon/releases/tag/v4.2.0
- https://blog.joinmastodon.org/2018/06/how-to-implement-a-basic-activitypub-server/
- https://blog.joinmastodon.org/2025/07/mastodon-4-4-for-devs/
- https://github.com/mastodon/fediverse_auxiliary_service_provider_specifications
- https://www.fediscovery.org/
- https://fedi.tips/how-do-i-opt-into-or-out-of-full-text-search-on-mastodon/
- https://simonwillison.net/2024/Jun/4/how-do-i-opt-into-full-text-search-on-mastodon/

**Mobilizon**
- https://docs.mobilizon.org/5.%20Interoperability/1.activity_pub/
- https://docs.mobilizon.org/5.%20Interoperability/3.graphql_api/
- https://docs.mobilizon.org/3.%20System%20administration/configure/global_search/
- https://docs.mobilizon.org/about/
- https://joinmobilizon.org/en/news/
- https://mobilizon.org/about/
- https://en.wikipedia.org/wiki/Mobilizon
- https://wedistribute.org/2023/12/five-years-later-mobilizon-reaches-maturity/
- https://framagit.org/kaihuri/mobilizon/-/releases/5.1.2
- https://framagit.org/kaihuri/mobilizon/-/tags
- https://framagit.org/kaihuri/mobilizon/-/issues/1669
- https://framagit.org/framasoft/mobilizon/blob/main/LICENSE
- https://hub.docker.com/v2/repositories/kaihuri/mobilizon/tags
- https://nlnet.nl/project/Mobilizon/
- https://nlnet.nl/project/Empowering-Mobilizon/
- https://nlnet.nl/project/WordPress-EventFederation/
- https://fedi.tips/mobilizon-event-organisation-and-discovery/
- https://search.mobilizon.fr/
- https://socialhub.activitypub.rocks/t/how-to-represent-places-in-an-event/413

**Gathio, Gancio e affini**
- https://github.com/lowercasename/gathio
- https://github.com/lowercasename/gathio/releases/tag/v1.6.3
- https://raw.githubusercontent.com/lowercasename/gathio/main/FEDERATION.md
- https://raw.githubusercontent.com/lowercasename/gathio/main/README.md
- https://raw.githubusercontent.com/lowercasename/gathio/main/LICENSE
- https://gath.io/
- https://github.com/lesion/gancio
- https://github.com/lesion/gancio/blob/master/CHANGELOG.md
- https://raw.githubusercontent.com/lesion/gancio/master/FEDERATION.md
- https://framagit.org/les/gancio/-/releases
- https://gancio.org/
- https://gancio.org/changelog
- https://gancio.org/federation
- https://lauti.org/
- https://codeberg.org/Klasse-Methode/lauti
- https://github.com/ngerakines/apevents
- https://fediverse.party/en/hubzilla/
- https://codeberg.org/fediverse/delightful-fediverse-experience

**Librerie e framework JS/AP**
- https://github.com/fedify-dev/fedify
- https://fedify.dev/
- https://www.npmjs.com/package/@fedify/fedify
- https://registry.npmjs.org/@fedify/fedify
- https://raw.githubusercontent.com/fedify-dev/fedify/main/docs/manual/deploy.md
- https://raw.githubusercontent.com/fedify-dev/fedify/main/docs/manual/federation.md
- https://github.com/fedify-dev/hollo
- https://registry.npmjs.org/activitypub-express
- https://github.com/immers-space/activitypub-express
- https://github.com/immers-space/activitypub-express/commits/master
- https://registry.npmjs.org/activitypub-core-server-express
- https://github.com/michaelcpuckett/activity-kit
- https://github.com/michaelcpuckett/activity-kit/commits/master
- https://github.com/dariusk/express-activitypub
- https://registry.npmjs.org/activitypub-http-signatures
- https://socialhub.activitypub.rocks/t/implementing-activitypub-on-netlify-using-serverless-functions/836

**Calendari e microformati**
- https://github.com/adamgibbons/ics
- https://github.com/jshor/datebook
- https://github.com/add2cal/add-to-calendar-button
- https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/main/services/google.md

**Nostr e AT Protocol**
- https://github.com/nostr-protocol/nips/blob/master/52.md
- https://github.com/nbd-wtf/nostr-tools
- https://registry.npmjs.org/nostr-tools
- https://github.com/zmeyer44/flockstr
- https://github.com/zmeyer44/flockstr/commits/main
- https://www.flockstr.com/
- https://github.com/formstr-hq/nostr-calendar
- https://github.com/opencollective/calendar
- https://www.nobsbitcoin.com/flockstr-nostr-events-meetups/
- https://github.com/bluesky-social/atproto
- https://github.com/lexicon-community/lexicon
- https://raw.githubusercontent.com/lexicon-community/lexicon/main/community/lexicon/calendar/event.json
- https://blog.smokesignal.events/posts/3ltugo43gkl2c-one-year-of-smoke-signal
- https://blog.smokesignal.events/posts/3lthgjbbhyk2c-community-lexicons
- https://atprotocol.dev/tech-talk-smoke-signal-events/

**Serverless, prior art e delega**
- https://paul.kinlan.me/adding-activity-pub-to-your-static-site/
- https://maho.dev/2024/02/a-guide-to-implementing-activitypub-in-a-static-site-or-any-website-part-3/
- https://shkspr.mobi/blog/2024/02/activitypub-server-in-a-single-file/
- https://github.com/sinofp/lesspub
- https://github.com/sinofp/lesspub/commits/master
- https://github.com/cloudflare/wildebeest
- https://fed.brid.gy/docs
- https://github.com/snarfed/bridgy-fed
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/functions/background-functions/
- https://docs.netlify.com/build/functions/usage-and-billing/
- https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
- https://www.netlify.com/blog/how-to-rate-limit-ai-features-and-avoid-surprise-costs/
- https://answers.netlify.com/t/functions-abuse-prevention/17814

**Scoperta e reach**
- https://fedi.tips/using-relays-to-quickly-expand-a-servers-view-of-the-fediverse/
- https://dustinrue.com/2023/01/adding-relays-to-your-mastodon-instance/
- https://www.zwilnik.com/better-social-media/activitypub-conference-2019/decentralised-hashtag-search-and-subscription-in-federated-social-networks/
- https://relay.fedi.buzz/

**Abuso e reputazione**
- https://fedi.tips/how-to-defederate-fediblock-a-server-on-mastodon/
- https://github.com/eigenmagic/fediblockhole
- https://github.com/irubnich/fediblock-importer
- https://writer.oliphant.social/oliphant/the-oliphant-social-blocklist
- https://github.com/Mastodon-DE/blocklists/blob/main/spam/2024-02-15/2024-02-15-spam-mute-list.md
- https://techcrunch.com/2024/02/20/spam-attack-on-twitter-x-rival-mastodon-highlights-fediverse-vulnerabilities/
- https://developers.google.com/search/docs/monitor-debug/security/social-engineering
- https://support.google.com/webmasters/answer/9044101?hl=en
- https://answers.netlify.com/t/my-netlify-subdomain-is-flagged-as-unsafe-false-positive/155839
- https://answers.netlify.com/t/urgent-google-safe-browsing-phishing-warning-on-netlify-site/164585
- https://www.malwarebytes.com/blog/detections/netlify-app
- https://alluresecurity.com/blog/url-shorteners-phishing/
- https://blog.cyril.email/posts/2025-03-12/url-protection-through-hmac.html
- https://www.getpagespeed.com/server-setup/nginx/nginx-secure-link-signed-urls-hotlink-protection
- https://news.ycombinator.com/item?id=17459204
