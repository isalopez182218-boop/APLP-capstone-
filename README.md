# APLP project website

Static site for the Automated Power Line Peeler capstone (ME 473, CCNY). Plain HTML, CSS and JavaScript with no build step, ready for GitHub Pages.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page |
| `style.css` | Black-and-white, Times New Roman, LaTeX-article styling |
| `site.js` | Contents highlighting, cycle-time calculator (port of `calculations/APLP-cycle-time.xlsx`), figure zoom |
| `viewer.js` | 3D viewer for `assets/aplp-rotary.glb` (Rev D CAD), with ring-angle slider and orbit animation |
| `vendor/three/` | three.js r160 (MIT licence), served locally so the site has no CDN dependency |
| `assets/` | Figures, the 3D model and the cutting-calculations PDF |

## Publish on GitHub Pages

1. Create a public repository, for example `aplp-capstone`.
2. Put the contents of this folder at the repository root (or in `/docs`).
3. In the repository go to Settings, then Pages, choose "Deploy from a branch", branch `main`, folder `/` (or `/docs`).
4. The site appears at `https://<username>.github.io/aplp-capstone/` within a minute or two.

Add an empty file named `.nojekyll` at the root so GitHub serves every file as-is.

## Preview locally

The 3D model is loaded with `fetch`, which browsers block on `file://` pages. Run a small server from this folder:

```
python -m http.server 8000
```

then open http://localhost:8000.

## Updating

- Text lives in `index.html`. Keep the copy plain and specific.
- The 3D model comes from `gear-system/cad/out/APLP_rotary_assembly.step`, converted with `cascadio.step_to_glb(..., tol_linear=0.08, tol_angular=0.4)`. Part names in the STEP drive the hover descriptions in `viewer.js` (`PARTS`) and which parts turn with the ring (`ON_RING`).
- Calculator constants are at the top of the model block in `site.js` and match the spreadsheet.
