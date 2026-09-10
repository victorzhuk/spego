# Design

## The reference is the seed

A bias needs a fixed reference to be a measurement. The current reference moves with the thing it measures: for an evidenced pair it is the median of the very runs in the ratio, so the answer is 1 by construction, and for a thin pair it is the seed. One quantity therefore means two different things depending on how much evidence exists, and only the less trustworthy meaning is ever surfaced.

The seed is the right reference for both. It is declared, it does not move when a run is recorded, and it is the number a maintainer would change in response to the warning. Bias then reads as one sentence: recorded runs came in this much above or below the profile this workspace declared.

The clamped correction keeps its current scope — prices that did not come from this workspace's runs. Those are exactly the pairs below the sample threshold, where the reference was already the seed, so no price changes. This is a change in what is reported and warned, not in what anything costs.

## Evidence gates the warning, not the measurement

Bias stays derived and reported for any pair with at least one run: a maintainer looking at a thin pair still wants to see the drift the correction is applying. Only the warning waits for the sample threshold, because only the warning asks for a judgment — and one or two runs cannot distinguish a stale seed from a mis-tiered change or a single bad afternoon.

The threshold is the one the ladder already uses. A second, separate threshold for warnings would be a second number two boards could disagree about, and it would decouple "enough evidence to price from" from "enough evidence to argue with", which are the same question.

## Consequences on an existing board

Pairs that used to warn on one or two runs go quiet. Pairs with enough runs start reporting real drift and will warn when a seed is genuinely wrong — which is the point, and which may surface warnings on boards that have been silent. That is a discovery, not a regression: those seeds have been wrong for as long as the evidence has existed.

A run recorded against a retired epic still counts, and its tier judgment is still frozen. This change does not make that judgment editable; it makes a pair of frozen runs stop demanding one.

## Rejected alternatives

- **Exclude retired epics from the run buckets.** It would silence the case that prompted this change, and destroy most of the evidence with it: a change is retired shortly after it is delivered, so nearly every run a mature board owns is attached to a retired epic.
- **Let a bias derived from one run keep warning, and make retired epics editable again.** Editable retired artifacts is a much larger contract change, and it would still leave the warning unable to fire for well-evidenced pairs.
- **Warn from a count of runs on the wrong side of the band rather than the median ratio.** More sensitive to a genuinely drifted seed, but it introduces a second statistic with its own threshold and its own explanation, for a warning whose whole job is to be legible.
