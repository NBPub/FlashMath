# [Flash Math](https://nbpub.github.io/FlashMath/)

Flash Math is a website built to practice multiplication facts from 1×1 to 12×12 with adaptive flash cards and a study grid. It tracks a user's progress 
on their own device, and allows for exporting/importing user data.

Practice is designed around well-studied learning strategies: recalling answers instead of re-reading them, spreading practice out over days, mixing a few new facts into mostly familiar ones, and showing the correct answer right away after a mistake. [Design Choices and Background](docs/design-choices.md#design-choices-and-background) explains each choice and cites the research behind it.

<img src="img/sloth.svg" alt="The Flash Math sloth, hanging from a multiplication sign" width="160">

| [Features](#features) | [Running Locally](#running-locally) | [Future Ideas](#future-ideas) | [AI Disclaimer](#ai-disclaimer) |

*[MIT Licensed](LICENSE)*

## Features

- Study grid: hover or tap any square to see its fact. Optional mastery colors show which facts need the most work.
- Flash cards: practice one number, a suggested group, any mix of numbers, or try **Adaptive Practice**.
- Mastery levels: each of the 78 facts moves from New to Mastered, and missed facts come back a few cards later.
- No visible timer: speed is measured quietly, against your own typing speed.
- Export and import: progress lives in the browser and can be saved to a file or moved to another device.

## Running Locally

The site is plain HTML, CSS and JavaScript with no build step. Serve the folder with any static server. For example, with Python 3 installed (no additional packages needed):

```
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk won't work, because browsers block JavaScript modules on `file://` pages.

Tests use Node's (Node 20 or newer) built-in test runner:

```
node --test
```

They also run on every push through GitHub Actions.

## Future Ideas

*Possible areas of improvement, none are explicitly planned.*

- Addition and subtraction facts.
- An installable app that works offline.
- Optional profiles, for several students sharing one device.
- A short warm-up that measures typing speed before the first round.
- Easier ways to keep progress across devices than export and import.
- Tuning the practice mix and review gaps once real students have used it.

### Fixes

*Probable to be addressed in the future*

 - keep two open tabs from overwriting each other's progress
 - refresh the grid's mastery colors after pressing Back


## AI Disclaimer

*The goal for this project was to build a working version as quickly as possible, and therefore coding and research were conducted almost entirely by AI.*

The design, feature scope, and the review and testing process were planned and directed by the author. An AI assistant (Claude) wrote much of the code, tests and documentation. The design and judgement calls are the author's; the keystrokes are largely the model's.
