import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locateFaces} from './detection.js';
function mock(results) {
 const calls=[];
 const api={TinyFaceDetectorOptions:class{},SsdMobilenetv1Options:class{},
 nets:{ssdMobilenetv1:{isLoaded:false,async loadFromUri(){calls.push('load');this.isLoaded=true;}}},
 async detectAllFaces(frame,options){calls.push(options.constructor);return results.shift();}};
 return {api,calls};
}
test('repeated misses never trigger a heavy live detector or download',async()=>{
 const {api,calls}=mock(Array.from({length:20},()=>[]));
 for(let i=0;i<20;i++)assert.equal((await locateFaces(api,{})).length,0);
 assert.equal(calls.length,20);assert.ok(calls.every(x=>x===api.TinyFaceDetectorOptions));
});
test('does not download fallback when tiny detector succeeds',async()=>{
 const {api,calls}=mock([[{score:.8}]]);
 assert.equal((await locateFaces(api,{},'models')).length,1);assert.equal(calls.length,1);
});
test('preserves multiple faces for enrollment safety',async()=>{
 const {api}=mock([[{score:.8},{score:.7}]]);
 assert.equal((await locateFaces(api,{},'models')).length,2);
});
