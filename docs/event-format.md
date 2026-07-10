# Evento event format specification

**Version: 2** — Status: stable
**Reference implementation:** [`src/shared/eventFormat.js`](../src/shared/eventFormat.js)

This document specifies the wire format of an Evento event. The format is the
protocol of the whole system: an event is a self-contained payload carried
inside a URL, and any Evento instance can decode URLs produced by any other
instance. If you self-host Evento (or write your own reader), this is the
contract.

## URL shape

```
https://<instance>/event/<payload>
```

`<payload>` is the encoded event as specified below. The path carrier is the
current default; carriers that keep the payload out of server reach (URL
fragment) are planned and do not change the payload format itself.

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

| Field         | Type   | Required | Meaning                                                                                                                                                                                                 |
| ------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`           | number | yes      | Format version. `2` for this specification.                                                                                                                                                             |
| `title`       | string | yes      | Event title. Non-empty after trimming.                                                                                                                                                                  |
| `start`       | string | yes      | Wall-clock start, `YYYY-MM-DDTHH:mm` (minute precision, no offset), interpreted **in the event's `tz`**.                                                                                                |
| `end`         | string | no       | Wall-clock end, same shape as `start`, strictly after `start`.                                                                                                                                          |
| `tz`          | string | yes      | IANA timezone identifier of the event (e.g. `Europe/Rome`).                                                                                                                                             |
| `location`    | string | yes      | Free-text location. May be empty.                                                                                                                                                                       |
| `description` | string | no       | Free-text description. Encoders omit it when empty.                                                                                                                                                     |
| `status`      | string | no       | `confirmed` (default, omitted by encoders) or `cancelled`.                                                                                                                                              |
| `updates`     | object | no       | Pointer to the event's update channel (reserved for the Nostr-based update mechanism): `{ pk, d }` where `pk` is a 64-char lowercase-hex public key and `d` is the addressable identifier (1–64 chars). |

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
  field. Sensitive events should use a carrier that keeps the payload away
  from servers (fragment), not rely on the format.
