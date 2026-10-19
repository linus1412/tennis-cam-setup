# Court Cam

Mobile PWA for setting up an iPhone on a SwingVision Swing Stick: works out camera height, tilt and lens for a court, and shows the phone's live tilt so you can set the holder before mounting.

Live: https://linus1412.github.io/tennis-cam-setup/

- `app/` – the PWA (no build step). `npm run serve` then open http://localhost:8765
- `tests/` – geometry and sensor maths, `npm test`
- `research/` – SwingVision, iPhone camera and court dimension notes

The tilt sensor needs HTTPS on iOS, so test the Level tab on the deployed site.
