# Tasks

## 1. Join sessions to changes

- [x] 1.1 Read recorded sessions for this project, extracting per-session start and end timestamps and the branch each ran on
- [x] 1.2 Read archived changes and their archive commits, deriving a time window per change
- [x] 1.3 Attribute sessions to changes by overlapping window and branch, leaving unattributable sessions out rather than forcing them onto a neighbour

## 2. Produce the table

- [x] 2.1 Sum elapsed wall-clock per change and print one row per change — change, attributed sessions, hours — for review before any aggregation is trusted
- [x] 2.2 Take a Size Tier per change from the maintainer, then print a `flows` block with the median hours per tier, ready to paste into `.spego/config.yaml`
- [x] 2.3 Print the coverage caveats with the output: the earliest session date, the count of changes with no attributable session, and any change whose sessions were split across days

## 3. Keep it out of the package

- [x] 3.1 Place the script under `scripts/` and confirm `npm pack` contents are unchanged
- [x] 3.2 Add the README paragraph on where the first seed comes from and why the script is scaffolding
