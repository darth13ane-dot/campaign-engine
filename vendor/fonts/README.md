# Bundled interface fonts

DM Mono, Fraunces, and Manrope are distributed here as unmodified TrueType font files from the official [Google Fonts repository](https://github.com/google/fonts/tree/f2bd09badbc763d8757951d52deec29da27e85fb/ofl). `sources.json` records each exact upstream URL and SHA-256 checksum. Fraunces and Manrope use shorter local filenames; their font contents and names are unchanged.

Each family's copyright notice and SIL Open Font License 1.1 are retained in `DMMono-OFL.txt`, `Fraunces-OFL.txt`, and `Manrope-OFL.txt`. These files accompany the fonts in the Windows package and browser offline cache.

`fonts.css` supplies the same interface families and weights previously requested from Google Fonts. The bundled fonts support consistent offline preparation and remove font-service requests at startup. `assets.json` lists the font assets checked during packaging and cached by the browser application.
