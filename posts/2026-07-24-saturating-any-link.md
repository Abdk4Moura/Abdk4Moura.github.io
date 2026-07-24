---
title: Saturating any link, and why one transport is never enough
date: 2026-07-24
summary: A transfer that should have been fast was not. Chasing why led through a mislabeled transport, a 15x fix, a multi-connection dead end, a hidden cloud policer that throttles UDP, and finally a generalisation: pick the transport with a no-regret learner and you can prove you converge on the best the link can give.
---

The [last post](post.html?post=webrtc-file-transfer-failures.md) was about making
Filament transfers *reliable*. This one is about making them *fast*, and it turned
into a longer road than I expected, because "fast" is not a property of the code.
It is a property of the code, the transport, and the network, in that order of how
much they surprised me.

It starts with a number that felt wrong. A one-time-code transfer between two of
my servers ran at about 5 MB/s. These are boxes in the same datacenter. 5 MB/s is
what you get over a bad hotel connection, not over a datacenter fabric. So: why.

## The transport I did not know I was using

Filament can move bytes over several transports: a WebRTC DataChannel, a direct
QUIC connection, a relay, and on the same host a plain local socket. The direct
QUIC path is the fast one. The DataChannel is the fallback that always connects.

Profiling the slow transfer, the transport layer itself clocked over 1 GB/s in a
unit test. So the wire was not the problem. The bytes were crawling because of the
*protocol stack around* the wire. I chased per-frame allocations, a memcpy per
chunk, a flush per chunk, and cleaned all of them up. It barely moved.

Then I looked at what the transfer was actually *riding*, and there it was: a
first-contact code transfer was going over the **WebRTC DataChannel**, not QUIC.
The DataChannel runs over SCTP over DTLS, and its flow control caps out around
5 to 10 MB/s. The fast QUIC transport existed, worked, and hit hundreds of MB/s,
but the code-transfer path never even *tried* it.

The reason was subtle and a little embarrassing. Direct QUIC needs the shared
secret to authenticate the connection. For a paired device that secret is on disk.
For a one-time code it only exists *after* the PAKE handshake completes, and the
code path never went back to start the direct connection once it had the secret.
So it silently stayed on the slow transport. The fix was to kick off the direct
attempt the moment the handshake produces the secret, race it against the
DataChannel, and hand the transfer to whichever wins. First-contact transfers went
from 5 MB/s to well over a hundred. A 15 to 30x jump for the most common thing a
user does, and it had been hiding behind a mislabeled default the whole time.

I also found, on the way, a genuine data-corruption bug: two concurrent chunks
could reserve the same file offset and overwrite each other, silently corrupting
any transfer over about 50 MB. That one is worth the whole exercise on its own.

## Testing on real machines, because loopback lies

Everything above I could see on loopback. But loopback is a liar for throughput
work: there is no real network, no loss, no latency, and both ends share one
machine's CPU and memory bandwidth. So I moved to two real servers and measured
across the actual link.

The direct-QUIC transfer held up: reliable, integrity-clean, and around 160 MB/s.
Better than the old 5, but nowhere near saturating a datacenter link. So I did the
obvious thing: if one QUIC connection tops out on one CPU core, open several and
stripe the file across them.

It did not work. Two connections gave the same throughput as one. Four, the same.
I checked the obvious culprits: not a shared lock (each connection had its own
send stream), not the disk (writing into a RAM disk gave the same number), and the
CPUs sat at 65 percent, never saturated. Multiple connections were not adding
throughput, and no profiling of *my* code explained why.

## The measurement I should have taken first

I had been optimising filament against a ceiling I never measured. So I measured
the link itself with `iperf3`, and the whole story rearranged itself:

- Raw TCP, one stream or eight streams: a flat **2.0 Gbps**, with tens of
  thousands of retransmits. Parallel streams did not aggregate. That flat line
  with heavy loss is the signature of a **rate policer**, a cap the cloud puts on
  the VM.
- Raw UDP, paced anywhere from 1.8 to 2.5 Gbps offered: only **1.0 to 1.3 Gbps
  delivered**, with 3 to 8 percent loss.

There it was. On the exact same link, TCP gets 2 Gbps and UDP gets 1.3. A clean
1.7x penalty on UDP. Cloud networks commonly deprioritise or rate-limit UDP,
because UDP floods are how you attack people. And Filament's fast transport is
QUIC, which is UDP. So filament at ~1.3 Gbps was not leaving throughput on the
table. It was already **sitting on the UDP ceiling**. No congestion-control tweak,
no bigger chunks, no extra connections were ever going to beat a rate cap that the
network applies before my packets even arrive. Multiple connections could not
aggregate past 2 Gbps for the same reason eight TCP streams could not: the policer
is on the VM, not the flow.

This is the part I want to be honest about. I spent real effort on multi-stream
and multi-connection striping, and the correct answer was that they were the wrong
tool for this link, and I could have known that an hour earlier by running one
`iperf3`. Measure the ceiling before you optimise against it.

## The actual lever, and why it generalises

If UDP is capped at 1.3 and TCP gets 2.0 on this link, the way to go faster is not
to tune QUIC. It is to *use TCP*. Filament's direct path is QUIC-only today, so the
concrete fix is a **direct-TCP transport**: TCP hole-punch using the same candidate
exchange, then run the existing frame and auth layer over the socket. The bridge is
already generic over any `AsyncRead + AsyncWrite`, so it drops in.

But sitting under that concrete fix is a bigger truth that the whole saga kept
pointing at: **no single transport is best on every link.**

- UDP-throttled link, TCP wins.
- Restrictive NAT, only QUIC or relay connect at all.
- Same host, a local socket dwarfs both.
- Genuinely independent paths, striping wins; a shared bottleneck, it does not.

And the best choice is not known ahead of time and drifts over the life of a
connection. So the right design is not a pile of if-statements. It is a
**portfolio of transports** and a rule for choosing among them that you can
*prove* is close to optimal.

Frame it as an online decision. Each transport is an arm with an unknown,
time-varying goodput. Measure each arm from the live transfer, and route bytes with
a no-regret selector (EXP3, or a sliding-window UCB). The guarantee that buys you is
the one I actually wanted this whole time:

> average throughput  >=  (best arm's average)  -  O( sqrt( K log K / T ) )

The regret term vanishes as the transfer grows. In words: for any link, filament
converges to the throughput of the best transport available on it, within a bounded
and shrinking gap. For genuinely independent paths, the "arm" is a subset and the
same bound targets the *sum*, so striping is used exactly when a measured
independence test says it helps and never when it does not. That is what
"saturate any link" has to mean once you accept that the link, not the code, sets
the ceiling: not "always go 2 Gbps", which no transport can promise, but "always
pick the transport that gets closest to whatever this link will give, provably."

The honest bound matters too. This does not invent bandwidth. It cannot beat what
the best available transport physically delivers, and exploration has a cost, which
is exactly what the regret term quantifies. It *finds* the fast transport. It does
not conjure one.

## What I am left with

Three things, in increasing order of how long they will matter.

A mislabeled default was costing users 15 to 30x, and a corruption bug was eating
large transfers. Both fixed. That is the shippable win, and it is a big one.

A datacenter link that throttles UDP means QUIC is the wrong horse there, and a
direct-TCP transport is the fix. So I built it, as the first arm of the portfolio:
TCP hole-punch over the same candidate exchange, the existing frame and auth layer
over the socket. On the same link where QUIC sat pinned at 150 MB/s by the UDP
policer, direct-TCP runs at **275 MB/s**, integrity-clean, run after run. That is
2.2 Gbps: it does not just beat QUIC, it saturates the link's TCP capacity, the
number the policer had been hiding all along. One arm of the portfolio, and the
ceiling I had stared at for a day was gone.

And a debugging story that started at "why is this 5 MB/s" ended at a small theorem:
if you treat transport choice as a bandit over a measured portfolio, you can
*prove* you converge on the best the network will allow. The bug reports were about
speed. The answer turned out to be about *choice*, and about measuring before you
optimise. The full design lives in the repo as
[docs/design-adaptive-transport-portfolio.md](https://github.com/Abdk4Moura/filament/blob/main/docs/design-adaptive-transport-portfolio.md).
