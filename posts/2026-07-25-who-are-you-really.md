---
title: Who are you, really: identity without an account
date: 2026-07-25
summary: The data-plane post got a secure pipe between two machines. This one answers the harder question sitting underneath it: whose machines, which one, and is it still them next week. Public keys, signatures, and certificates from the ground up, how a person can be a set of devices with no login and no server, and the scary part nobody in this space has cleanly solved, what happens when you lose the key that is you.
---

The [last post](post.html?post=2026-07-25-the-data-plane-underneath.md) got a
secure pipe between two machines and carefully stepped around the harder question
sitting right underneath it. The moment the bytes arrive, something has to answer:
who sent them? On a network there is no face, no voice, no handwriting. A packet
that says "I'm Alice" is just bytes, and anyone can type the word "Alice."

This is the identity problem, and the constraint that makes it interesting for
filament is that we refuse the easy answer. No accounts, no login, no central
server that "has an account for you." So we cannot lean on "the server says he's
Alice." Identity has to stand on its own math. This post builds that from nothing,
and ends on the part that is genuinely unsolved.

## A name is not an identity

Start with what fails, because it sharpens the problem.

```
   Machine A                          Machine B
   "Hi, I'm Alice"  ------------->    "...says the packet."

   And so does the attacker:
   "Hi, I'm Alice"  ------------->    B cannot tell them apart.
```

A name is a label, and labels are free to copy. So is any fixed secret you send
over the wire: a password works once, but anyone who sees it (on the wire, in a
log) can replay it. What we actually need is a very specific and seemingly
impossible property:

> Something you can prove you possess without ever revealing it, and that nobody
> else can fake, even after watching you prove it a thousand times.

Public-key cryptography makes that real, and it rests on one idea.

## The one-way street

All of this stands on one-way math: operations easy to do forward and effectively
impossible to reverse. You do not need the equations, only the intuition.

- A **hash** is a fingerprint of data: `hash("hello") -> a1b2c3...`, fixed size,
  and you cannot run it backward or find another input with the same fingerprint.
  It is a blender: fruit into smoothie is easy, smoothie back into fruit is not.
- A **trapdoor keypair** is two numbers where one undoes what the other does, but
  you cannot compute one from the other.

```
   easy direction  ------------------------>   hard / impossible direction
   private key  ->  public key                 public key  -X->  private key
   message + priv key -> signature             signature   -X->  private key
```

That asymmetry is the entire foundation. Hold it.

## The keypair: a secret half and a public half

A keypair is two mathematically linked keys: a **private key** you generate and
never share, and a **public key** derived from it that you hand to the whole world.

```
   +------------------+       derive        +-----------------+
   |  PRIVATE key     | ------------------> |  PUBLIC key     |
   |  never leaves    |   one-way: you      |  share freely   |
   |  your machine    |   cannot go back    |                 |
   +------------------+                     +-----------------+
```

The link gives two superpowers depending on which key does the work. Encrypt to
someone's public key and only their private key can read it (secrecy, not our
topic today). Or sign with your private key and anyone can verify with your public
key. That second one is the identity superpower. filament uses **Ed25519**, a
fast modern signature scheme; when you see it, think "a keypair whose job is
signing and verifying."

## Digital signatures: unforgeable "I said exactly this"

A signature is the crypto version of a wax seal only you can press and anyone can
check.

```
   SIGNING (only the private-key holder can do it):
     message  +  PRIVATE key  ->  [ sign() ]  ->  signature

   VERIFYING (anyone with the public key can do it):
     message  +  signature  +  PUBLIC key  ->  [ verify() ]  ->  true / false
```

Two properties make it bedrock. It is **unforgeable**: producing a signature that
verifies against a public key requires the matching private key, and watching a
million valid signatures does not help an attacker forge a new one. And it is
**bound to the exact message**: flip one bit and verification fails.

```
   verify("transfer 5 to Bob",    sig, pub)       -> true
   verify("transfer 5000 to Bob", sig, pub)       -> false  (message changed)
   verify("transfer 5 to Bob",    sig, WRONG_pub) -> false  (not that key)
```

So a signature proves a precise statement: the holder of private key K asserted
this exact sequence of bytes. That is the atom everything else is built from.

## The move that kills accounts: your key is your identity

Here is the leap. If proving "I'm me" just means "I hold private key K," then your
identity can simply be your public key. To prove it, someone sends a random
challenge, you sign it, they verify. No username, no password, no server that owns
an account for you.

```
   B: "Sign this random nonce: 7f3a9c."
   A: sign("7f3a9c", private key) -> signature
   B: verify("7f3a9c", signature, K) -> true.  "Ok, you hold K."
```

filament takes this literally: your overlay address is a hash of your public key.
The address is the identity. Anyone can challenge you to prove you own it, and
nobody can claim an address whose key they do not hold. That is what "anonymous,
no-account identity" means underneath: no authority issues it, the math does. And
it immediately creates the problem this whole post exists to solve.

## The problem: a key is a device, not a person

The catch is a rule that cannot bend: **a private key must never leave the machine
it was born on.** The moment it is copied elsewhere, that machine can perfectly
impersonate the first, and you have lost the link between "holds the key" and "is
that specific device." So: one device, one private key, and it stays put.

Which means a person is not a key.

```
   BOB is really:
     bob-laptop   holds key K1  ->  address addr(K1)
     bob-phone    holds key K2  ->  address addr(K2)
     bob-desktop  holds key K3  ->  address addr(K3)

   Three keys, three addresses, three identities.
   There is no single key that is "Bob."
```

Now Alice, a stranger, wants to reach Bob. She sees keys, not "Bob." Three problems
fall out at once. **Addressing**: there is no "Bob" to name. **Granularity**: she
wants one device (his laptop), not to enroll in all three. **Privacy**: if reaching
"Bob" meant learning K1, K2, and K3, she would learn Bob owns three machines and
which. His device set is nobody's business. Raw key-identity is too granular:
perfect for machines, useless for "I want to talk to the human Bob."

## The idea: a key that vouches for other keys

The fix is the trick certificate authorities have used for decades. Give each
person one more keypair: a long-term **user key** that represents the person. It
never runs on any hot path; its only job is to **sign statements about device
keys**.

```
   Bob's USER key  (the anchor "Bob")
        |
        +--signs--> "device key K1 is mine"   (a certificate for bob-laptop)
        +--signs--> "device key K2 is mine"   (a certificate for bob-phone)
        +--signs--> "device key K3 is mine"   (a certificate for bob-desktop)
```

That signed statement is a **certificate**. Now bob-laptop can prove it is Bob's:
it presents its device public key plus the certificate signed by Bob's user key.
Anyone who knows Bob's user public key verifies the certificate and concludes:
this device really belongs to Bob. The user key is the stable "Bob"; device keys
are replaceable leaves underneath it.

If you know SSH certificates, you already know this whole design:

```
   filament            SSH certificate authority
   -----------------   -------------------------
   user key         =  the CA key
   device key       =  a host key
   device cert      =  a signed host certificate
   verify + connect =  verify the cert, then connect to the host
```

## What a certificate actually is

No magic, just a small signed record.

```
   +-------------------------------------------------------------+
   |  CERTIFICATE                                                |
   |    subject public key : K1   (the device being vouched for) |
   |    issuer             : Bob's user public key               |
   |    claims             : "belongs to Bob"                    |
   |    valid from / until : 2026-07-25 .. 2026-10-23  (90 days) |
   |  ---------------------------------------------------------  |
   |    signature : sign(all of the above, Bob's USER priv key)  |
   +-------------------------------------------------------------+
```

Verifying it is one signature check and a clock check: is the issuer's signature
over these fields valid under the issuer's public key, and is it still inside its
validity window. That is all a certificate is, in TLS, in SSH, and here: a signed
binding between a key and some claims, with an expiry.

## Two kinds of key, two very different lifestyles

This is the part most people blur, so make it sharp. There are now two private
keys in Bob's world, living completely differently.

```
   DEVICE key (K1 on bob-laptop)          USER key (Bob's anchor / CA)
   ---------------------------------      ---------------------------------
   born on the device, never leaves       born once, kept COLD / offline
   used constantly (every handshake)      used RARELY (only to sign certs)
   if stolen: lose ONE device             if stolen: become ALL of Bob
   cheap to replace                       catastrophic to lose; guard it hard
```

The picture: the user key is a master seal locked in a safe, out only to stamp new
ID badges. The certificate is the badge a device carries. The device key is the
badge-holder proving, live, that the badge is really theirs by signing a fresh
challenge. You need both. A certificate without a live key proof is a stealable
badge; a live key without a certificate is an anonymous stranger.

## The whole thing: introduce me to one device, not to Bob's mesh

Alice wants to reach Bob. Assume she already has his user public key (how she got
it is out-of-band, a QR code or a one-time word, more on that below). Watch what
crosses the wire, and what does not.

```
   ALICE                    RENDEZVOUS                    BOB'S DEVICES
   (stranger)               (dumb relay)                  (his private mesh)
     |                          |                             |
     |-- "introduce, token T" ->|---------------------------->|
     |                          |     Bob's side privately picks ONE
     |                          |     device to expose: bob-laptop
     |                          |                             |
     |==  PAKE handshake, end-to-end encrypted  ==============>|
     |    (the relay forwards ciphertext; it sees T, not the   |
     |     contents)                                           |
     |                                                         |
     |<= inside the encrypted channel, bob-laptop sends: ===== |
     |       - its device public key K1                        |
     |       - its network candidates                          |
     |       - its device CERT (signed by Bob's USER key)      |
     |                                                         |
     |  Alice checks:                                          |
     |    verify(cert, Bob_user_pubkey) -> true  "it's Bob's"  |
     |    PAKE proves bob-laptop holds K1 live   "and it's K1" |
     |                                                         |
     |=====  authorized pairwise channel to bob-laptop  ======|
```

Alice ends with a secure channel to bob-laptop and certainty it is Bob's device.
She never learns bob-phone or bob-desktop exist. Bob showed one badge; the rest of
his set was never mentioned. Two proofs did two jobs: the certificate (issued
offline by the user key) proved "this device is Bob's," and the live PAKE (by the
device key) proved "and I am really that device, right now."

## Why the device set stays private

Three separate reasons, and they are the caveats worth being honest about.

```
   1. The rendezvous is blind. It forwards ciphertext and sees only token T.
      The key and cert are exchanged INSIDE the encrypted channel.
   2. Alice sees exactly one door. Bob chose bob-laptop; the others are
      never named. "Reach Bob" did not hand over a roster.
   3. User keys stay out of the plaintext token, so the relay cannot even
      notice "Alice's key just met Bob's key."
```

The one linkage that remains: if Alice is later introduced to bob-desktop too,
both certificates chain to the same user key, so she can tell they are both Bob.
That is the price of continuity. If Bob wants his work and personal lives
unlinkable, he uses two separate user keys, two separate "Bobs," and gives up
continuity between them. A dial he controls, not a leak he cannot help.

## Continuity: how "Bob" survives a new laptop

This is the payoff of anchoring identity in the user key instead of a device key.

```
   bob-laptop dies. Its device key K1 is gone forever (never backed up: good).
   Bob gets a new laptop with a fresh device key K4.
   He wakes his COLD user key once and signs: "K4 is mine."

   Next time Alice reaches Bob, the new device presents K4 + its cert.
   Alice: verify(cert, Bob_user_pubkey) -> true.  "Still Bob."
   No re-introduction, no new trust decision. Her contact "Bob" just works.
```

The user key is the durable identity; devices are cattle, not pets. That is also
exactly the substrate the last section needs.

## The scary part: what happens when you lose the key that is you

Everything above rests on the user key. So the honest question is: the user key
*is* Bob, so what happens when Bob loses it, or someone steals it? This is where
every anonymous-key system I looked at (cjdns, Yggdrasil) simply has no answer:
lose the key, lose the identity, forever. That is not good enough for something
people would actually depend on, so it is worth designing on purpose. Two failure
modes, and they are not the same.

**Loss** (the key is gone, nobody has it). You can no longer issue certificates for
new devices, and your existing device certs age out. You are slowly becoming a
stranger to everyone who knew you.

**Compromise** (someone else has it). Far worse: the thief can issue device certs
as you, becoming you to everyone. You need to revoke the key and move to a new one,
fast.

The first line of defense is boring and essential: **back the user key up.** It is
tiny; keep an encrypted copy offline (on paper, a hardware token, an encrypted
file). Restore it and you are back.

```
   user key  --encrypt-->  backup (paper / hardware / encrypted file, offline)
   later:    backup  --decrypt-->  user key restored.  You are you again.
```

But a backup is another copy, which is another thing to lose or have stolen, and
it does nothing for the compromise case (the thief has a working key too). So the
interesting answer reuses the one thing filament already has: the people who
already trust you.

**Social recovery through the introduce-graph.** The people who hold a link that
chains to your user key already know "you." So let a threshold of them vouch a
*new* user key as the same person.

```
   old user key U : lost or compromised
   Bob mints a fresh user key U'.

   Bob asks his trusted contacts (who each hold a link bound to U):
     "This is me. Please sign that U' is the same person as U."

   Alice, Carol, Dave, Erin, Frank each sign a small attestation:
        sign("U' is the same person as U",  their own key)

   A peer accepts U' as "still Bob" when enough trusted vouchers agree
   (say 3 of 5). No central authority. The social graph that gated
   Sybil in the mesh design is reused here to gate recovery.
```

This is elegant because it needs no server and no account, only the trust you
already built. But be honest about the two new dangers it introduces.

```
   Collusion: if enough of your vouchers collude or are compromised, they can
              bless an ATTACKER's key as "you." Social recovery hands your
              identity's safety to your threshold. Choosing who counts, and
              how many, is now a security decision, not a convenience.

   Bootstrap: social recovery needs pre-existing trusted contacts. A brand-new
              user with no one to vouch has only the backup to fall back on.
```

Compromise is the genuinely hard case, because the stolen key cannot be trusted to
sign its own death certificate (the thief holds it too). Two honest options, and
both are real work: pre-commit a separate **recovery key** in advance, a second
cold key whose only power is to revoke and replace the user key; or lean on social
recovery, a threshold of contacts who revoke the old key and bless the new one.
The first is simpler but is one more precious secret to keep; the second avoids
that but inherits the collusion risk above. There is no free version.

And a smaller honesty that runs through all of it: there is **no global list of
dead keys** (that would be the central authority filament refuses), so a revocation
only reaches the peers you push it to. The mitigation is the expiry from earlier,
short-lived device certificates, so even a revocation someone missed stops working
within about ninety days.

## What I am left with

The shape is small and, I think, right: your key is your identity (no account), a
device is a key that never moves, and a person is a user key that vouches for their
devices with certificates, the same shape as an SSH certificate authority. That
buys the thing that actually matters day to day, "connect me to Bob's laptop,
provably Bob's, without ever seeing Bob's other machines," with no login, no
server, and no name anyone can steal.

The honest edge is recovery. Anchoring identity in one cold key makes everything
above clean, and makes losing that key the one genuinely unsolved problem, which no
comparable system has answered and which trades backup-loss against voucher-
collusion against the cold-start of having no one to vouch for you yet. That is not
a footnote to hand-wave. It is the actual frontier of doing identity without an
account, and it is the next thing worth getting right.
