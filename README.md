# Jass with Vreni

A small web app for learning Schieber, the most popular kind of the Swiss card game Jass.
Written in English for people with Swiss roots who have never held Swiss-German cards.

Live: https://jass-with-vreni.netlify.app

## What is in here

- `public/index.html` is the whole app: one page, no build step.
- `public/audio/` holds 52 short recordings of the Jass terms and of Vreni's sayings.
- `public/cheatsheets/` holds the four printable cheat sheets as PDF, one US Letter page each.
- `tools/make-cheatsheets.js` rebuilds those PDFs from the card drawings in the app.
- `tests/logic-test.js` checks the rules and the question generators.
- `tests/browser-test.js` plays through every lesson in a real browser.
- `netlify.toml` tells Netlify to publish the `public` folder.

## Credits

- Voice: Christa Egger.
- Card drawings: own simplified drawings after the traditional Swiss-German pattern.
- Rules follow the Schieber guide on jassverzeichnis.ch.

## Status

Chapter 1 (the cards, winning a trick, counting points) and the first two stages of chapter 2
(Trumpf: Puur and Nell, the points, and which cards may be played). Still to come: Ansagen or
Schieben, a first full round, and chapters 3 and 4.
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
