# Graphics assets

## Add work to the graphics portfolio

Each entry in `graphicsProjects` is a case study/brief collection. Create one
object per client, campaign, class brief, or personal series, then add its art
in `pieces`. Keep the narrative grounded in what actually happened: explain
the brief, audience or constraints, your design reasoning, iterations, tools,
outcome, and what you learned. Empty narrative fields are omitted from the page
until you fill them in.

```json
{
  "title": "Project or brief name",
  "client": "Client, group, or course",
  "discipline": "Identity / Campaign / Editorial",
  "year": "2026",
  "overview": "A short summary of the project and its goal.",
  "attachment": {
    "url": "assets/graphics/my-project-brief.pdf",
    "label": "Full brief (PDF)"
  },
  "brief": ["What was requested? Who was it for? What constraints mattered?"],
  "thinking": ["What directions did you consider, and why choose this one?"],
  "process": ["How did research, exploration, feedback, and refinement work?"],
  "outcome": ["What did you deliver? What worked, and what would you improve?"],
  "pieces": [
    {
      "image": "assets/graphics/my-poster.jpg",
      "width": 720,
      "height": 960,
      "title": "Optional piece title",
      "category": "Poster",
      "alt": "A specific description of the visible design.",
      "description": "A paragraph about this piece's brief, audience, visual idea, design decisions, iterations, and what you learned."
    }
  ]
}
```

Use a relative path such as `assets/graphics/my-poster.jpg`.

To attach a PDF or PowerPoint containing the complete brief, add its file under
`assets/graphics/` and set the case study's optional `attachment` field in
`content/site.json` to the relative file path (or to an object with `url` and an
optional `label`, as in the example). The page will show separate open and
download links. Supported files can include PDF and PowerPoint formats; opening
PowerPoint files depends on the visitor's browser/device, while downloading
remains available.

## Setting the size of each image

Every piece takes a `width` and a `height`, written as **design pixels**: the
numbers you would use while working on a 1200px-wide canvas.

- `width`: how much horizontal room the piece takes. The gallery is 12 columns
  wide, so a `width` of `1200` is full width, `720` is about 7 columns, `480`
  is 4. Anywhere in between works and the mosaic packs around it.
- `height`: the piece's height. Combined with `width` it sets the frame's
  aspect ratio, so the image is never stretched.

The two numbers are used as proportions, not literal pixels, so the same values
produce a correct layout on a phone, a tablet and a desktop. Nothing is
hard-coded per breakpoint, and the gallery re-packs itself on resize, on
webfont load, and as each image finishes loading.

To crop on purpose, set a `height` that does not match the image's real
proportions, and add `"fit": "cover"`:

```json
{
  "width": 720,
  "height": 480,
  "fit": "cover",
  "position": "center top"
}
```

- `fit`: `contain` (the default, so artwork is never cropped) or `cover` to
  fill the frame. `fill` is also accepted but will distort.
- `position`: crop focus for `cover`, such as `center`, `center top`, or
  `right center`.

A very tall ratio is capped at `88svh` so one piece cannot run off the screen on
a short device.

### Optional extras

- `scale`: a multiplier on the column count, from `0.25` to `3`. Useful for a
  quick nudge without rewriting `width`.
- Omit `width` and `height` entirely and the image keeps its own proportions,
  sized from the `size` hint (`tall`, `wide`, or `square`) if present.

## How the mosaic is built

`js/site.js` turns each piece's `width` into a column span, measures the frame
the browser laid out, and converts that height into a row span counted in 8px
units. Dense flow then tucks smaller pieces into the gaps left under taller
ones, which is what gives the gallery its mosaic look. The CSS lives in
`css/custom.css` under the `MOSAIC GALLERY` comment and is the single source of
truth for the frame; adjust `--mosaic-column-gap` and `--mosaic-row-unit`
there. If you change `--mosaic-row-unit`, update `MOSAIC_ROW_UNIT` in
`js/site.js` to match.
