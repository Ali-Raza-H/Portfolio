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
  "brief": ["What was requested? Who was it for? What constraints mattered?"],
  "thinking": ["What directions did you consider, and why choose this one?"],
  "process": ["How did research, exploration, feedback, and refinement work?"],
  "outcome": ["What did you deliver? What worked, and what would you improve?"],
  "pieces": [
    {
      "title": "Optional piece title",
      "category": "Poster",
      "image": "assets/graphics/my-poster.jpg",
      "alt": "A specific description of the visible design.",
      "description": "A paragraph about this piece's brief, audience, visual idea, design decisions, iterations, and what you learned. Replace the prompt with your own account.",
      "size": "tall",
      "scale": 1
    }
  ]
}
```

Use a relative path such as `assets/graphics/my-poster.jpg`. Available sizes are
`tall`, `wide`, and `square`.

Each graphic also supports these optional image controls:

```json
{
  "scale": 0.8,
  "ratio": "4 / 5",
  "fit": "cover",
  "position": "center top"
}
```

- `scale`: from `0.25` to `3`; controls gallery width (`1` is the default size).
  It also makes the image proportionally narrower or wider on mobile.
- Images keep their own aspect ratio by default, so there is no cropping.
- `ratio`: optional CSS aspect ratio to frame/crop an image, such as `1 / 1`,
  `16 / 9`, or `3 / 4`.
- `fit`: `cover`, `contain`, or `fill` when `ratio` is set.
- `position`: controls the crop focus, for example `center`, `center top`, or
  `right center`.
