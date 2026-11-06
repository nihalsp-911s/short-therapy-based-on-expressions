// Live scanning uses only the lightweight detector. The expensive SSD detector
// is reserved for the explicit photo test, never the live camera loop.
export async function locateFaces(api, frame) {
  return api.detectAllFaces(frame,
    new api.TinyFaceDetectorOptions({inputSize:224, scoreThreshold:0.3}));
}
