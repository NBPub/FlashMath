# Design Choices and Background

This page explains how the practice cards decide what to show you, and why. It's meant for teachers, parents, students who are curious, and anyone thinking about borrowing the approach. Each choice links to the research behind it. Where that research is debated or weaker than it sounds, this page says so.

The research shaped a starting point, not a final answer. The rules and numbers below are open to change as the app gets real use, and suggestions are welcome through the repository's [Issues](https://github.com/NBPub/FlashMath/issues).

| Section | Contents |
|---|---|
| [Highlights](#highlights) | The approach in a few bullets |
| [Practice](#practice) | How facts, mastery levels and practice rounds work |
| [Reasoning](#reasoning) | Why each choice was made, and the research behind it |
| [App Exclusions](#app-exclusions) | What the app deliberately doesn't do |
| [Known Limitations](#known-limitations) | Current gaps and untested assumptions |
| [References](#references) | Full citations |

## Highlights

- You type the answer instead of flipping a card. Recalling something strengthens memory more than re-reading it.
- Each of the 78 facts has its own mastery level. Facts you know show up less often, and facts you miss come back soon.
- Most of each round is facts you already know, with a few new or shaky ones mixed in.
- Speed is measured quietly and compared with your own typing speed, not a fixed cutoff.
  - Speed is not necessarily important for many aspects of math proficiency, but is particularly useful for simple multiplication facts. Therefore, it is used as a measure of mastery here.
- When you miss a fact, you see the correct answer right away, and the fact comes back a few cards later.

## Practice

### Facts

3×7 and 7×3 are tracked as one fact, so the 12×12 table has 78 facts rather than 144. Each time a card appears, the order is picked at random, so both forms get practice.

A fact belongs to both of its numbers: 3×7 is in "the 3s" and in "the 7s". If you choose several numbers, any fact that uses at least one of them is included.

The suggested groups follow a common teaching order. The easiest "anchor" facts come first:

| Group | Numbers |
|---|---|
| Starter | 1, 2, 5, 10 |
| Intermediate | 3, 4, 9, 11 |
| Challenge | 6, 7, 8, 12 |

### Mastery levels

| Level | Name | Comes back for review (Adaptive mode) |
|---|---|---|
| 0 | New | not yet introduced |
| 1 | Learning | in the same session |
| 2 | Familiar | after 1 day |
| 3 | Strong | after 3 days |
| 4 | Mastered | after 7 days, then 14, 28 and up to 60 |

- **Correct and quick:** the fact moves up one level.
- **Correct but slow:** the fact gets half a step. Two slow correct answers, in different sessions, move it up a level.
- **Wrong:** the fact goes back to Learning and comes back about 3 cards later, then again about 8 cards later.
- **Already known:** a brand-new fact answered quickly and correctly the first time jumps straight to Familiar. Students who know most of their facts don't have to grind through them.
- **One step per session:** a fact can move up at most once per session. Repeats after a mistake are practice, not progress.

### Practice Round

A round is 20 cards by default, or you can choose a timed round of 2 or 5 minutes instead.

- About 70% of cards are facts at Familiar or above. About 30% are New or Learning.
- New facts come in a few at a time. While three facts are being missed, no new facts are added; the round goes back over the ones in progress instead.
- The same fact never appears twice in a row.
- **Adaptive practice** uses all 78 facts. Facts that are due for review come first.

## Reasoning

### Typing the answer: retrieval practice

Pulling an answer out of memory makes it stick better than seeing it again. In one well-known study, students who were tested on material remembered much more of it a week later than students who spent the same time re-studying, even though the re-studiers felt more confident *(Roediger & Karpicke, 2006)*. That's why the card asks you to type the answer instead of offering a "show me" button.

### Spreading practice out: spacing

Practice spread over days beats the same amount of practice crammed into one sitting, and the best gap grows the longer you want to remember something *(Cepeda et al., 2006)*. The growing review gaps in the levels table come from this idea. So does the rule that a fact can move up only once per session. The levels themselves work like the classic Leitner box system for flash cards *(Leitner, 1972)*.

*Caveat:* most spacing research uses word lists and facts to memorize. The same review found that results for math-like tasks are less consistent. Multiplication facts are closer to memorizing than to problem solving, which is why the idea is used here.

### Mostly known facts: incremental rehearsal

**Incremental rehearsal** is a flash-card method from school psychology. It mixes one unknown item into a set of known ones and adds new items gradually. In a study comparing it with other flash-card methods, it produced the best retention *(MacQuarrie et al., 2002)*. It has also helped students with math learning disabilities become fluent with multiplication facts *(Burns, 2005; Codding et al., 2010)*. A review of drill research found that practice sets made up mostly of known items worked better than sets that were mostly unknown *(Burns, 2004)*.

This app uses a lighter mix than strict incremental rehearsal: about 70% known instead of about 90%, and the struggling limit keeps the number of unknowns down. A computer can choose cards one at a time, so the exact proportions are tuning choices and may change with testing.

### Quick recall counts, but no clock

Knowing a fact well means you can recall it quickly instead of counting it out. In incremental rehearsal, a fact usually counts as "known" if it's answered within about 2 seconds *(Burns, 2005)*. Speed matters here too: quick answers move a fact up faster.

Visible timers are a different matter. *Boaler (2014)* argued that timed tests cause math anxiety. That was an opinion column, and the claim is disputed: critics point out that few controlled studies have tested it directly. This app takes a cautious middle path. It measures speed but never shows a countdown. The only hint is the color of the "correct" flash.

### Measuring speed against you, not a fixed number

Typing on a phone takes longer than writing, and people vary a lot. A fixed cutoff would partly measure thumbs, not memory. So the app learns your typing speed from the facts that need almost no thinking (anything × 1 or × 10). A quick answer is one within about 2 seconds of your usual time for that many digits. Until it has enough data, it uses generous defaults of 4–6 seconds. Slow but correct answers still count, just in smaller steps, so nobody gets stuck because of how fast they type.

### Showing the answer right away after a mistake

When you miss a fact, the full fact appears large and stays until you continue, and then it comes back a few cards later. This is the same principle behind Cover, Copy, Compare, a widely used self-checking method: look at the correct fact, cover it, answer from memory, and compare *(Skinner et al., 1997)*. Getting the right answer in front of you immediately keeps a wrong answer from sticking.

### Mixing facts: interleaving

Shuffling different kinds of math problems together, instead of doing one kind at a time, improved later test scores in *Rohrer & Taylor (2007)*. That's one reason for mixed groups, Adaptive mode, and random order within a fact (3×7 and 7×3). *Caveat:* later studies of interleaving have found mixed results, so this is a reasonable bet rather than a settled fact.

### The grid: studying before quizzing

The grid is for studying patterns before quizzing. For example, the digits of the 9s add up to 9 through 9×10 (18, 27, 36…), and 7×8 is 7×4 doubled. Teaching these "derived fact" strategies helps students work out facts they haven't memorized yet *(Isaacs & Carroll, 1999)*. With Show mastery on, the grid also works as a progress map. The facts that need the most work are the most visible.

## App Exclusions

- **No accounts and no data collection.** Progress is saved only in your browser, on your device. You can export it to a file and import it on another device.
- **No streaks, scores or leaderboards.** The end-of-round summary shows which facts moved up and which need another look. When a fact you used to know slips, it says so gently.
- **No timer on the screen.**

## Known Limitations

- Progress stays on one device and in one browser. Some browsers clear saved site data after a few days without use, so exporting your progress now and then is a good habit.
- The thresholds (70% known, 3 struggling facts, the review gaps, the speed margin) are reasonable starting points drawn from the research above. They aren't tuned on real students yet.
- Only multiplication from 1×1 to 12×12 are included so far.

## References

- Boaler, J. (2014). Research suggests that timed tests cause math anxiety. *Teaching Children Mathematics, 20*(8), 469–474. (Opinion column.)
- Burns, M. K. (2004). Empirical analysis of drill ratio research: Refining the instructional level for drill tasks. *Remedial and Special Education, 25*(3), 167–173.
- Burns, M. K. (2005). Using incremental rehearsal to increase fluency of single-digit multiplication facts with children identified as learning disabled in mathematics computation. *Education and Treatment of Children, 28*(3), 237–249.
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3), 354–380. https://doi.org/10.1037/0033-2909.132.3.354
- Codding, R. S., Archer, J., & Connell, J. (2010). A systematic replication and extension of using incremental rehearsal to improve multiplication skills: An investigation of generalization. *Journal of Behavioral Education, 19*(1), 93–105. https://doi.org/10.1007/s10864-010-9102-9
- Isaacs, A. C., & Carroll, W. M. (1999). Strategies for basic-facts instruction. *Teaching Children Mathematics, 5*(9), 508–515. https://doi.org/10.5951/TCM.5.9.0508
- Leitner, S. (1972). *So lernt man lernen* [How to learn to learn]. Herder.
- MacQuarrie, L. L., Tucker, J. A., Burns, M. K., & Hartman, B. (2002). Comparison of retention rates using traditional, drill sandwich, and incremental rehearsal flash card methods. *School Psychology Review, 31*(4), 584–595.
- Roediger, H. L., III, & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science, 17*(3), 249–255. https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science, 35*(6), 481–498. https://doi.org/10.1007/s11251-007-9015-8
- Skinner, C. H., McLaughlin, T. F., & Logan, P. (1997). Cover, copy, and compare: A self-managed academic intervention effective across skills, students, and settings. *Journal of Behavioral Education, 7*(3), 295–306.
