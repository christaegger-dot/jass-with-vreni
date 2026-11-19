# Jass with Vreni

A small web app for learning Schieber, the most popular kind of the Swiss card game Jass.
Written in English for people with Swiss roots who have never held Swiss-German cards.

Live: https://jass-with-vreni.netlify.app

## What is in here

- `public/index.html` is the whole app: one page, no build step.
- `public/audio/` holds 52 short recordings of the Jass terms and of Vreni's sayings.
- `public/cheatsheets/` holds the eleven printable cheat sheets as PDF, one US Letter page each. Sheet 10 is a glossary of every Jass word in the course.
- `tools/make-cheatsheets.js` rebuilds those PDFs from the card drawings in the app.
- `tests/logic-test.js` checks the rules and the question generators, and plays 3000 whole rounds and 700 whole games (every card, Weis, Stöck and slate entry) against a second, independent copy of the rules.
- `tests/browser-test.js` plays through every lesson, several whole rounds and one whole game in a real browser.
- `netlify.toml` tells Netlify to publish the `public` folder.

## Credits

- Voice: Christa Egger.
- Card drawings: own simplified drawings after the traditional Swiss-German pattern.
- Team badges in the round (a potato for Idaho, a lion for Winterthur): own drawings. The Great Seal of
  Idaho and the coat of arms of Winterthur are official emblems and are not used; the start page links to them.
- Rules follow the Schieber guide on jassverzeichnis.ch.

## Status

Chapter 1 (the cards, winning a trick, counting points) and chapter 2 (Trumpf: Puur and Nell, the
points, which cards may be played, Ansagen or Schieben, and a first whole round of nine tricks against
three simple computer players). The round is played with the four Trumpf suits only: no Weis, no Stöck,
no Obenabe or Undenufe, everything counted once. Chapter 3 (playing well) teaches Bock, counting Trumpf
and four proven tactics and signals of team play: Trumpf uszieh, Schmiere, Verwerfe, Aazieh. The app keeps
three things apart: rules (a must), tactics (often useful) and signals between partners (tables differ).
Chapter 4 (the full game) has three stages: Obenabe and Undenufe, Weis and Stöck, and scoring like a local
(single, double, triple, Match, and how a game ends). With that every rule of the game is covered.
Chapter 5 (at the table) starts with stage 13: counting sure tricks, when to name Obenabe or Undenufe, and the
first card after a push. These are rules of thumb and conventions, and the app labels them as such.
Stage 14 is the whole game: all six games, Weis, Stöck and the slate, with the deal moving on after every
round, played to 1000 (everything single) or to 2500 (with the factors). Weis and Stöck are announced
automatically, a round is always played to the end, and an unfinished game is saved in the browser.
The course now has 14 stages and 57 lessons.
Progress is stored in the learner's browser only.

## Running it locally

```
cd public
python3 -m http.server 8765
```

Then open http://127.0.0.1:8765/.

## Tests

```
node tests/logic-test.js public/index.html
npm install puppeteer-core
URL=http://127.0.0.1:8765/index.html SITE=1 node tests/browser-test.js
```

The browser test expects Google Chrome at `/usr/bin/google-chrome` and the local server from above.

## Rebuilding the cheat sheets

```
node tools/make-cheatsheets.js
```

Run it with the local server from above. Do this whenever the card drawings or the sheet texts change.

## One switch to know

`public/index.html` contains `const PUBLIC_SITE=true;`. With `false`, the two videos become plain links
and a list of all recordings appears on the cards page. That variant is used for previews in places
where video players cannot be embedded.
