# Evento event format specification

**Version: 2** — Status: stable
**Reference implementation:** [`src/shared/eventFormat.js`](../src/shared/eventFormat.js)

This document specifies the wire format of an Evento event. The format is the
protocol of the whole system: an event is a self-contained payload carried
inside a URL, and any Evento instance can decode URLs produced by any other
instance. If you self-host Evento (or write your own reader), this is the
contract.

## URL carriers

An instance serves the same payload from two carriers; the payload format is
identical in both, and decoders MUST accept both.

| Carrier               | Shape                                | Semantics                                                                                                                                                                                        |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Path ("with preview") | `https://<instance>/event/<payload>` | The payload reaches the serving instance, which derives stateless projections from it (see below). Edit URLs: `/event/<payload>/edit`.                                                           |
| Fragment ("private")  | `https://<instance>/event#<payload>` | The payload never leaves the browser — URL fragments are not sent in HTTP requests — so there are no server logs, no preview card and no server projections. Edit URLs: `/event/edit#<payload>`. |

### Server projections (path carrier only)

Instances MAY serve, computed statelessly from the payload on every request:

- `GET /ics/<payload>` → `text/calendar` (RFC 5545 export; enables `webcal://`)
- An Open Graph preview page on `/event/<payload>`, served only to
  link-preview bots (envelope only: title, date/time, location — never the
  description)

Projections are suppressed for payloads in the instance's abuse denylist
(configuration state, not user data).

## Encoding

The canonical (v2) encoding is:

```
base64url( UTF-8( JSON.stringify(event) ) )
```

- **base64url** alphabet (`A–Z a–z 0–9 - _`), **without padding** (`=` stripped).
- The JSON text is encoded as UTF-8 bytes before base64; non-ASCII text is
  therefore carried natively, not percent-escaped.

### Legacy (v1) encoding — decoders MUST accept it

URLs produced before this specification used:

```
base64( encodeURIComponent( JSON.stringify(event) ) )  with '/' → '_', '=' stripped
```

Disambiguation is deterministic: after base64 decoding, a legacy payload is
percent-encoded ASCII and always starts with `%` (the JSON `{` is escaped as
`%7B`), while a canonical payload starts with `{`. Decoders MUST support both.
Encoders MUST emit only the canonical encoding.

## Event object

### Version 2 (current)

| Field         | Type   | Required | Meaning                                                                                                                                                                                                                                                  |
| ------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`           | number | yes      | Format version. `2` for this specification.                                                                                                                                                                                                              |
| `title`       | string | yes      | Event title. Non-empty after trimming.                                                                                                                                                                                                                   |
| `start`       | string | yes      | Wall-clock start, `YYYY-MM-DDTHH:mm` (minute precision, no offset), interpreted **in the event's `tz`**.                                                                                                                                                 |
| `end`         | string | no       | Wall-clock end, same shape as `start`, strictly after `start`.                                                                                                                                                                                           |
| `tz`          | string | yes      | IANA timezone identifier of the event (e.g. `Europe/Rome`).                                                                                                                                                                                              |
| `location`    | string | yes      | Free-text location. May be empty.                                                                                                                                                                                                                        |
| `description` | string | no       | Free-text description. Encoders omit it when empty.                                                                                                                                                                                                      |
| `status`      | string | no       | `confirmed` (default, omitted by encoders) or `cancelled`.                                                                                                                                                                                               |
| `updates`     | object | no       | Pointer to the event's update channel, now implemented over Nostr (see [Update channel](#update-channel-nostr)): `{ pk, d }` where `pk` is the 64-char lowercase-hex Nostr public key of the channel and `d` is the addressable identifier (1–64 chars). |

Time semantics: `start`/`end` are the local time **at the event**, and `tz`
makes them unambiguous instants. Renderers should display the wall-clock time
as written (optionally noting the zone); calendar exports must convert using
`tz`, never the viewer's zone.

### Version 1 (legacy)

`{ title, datetime, location, description? }` with no `v` field. `datetime` is
any `Date`-parseable string with no timezone attached ("floating" wall-clock
semantics: it displays the same in every zone). Decoders normalize v1 events
to the v2 in-memory shape with `tz = null`.

## Versioning rules

- A payload with no `v` field and a string `datetime` is version 1.
- Decoders MUST accept all versions up to the one they implement, and MUST
  ignore unknown fields within a known version (forward compatibility for
  additive changes).
- The version number increases only for changes that older decoders would
  misinterpret. Additive optional fields do not bump the version.
- Decoders MUST reject payloads whose `v` is greater than the version they
  implement, rather than guessing.

## Limits

Enforced at creation (encode) time; decoders SHOULD stay lenient so that
older or foreign URLs remain readable:

| What            | Limit      |
| --------------- | ---------- |
| `title`         | 200 chars  |
| `location`      | 200 chars  |
| `description`   | 2000 chars |
| Encoded payload | 4096 chars |

Encoded-parameter shape (cheap pre-validation without decoding):
`^[A-Za-z0-9+_-]{1,4096}$` — the union of the canonical and legacy alphabets.

## Invariants

- The payload is the single source of truth: an event is fully readable from
  the URL alone, with no server round-trip.
- Editing an event produces a new payload (and thus a new URL). Propagating
  changes to holders of an old URL is the job of the `updates` channel, not
  of the format.
- Nothing in the payload is secret: anyone holding the URL can read every
  field. Sensitive events should use the fragment carrier, which keeps the
  payload away from servers — not rely on the format.

## Update channel (Nostr)

The `updates` pointer turns an otherwise-immutable URL into an event that can
change after the fact: the creator can push a new time, a new location or a
cancellation to everyone who already holds the link. The channel is opt-in —
an event without an `updates` pointer is simply immutable — and degradable: if
the relays are unreachable, the URL payload still renders on its own. This
section specifies the wire contract so that an independent reader can
interoperate without consulting the reference implementation.

### The channel is a Nostr replaceable event

The channel is an **addressable replaceable Nostr event of kind 31923**
(NIP-52 time-based calendar event). "Addressable replaceable" means relays keep
only the newest event per `(kind, pubkey, d)` tuple: publishing a new version
supersedes the previous one, so the channel always resolves to a single current
event. The channel is identified by the payload's `updates` pointer — `pk` is
the event's Nostr public key, `d` is the value of its `d` tag.

### Payload transport and NIP-52 interop

The Evento payload (the same base64url string used in URLs) is the **single
source of truth** and travels in a dedicated tag:

```
["evento", "<encoded-payload>"]
```

Readers derive every Evento field from this tag alone. Standard NIP-52 tags and
`content` are emitted alongside it purely for interop with other Nostr calendar
clients, and readers MUST NOT treat them as authoritative:

- `d` — the addressable identifier (equals the channel `d`).
- `title` — the event title.
- `start` — the start instant as a **unix-seconds string**.
- `end` — the end instant as a unix-seconds string (optional).
- `start_tzid` — the IANA timezone (optional).
- `location` — the free-text location (optional).
- `content` — the event description.

Cancellations are expressed two ways so that both Evento and foreign clients
degrade gracefully: an Evento-specific `["status", "cancelled"]` tag carries the
machine-readable signal, and the `title` tag is additionally prefixed with
`CANCELLED: ` so a generic Nostr calendar client that ignores the status tag
still surfaces the cancellation to its users.

### Verification (readers MUST do all of this)

Relays are untrusted. Before accepting a channel event as an update, a reader
MUST verify all of the following, and reject the event if any check fails:

- The Nostr event's **Schnorr signature** verifies.
- The event's **kind is 31923**.
- The event's **pubkey equals the channel `pk`**.
- The event's **`d` tag equals the channel `d`**.
- The **`evento` tag payload decodes** as a valid Evento event (per this spec).
- That decoded event's own **`updates` pointer equals `{ pk, d }`** — an update
  may not silently re-point the channel to a different key or identifier.

The last check is what keeps the channel bound to the identity the URL holder
already trusts: a valid-looking update that hijacks the pointer is rejected.

### Latest-version selection

When more than one candidate event survives verification (relays may return
several), the current version is the one with the highest `created_at`; ties are
broken by the **lexicographically smallest event id**.

### Relay list

Readers query a **default set of public relays**. A self-hoster or a test
harness overrides that set via `localStorage["evento.relays"]`, whose value is a
JSON array of `wss://`/`ws://` URLs. When the override is present it replaces the
default set.

### Key custody limitation

The channel's signing **secret key lives only in the creating browser's
`localStorage`**, under the key `evento.sk.<pk>` and bound to the channel's `d`.
It is device-bound with **no recovery**: if that browser storage is lost, the
event can no longer be updated or cancelled — it simply becomes **immutable**.
It never becomes unreadable: holders keep seeing the last-known version, and the
original URL payload always renders on its own. Two further consequences follow
from custody living entirely on the creating device:

- The channel cannot be **added to an event after creation** — the `updates`
  pointer must be present in the URL the holder received.
- The channel cannot be **revoked from links people already hold** — an update
  can supersede the content, but it cannot recall an already-shared URL.
