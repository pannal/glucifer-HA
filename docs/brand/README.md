# Brand assets

Edit `glucifer.svg` to change the horned drop and insulin pen. It is the vector master for the standalone card mark, framed app icons and README banner. The master frame is centered on the blood drop, with symmetric horn spacing. The pen does not affect that anchor. The card serves the transparent `custom_components/glucifer/brand/mark.svg` directly.

After installing the repository's npm dependencies and Playwright Chromium, regenerate all variants:

```sh
node docs/brand/render.cjs
```

The renderer uses local files only. `icon.svg` and `banner.svg` are derived files. `mark.png` is a transparent raster alternative; the framed icons retain their navy app tile.

Banner lettering uses [Outfit](https://github.com/google/fonts/tree/main/ofl/outfit), bundled under the [SIL Open Font License](Outfit-OFL.txt).

The [Home Assistant logo](https://github.com/home-assistant/assets/tree/master/logo) is the Open Home Foundation's trademark and remains subject to its terms, separate from this repository's GPL license. Commercial marketing use requires the foundation's written permission.
