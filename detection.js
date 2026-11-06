// Keep face location separate from landmark/descriptor enrichment: a landmark
// failure must not be reported as an absence of faces.
export async function locateFaces(api, frame, modelRoot) {
  let faces = await api.detectAllFaces(frame,
    new api.TinyFaceDetectorOptions({inputSize:608, scoreThreshold:0.3}));
  if (!faces.length) {
    if (!api.nets.ssdMobilenetv1.isLoaded) {
      await api.nets.ssdMobilenetv1.loadFromUri(modelRoot);
    }
    faces = await api.detectAllFaces(frame,
      new api.SsdMobilenetv1Options({minConfidence:0.4}));
  }
  return faces;
}
