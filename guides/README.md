# Subject guide outlines

One file per subject. Paste the syllabus content section of the official IB
subject guide into it — the part that lists the topics and, under each, the
content or "understandings" statements. That is the part that becomes the
subtopic map.

What to paste:

  - the topic headings, in the guide's own numbering
  - every content / understanding / skill statement under each one
  - the HL extension sections, if the subject has them

What not to bother with: the introduction, assessment outline, TOK links,
command term glossary, or anything about internal assessment. None of it maps
to a subtopic and all of it makes the file longer to read.

Plain text is fine. Formatting, bullets and numbering do not matter — it only
has to be readable.

Then, per subject:

    node scripts/remap-syllabus.mjs --subject "Physics SL" --source guides/physics-sl.txt

That writes a proposal to `syllabus-proposals/` and touches nothing. Read it,
then apply it:

    node scripts/remap-syllabus.mjs --subject "Physics SL" --source guides/physics-sl.txt --apply

Applying only ever adds. Nothing is deleted, and any subtopic that already
carries questions, progress or flashcards keeps its exact name, so no existing
work is orphaned.

A note on where the outline comes from: work from the guide for the course you
are enrolled in, or from the subject brief the IBO publishes for it. Do not
take another study tool's subtopic breakdown — their arrangement is their work,
and it would also be built for their content rather than yours.
