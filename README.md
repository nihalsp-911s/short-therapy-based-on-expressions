# Kindspace
Browser-based expression check-ins, supportive suggestions, a breathing exercise, a memory game, and consent-based face enrollment.

## Run
Requires Python 3 and Node 18+ for tests; no package installation needed.

```
npm start
npm test
```
Open localhost port 3000 on your own machine. Camera access requires localhost or HTTPS and browser permission. A remote cloud machine cannot access your local webcam directly.

The first camera start loads face-api.js 0.22.2 from jsDelivr and pretrained tiny face detector, landmarks, expression and face-recognition weights from the upstream face-api.js GitHub repository. Internet access is required. Manual check-ins and activities work without models. No API key or paid service is required. For production, vendor and integrity-pin these external assets and review model licensing and evaluation before deployment.

Seven model labels: happy, sad, angry, fearful, disgusted, surprised, neutral. These are uncertain facial-expression classifications, not reliable evidence of emotions or mental health. The user selects their feeling before receiving suggestions. Recognition uses nearest descriptor distance under 0.5 and shows a possible match, not authenticated identity.

Camera frames and inference remain in the browser. Optional named 128-number face templates persist in localStorage on that browser only; they are not encrypted and should not be saved on shared devices. Individual and delete-all controls remove templates. Stop camera ends its tracks. No backend or telemetry exists. The model/CDN hosts receive ordinary asset requests, not camera images.

## Validation limits
Unit tests cover matching and saved-template validation. Real camera accuracy, lighting, demographic performance, browser permissions, and model downloads require device testing. This is a wellbeing prototype, not therapy, diagnosis, or secure identity verification.
