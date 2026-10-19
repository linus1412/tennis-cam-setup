# SwingVision phone mounting: research notes

Researched 2026-10-19. Feeds a PWA that tells the player what height and downward tilt to mount an iPhone 12 or 12 mini at. Every claim has a source, and anything not confirmed is labelled **UNCONFIRMED**.

## Key numbers

| Item | Value | Source / note |
|---|---|---|
| Court length (baseline to baseline) | 23.77 m (78 ft) | ITF [7] |
| Singles / doubles width | 8.23 m / 10.97 m (27 / 36 ft) | ITF [7] |
| Service line from net | 6.40 m (21 ft); 5.485 m from baseline | ITF [7] |
| Net height: centre / posts | 0.914 m / 1.07 m | ITF [7] |
| Net posts | 0.914 m outside doubles sideline | ITF [7] |
| Recommended run-back / side run-off | ≥ 6.40 m (21 ft) / ≥ 3.66 m (12 ft); enclosure 36.58 × 18.28 m (120 × 60 ft) | ITF [7] |
| SwingVision mount position | On top of the back fence, **behind the baseline, centred** | SwingVision guide [1] |
| SwingVision framing requirement | "Entire court in view", meaning both baselines and both doubles alleys | [1], [3] |
| SwingVision capture | Rear camera, **60 fps** | ITF PAT report [4] |
| SwingVision official height or tilt figure | **None published** (UNCONFIRMED; not found) | — |
| Swing Stick height above fence | ~2 ft (~0.6 m) above the fence top | review snippet [6]; UNCONFIRMED |
| iPhone 12 = 12 mini rear cameras | Identical hardware | Apple specs [8][9] |
| Wide (1x) 16:9 video FOV | H ≈ 67°, V ≈ 41° (≈ 62° × 37° with ~10% stabilisation crop) | computed below |
| Ultra-wide (0.5x) 16:9 video FOV | H ≈ 106°, V ≈ 74° (≈ 100° × 68° with ~10% crop); measured 14 mm-eq gives ≈ 102° × 70° | computed below |
| Camera tilt-down from orientation | `tilt = asin(cos β · cos γ)` (degrees in, degrees out) | derived from the W3C spec [13] |
| Camera tilt-down from gravity | `tilt = asin(a_z / |a|)` (sign must be checked on the device) | derived |

---

## 1. Official SwingVision mounts

### Product line
The SwingVision web app defines these mount types in its code: `FENCE_MOUNT`, `SWING_STICK`, `SWING_VISION_MOUNT`, `CLUB_MOUNT`, `SWING_STICK_2NDGEN`, `GROUND` (from the `swing.vision` JS bundle, `static/js/main.*.js`).

- **Swing Stick (1st gen).** Launched March 2023 in the "Android Update, Swing Stick" newsletter: "the brand-new Swing Stick mount — record your matches from anywhere on the court" [2]. Product copy: "our patented phone mount that fits in your sports bag, works right out of the box, and attaches in seconds". Feature list: "Integrated phone sunshade" and "Works with fences & indoor curtains" (site locale `/locales/en/product.json`). The site promotes it as a $100 value, free with a yearly Pro subscription. Shop page: https://swing.vision/shop/swing-stick-offer [2].
- **Swing Stick (2nd Gen).** "Built-in motor with Bluetooth & AI Setup … Adjust your camera angle via Apple Watch or a friend's phone … Swing Stick's internal motor communicates with your phone to find the court for you." It ships to the U.S. only (`product.json`). So on the 2nd Gen the tilt is **motorised** and adjusted remotely, not set by hand.
- **Older "Fence Mount (QM-1)".** Sold by SwingVision (https://swing.tennis/shop/phone-mount-offer) and listed in the 2021 setup video [5]. tennis.com called it a "top of the fence mount… sells its own model ($60)" [3]. The video calls the earlier "Fence Grip" "[No Longer Recommended!]", and it also lists the third-party **Functional Tennis "MD" mount**.
- **Phone holder.** The FAQ says "A second, complimentary phone holder is included … You may purchase additional holders through Amazon". The link resolves to ASIN **B0B5Z5435D**: "Petutu 2 Pack Tripod Phone Mount… Width: 2.36–4.1 inch, Vertical and Horizontal Rotating, Adjustable Clamp" [10]. So the holder is a generic spring clamp for phones **60–104 mm wide**. iPhone 12 mini (64.2 mm) and iPhone 12 (71.5 mm) both fit.
- **Other SwingVision-recommended accessories** (Amazon affiliate links in the site code): a clip-on wide-angle lens (B01A6D2JVI), an umbrella or sunshade (B0962R6XKK), and a UBeesize 60" tripod (B07NWC3L95).

### Physical specs of the Swing Stick: mostly UNCONFIRMED
I could not find an official spec sheet, manual or Amazon listing for the Swing Stick (eBay listings returned 403). Status of each spec:

| Spec | Status |
|---|---|
| Total / extended length, number of sections | **UNCONFIRMED.** A review says the phone sits ~2 ft (60 cm) above the fence [6]. |
| Fence attachment (wire gauge or post size) | **UNCONFIRMED.** Official copy only says "fences & indoor curtains". A 3D-printed "stabilizer" accessory exists because the stick "can rotate a bit when on a curtain" (MakerWorld 755041, search snippet). |
| Phone holder range | 2.36–4.1 in (60–104 mm) clamp, per the replacement-holder listing [10] |
| Tilt / pan / roll ranges, detents, markings | **UNCONFIRMED.** One review mentions "built-in guides to help you position your phone" [6]. 2nd Gen tilt is motorised. |
| Weight | **UNCONFIRMED** |

For comparison, the third-party **Functional Tennis mount** (which SwingVision has recommended) has a telescopic pole extending to **200 cm (6.2 ft)** that collapses to **51 cm**. It has a fence-top hook plus velcro straps, phone and GoPro attachments, and a weight listed as "950" with no unit; it costs €59.95. Its setup tips are to use the wider view and "tighten as much as possible" [11].

### Videos and threads
- Official: "How to Set Up Your SwingVision Recording for Tennis or Pickleball" (2024), https://www.youtube.com/watch?v=-sQ_XP1HxXs. Chapters: 0:52 camera and fence mount, 2:15 Apple Watch, 3:00 Remote or Audio-Guided.
- Official (2021, older mounts): https://www.youtube.com/watch?v=Q4jWP2EXWRU [5]
- Third-party short: https://www.youtube.com/shorts/3RHOi7mC2r8
- I found no relevant Reddit threads; searches returned nothing usable.

## 2. SwingVision's official recording and setup guidance

From https://swing.vision/guides/set-up-your-recording [1]. The page is rendered by JavaScript, so the text was read from `/locales/en/guides-set-up-your-recording.json`.

- **Swing Stick:** "Attach the Swing Stick on top of the fence behind the baseline in the green area marked below". The diagram's alt text is "Mount behind baseline in middle". Audio-Guided mode: "Wait for Siri to check your camera angle. Adjust the Swing Stick if needed." With Watch or Remote: "Ensure your camera angle fits the entire court in view."
- **Fence mount / suction mount:** "Ensure the camera is angled so that the entire court is in view."
- **Tripod** (with reduced accuracy) goes "by the fence behind the baseline". For **singles**: "place the phone half way between the center and one of the alleys". For **doubles**: "place the phone in the center".
- **Ground mode:** lean the phone against a water bottle so "the net tape is within the pink rectangle". This is the only explicit framing overlay the guide mentions.
- **Lens:** "Use this wide angle lens if your device doesn't have a built-in ultra wide camera and you're unable to see the entire court on 1x zoom." This implies that 0.5x ultra-wide is the expected choice when 1x can't fit the court. The app's data model stores zoom as 0.5x–1.0x in 0.1 steps (plus 1.5x–3x), so the app chooses an intermediate zoom.
- **In-app auto framing:** release 9.1 added "Auto Setup with Audio Feedback… once your device is stable… Siri will detect the court and let you know if you need to adjust the camera angle or zoom" (newsletter chunk in the site code). The 2nd Gen stick motor does this automatically. Court-line detection is automatic, with no manual calibration step documented.
- **Tips:** place the phone on the side with the sun **behind** it, and **opposite** the side with a windscreen. Use an umbrella or shade to avoid overheating.
- **What must be visible:** tennis.com, describing SwingVision's guidance, says "high enough and far enough beyond the baseline to get a view of the entire court… angled so that both baselines and alleys are visible… what you see at eye level may not be what you want when the phone is mounted on top of the fence" [3].
- **Orientation:** landscape. The guide's remote-control image is captioned "iphone 15 landscape", and the ITF describes it as "mounted at the back of the court… with full view of the court" [4]. I did not find an explicit "landscape only" statement (UNCONFIRMED but strongly implied).
- **Height:** SwingVision publishes **no numeric height or tilt.** In practice the height is the fence top plus the stick (~0.6 m). Club fences are typically 3–3.7 m (10–12 ft), but that figure is not from SwingVision (UNCONFIRMED).

## 3. iPhone 12 / 12 mini camera specs and FOV

**The 12 and 12 mini have identical rear camera hardware.** Apple specs for both: "Dual 12MP… Ultra Wide ƒ/2.4, 120° field of view, five-element lens, lens correction; Wide ƒ/1.6, seven-element, OIS". Video: 4K at 24/25/30/60 fps, 1080p at 25/30/60 fps, and "Cinematic video stabilisation (4K, 1080p and 720p)" [8][9]. The 12 Pro Max is the model with a different (sensor-shift) wide camera.

| | Wide (1x) | Ultra-wide (0.5x) |
|---|---|---|
| 35 mm-equivalent | 26 mm [12] | 13 mm claimed, **14 mm measured** by DXOMARK [12] |
| Sensor | 12 MP, 1.4 µm, 1/2.55" ≈ 5.64 × 4.23 mm | 12 MP, 1/3.6" ≈ 4.0 × 3.0 mm [12] |
| Actual focal length | ≈ 4.2 mm (26 / crop factor 6.13) | ≈ 1.5 mm (derived; EXIF typically shows 1.54 mm, UNCONFIRMED) |
| Aperture | f/1.6, OIS | f/2.4, no OIS, distortion-corrected ("lens correction") |

### Working
The 35 mm-equivalent focal length is defined by the full-frame diagonal, D = √(36² + 24²) = 43.27 mm. The iPhone sensor is 4:3, so its equivalent width is 0.8D = 34.61 mm and its equivalent height is 0.6D = 25.96 mm. A 16:9 video frame keeps the full width and crops the height to 34.61 × 9/16 = 19.47 mm. The rectilinear FOV is `2·atan(size / (2·f_eq))`.

- **Wide, f_eq = 26:** H = 2·atan(17.31/26) = **67.3°**; V (4:3) = 2·atan(12.98/26) = 53.1°; **V (16:9) = 2·atan(9.73/26) = 41.1°**; diagonal (4:3) = 79.5°.
- **Ultra-wide, f_eq = 13:** H = 2·atan(17.31/13) = **106.2°**; V (4:3) = 89.9°; **V (16:9) = 2·atan(9.73/13) = 73.7°**; diagonal (4:3) = 118° (Apple rounds this to 120°).
- **Ultra-wide at the measured 14 mm:** H = 102.1°, V (16:9) = 69.6°.
- **Stabilisation crop:** Apple's developer forum notes that the video FOV reported by `AVCaptureDevice.Format.videoFieldOfView` is smaller than the photo FOV, "approx 10% smaller", because of the stabilisation crop [14]. Applying a 0.9 linear crop, `2·atan(0.9·tan(FOV/2))`, gives **wide ≈ 61.8° × 37.2°** and **UW ≈ 100.3° × 68.0°** (13 mm) or 96.1° × 64.1° (14 mm).
- 1080p and 4K both use the full sensor width (16:9 crop of the 4:3 sensor), so these figures apply to both resolutions. The exact crop for each format is **UNCONFIRMED**. The authoritative value is `videoFieldOfView` on the device's active format. The PWA should treat these numbers as ±3°.

### Worked example: why 0.5x is usually needed
Take a phone centred behind the baseline, d = 6.40 m back (the ITF run-back) and h = 4.3 m high (3.7 m fence + 0.6 m stick).
- The near baseline is atan(4.3/6.4) = 33.9° below horizontal, and the far baseline is atan(4.3/30.17) = 8.1° below. That is a span of 25.8°, which fits in either lens's vertical FOV. The ideal tilt is about 21° down, the midpoint.
- At that tilt, the near baseline's doubles corners lie 5.485 m to the side at an optical-axis depth of 6.4·cos21° + 4.3·sin21° = 7.52 m. That needs a half-angle of atan(5.485/7.52) = 36.1°, so the full HFOV must be ≥ 72°. The 1x lens gives only ~62–67°, so **the ultra-wide is required** unless the phone is much further back.

General formulas for the PWA, with a ground-plane point at forward distance Y and lateral offset X, camera height h and tilt θ:
- depth z = Y·cosθ + h·sinθ
- horizontal image angle = atan(X / z)
- vertical image angle = atan((h·cosθ − Y·sinθ) / z), positive meaning below the image centre

## 4. ITF court dimensions [7]
- Length 23.77 m. Singles width 8.23 m, doubles width 10.97 m.
- Service lines are 6.40 m from the net, so 5.485 m from the baseline.
- Net is 0.914 m at the centre and 1.07 m at the posts. Doubles posts are 0.914 m outside the doubles sideline; singles sticks are 0.914 m outside the singles sideline.
- All measurements are taken to the outside of the lines.
- Recommended minimum run-back (baseline to backstop) is **6.40 m (21 ft)**, and side run-off (sideline to sidestop) is **3.66 m (12 ft)**. The ITF document says this is "as a guide for international competitions". The diagram shows a 36.58 × 18.28 m (120 × 60 ft) enclosure, and indoor show courts need ≥ 9 m free height at the net.

## 5. iOS Safari DeviceOrientation / DeviceMotion for a PWA
- **Permission:** since iOS 13, call `DeviceOrientationEvent.requestPermission()` and/or `DeviceMotionEvent.requestPermission()`. Each returns a Promise of `"granted"` or `"denied"`. The call must come from **transient user activation** (a click; `touchend` works but `touchstart` reportedly does not), otherwise it rejects with `NotAllowedError`. It requires a **secure context (HTTPS)**, and iOS auto-denies the request on HTTP [15][16]. Feature-detect with `typeof DeviceOrientationEvent.requestPermission === 'function'`. The grant is cached per origin; there is no API to query its state, so show a "Enable sensors" button [17]. iOS 12.2–12.4 instead had a Settings toggle ("Motion & Orientation Access"), off by default.
- **Euler angles (W3C, intrinsic Z-X'-Y''):** alpha ∈ [0,360) is about z; **beta** ∈ [−180,180) is about x (front-back); **gamma** ∈ [−90,90) is about y (left-right). The device axes are x to the right of the screen and y up the screen (portrait), with z out of the screen. **The rear camera looks along −z** [13].
- **Camera pitch formula.** The device z-axis expressed in Earth coordinates is R·ẑ = (sinγ, −sinβ·cosγ, cosβ·cosγ). Its vertical component is `cosβ·cosγ`. The rear camera's optical axis is −z, so:

  ```
  tiltDown = asin( cos(beta) * cos(gamma) )   // degrees: 0 = horizontal, +90 = looking straight down
  ```

  This is **independent of roll and of portrait or landscape orientation**, so no `screen.orientation` handling is needed. It also avoids the beta/gamma gimbal flips that occur when an iPhone is held in landscape.
- **Accelerometer alternative:** use `devicemotion` `accelerationIncludingGravity` (a_x, a_y, a_z) with the phone at rest: `tiltDown = asin(clamp(s · a_z / |a|, −1, 1))`. Under the spec, a phone lying flat face-up gives a_z ≈ +9.81, so s = +1. iOS Safari has historically reported this vector with the **opposite sign** to the spec/Android (UNCONFIRMED for current iOS). Determine s on the device by checking that it agrees with the orientation formula, or that a phone held flat face-up reads +90°. Low-pass filter the readings (for example an EMA with α ≈ 0.1) and require |a| ≈ 9.8 to reject movement.

## Sources
1. SwingVision, "Set Up Your Recording" — https://swing.vision/guides/set-up-your-recording (text from https://swing.vision/locales/en/guides-set-up-your-recording.json)
2. SwingVision Swing Stick shop page and newsletter — https://swing.vision/shop/swing-stick-offer , https://swing.vision/newsletters/android-update ; product strings at https://swing.vision/locales/en/product.json , FAQ at https://swing.vision/locales/en/faq-orders.json
3. tennis.com, "SwingVision delivers pro-level insights for recreational players" — https://www.tennis.com/news/articles/swingvision-delivers-pro-level-insights-for-recreational-players
4. ITF PAT approval report PAT-25-037 (SwingVision, 31/10/2025) — https://www.itftennis.com/media/15294/pat-25-037-approval-report-swingvision.pdf
5. SwingVision YouTube, "How To Set Up Your SwingVision Recording" (2021) — https://www.youtube.com/watch?v=Q4jWP2EXWRU ; 2024 version — https://www.youtube.com/watch?v=-sQ_XP1HxXs
6. Better Pickleball, SwingVision review (search snippet; page returned HTTP 500) — https://betterpickleball.com/swingvision-review/
7. ITF, Court Size / Org requirements — https://www.itftennis.com/media/9026/court-size-org-requirements.pdf ; ITF Rules of Tennis 2026 (Rule 1, Appendix X) — https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf
8. Apple, iPhone 12 tech specs — https://support.apple.com/en-gb/111876
9. Apple, iPhone 12 mini tech specs — https://support.apple.com/en-gb/111877
10. Amazon replacement holder (linked from SwingVision FAQ) — https://www.amazon.com/dp/B0B5Z5435D
11. Functional Tennis camera mount — https://www.functionaltennis.com/pages/camera-mount-setup
12. DXOMARK iPhone 12 camera review — https://www.dxomark.com/apple-iphone-12-camera-review-pro-level-video-amateur-zoom/ ; sensor size — https://www.kimovil.com/en/apple-iphone-12/camera
13. W3C DeviceOrientation Event spec — https://www.w3.org/TR/orientation-event/
14. Apple Developer Forums, "Camera field of view when taking photos" — https://developer.apple.com/forums/thread/97353
15. MDN, DeviceOrientationEvent.requestPermission() — https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static
16. "Using HTML5 accelerometer and gyroscope in 2020" — https://yal.cc/js-device-motion/
17. Apple Developer Forums, "Unable to check DeviceOrientationEvent" — https://developer.apple.com/forums/thread/128376

---

## Swing Stick 1st gen — physical details

Researched 2026-10-19 (second pass). This supersedes the "mostly UNCONFIRMED" table in §1. Confidence: **High** means an official SwingVision image or statement, **Med** means a consistent third-party report or a careful inference, and **Low** means an estimate.

### Headline numbers

| Item | Value | Confidence | Source |
|---|---|---|---|
| Pole length | **22" collapsed → 72" extended (56–183 cm)**, telescoping | High | Official diagram [S1] |
| Sections / locks | 4 flip locks: **1 above the fork** (raises the phone) and **3 below the fork** (extend the handle downward), so about 5 tube sections | High (lock layout) / Med (section count) | Diagram [S1]; official setup video [S3]; unboxing [S4] ("it's got three") |
| Upward extension, top of fork collar → phone-holder joint | **24"** in the official "Swing Stick Extended" photo (2nd Gen photo: 22") | High | [S2], [S6] |
| **Fence top rail → phone camera, upper section fully extended** | **≈ 0.8 m (31–33"); range 0.75–0.90 m** | Med (photo estimate) | Pixel measurement, below |
| Fence top rail → phone camera, upper section collapsed | ≈ 0.23 m (≈ 9"); range 0.18–0.30 m | Low–Med | Pixel measurement, below |
| Shipping box | 26.78 × 7 × 3, weight 2.857 (units not given; almost certainly in and lb, so 68 × 18 × 7.6 cm and 1.3 kg boxed). 2nd Gen: 26.5 × 7 × 3, 2.4 | High (values) / Med (units) | SwingVision product API [S5] |

### 1. How it attaches

- **Primary method: a "fork" hooks down over the fence top rail.** The fork is a moulded bracket clamped to the pole. It has two prongs that straddle the top rail, with the pole hanging down on the court side. Official setup video: "If you're playing outdoors secure the fork on top of the fence. You can also bend the fork with your hands in case the fence is too thick or too thin" [S3]. The product photos show the fork seated on a chain-link top rail [S2]. Unboxing: "this part here clips on top of the fence… then you just hook this bit over the fence" [S4]. Confidence: High.
- **Backup method: partway down on the chain-link mesh.** "As a backup you can also attach the Swing Stick lower to the ground on any diamond using the rear knob" [S3]. The printed instructions, read aloud in [S4], say "on the fence itself using the rear diamond knob". The rear knob is a screw clamp on the back of the fork that grips a mesh diamond. **So the stick does NOT have to sit on the fence top.** It can clamp at any height on chain-link mesh. SwingVision frames this as a fallback, not the recommended method. Confidence: High.
- **Indoors:** "attach by sliding the curtain against the back of the fork". A "curtain stabilizer" fin sits under the fork [S1][S3]. It can rotate on curtains, hence the third-party MakerWorld stabilizer noted in §1.
- **Lineage of the design.** SwingVision calls it "our patented phone mount". The only mount patent owned by SwingVision's company (Mangolytics, Inc.) is **US 8,152,389 B1, "Camera support apparatus"** (Mike Lammens, filed 2010). It was assigned to Mangolytics nunc pro tunc in February 2023, a month before the Swing Stick launched [S7]. The patent describes an inverted-U, two-finger spring clip that slides over a fence top rail with the chain-link mesh trapped between one finger and the rail. Patent figures: about 2.0" finger gap, 3.5" fingers, a 1.653" rail with 0.462" mesh, and about 2.3 lbf clamp. A telescoping aluminium extension pole with collet clamps lets one person hang the clip "on a tennis court fence structure… about twelve feet" without a ladder. The patent covers the concept; the Swing Stick's actual fork is a plastic moulding with a knob, so the dimensions are indicative only. Confidence: High that it is the patent, Med that it describes the 1st-gen fork.

### 2. Geometry and the attachment-to-camera height

**How the pole works.** The fork sits near the top of the pole. The sections **below** the fork telescope downward to form a long handle, which lets you lift the fork onto a rail above head height. The single section **above** the fork telescopes upward to raise the phone: "open the flip locks below the fork to extend the pole… to get an even higher viewpoint open the flip lock above the fork to extend the pole upwards" [S3]. Only the upper section changes the camera height above the rail. A user who has recorded about 200 matches recommends "this last adjustment height extended as much as possible… gives a better perspective" [S8].

**Estimating camera height from the official photos.** No direct measurement exists, so these are pixel measurements.
- **Extended photo [S2]:** the 24" scale bar spans about 410 px in the original 1125-px image, so about 17 px/in. The bar runs from the top of the flip-lock collar just above the fork to the holder/tilt-knob joint.
  - The rear-camera lens cluster sits about 5–6" above the top of the bar. The phone is landscape in a clamp holder with about 1" of clamp below it.
  - The bottom of the bar sits about 2.5–3.5" above the top of the rail (the fork's own height).
  - Total: 24 + 5.5 + 3 ≈ **32" ≈ 0.81 m** from rail top to lens.
  - Cross-check: the phone's measured vertical extent (an iPhone 13 Pro, tilted in-plane) agrees with its known size to within about 15%. Range **0.75–0.90 m**.
- **Collapsed photo [S2]:** the scale comes from the phone's long edge (146.7 mm ≈ 372 px in a 2× crop). The lens is about 580 px, or **about 23 cm (9")**, above the top of the rail. The shot looks steeply upward, which shortens vertical distances, so take 0.18–0.30 m.
- The 2nd Gen photo shows 22" from the collar to the bottom of the holder [S6], consistent with the 1st Gen.
- The earlier "~2 ft above fence" figure [6] matches the 24" pole extension, not the lens height. **For the PWA use camera = fence top + 0.8 m (range 0.75–0.9 m) when the stick is fully raised**, or +0.25 m when the upper section is collapsed.

### 3. Tilt mechanism

- **Single-axis tilt pivot** under the phone holder, locked by a thumb **"tilt knob"** (a friction clamp, not detents) [S1]. Confidence: High.
- **Alignment markings:** the official instruction is "tilt the phone forward until the marking on the right lines up with the **bottommost marking on the left**; tighten the knob to secure" [S3]. A user describes "three markers… you have to figure out which one works for your court"; he sets his line "just below the bottommost" mark [S8]. So there is one index mark and **three reference marks**, with continuous adjustment between them. Confidence: Med–High.
- **What the marks mean in degrees: UNCONFIRMED.** The predecessor patent says the marked preset for a tennis court is a line of sight "approximately 15 degrees" to the court surface, for a 12 ft rail [S7]. The Swing Stick's three marks are probably presets around that value. Total tilt range: **UNCONFIRMED**.
- The phone holder can be mounted facing either way on the pivot; [S8] prefers the phone hanging against the fixture for safety.
- In-app tips the app shows when framing is wrong: "Set up higher on the fence", "Tilt your device farther down/up", "Center your device", "Fit the entire court in view" (`/locales/en/remote_control.json`). The app warns of a "Suboptimal Setup" in which "shot speeds and line calls may be inaccurate". The 2nd Gen replaces the knob with a motorised "control head".

### 4. Tall fences (5–6 m / 18–20 ft)

- **Reach limit (inference, Med):** about 48" of handle below the fork plus a person's overhead reach of about 2.1–2.3 m lets you hook the fork onto a rail at roughly **3.3–3.6 m (11–12 ft)**. The patent's design case is a 12 ft fence. A user notes the fully extended pole is "an awkward thing" and extends it one section at a time before hooking it on [S8].
- **Beyond that, use the official fallback:** clamp the fork to a mesh diamond with the rear knob at a height you can reach [S3], so the camera is at the clamp height plus about 0.8 m. Alternatives are a ladder, or hooking onto a lower horizontal rail if the fence has one (common on 18–20 ft fences). No SwingVision source mentions doing this.
- **SwingVision publishes no maximum or minimum fence height.** The only guidance is directional: higher is better ("Set up higher on the fence" in-app; "you really want it to get really high" [S4]).
- I found no Reddit (r/10s, r/swingvisionapp; the API returned 403), Tennis Warehouse or Amazon material on tall fences. The Swing Stick is sold only via swing.vision, and eBay returned 403.

### Sources (this section)
- S1. Official diagram, `https://swing.vision/images/order/swing-stick-diagram.png` (alt "Swing Stick Diagram"). Labels: tilt knob, flip locks, rear knob, fork, curtain stabilizer, pole, sunshade, "22" - 72"".
- S2. Official photos, `https://swing.vision/images/order/swing-stick-extended.png` ("Swing Stick Extended", 24" bar) and `.../swing-stick-collapsed.png` ("Swing Stick Collapsed"). Gallery array `xne` in `swing.vision/static/js/main.48159186.js`.
- S3. SwingVision, "How to Set Up Your SwingVision Recording for Tennis or Pickleball", https://www.youtube.com/watch?v=-sQ_XP1HxXs (auto transcript, 1:01–2:10).
- S4. "Swing Stick Unboxing by SwingVision", https://www.youtube.com/watch?v=2MjI_SXzMuE (user video; includes the printed instructions read aloud).
- S5. SwingVision product API, `https://api.swing.tennis/v1/products/available` (fields length/width/height/weight; `swing-stick` bundle created 2023-02-09, $99.99 list price).
- S6. Official 2nd Gen photo, `https://swing.vision/images/order/ss2g-height-measure.png` (22"), and `ss2g-diagram.png`.
- S7. US 8,152,389 B1, "Camera support apparatus", https://patents.google.com/patent/US8152389B1/en (current assignee Mangolytics Inc.; reel/frame 062773/0413).
- S8. "Mastering SwingVision Mount Setup: Tips & Tricks for Perfect Tennis Recording", https://www.youtube.com/watch?v=9pIStuFs_Mo (user, about 200 matches recorded).

## Swing Stick 1st gen: the user's own measurements (2026-10-19)

Measured with a tape on the user's stick. These replace the photo estimates above. "Rest" is the part of the fork that sits on the top rail; "knob" is the fence-hook knob ("nobble").

| Measurement | Value |
|---|---|
| Top of phone clamp → base, everything collapsed | 76 cm |
| Same, top section raised | 124 cm (top section adds 48 cm) |
| Knob → base, collapsed | 51 cm (knob is 3 cm below the rest) |
| Rest → base, collapsed | 54 cm |
| Rest → base, only the lowest section open | 95 cm (+41) |
| Rest → base, only the middle section open | 97 cm (+43) |
| Rest → base, only the highest lower section open | 97 cm (+43) |
| Rest → base, all three open (derived) | 181 cm |
| Rest → bottom jaw of the phone clamp, collapsed | ≈ 12.5 cm (scaled from the user's photo: 22.6 px/cm; to confirm) |
| Rest → camera lens, top section raised (derived) | ≈ 0.64 m (lens 1.3–5.9 cm above the jaw, depending which way up the phone is clamped) |

This stick is longer than SwingVision's "22–72 in" diagram: about 76 cm collapsed and about 2.5 m fully extended.
