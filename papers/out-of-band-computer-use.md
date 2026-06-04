---
title: Out-of-Band Computer Use: Operating Unmodified Machines Through the Human Interface
date: 2026-06-04
summary: Most computer-use agents drive a machine they are installed inside. I argue for an out-of-band body, HID for the hands and video for the eyes, that operates any unmodified machine the way a human would, and that the loss this entails is the very thing that makes it general. The figures here are live; the mathematics renders inline.
---

## Abstract

Every machine we have ever built quietly assumes that a human will sit in front of it. The keyboard,
the mouse, the screen: these are not incidental, they are the contract, and almost the whole of our
legacy software rests on the premise that some person will perceive its output and supply its input.
The present wave of *computer-use agents* wants to slide an artificial intelligence into that very
seat, to have it play the *multiplier on the human-input channel* that our systems have always assumed
a human would occupy. I hold that this is not a feature but a turn in the road, *human beings migrating
to a loftier memetic elevation, where they would have their computers operate other computers*, and
this paper looks at both the possibility and the impediments.

The possibility is real, and its mechanism is almost dull. The input a computer takes from its
peripherals can be *simulated*, which is, in a generalistic sense, exactly what the HID interface was
built to permit. From that one fact follows everything, because we can now *feed into machine
consumption what was authored for a human audience*: pixels meant for eyes, controls meant for hands. I
will argue that this channel is **lossy in nature**, and, against the instinct to treat that as a
wound, that the loss is the very thing that makes it general. An agent that works the surface as a
human works it does not need the machine's inner truth; it needs only enough of the surface to choose
its next act, and *it neither expects nor requires the whole of its input to return in its output*.
From there I draw an **out-of-band** body, HID for the hands and video for the eyes, that asks
*nothing* of the target, and so reaches the machines the in-band, sandboxed agents cannot touch at all:
the locked-down, the air-gapped, the regulated, the pre-boot, and the things that were never quite
computers. I describe a working, cross-platform system, set it beside the field as it stands, and name
the constraints that still bind.

---

## 1. The turn in the road

For fifty years the interface contract of computing has been a human one, and so total that we forget
to say it. Applications, operating systems, kiosks, terminals, the little control panels bolted to
industrial machines: every one of them was authored on the assumption that a person would stand in
front and drive it. Call it the *human-audience assumption*. It is the water the systems swim in.

Computer-use agents turn the assumption over. They do not ask a human to work the tool, they ask a
model to. Everyone is in this game now. The frontier labs have all shipped their version, and beneath
them a layer of infrastructure has formed to rent the agents a place to run. And yet, for all the
motion, the published competence is thin. On the standard benchmark the best agents finish only a
minority of ordinary tasks. The reading I take from this is simple: *the models are running ahead of
the means of execution.* We can decide; we cannot yet reliably *act*.

So the claim of this paper is that *computers operating computers* is the layer now coming into being,
and that the half of it which has gone under-examined is the **execution**: not what the agent ought to
do, but how the act actually lands on a real machine, out where the wires are.

I offer three things. First, a way of *seeing* the whole problem, as the *consumption, by a machine, of
an interface authored for a human audience*, with the argument that this consumption is **lossy by
design** and that the loss is a gift rather than a defect. Second, an **out-of-band** body, HID and
video, that works entirely through the human interface and so installs *nothing* on the target, and the
reach this buys. Third, a working system, and an honest accounting of what still gets in the way.

---

## 2. That it is possible

The possibility leans on a single fact about how machines are made. A computer does not, and cannot,
tell apart a key struck by a finger and a key handed to it as a HID report. Down at its input stack
they are one and the same event. The HID specification, the same on every operating system and alive in
firmware *before any operating system has even loaded*, exists for precisely this: to let some outside
thing speak the native tongue of a keyboard or a mouse. To synthesize input, then, is not to break the
machine. It is to use it as it was drawn.

And the mirror of it: the output can be *watched*. The video a machine throws to its display is a
faithful portrait of its state, and it is there at the cable no matter what software is, or is not,
running. Between the two, input we can simulate and output we can observe, sits the whole loop of
computer use, and it is an old and human loop: *see the surface, choose an act, deliver the act, see
again.*

Let me put that loop in symbols, because the whole argument hangs on what each step is allowed to
forget. Let $s_t$ be the true state of the machine at step $t$, which I never get to hold. My body
only ever receives an observation $o_t = C(s_t)$, where $C$ is the *capture*: a screenshot if I am let
in, a frame off the cable if I am not. A policy $\pi$ reads the observation and whatever context
$c_t$ I am allowed to carry, a goal, a region to attend to, a memory of where I just was, and chooses
the act $a_t$. The act lands, the world turns over, and I look again:

$$ o_t = C(s_t), \qquad a_t = \pi(o_t,\, c_t), \qquad s_{t+1} = T(s_t,\, a_t). $$

<div class="ap-fig" data-fig="loop" data-cap="<b>The loop, and only the loop.</b> See the surface, decide, act through the body, see again. Drag the pace and watch the token travel: the model, never the channel, sets how many acts land per minute. The body is deliberately dumb. All of the intelligence lives in one station."></div>

The novelty was never the loop. It is the *audience*. The surface we read and the controls we drive
were composed for a person, and what we are doing, this is the crux, is *feeding into machine
consumption what was meant for a human audience.* Everything generous about the method, and everything
it costs, falls out of that one inversion.

---

## 3. Lossy by design

The tempting thing is to hand the agent the machine's *inner* truth, the accessibility tree, the
document model, the window manager's geometry, so that it acts on facts and not on a picture. This is
the **in-band** posture, and where you can have it, it is precise. But you can only have it when the
target consents: when you may install your software, hold your permissions, and address a program
willing to expose its bones.

The **out-of-band** posture refuses that dependence, and pays for the refusal in fidelity. A model
reading pixels meant for human eyes recovers less than an API would simply tell it; the channel is
*lossy in nature*. I want to say exactly what that loss is, and why I do not mourn it. In the plain
language of information, the capture throws bits away,

$$ H(o_t) \,\ll\, H(s_t), $$

the frame carries far fewer bits than the machine's real state. The in-band instinct is to close that
gap. Mine is to ask a smaller question. The act I owe does not depend on all of $s_t$; it depends on a
thin, decision-relevant slice of it. Write $A^\star$ for the act a perfect operator would choose from
the true state. What I actually need the channel to carry is not the state, but the *act*, which is to
say I need

$$ I(o_t;\, A^\star) \;=\; I(s_t;\, A^\star). $$

The observation must hold all of the state's information *about the next act*, even while it discards
almost everything else. Put the other way: call two states equivalent, $s \sim s'$, when they call for
the same act, and the capture has only to keep the equivalence classes apart, never to reconstruct the
state inside them. A frame can lose nearly every pixel and still be *lossless in the only currency the
loop spends.* That is what I mean by lossy by design. I am not failing to recover the screen; I am
choosing the operating point where the rate is low and the part that decides the next act survives.

<div class="ap-fig" data-fig="lossy" data-cap="<b>Lossy by design.</b> Lower the information budget and the frame falls apart as a picture. The one act it must support, find the control and press it, survives long past the point where the image stops being legible. The ring marks where the agent would still aim. Pixel fidelity is not the currency the loop spends; the act is."></div>

Two things follow. First, the eyes need not be a black box. Rather than inferring blind over a raw
frame, perception can be *narrowed by a context element*, a goal, a region to attend to, a memory of
where we just were, so that the step returns *less, but the right less*. We are not after the most
information; we are after enough for the next act, or thereabout.

Second, and this is the lever for everything below: *fidelity is not the bottleneck.* If we never
wanted the whole input back, then whatever binds this system binds it somewhere else. It binds in the
*grounding*, in the *latency*, in the curious one-handedness of a channel that can only write, and not
in how much of the screen a model can reconstruct.

---

## 4. Where the body attaches

It helps to separate the agent's *brain*, the thing that sees and decides, from its *body*, the means
by which it sees and acts at all. And once separated, you notice the body can be joined to a target in
two ways that are different not in degree but in kind.

| | **In-band** (a sandbox, or installed software) | **Out-of-band** (this work) |
|---|---|---|
| Eyes | a screen-capture call, run *inside* the target | the display's own **video**, captured (HDMI to capture) |
| Hands | an input-injection call, run *inside* the target | **HID**: the target merely sees a keyboard and mouse |
| Installed on the target | required | *nothing* |
| Permissions on the target | required | *none* |
| Target OS must be up and willing | yes | *no*; it works at the BIOS, locked, even crashed |
| Reaches the things that aren't quite PCs (kiosks, HMIs, ATMs, TVs) | no | *yes* |

The out-of-band body is, said plainly, *an intelligence seated where a KVM sits*: the
keyboard/video/mouse position from which an operator has always run a server even with its operating
system dead on the floor. Where the in-band agent drives machines it was *let into*, the out-of-band
agent works any machine the way a person physically would, through the screen it shows and the ports it
leaves open.

Make the reach a statement about sets, because it is one. Let $M$ be the machines in the world. The
in-band body can touch only those it is allowed inside,

$$ R_{\text{in}} = \bigl\{\, m \in M : \text{you may install on } m,\ \text{hold permissions on } m,\ \text{and the OS of } m \text{ is up and willing} \,\bigr\}. $$

The out-of-band body asks for none of that. It needs a surface to watch and a port to speak into, and
nothing else,

$$ R_{\text{out}} = \bigl\{\, m \in M : m \text{ shows a display and accepts a human-interface device} \,\bigr\}. $$

Every machine in the first set is in the second, and the second holds strictly more,

$$ R_{\text{in}} \;\subseteq\; R_{\text{out}}. $$

The gap $R_{\text{out}} \setminus R_{\text{in}}$ is not a rounding error. It is the locked-down, the
air-gapped, the pre-boot, the regulated, and the things that were never quite computers, which is to
say *the population this whole paper is about*.

<div class="ap-fig" data-fig="reach" data-cap="<b>Reach is a claim about sets.</b> Flip the body. In-band lights only the machines you may install on and hold permissions over; out-of-band lights anything that shows a display and takes a keyboard. The second set contains the first, and the difference is exactly where the work in finance, health, government, and the plant floor actually lives."></div>

---

## 5. Seeing, deciding, and the act of grounding

The brain arranges itself in one of two ways, and the author puts the choice as a fork. Either a
*vision-understanding* model reads the frame and feeds its reading, as input, to a *language* model
that chooses the act, or a single, *end-to-end* multimodal model that sees and chooses in one breath.

Either way the decision has to be *grounded*. The affordance the model named, "the OK button," "the
field," has to become a real act on the surface, which is to say, most often, a coordinate. And here
the out-of-band body pays its fidelity tax in the open. The model speaks in *absolute* targets, a point
$p \in [0,1]^2$ on the normalized surface, while a mouse, the Bluetooth ones especially, will often
only move in *relative* steps. When I have an absolute pointer I send $p$ straight through. When I do
not, I pin to a known corner $q_0$ and walk in by the measured offset,

$$ \Delta = p - q_{\text{cur}}, $$

correcting as the next frame tells me where the cursor actually went, which folds the grounding error
back into the loop instead of trusting it once and hoping. And because the target cannot tell my
synthesized hand from a living one, the *manner* of the act can be made human, an eased and slightly
curved path $p(\tau)$, $\tau \in [0,1]$, with $p(0)$ the start and $p(1)$ the target, rather than a
teleport. That earns its keep twice: against systems that sniff for input too clean to be human, and
for the plain legibility of the agent to whoever is watching over it.

Then the act goes down the body of §4, the surface changes, a fresh look closes the loop, and we go
again.

---

## 6. What still gets in the way

Having made our peace with the loss, what is it that actually binds the thing? I will name the
constraints I take to be load-bearing, and you should tell me which of them you want to carry the
paper.

The first is *grounding*. Turning a lossy, human-surface glance into the *right* coordinate is the
dominant way these agents fail; it is most of why the benchmarks read low. Out-of-band takes that on
whole, and adds the small sins of its own capture, a little sampling error, a little scaling.

The second is the *one-handedness* of the channel. HID only writes; it reads nothing back. Every fact
about the world, including whether the last act even worked, has to come home through the eyes, which
makes the loop strictly observation-bound and makes every verification cost a fresh look.

The third is plainer: *time and money*. Each turn buys a fresh observation and a model call.
Out-of-band can shave some of it, because capture is continuous and cheap, but the per-act latency is,
in the end, the model's to spend.

The fourth is the deep one, and it is the one from §2 wearing different clothes. The surface was
*authored for a human audience.* A machine consuming it works one step removed from the system's real
intent, and no cleverness ever quite shuts that gap. It can only be made *acceptable*.

And the fifth is consent. A channel that drives any machine as a human would is also the channel an
adversary would dearly want; the threat model is the threat model of KVM-over-IP, no more and no less.
Because we work *out-of-band*, the target's own software cannot stand at the door and check us, so the
checking has to happen at the physical layer, or the organizational one.

---

## 7. A body I built

To keep the argument honest I built a working one.

The hands, for the in-band path, are a small cross-platform service that lays down synthesized input on
Linux (the kernel's `uinput`), Windows (`SendInput`), and macOS (`CGEvent`), and speaks a thin
line-of-JSON protocol: move-to, move, click, key, text, scroll. The Linux path I check end-to-end in
continuous integration, by reading the very events back off the kernel device. Windows I drove live;
macOS I proved over a network tunnel. The hands for the *out-of-band* path are a phone, or a small
dongle, presenting itself as an ordinary Bluetooth keyboard and mouse to a target that has had nothing
done to it. The eyes are pluggable: the target's own display when I am allowed in, or an HDMI capture
card for the true, no-software, *KVM-brain* arrangement.

The brain I kept deliberately loose. The execution layer cares nothing for which model decides. I drove
it from Anthropic's and Gemini's computer-use loops, and, to show the seam is clean, I exposed the acts
as Model-Context-Protocol *tools*, so that any agent that speaks MCP gains a body on a real machine,
with its own model and no second key.

---

## 8. How I would measure it

Three axes, of which the first is the one this paper is really about.

The honest measure is *reach*. Lay out the kinds of target: the cloud VM, the willing desktop app, the
managed and locked-down PC, the air-gapped box, the BIOS or recovery screen, the kiosk and the HMI and
the ATM, the television. Then mark, plainly, which an in-band agent can operate *at all* and which an
out-of-band one can. The thesis makes a flat prediction, the one drawn in §4: out-of-band strictly
dominates on reach, $R_{\text{in}} \subseteq R_{\text{out}}$, and pays for it in precision. The second
axis is *task success*: ordinary tasks run through the out-of-band body across the three desktops, read
against the in-band ceiling. And the third is *the price of the loss*: name the gap in numbers,

$$ \delta \;=\; \mathrm{succ}_{\text{in}} - \mathrm{succ}_{\text{out}}, $$

the same tasks done in-band with structure and out-of-band with only pixels, and the distance between
them is the toll the channel charges for asking *nothing* of the target. The whole bet of the paper is
that $\delta$ is small where it can be measured, and that it is bought back cheaply, while the reach it
unlocks is not available to the in-band way at any price.

---

## 9. Where it goes

A *talking* body. A live, streaming voice-and-vision interface does nothing for grounding, but it opens
a different door: a person narrating their intent aloud while the agent watches a live surface and
acts, over an out-of-band body, on a machine it has no foothold in. That is a striking thing to be able
to demonstrate.

A *hybrid* brain. Let a streaming model hold the plan and the awareness, and hand the precise
coordinate to a grounding step, a tuned model or a marked-up frame, and you buy the precision back
without surrendering the reach.

A *form*. The cleanest out-of-band body is one device: HDMI in for the eyes, a USB gadget that pretends
to be a keyboard and mouse for the hands, an *AI-KVM*. That is the shape the argument wants to take when
it becomes a thing you can hold.

And a *place to land*. The reach is worth most exactly where the in-band way is forbidden: in finance,
in healthcare, in government, on the floor of a plant. Which is to say, where the work actually is.

---

## 10. The neighbours

The frontier computer-use systems and the benchmark they are scored on; the purpose-built grounding
models; the open infrastructure for desktop agents; the cloud sandboxes and the browser farms; the new
OS-level sandboxes; and, older than all of it, the long lineage of robotic process automation that has
been poking at legacy desktops for years. The line I draw cuts across all of them, and it is not about
*which model*. It is about *where the body attaches*: inside the target, or out at the human interface
it was always assumed a human would hold.

---

## 11. In closing

The move from humans working computers to *computers working computers* asks for no new physics. It
asks only that we let a machine consume what we already make for human eyes and hands, and that we make
our peace with the loss that consuming entails. Done in-band, it is precise, and bounded to the
machines we are let inside. Done out-of-band, through the very seat the human was assumed to fill, it is
lossier, and unbounded in its reach, working any machine with a screen and a port the way a person
would. The loss, I have argued, is not the wound but the wing. The constraints that remain are real and
named, and a working body for the idea exists. The frontier is no longer *whether* one computer can
operate another. It is how cheaply, how exactly, and, the question that will decide who this is for, on
*which* machines.

---
