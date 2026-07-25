---
title: The Data Plane Underneath
date: 2026-07-25
summary: Filament's VPN layer moves every packet as a QUIC datagram in a userspace process, one packet at a time, on one core, roughly an order of magnitude slower than kernel WireGuard doing the identical job. Understanding why meant going back to before sockets exist and building forward through UDP, TCP, TLS, QUIC, and WebRTC, to find the one box WireGuard was built to fill exactly, and the one it was never meant to.
---

It starts with a gap I could not explain away. Filament moves a machine's IP
packets to another machine by wrapping each one in an encrypted QUIC
datagram, in a userspace process, one packet at a time, on a single core.
WireGuard does the identical job: take a packet, encrypt it, wrap it in one
UDP datagram, send it, in the kernel, batched, with a fixed and audited
crypto suite. Same job, same shape of work. Filament's version runs roughly
an order of magnitude slower.

That gap sat in the codebase longer than I'd like to admit before I
understood it well enough to be honest about it. Understanding it meant
going further back than "which transport is faster." It meant going back to
why sockets exist at all, and building forward from there through
everything a computer does to get bytes from one machine to another. This
post is that path. It ends where the gap started: at the decision to stop
building a machine-to-machine tunnel out of app-to-app parts, and borrow the
tool that was built for the job.

## One machine, then two

A single machine is easy to reason about. A keypress goes to a program, the
program computes something, the result goes to a screen. Everything happens
inside one box, under one kernel, and "sending data" means moving it from
one region of memory to another.

The moment you have two machines that need to exchange bytes, that story
breaks. There is no shared memory anymore. There is a wire (or radio) in
between, owned by nobody, that neither machine controls end to end. Every
protocol in this post, UDP, TCP, TLS, QUIC, WebRTC, WireGuard, is a
different answer to the same question: how do two programs on two machines
exchange bytes over a link that is fundamentally unreliable and not under
either program's control?

[FIG: one machine vs two machines]
```
  ONE MACHINE                      TWO MACHINES

  keyboard -> program -> screen    program A            program B
       (all in one kernel,             |                     |
        one address space)             v                     v
                                    kernel A  <--- wire --->  kernel B
                                  (owns the NIC)          (owns the NIC)
```

## Why sockets exist

A network card is shared hardware. If every program could poke it directly,
one buggy program could corrupt another program's traffic, or read it. So
the kernel owns the NIC, and it hands your program a **socket**: a
file-like handle you `read()` and `write()`. You put bytes in, the kernel
moves them to the wire; bytes arrive on the wire, the kernel hands them to
you. You never touch the hardware.

Addressing has two parts because there are two questions to answer: which
*machine*, and which *program on that machine*. The machine is the IP
address. The program is the port. A socket is bound to the pair `(IP,
port)`, and that pair is how the kernel knows which of the dozens of
programs listening on a machine a given incoming packet belongs to.

[FIG: socket as the kernel's handle to the NIC]
```
  your program
      |  read() / write()
      v
  +---------+        the kernel is the only thing
  | socket  |        that ever touches the NIC directly
  +---------+
      |
      v
  kernel (owns the NIC) ----> wire
```

## The wire only moves packets, and it does not promise much

The wire does not carry a stream of bytes. It carries **packets**: small,
discrete chunks. The size limit isn't a property of packets themselves,
it's a property of the link: on a typical Ethernet link the maximum
transmission unit (MTU) is around 1500 bytes, but jumbo frames push that to
9000, and other link layers set it elsewhere. Anything bigger than the
path's MTU has to be split up. Hold onto that number; it comes back to bite
us later, when a VPN wraps each packet inside a bigger one and the inner
packet no longer fits (the MTU point in the TUN section). And packets are
not guaranteed anything beyond "we'll try." A packet can be:

- **lost** (a router drops it under congestion, a link glitches)
- **reordered** (it arrives out of the order it was sent)
- **duplicated** (a retransmission and the original both arrive)
- **corrupted** (bit flips in transit)

This one fact, that the wire is a best-effort packet service and nothing
more, is the reason everything downstream exists. Every protocol from here
on is a deliberate choice about how much of that unreliability to hide from
the application, and at what cost.

Reordering in particular surprises people the first time they hit it,
because it doesn't feel like it should happen. Your program calls `write()`
twice in a row; surely the two writes arrive in that order? They usually
do, but not because the network promises it. `write()` returning just means
the kernel accepted the bytes into its own send buffer; it says nothing
about the trip across the wire. Once a packet leaves your machine, it is
routed independently of every other packet, hop by hop, and different
packets can take different paths through different queues at different
routers. Packet 2 can physically arrive at the destination before packet 1
did. It's the same reason five letters mailed on the same day from the same
mailbox can arrive at their destination on five different days, in a
different order than you dropped them in the box: once they're in the
postal system, each one finds its own way there.

[FIG: reordering happens in the network, not in your write() call]
```
  sender writes:  [1] [2] [3]

  network routes each packet independently:

    [1] ---> router A ---> router C ---> (slow queue) --------> [1]
    [2] ---> router B --------------------------------> [2]
    [3] ---> router A ---> router D --------> [3]

  arrival order at receiver:   [2]  [3]  [1]
```

## UDP: the thinnest socket you can open

UDP gives you almost nothing beyond a raw packet with an address on it. No
connection setup, no ordering, no retransmission, no flow control. What it
does add, on top of raw IP, is ports (so the kernel can route the packet to
the right program) and a checksum.

Formally, what UDP hands you is a **datagram**: a self-contained,
independently-routable, packet-sized message. It travels wrapped inside
other packets, a process called encapsulation: your UDP datagram becomes
the payload of an IP packet, which becomes the payload of an Ethernet
frame. Each layer only looks at its own header and treats everything inside
as opaque cargo.

[FIG: encapsulation, packets inside packets]
```
  Ethernet frame
  +----------------------------------------------------+
  | Eth header | IP packet                              |
  |            | +----------------------------------+   |
  |            | | IP header | UDP datagram          |   |
  |            | |           | +------------------+  |   |
  |            | |           | | UDP hdr | payload |  |   |
  |            | |           | +------------------+  |   |
  |            | +----------------------------------+   |
  +----------------------------------------------------+
```

That word "message" is worth pinning down, because it comes back for SCTP
and WebSockets further down, and it is the quiet line between two whole
families of transport. A **message** is a bounded unit whose edges are
preserved: hand UDP a 200-byte message and then a 50-byte message, and the
peer receives exactly those two, one 200-byte read and one 50-byte read, as
separate units. The boundaries survive the trip. That is a
**message-oriented** transport. TCP, in the next section, is the opposite: a
**byte stream**, one continuous flow with no boundaries at all. Write
"hello" and then "world" to a TCP socket and the receiver might read
"helloworld" in a single go, or "hell" then "oworld". TCP guarantees the
bytes arrive in order and complete, but it does not remember where one
`write()` ended and the next began. If your application needs to know where
one logical message stops and the next starts over TCP, you add that
yourself, with a length prefix or a delimiter, a job called **framing**.
Message-oriented transports (UDP, SCTP, QUIC's datagram mode) do that
framing for you; a byte stream makes it your problem.

[FIG: a message keeps its boundaries; a byte stream does not]
```
  MESSAGE-ORIENTED (UDP, SCTP)        BYTE STREAM (TCP)

    send: [hello] [world]               write: [hello][world]
    peer: [hello]  then  [world]        peer:  "helloworld"
          two reads, edges kept                one flow, edges GONE
                                               (you must frame it yourself)
```

The checksum is not delivered "reliably" in any special way; it rides
inside the same packet as the data it protects. The sender computes it and
the receiver recomputes it on arrival and compares; if anything got
corrupted in transit, either the data or the checksum field itself, the two
won't match and the packet is silently dropped. That's detection, not
correction: nobody fixes the bits, the packet just never gets delivered.

One detail here explains a whole class of real-world networking pain. The
UDP checksum does not cover just the UDP header and payload; it also covers
a **pseudo-header** pulled from the IP layer below it: the source IP, the
destination IP, the protocol number, and the UDP length. Mixing those IP
fields into a UDP-layer checksum is a deliberate cross-layer check that the
packet was delivered to the right host. But it has a consequence: a NAT box,
whose entire job is to rewrite source/destination addresses as packets pass
through it, changes fields that the UDP checksum was computed over. So the
NAT must also recompute and rewrite the UDP checksum, or the receiver will
compute a mismatch and drop every packet. That coupling is why NAT
traversal is fiddly and why a middlebox that rewrites addresses but botches
the checksum silently blackholes traffic. (In IPv4 the UDP checksum is
optional, an all-zero field means "not computed"; in IPv6 it's mandatory,
because IPv6 dropped the IP-header checksum and leans on the transport to
catch corruption.)

It's also a weak, 16-bit checksum: fine against random line noise, useless
against anyone actively tampering with the packet. If you need protection
against a real attacker, that's what TLS and its relatives are for, further
down this post.

UDP is good for exactly the things where you don't want the overhead of
guarantees you don't need: DNS lookups (one request, one response, just
retry if nothing comes back), games and voice/video (a stale packet is
worse than a missing one, so why wait for a retransmit), and anything that
wants to build its own, custom reliability scheme on top rather than
inherit TCP's. QUIC, later in this post, is exactly that last case. The
bill for all this freedom: if your application needs ordering or
reliability, you write it yourself, or you use a protocol that already has.

## TCP: a reliable, ordered byte stream, built on an unreliable packet service

TCP's job is to take the lossy, reordering, duplicating packet service
underneath and present the application with something that feels nothing
like it: a reliable, in-order stream of bytes, indistinguishable from
reading a file. It does this with four mechanisms stacked together.

**A connection handshake.** Before any data moves, both sides agree the
connection exists: SYN, SYN-ACK, ACK. This costs a round trip before the
first useful byte can go anywhere.

[FIG: TCP three-way handshake]
```
  client                          server
    | -------- SYN --------------> |
    | <------ SYN-ACK ------------ |
    | -------- ACK --------------> |
    |                               |
    |   (connection established)   |
```

**Per-byte sequence numbers, to undo reordering.** This is where TCP earns
the "byte stream" abstraction. At handshake time each side picks a random
initial sequence number (ISN). The randomness is a security control, not
housekeeping: if the ISN were predictable, an off-path attacker who can't
see your traffic could still guess the sequence numbers of an existing
connection and inject forged segments into it (spoofed resets, or worse,
injected data), so randomizing the ISN makes that blind-injection attack
infeasible. From then on, every segment TCP sends says, in effect, "my
bytes start at offset X." The receiver doesn't place
incoming data directly into the application's read buffer; it places each
segment into a reassembly buffer at the byte offset the segment claims, and
only ever hands the application the longest **contiguous, gap-free prefix**
it has received so far. If segment 3 arrives before segment 2, it just sits
in the reassembly buffer, past a gap, until segment 2 shows up (or gets
retransmitted). This is also the direct source of TCP's biggest cost: since
delivery to the application must be strictly in order, one lost segment
stalls delivery of every segment behind it, even ones that already arrived
safely. That's called **head-of-line blocking**, and it's a recurring
character in this post; QUIC exists largely to get rid of it.

[FIG: TCP sequence numbers, reassembly, and head-of-line blocking]
```
  sent segments, by byte offset:      [0-99] [100-199] [200-299]

  arrival order:  [200-299]  [0-99]  (segment [100-199] is lost)

  reassembly buffer:
    offset 0:   [0-99]      ready to deliver
    offset 100: <gap>       waiting on retransmit
    offset 200: [200-299]   received, but STUCK behind the gap

  app only ever sees the gap-free prefix -> delivery stalls at byte 100
  until [100-199] is retransmitted, even though [200-299] is sitting right
  there.
```

**ACKs and retransmission, for reliability.** The receiver acknowledges
what it has; if the sender doesn't hear an ACK within a timeout, it
resends. This sounds like it needs the ACK itself to be reliable, and it
doesn't, which is worth sitting with because it's a small piece of
engineering elegance: TCP's ACKs travel over the exact same lossy,
best-effort packet service as everything else, and it doesn't matter.
Reliability is *emergent* from two simple rules, not from any single
message being guaranteed. First, timeout-and-retransmit: if the sender
hears nothing in time, it resends, whether the original data was lost or
just its ACK was. Second, ACKs are cumulative: "I have everything up to
byte N" heals an earlier lost ACK, because the next one that does arrive
covers it too. Duplicate segments that show up because of a resend get
silently discarded by sequence number: the receiver has already seen that
range, so it just drops the copy. Data lost and ACK lost resolve through
the identical mechanism, a resend, and the receiver's job is just to be
idempotent about what it's already seen. The whole tower of reliability
stands on parts that individually promise nothing.

One practical nuance the "timeout and resend" story hides: waiting for a
timeout (the retransmission timeout, or RTO) is actually the *slow* path,
and in a healthy connection you rarely hit it. Modern TCP recovers from
most loss much faster than that, without any timer firing. When the
receiver gets a segment past a gap, it re-sends the same cumulative ACK it
already sent (a duplicate ACK); three duplicate ACKs in a row tell the
sender "the segment after this point is missing" well before the RTO would
expire, and it retransmits immediately. That's **fast retransmit**, and
**SACK** (selective acknowledgement) sharpens it further by letting the
receiver name exactly which byte ranges it *does* have past the gap, so the
sender resends only the truly-missing pieces instead of everything after
the hole. RTO-driven recovery is the fallback for when even the duplicate
ACKs get lost, and when you see a TCP connection stall for a visible beat
before resuming, a latency spike in production, that's usually an RTO
firing, not fast retransmit.

[FIG: both "data lost" and "ACK lost" heal the same way]
```
  case 1: data lost              case 2: ACK lost
  sender    receiver              sender    receiver
    |--data-->  X (dropped)         |--data-->  |  (received fine)
    | (timeout, no ACK)             |<--ACK---  X (dropped)
    |--data(resend)-->  |           | (timeout, no ACK)
    |<-------ACK------  |           |--data(resend)-->  | (dup, discarded
    |                                |                    by seq #, ACK
                                     |<-------ACK------  |  resent)
```

**Two separate windows, so nobody gets overwhelmed.** This is the one place
in TCP most worth keeping straight, because the two mechanisms here get
conflated constantly and a reader debugging throughput needs to tell them
apart. There are two windows, protecting two different things.

*Flow control* protects the **receiver**. The receiver advertises, in every
ACK, a *receive window*: how many more unacknowledged bytes it currently has
buffer space for. The sender must never have more than that in flight. This
is entirely the receiver's call, sent explicitly on the wire, and it exists
so a fast sender can't overrun a slow receiver's buffers.

*Congestion control* protects the **network path**, and nobody advertises
it, the sender *estimates* it. The sender maintains its own *congestion
window*, invisible to the receiver, and grows or shrinks it based on what
the ACK stream implies about the path: ramp up quickly at first (slow
start), then probe upward more cautiously and cut back on loss (the classic
additive-increase / multiplicative-decrease of Reno, refined by CUBIC,
which is the modern Linux default, or replaced entirely by rate-and-RTT
estimators like BBR). Loss on a shared network usually means a router queue
somewhere filled and started dropping, so backing off is the sender being a
good citizen of a network it can't see directly.

The amount the sender may actually put in flight is the *minimum* of the
two windows: never more than the receiver will buffer, never more than the
sender thinks the path will bear. When you're chasing a throughput problem,
knowing which window is the binding constraint, a receiver that's
advertising a tiny window, versus a congestion controller that's backed off
because the path is lossy, points at two completely different fixes.

What all of this buys the application is real: you get to `read()` a
stream of bytes and never think about packets again. What it costs is also
real: a round trip before the first byte, head-of-line blocking baked into
the design, and the whole implementation living inside the kernel, which
means it evolves at the pace of OS releases and kernel patches, not at the
pace of your application.

## TLS: the encryption and authentication wrapper

TCP gives you reliability and order, not privacy or authenticity. Anyone
who can see the wire can read a plain TCP stream, and anyone who can inject
packets can potentially inject fake ones. TLS sits on top of TCP and adds
both: it encrypts the stream so eavesdroppers can't read it, and
authenticates the far end so you know you're actually talking to who you
think you are (this is "classic HTTPS": TLS running over TCP).

TLS needs a reliable, in-order byte stream underneath it to do this,
because its own handshake and record framing assume bytes arrive in the
order they were sent; that's part of why it was built on top of TCP rather
than UDP. The cost is more round trips before the first byte of actual
application data moves: TCP's handshake, then TLS's own handshake, stacked
in series. How many round trips depends on the TLS version, and this
matters for the next section: TLS 1.2 spends about two round trips on its
own handshake, TLS 1.3 cut that to one, and TLS 1.3 resuming a prior
session can send application data with zero extra round trips (0-RTT). But
notice that in classic HTTPS every one of those TLS round trips sits *on
top of* TCP's own handshake round trip; the two handshakes are stacked in
series, and neither knows about the other. Holding that picture, stacked and
redundant, is exactly what makes QUIC's trick in the next section land.

[FIG: TLS handshake bolted on top of TCP's]
```
  client                          server
    |------ SYN ------------------>|
    |<----- SYN-ACK ----------------|
    |------ ACK ------------------->|   TCP connected
    |------ TLS ClientHello ------->|
    |<----- TLS ServerHello, cert --|
    |------ TLS Finished ---------->|   TLS connected
    |------ first real app byte --->|
```

## QUIC: rebuilding TCP's good parts on UDP, without the bad parts

QUIC's whole premise is that TCP's job, reliable ordered delivery, and
TLS's job, encryption and authentication, are both worth keeping, but
bolting them together in the kernel and in series has baked in costs that
don't have to exist. So QUIC rebuilds both jobs from scratch, in userspace,
on top of UDP.

The headline feature is **multiple independent streams inside one
connection**. Where a single TCP connection is one ordered byte stream (so
one loss stalls everything), QUIC lets an application open many streams on
the same connection, and a lost packet on stream A only stalls stream A.
Stream B keeps flowing. There's no cross-stream head-of-line blocking,
because each stream keeps its own sequencing.

[FIG: no cross-stream head-of-line blocking in QUIC]
```
  TCP: one stream, one loss stalls everything behind it

    [A1][A2][A3][A4] ---- loss on A2 ----> A3, A4 wait for A2's resend

  QUIC: independent streams on one connection

    stream A: [A1][A2 LOST][A3][A4] --> A3, A4 keep delivering
    stream B: [B1][B2][B3]           --> unaffected by A's loss
```

QUIC also merges TLS 1.3 *into* the connection handshake instead of running
it afterward. This is the payoff of the stacked-handshake picture from the
TLS section: rather than TCP's round trip and then TLS 1.3's round trip in
series, QUIC fuses them, so a fresh connection is usable in one round trip
(1-RTT), and a connection resuming to a server you've talked to before can
send application data on the very first flight (0-RTT).

0-RTT is a sharp tool, not a free upgrade, and it's worth being careful
about. That early data is encrypted with a key derived from the *previous*
session, so it has no forward secrecy, and worse, it's replayable: a network
attacker who captures the 0-RTT flight can resend it, and the server has no
in-band way to know it's a replay. So 0-RTT must be restricted to requests
that are safe to run more than once (idempotent reads, not "charge this
card"), and it's opt-in for exactly that reason. Treat it as a performance
option you deliberately enable for replay-safe traffic, not a default you
get everywhere for free.

Separately, instead of identifying a connection by the classic 4-tuple
(source IP, source port, destination IP, destination port), QUIC
connections carry their own connection ID. Change networks mid-connection, walk from wifi onto
cellular and your IP changes, and the QUIC connection survives, because the
connection ID didn't change even though the 4-tuple did. TCP has no
equivalent; a 4-tuple change there is a dead connection.

QUIC also exposes an **unreliable DATAGRAM mode** (RFC 9221): a way to send
a message over the QUIC connection that explicitly opts out of QUIC's own
reliability and ordering, for applications that want the connection's
encryption and NAT-friendliness but not the stream guarantees. This mode
matters later in this post; it's exactly what filament's VPN layer uses
today, and it's a big part of the story.

None of this is free, and it's worth being precise about *what* costs the
CPU, because the easy answer is wrong. It is not the crypto: TLS crypto was
already running in userspace even in classic HTTPS-over-TCP, so QUIC didn't
move it anywhere. What moved into userspace is the **transport logic** that
used to be the kernel's job in TCP: packetization, ACK processing, loss
detection and recovery, congestion control, all of it now runs per-packet
in your process. On top of that, QUIC gets a weaker hardware-offload story:
the kernel and NIC can offload big chunks of TCP work (TSO/GSO/GRO,
coalescing many segments into one traversal of the stack), and QUIC-over-UDP
historically can't lean on those nearly as well, so it touches more per
packet in software. Userspace transport plus weaker offload, not crypto, is
where the CPU goes.

And because QUIC rides on UDP, it inherits every place a network treats UDP
worse than TCP. One vivid example, and I want to flag it clearly as *one
anecdotal measurement on one cloud link*, not a general law that UDP or QUIC
is inherently slower: on a link between two of my own cloud VMs, a plain
`iperf3` comparison showed raw TCP holding a flat 2.0 Gbps while raw UDP,
offered the same or more, delivered only about 1.3 Gbps, throttled by a rate
policer the provider applies to UDP specifically (UDP floods are how you
attack people, so it gets policed harder). QUIC, being UDP, sat right on
that same ceiling. That's not a QUIC defect and it's not a universal
constant; it's one provider's QoS/middlebox policy on one path. I chased
that particular number to the ground in a
[separate post](post.html?post=2026-07-24-saturating-any-link.md); the point
here is only that "QUIC is UDP" means QUIC inherits whatever a given network
decides to do to UDP, for better or worse.

## WebRTC: the browser detour

Everything above assumes your program can open a raw socket. Browser
JavaScript cannot, and that's deliberate, not an oversight. A web page is
untrusted stranger code that you nonetheless run inside your own network,
behind your own firewall, with your own IP. If that code could open
arbitrary sockets, it could port-scan and attack your LAN (your router,
your printer, your NAS, whatever IoT device is sitting there with default
credentials), turn your browser into a bot in someone else's DDoS or
reflection attack, impersonate you to services on your network, and bypass
same-origin and CORS protections that exist for exactly this reason. So the
browser sandbox permits only constrained, consented communication channels,
not raw sockets.

[FIG: browsers cannot open raw sockets]
```
  a web page is untrusted code running INSIDE your firewall

     browser JS  --X-->  raw TCP/UDP socket   (blocked by the sandbox)

     browser JS  ---->  WebSocket             (needs a server that opts in)
     browser JS  ---->  WebRTC DataChannel     (needs peer consent via ICE)
```

The first escape hatch is the **WebSocket**. HTTP is fundamentally
request-response: the client asks, the server answers, and the server
cannot push data on its own initiative. A WebSocket starts life as a
normal HTTP request with an `Upgrade: websocket` header; if the server
agrees, it replies `101 Switching Protocols`, and from that point the same
underlying TCP connection carries a persistent, bidirectional, message-
framed channel instead of HTTP request/response pairs. Because it's still
riding TCP underneath, it inherits TCP's ordering and head-of-line
blocking, and it's inherently client-server: your browser talks to a
server it opened a connection to, not directly to another browser.

The second escape hatch, and the interesting one for anything that wants
two browsers to talk to each other directly, is **WebRTC**, specifically
its DataChannel. Where a WebSocket is client-server over TCP, a DataChannel
is peer-to-peer. Its data stack is **SCTP over DTLS over UDP**, and off to
the side, not stacked in that tower, sits **ICE**, which is the process that
decides *which UDP path* the tower runs on. Getting that relationship right
matters:

- **ICE** (with **STUN** and **TURN**) is not a protocol layer that SCTP
  runs "over." It's the connectivity-establishment process: each side
  gathers candidate addresses (STUN helps a peer discover its own public
  address as seen from outside its NAT; TURN provides a relay candidate for
  when no direct path exists), then the two sides probe pairs of candidates
  to find one that actually carries packets both ways, and validate it. Once
  ICE has picked and validated a working UDP path, it largely gets out of
  the way; the DTLS and SCTP layers then run over that chosen UDP flow.
- **DTLS** is TLS adapted for unreliable, packet-based transport: the
  relationship of DTLS to UDP is the same as the relationship of TLS to
  TCP. Since DTLS can't rely on the transport to deliver its handshake
  messages in order or at all, it adds its own record sequence numbers and
  its own handshake retransmission logic on top.
- **SCTP** is the transport doing the actual message delivery: TCP-like
  reliability, but, like QUIC, with multiple independent streams so one
  stream's loss doesn't block another. It's message-oriented rather than
  byte-stream-oriented, and reliability is tunable per message: you can
  ask for best-effort, partial reliability, or full reliability, per
  message, on the same channel.

[FIG: WebRTC's DataChannel: a stack, plus ICE choosing the path]
```
  application message                    ICE (connectivity process,
        |                                 NOT a stack layer):
        v                                  gather candidates (STUN/TURN),
   SCTP   (multi-stream, tunable    <----  probe + validate pairs,
        |  reliability)                    hand the winning UDP path
        v                                  to the stack, then step aside
   DTLS   (TLS-for-datagrams)
        |
        v
   UDP    (the single path ICE selected carries all of it)
```

This is filament's browser fallback: the path that always connects,
because it doesn't require any special network cooperation beyond what ICE
can negotiate. It is not QUIC, and in practice it's meaningfully slower:
the WebRTC DataChannel tends to top out somewhere around 5 to 10 MB/s. One
caveat worth stating so it doesn't get miscopied, though: that ceiling is
an implementation-and-tuning artifact, not a law of SCTP. It comes from the
browsers' bundled `usrsctp` defaults (buffer sizes, and behavior that
degrades with RTT), not from anything inherent in the protocol. A
non-browser SCTP path with tuned buffers can go substantially faster, so
don't design around 5 to 10 MB/s as if it were a hard SCTP limit.

## The different problem: a VPN moves a whole machine, not one app's stream

Everything so far has been about one application's data reaching another
application. A VPN is answering a different question entirely: how does a
whole *machine's* outgoing IP traffic, from every application on it,
transparently reach another machine, as if the two were on the same local
network? That's a layer 3 problem (moving IP packets), not a layer 4 or 7
problem (moving one app's stream or messages).

The kernel building block for this is a **TUN device**, and it's worth
being precise about what it actually is, because it's easy to hand-wave.
A TUN device is a fake network interface: to the rest of the kernel it
looks exactly like a real NIC, something the routing table can send
packets to. But nothing is plugged into it. It's a queue, sitting entirely
in software, with one end wired into the kernel's normal IP routing and
the other end exposed to a userspace program as a file descriptor you
`read()` and `write()` raw IP packets from and to. When the kernel's
routing table decides a packet belongs out through `tun0`, it doesn't go
to any hardware; it lands in that queue, and your userspace VPN program
reads it out as a raw IP packet.

[FIG: the TUN device, a fake NIC that only your program sees]
```
  normal app  --syscall-->  kernel routing table
                                    |
                        route says "out via tun0"
                                    v
                              +-----------+
                              | TUN queue |   <-- not hardware, just a
                              +-----------+       kernel<->userspace queue
                                    |
                                    v
                        your userspace VPN program
                             read()s a raw IP packet
```

So what does your userspace program actually do with that raw IP packet,
and does the "fake" card secretly use the real one? Yes, and this is where
the whole picture comes together. Your VPN program takes the inner IP
packet it just read from the TUN, encrypts it, and wraps it as the
**payload** of an entirely ordinary outer packet addressed to the peer
machine's real public IP. It sends that outer packet through a completely
normal socket, out the machine's real NIC, over the real internet. Every
router along the way only ever looks at the outer header; the inner packet
is opaque encrypted cargo to them, no different from any other UDP payload.
On the receiving machine, the real NIC receives the outer packet, the
kernel hands it to the userspace VPN program (because it's addressed to
that program's socket), the program decrypts and unwraps it, and writes
the *inner* packet into its own TUN device. The receiving kernel then
routes that inner packet exactly as if it had arrived on a real interface,
and delivers it to whatever application was actually waiting for it. The
fake card never touches hardware directly; it rides on top of the real
card, with a userspace detour in between where the encryption and
re-addressing happen.

[FIG: the packet's real trip, machine to machine]
```
  machine A                                       machine B

  app A writes IP packet
        |
        v
  kernel routes it -> tun0 (fake NIC)
        |
        v
  VPN program reads inner packet
  encrypts it, wraps it as PAYLOAD
  of an outer packet addressed to
  B's real public IP
        |
        v
  real socket -> real NIC ---------- real wire ----------> real NIC
                                                                |
                                                                v
                                                     kernel hands outer
                                                     packet to VPN program
                                                                |
                                                                v
                                                     decrypt, unwrap,
                                                     write INNER packet
                                                     into B's tun0
                                                                |
                                                                v
                                                     kernel routes inner
                                                     packet to app B
```

There's a sharp practical consequence of that wrapping, and it's one of the
most common ways a real VPN quietly breaks. The outer packet is the inner
packet *plus* the encryption and outer headers, so it is bigger. But the
physical NIC still has its same MTU (that ~1500-byte number from way back at
the start). If the inner app hands the TUN a full 1500-byte packet, the
wrapped outer packet is over 1500 and no longer fits on the wire. Now one of
two bad things happens. Either the outer packet gets fragmented, which is
slow and increasingly dropped by modern networks, or, if the packet has the
"don't fragment" (DF) bit set, which most TCP traffic does today, the
oversized packet simply gets discarded somewhere along the path and
*vanishes silently*: no error the app can see, just a connection that
mysteriously stalls on large transfers while small packets sail through. The
fix is to set the overlay (TUN) MTU *below* the physical MTU, low enough
that the inner packet plus all the tunnel overhead still fits in one
physical frame. This is why WireGuard defaults its interface MTU to 1420 and
overlay networks commonly sit around 1280: they're leaving headroom for the
encapsulation. Get this wrong and you get the single most confusing VPN bug
there is, where ping works, SSH login works, and then a large paste or a
file copy hangs forever.

[FIG: why the overlay MTU must be smaller than the physical MTU]
```
  inner packet from the app (fills the app's view of the MTU):

    [ inner IP packet ....................... 1500 bytes ]

  after the VPN wraps it (encrypt + outer UDP/IP headers):

    [ outer hdr ][ inner packet + crypto ............... > 1500 ]
                                                          ^^^^^
                            too big for a 1500-byte physical frame

  with DF set, this doesn't fragment, it just DISAPPEARS.

  fix: set the TUN MTU low (e.g. 1420) so inner + overhead <= 1500:

    [ outer hdr ][ inner packet (<=1420) + crypto ] <= 1500  OK
```

One more design fact about VPNs matters, and it's easy to get backwards:
the tunnel itself should be **best-effort**, never reliable. That sounds
wrong at first, given that "VPN" implies "your traffic gets there," but
think about what's inside the tunnel. If the application inside is TCP,
that TCP connection already has its own retransmission logic, running on
its own timers, tuned to its own view of the path. Wrap that TCP stream
inside *another* reliable stream, and you get two independent
retransmission systems, unaware of each other, each reacting to loss on
its own schedule. This is the classic "TCP-over-TCP meltdown": a loss on
the outer stream stalls the inner stream's delivery, the inner stream's
own timers expire and it retransmits data the outer stream is still
patiently waiting to redeliver, and the two systems compound each other's
latency instead of cooperating. The fix is structural, not tunable: a VPN
tunnel should carry datagrams, and let whatever's actually inside the
tunnel be the one thing responsible for its own reliability.

## WireGuard: the minimal in-kernel packet tunnel

WireGuard is what you get if you take the VPN problem above and refuse to
add anything to it beyond what's strictly necessary. Per packet, the job
is: take the packet from the TUN, encrypt it, wrap it in exactly one UDP
datagram, send it. The peer decrypts it and injects the plaintext into its
own TUN. That's the entire hot path.

[FIG: WireGuard's per-packet path]
```
  TUN  --read pkt-->  encrypt (Noise session key)  --wrap in 1 UDP dgram-->
    wire  --> peer: decrypt  --write pkt-->  peer's TUN
```

The crypto is fixed, not negotiated: Curve25519 for the key exchange,
ChaCha20-Poly1305 for authenticated encryption, BLAKE2s for hashing. The
handshake that sets up the session key is built on the **Noise Protocol
Framework**, and it's worth actually working through why, because "we used
Noise" undersells what problem it's solving.

Start from the underlying problem: two parties on a public, observed wire
need to agree on a secret that an eavesdropper watching every message they
exchange cannot derive. Diffie-Hellman is the classical answer. Each side
generates a keypair. They swap their *public* keys in the clear, over the
wire an attacker is watching. Each side then combines its own private key
with the other side's public key, and by the math (this relies on a
problem that's easy to compute one direction and hard to invert), both
sides land on the exact same shared secret, while an attacker holding only
the two public keys cannot feasibly derive it.

[FIG: Diffie-Hellman, same secret from swapped public keys]
```
  Alice: private a, public A = g^a         Bob: private b, public B = g^b

     Alice ---------- sends A (public) ------------> Bob
     Alice <--------- sends B (public) -------------- Bob
        (an eavesdropper sees A and B, nothing else)

  Alice computes  B^a = g^(ba)             Bob computes  A^b = g^(ab)
              same secret S = g^(ab), the eavesdropper cannot derive it
              from A and B alone
```

Plain Diffie-Hellman has two gaps a thinking attacker will find immediately.
First, **authentication**: nothing above proves you just did DH with the
peer you meant to; an attacker who can sit in the middle can run DH
separately with each side and relay, a classic man-in-the-middle, unless
you mix in something that proves identity, like a long-term static key
each side already trusts. Second, **forward secrecy**: if you only ever
use long-term static keys for the DH, then stealing those keys in the
future lets an attacker decrypt every past session they recorded. The fix
is to mix in a fresh, ephemeral keypair generated for that session alone,
so a future key compromise can't reach backward into traffic already
gone.

Noise is a *framework* of handshake **patterns**, named things like IK and
XX, that each choreograph exactly which static and ephemeral keys get sent,
and in what order they get Diffie-Hellman-mixed together, to deliver a
specific, well-understood authentication and forward-secrecy profile. It's
important to be precise about what Noise is and isn't here, because it's
easy to over-credit it. Noise itself is a menu, many patterns, and some
Noise-based protocols *do* negotiate which one to use. The
"no negotiation, no downgrade attacks" property is not a property of Noise
generically; it's a choice **WireGuard** makes on top of Noise. WireGuard
hardcodes, at compile time, exactly one pattern and one set of primitives
and offers no alternatives: **Noise_IKpsk2** with Curve25519,
ChaCha20-Poly1305, and BLAKE2s, full stop. There's no cipher-suite list to
advertise, no version to negotiate, so there's nothing for a
downgrade attack to bite on, because negotiation is exactly the surface
those attacks exploit. That rigidity is WireGuard's security feature, not a
limitation someone forgot to lift, and not something Noise handed it for
free.

One clarification the section title glosses, and it matters for the
comparison at the end of this post: "in-kernel" is specifically the *Linux*
story. WireGuard on Linux is a kernel module, and that's where the
headline throughput numbers come from. On macOS, Windows, iOS, and Android,
the common implementation is `wireguard-go` (or a similar userspace
implementation), running in userspace exactly like the VPN program in the
TUN section, with Windows using WireGuard's `Wintun` driver for the TUN half
but still doing crypto in userspace. So "kernel-speed WireGuard" means
"kernel WireGuard on Linux" specifically. When I compare filament's
throughput to WireGuard's later, that Linux in-kernel implementation is the
baseline I mean, not userspace `wireguard-go`, which is much closer to
filament's own architecture.

Everything above is what WireGuard does. What it deliberately does *not*
do is just as important: no NAT traversal, no peer discovery, no relay
when a direct path doesn't exist, no fallback if UDP itself is blocked,
and it needs `CAP_NET_ADMIN` to create the TUN device in the first place.
That's not an oversight either; it's the same minimalism that makes the
crypto core small and auditable, applied consistently. It's exactly why
tools like Tailscale, and filament, exist on top of it: WireGuard is a
data plane. Finding the peer, getting through the NAT, and falling back
when the network is hostile is a separate job, the *network*, and it's
the job those tools actually do.

The instinct, once you've followed the Noise handshake this closely, is to
want to improve it: add your own multiplexing into the handshake, bake NAT
traversal into the crypto layer, tune the cipher choice per link. That
instinct is right in spirit and wrong in target. The place to build is the
layer *around* the crypto, never the crypto core itself; a crypto
protocol's value is precisely that it's small, fixed, and has been stared
at by people whose job is to find flaws in exactly this kind of thing, and
hand-rolled changes to that core are where careful engineers reliably go
wrong in ways that don't show up until it's too late. Borrow the Noise core
and the data plane untouched. Innovate one layer up: NAT traversal,
discovery, relay, path selection, a UDP-over-TCP shim for hostile networks,
multi-path, identity. That division of labor is the actual strategy.

## The two axes that explain the whole zoo

Every protocol in this post sorts cleanly onto two axes. The first is
*what* is being carried: one application's data (app talks to app) or a
whole machine's packets (machine talks to machine). The second is *how
much is promised*: best-effort or reliable. Be careful with the vocabulary
in the top-left, though: UDP is not a "stream." It's the best-effort
*datagram* (message) primitive. TCP is the reliable *stream*. Lumping them
together as "streams" is exactly the confusion this chart is meant to clear
up.

[FIG: the two axes]
```
                    APP <-> APP                MACHINE <-> MACHINE
                    (one app's data)           (a whole machine's packets)

  BEST-EFFORT       UDP                        WireGuard
                     = the datagram (message)   (best-effort by design;
                       primitive; you build      the inner protocol owns
                       reliability yourself,     reliability)
                       or don't

  RELIABLE          TCP (the reliable stream);  the box you almost never
                    QUIC, WebRTC (reliable       want: reliable-over-reliable
                    multi-stream)                is TCP-over-TCP meltdown
```

QUIC and WebRTC both add a wrinkle worth naming inside that bottom-left
cell: QUIC is reliable-by-default per stream but also exposes an explicit
best-effort DATAGRAM mode, and SCTP inside WebRTC lets you dial reliability
per message. Both are still fundamentally app-to-app transports, though;
neither is built to carry a whole machine's IP traffic. WireGuard is the
only thing on this chart built specifically for the machine-to-machine,
best-effort job, moving one machine's packets to another, because the inner
protocol already handles reliability if it needs it. A reliable machine
tunnel (the empty bottom-right box) is a thing you *can* build, and it's
very nearly always a mistake to.

## What filament's VPN layer actually does today, and why

This is where the gap I opened with comes from. `filament up` gives a
machine a real kernel network device, `filament0`, created the normal TUN
way, `IFF_TUN | IFF_NO_PI`, wired into routing with iproute2 like any other
interface. That part is genuinely kernel, and it gives filament real
routing, the host firewall, and MagicDNS-style names for free.

The data plane behind that device is not kernel WireGuard, though. It's a
userspace loop built on QUIC's unreliable DATAGRAM mode, the one mentioned
earlier in the QUIC section. Per packet: read one packet off the TUN, look
up the destination, hand it to `conn.send_datagram()` as an unreliable QUIC
DATAGRAM over the connection's UDP socket, and on the peer, read it back
off with `read_datagram()` and write it into that peer's TUN. The crypto
protecting it is QUIC's TLS 1.3, running in userspace.

Held up against the two-axis chart above, this is architecturally sound in
category: it's a best-effort packet tunnel, which is the right box.
Held up against *WireGuard specifically*, doing the same job, it's
missing every optimization that makes a kernel packet tunnel fast: no
batching (one syscall per packet, no `sendmmsg`/`recvmmsg`), no GSO/GRO
offload, a fresh allocation and copy for every single packet, and one task
pumping the TUN for the entire node, so it never uses more than one core no
matter how much traffic is in flight. It's userspace-WireGuard-class
architecture without the optimizations that userspace WireGuard
implementations themselves added over the years to compensate for not
being in the kernel. That's the order-of-magnitude gap.

It's worth being fair about why it was built this way, because it wasn't
carelessness. Filament's L3 datagrams ride the *same* authenticated QUIC
connection that already did the NAT punch-through and completed the key
exchange for that peer. That's genuinely convenient: the VPN plane
inherits all of filament's connectivity and identity work for free, over
one connection filament already had open for other reasons. WireGuard
would need a second, independent UDP flow, with its own NAT hole-punching
and its own static-key trust model layered in separately. The code reuse
was real. The cost turned out to be an order-of-magnitude throughput hit,
and a hand-rolled data plane that filament, not an audited crypto library,
is responsible for securing.

## The decision: borrow WireGuard, keep filament as the network around it

First, a caveat I want to state up front, not bury: this is a *proposed*
direction, written up as an architecture decision record, not something
already shipped in filament. The current data plane is still the
QUIC-datagram loop described above. What follows is the plan and the
reasoning behind it, not a description of running code.

With that said: once the two-axis picture is in your head, the fix isn't
really about performance tuning, it's about recognizing that the job in the
best-effort machine-to-machine cell (top-right of that chart) already has an
answer that's faster, smaller, and more thoroughly audited than anything
worth building from scratch: WireGuard. So the proposed plan is to adopt
WireGuard as filament's data plane (kernel WireGuard on Linux where the
process has `CAP_NET_ADMIN` and a UDP path exists; a userspace WireGuard
implementation otherwise, which is still meaningfully faster than the
single-threaded QUIC-datagram loop it replaces), and keep filament doing
exactly what WireGuard was never trying to do: find the peer, get through
the NAT, relay when direct doesn't work, and pick a path that survives a
UDP-hostile network.

The two layers stay separate, deliberately. Filament's control plane keeps
owning identity, discovery, NAT traversal, relay selection, and choosing
*which underlay path* to use, direct UDP when it's clean, a UDP-over-TCP or
relay shim when UDP is blocked or policed, WebRTC for the browser case
where nothing kernel-level is even possible. WireGuard then rides on top of
whichever path that selection lands on; it stops being a second competing
tunnel and becomes the encrypted packet layer sitting on the path filament
already chose. The identity handoff happens over filament's existing
authenticated control channel: the key exchange filament already does gets
used to install a session key into WireGuard, so filament still owns who
you are and who you're talking to, and WireGuard just gets told which keys
to use for the bytes.

[FIG: the decision, filament as the network around a borrowed data plane]
```
  filament control plane (stays filament's job):
    identity, discovery, NAT traversal/holepunch, relay selection,
    path selection (direct UDP / TCP shim / WebRTC)
                            |
                            v   selects an underlay path, installs keys
  +------------------+  +------------------+  +------------------+
  | direct UDP        |  | UDP-over-TCP or  |  | WebRTC (browser,  |
  | (clean case)       |  | relay (UDP       |  |  or no-admin      |
  |                    |  |  blocked/policed)|  |  fallback)        |
  +------------------+  +------------------+  +------------------+
                            |
                            v   WireGuard rides on top of the chosen path
  +-----------------------------------------------------------+
  | L3 data plane = WireGuard (kernel when possible, userspace  |
  | otherwise). Encrypted IP tunnel. Borrowed, not homegrown.    |
  | (the old QUIC-datagram plane survives only as the browser/   |
  |  migration bridge, since browsers can't run WireGuard at all)|
  +-----------------------------------------------------------+
```

The costs are real and worth stating plainly, not smoothing over. This adds
a WireGuard dependency (kernel where present, plus a userspace
implementation for the no-admin case), which cuts against keeping the
codebase dependency-light. There's real work in mapping filament's
Ed25519-and-PAKE identity model onto WireGuard's static Curve25519 keypair
model. There will be two crypto stacks running side by side during
migration, WireGuard's Noise core for the new default path and the
retained QUIC/TLS 1.3 stack for the browser bridge. And WireGuard is
UDP-only and will not fall back on its own if UDP is blocked or policed, so
we still need a UDP-over-TCP shim as one of the underlay paths, making sure
the WireGuard tunnel (the best-effort machine-to-machine box, top-right of
the chart) still has a path to ride on when the network punishes UDP.

And the one part of the old plane that isn't going away: a browser cannot
run WireGuard, full stop, the same sandbox constraints from the WebRTC
section apply here too. So the WebRTC/QUIC bridge stays, permanently, as
the answer for that one case, not as the default anymore.

## What I'm left with

The honest version of this story isn't "WireGuard is better code than what
we wrote." It's narrower and, I think, more useful than that: the
best-effort machine-to-machine cell of that two-axis chart (top-right)
already has a small, fixed, thoroughly audited answer, and re-deriving its
optimizations ourselves, batching, offload, zero-copy, multicore, in code
we alone would be responsible for auditing, is a multi-month project whose
entire output is a worse copy of something that already exists and is
free to use. Filament's actual job was never to move bytes the fastest way
physically possible. It's to find the peer behind two different NATs, pick
a path that survives whatever that network does to UDP, and fall back
cleanly when it can't. That's the part WireGuard explicitly refuses to do,
and it's the part actually worth building. Handing the data plane to
WireGuard isn't giving up the interesting problem. It's finally putting
the interesting problem, and the boring one, in the two different places
they each belong.

This decision is proposed, not shipped; the phasing is still a sketch. But
the gap I started with, an order of magnitude, sitting in code doing
exactly the job a smaller and better-tested piece of software already
does, was never going to close by tuning the code we had. It was going to
close by admitting which box we were actually building for, and reaching
for the tool built for that box.
