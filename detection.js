// Keep face location separate from landmark/descriptor enrichment: a landmark
// failure must not be reported as an absence of faces.
let misses=0;
export async function locateFaces(api, frame, modelRoot, onFallback=()=>{}) {
  let faces = await api.detectAllFaces(frame,
    new api.TinyFaceDetectorOptions({inputSize:320, scoreThreshold:0.3}));
  if (faces.length) misses=0;
  if (!faces.length && ++misses % 5 === 0) {
    onFallback();
    if (!api.nets.ssdMobilenetv1.isLoaded) {
      await api.nets.ssdMobilenetv1.loadFromUri(modelRoot);
    }
    faces = await api.detectAllFaces(frame,
      new api.SsdMobilenetv1Options({minConfidence:0.4}));
  }
  return faces;
}
