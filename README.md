# Carousel Studio

![Carousel Studio preview](./og-cover.png)

Carousel Studio is a browser-based tool for generating Instagram or LinkedIn carousel posts with ChatGPT planning and GPT Image generation.

You paste your content, choose a slide count and format, and the app:

1. plans the carousel page by page
2. turns each page into a visual concept
3. generates each slide as an image
4. exports the final set as PDF or ZIP

This public branch intentionally keeps only the **core carousel generation workflow**.  
Private lead generation, webhook integrations, and production-only backend logic are not included here.

## What It Does

- Generate 3, 5, or 10-page carousels
- Support multiple formats:
  - `1:1`
  - `3:4`
  - `16:9`
  - `1080 × 1350`
- Accept a single content draft and automatically split it into slides
- Use a shared style brief across the whole carousel
- Analyze up to 5 reference images and extract visual DNA
- Build a reusable design system before generating images
- Let each slide choose its own layout family while keeping a consistent visual language
- Regenerate individual slides with comments
- Export as PDF or ZIP

## Why I Built It

I wanted a faster way to turn raw ideas or long-form notes into polished social carousel posts without manually designing every page.

The interesting part is not just image generation. The app combines:

- content planning
- layout selection
- design system generation
- reference-image analysis
- page-by-page rendering

That makes it more like a lightweight AI-assisted content production workflow than a single prompt box.

## Stack

- Plain HTML, CSS, and JavaScript
- OpenAI Chat Completions for planning
- GPT Image for image generation
- Client-side PDF / ZIP export

## How It Works

1. Paste a topic, draft, bullet points, or long-form text
2. Add an optional shared style brief
3. Upload optional reference images
4. Choose slide count, size, and output format
5. The app:
   - analyzes image references
   - creates a carousel design system
   - plans each slide
   - generates the images
6. Export the result

## Local Usage

This app is static and can be served with any simple local web server.

Example:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

## OpenAI API Note

This public version runs in the browser and uses the user's own OpenAI API key.

That means:

- the API key is entered client-side
- requests are sent from the browser directly to OpenAI
- the key is stored in browser `localStorage` for convenience in this branch

If you want a production SaaS setup, move API handling to a backend service.

## Production Note

The deployed version I use privately may include extra production integrations or operational tooling that are not part of this open-source branch.

This repo is intended to show the **core product idea and implementation**, not every private workflow around it.

## Demo

Live site:

[https://carouselapp.isaac.mba](https://carouselapp.isaac.mba)

## Good Fit For

- creators making social carousels
- marketers testing AI-assisted visual workflows
- builders exploring prompt-to-design systems
- anyone curious about combining planning + image generation in one UI

## License

No license has been added yet.
