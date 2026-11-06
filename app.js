import {locateFaces} from './detection.js?v=6';
import {messages,matchFace,validPeople} from './logic.js';
const $=id=>document.getElementById(id);let stage='idle',lastError='',lastScanMs=0;
function setStage(value){stage=value;$('progress').textContent=value;}
let scanBusy=false; let stream,active=false,generation=0,latest=null,people=[],breathTimer,gameVersion=0;
try{people=validPeople(JSON.parse(localStorage.getItem('kindspace-faces')||'[]'));}catch{}
function persist(next){try{localStorage.setItem('kindspace-faces',JSON.stringify(next));people=next;renderPeople();return true;}catch{$('identity').textContent='Could not update storage. Check browser storage permissions.';return false;}}
function renderPeople(){$('people').replaceChildren();for(const p of people){const row=document.createElement('p');row.textContent=p.name+' ';const b=document.createElement('button');b.className='text';b.textContent='Forget';b.onclick=()=>{if(persist(people.filter(x=>x!==p)))$('identity').textContent='Face deleted.';};row.append(b);$('people').append(row);}}
renderPeople();for(const mood of Object.keys(messages)){const b=document.createElement('button');b.className='secondary';b.textContent=mood;b.onclick=()=>{$('greeting').textContent='Thanks for checking in.';$('suggestion').textContent=messages[mood];document.querySelectorAll('#moods button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};$('moods').append(b);}
async function loadModel(){if(!window.faceapi){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/face-api.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Model library could not load.'));};document.head.append(s);});}setStage('Preparing inference engine');await faceapi.tf.setBackend($('compatibility').checked?'cpu':'webgl');const root='./models';setStage('Loading detector and expression models');await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(root),faceapi.nets.faceExpressionNet.loadFromUri(root)]);}
function stop(){active=false;generation++;latest=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;$('placeholder').hidden=false;$('start').disabled=false;$('stop').disabled=true;$('status').textContent='Camera is off.';$('prediction').textContent='Camera stopped.';$('confirm').hidden=true;}
$('stop').onclick=stop;window.addEventListener('pagehide',stop);
$('start').onclick=async()=>{const token=++generation;$('start').disabled=true;$('stop').disabled=false;$('status').textContent='Loading expression and recognition models…';try{await Promise.race([loadModel(),new Promise((_,reject)=>setTimeout(()=>reject(Error("Model loading timed out")),45000))]);if(token!==generation)return;setStage('Waiting for camera permission');const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:24}},audio:false});if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;$('video').srcObject=stream;await $('video').play();if(token!==generation)return;active=true;$('placeholder').hidden=true;$('status').textContent='Checking your face…';scan(token);}catch(e){if(token!==generation)return;stop();lastError=e.message;setStage('Startup failed: '+e.message);$('status').textContent='Camera or model unavailable. See the error below.';}};
async function scan(token) {
  if (!active || token !== generation) return;
  if(scanBusy){setTimeout(()=>scan(token),500);return;}
  scanBusy=true;const started=performance.now();
  const watchdog=setTimeout(()=>{if(token===generation){stop();$('status').textContent='Processing took too long. Camera stopped. Try restarting or use a manual check-in.';}},60000);
  try {
    const video = $('video');
    if (video.readyState < 2 || !video.videoWidth) {
      $('status').textContent = 'Waiting for camera frames…';
    } else {
      // Snapshot the actual camera pixels at their native dimensions.
      const frame = document.createElement('canvas');
      const scale=Math.min(1,480/video.videoWidth);
      frame.width = Math.round(video.videoWidth*scale);
      frame.height = Math.round(video.videoHeight*scale);
      frame.getContext('2d').drawImage(video, 0, 0, frame.width, frame.height);
      setStage('Locating a face');
      const faces = await locateFaces(faceapi, frame,
        './models',()=>setStage('Trying stronger detector — this can take up to a minute'));
      if (token !== generation) return;
      latest = null;
      if(faces.length!==1){$('prediction').textContent='No expression estimate yet.';$('confirm').hidden=true;}
      $('identity').textContent = '';
      if (faces.length === 1) {
        setStage('Face found — estimating expression');
        const crops = await faceapi.extractFaces(frame, faces);
        const crop = crops[0];
        const expressions = await faceapi.recognizeFaceExpressions(crop);
        if (token !== generation) return;
        const [label, confidence] = Object.entries(expressions).sort((a,b)=>b[1]-a[1])[0];
        $('prediction').textContent = `Possible expression: ${label} (${Math.round(confidence*100)}%)`;
        $('confirm').hidden=false;
        $('confirm').onclick=()=>{$('greeting').textContent='Thanks for checking in.';$('suggestion').textContent=messages[label];};
        $('status').textContent = confidence >= .6
          ? `Possible expression: ${label}. Does that fit? Choose your feeling below.`
          : `Uncertain expression: ${label} (${Math.round(confidence*100)}%). Choose how you feel below.`;
        setStage('Expression updated');
        if(people.length || $('consent').checked) try {
          setStage('Expression ready; checking saved identity');const root='./models';
          await Promise.all([faceapi.nets.faceLandmark68Net.isLoaded?null:faceapi.nets.faceLandmark68Net.loadFromUri(root),faceapi.nets.faceRecognitionNet.isLoaded?null:faceapi.nets.faceRecognitionNet.loadFromUri(root)]);
          if(token!==generation)return;
          const landmarks = await faceapi.detectFaceLandmarks(crop);
          const aligned = await faceapi.extractFaces(crop, [landmarks.align()]);
          const descriptor = await faceapi.computeFaceDescriptor(aligned[0]);
          if (token !== generation) return;
          latest = {face:{descriptor}, time:Date.now()};
          const match = matchFace(Array.from(descriptor), people);
          $('identity').textContent = match ? `Possible match: ${match.name}.` : 'No saved face matched.';
        } catch {
          if (token !== generation) return;
          $('identity').textContent = 'Face found, but recognition is unavailable. Face the camera directly to try again.';
        }
      } else {
        $('status').textContent = faces.length
          ? 'Please keep only one face in view.'
          : 'Neither detector found a face. Move closer and light your face from the front.';
      }
    }
  } catch (error) {
    if (token !== generation) return;
    latest = null;
    $('status').textContent = 'Face processing failed. Check your connection and restart the camera.';
    lastError=error.message;setStage('Processing failed: '+error.message);console.error('Face processing failed:', error);
  }
  finally {clearTimeout(watchdog);scanBusy=false;lastScanMs=Math.round(performance.now()-started);}
  if (active && token === generation) setTimeout(()=>scan(token), 1200);
}
$('save').onclick=()=>{const name=$('name').value.trim();if(!$('consent').checked||!name){$('identity').textContent='Enter your name and agree to save your face first.';return;}if(!active||!latest||Date.now()-latest.time>2500){$('identity').textContent='Start the camera and keep one face clearly in view.';return;}if(people.length>=20){$('identity').textContent='Limit reached. Delete a saved face first.';return;}if(persist([...people.filter(p=>p.name!==name),{name,descriptor:Array.from(latest.face.descriptor)}])){$('identity').textContent='Saved on this browser.';$('consent').checked=false;}};
$('delete').onclick=()=>{if(persist([]))$('identity').textContent='All saved faces deleted.';};
$('breathe').onclick=()=>{clearInterval(breathTimer);const box=$('breathing');box.hidden=!box.hidden;if(box.hidden){$('breathe').textContent='Take a breathing break';return;}$('breathe').textContent='End breathing break';let i=0;box.textContent='Breathe in gently…';breathTimer=setInterval(()=>{box.textContent=++i%2?'Breathe out slowly…':'Breathe in gently…';},4000);};
$('play').onclick=()=>{const version=++gameVersion;const icons=['🌿','☀️','🌸','🌙','🌿','☀️','🌸','🌙'];for(let i=icons.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[icons[i],icons[j]]=[icons[j],icons[i]];}let selected=[],locked=false,pairs=0;$('game').hidden=false;$('game').replaceChildren();$('gameStatus').textContent='Find the four matching pairs.';icons.forEach((icon,i)=>{const b=document.createElement('button');b.textContent='?';b.setAttribute('aria-label',`Hidden card ${i+1}`);b.onclick=()=>{if(locked||b.disabled)return;b.textContent=icon;b.setAttribute('aria-label',icon);b.disabled=true;selected.push(b);if(selected.length===2){if(selected[0].textContent===selected[1].textContent){selected=[];pairs++;$('gameStatus').textContent=pairs===4?'All pairs found. Nicely done!':`${pairs} of 4 pairs found.`;}else{locked=true;setTimeout(()=>{if(version!==gameVersion)return;selected.forEach(x=>{x.textContent='?';x.setAttribute('aria-label','Hidden card');x.disabled=false;});selected=[];locked=false;},900);}}};$('game').append(b);});};

$('copyDiagnostics').onclick=async()=>{
 const report=JSON.stringify({version:6,stage,error:lastError,scanMs:lastScanMs,camera:{readyState:$('video').readyState,width:$('video').videoWidth,height:$('video').videoHeight},backend:window.faceapi?.tf.getBackend(),browser:navigator.userAgent},null,2);
 $('diagnostics').textContent=report;
 try{await navigator.clipboard.writeText(report);$('copyDiagnostics').textContent='Copied — paste this into chat';}catch{$('copyDiagnostics').textContent='Select and copy the details below';}
};
$('photo').onchange=async(event)=>{
 const file=event.target.files[0];if(!file)return;
 if(scanBusy){$('status').textContent='Stop the camera and wait for processing to finish before testing a photo.';return;}
 stop();const token=generation;scanBusy=true;$('start').disabled=true;
 const url=URL.createObjectURL(file);
 try{
  setStage('Loading models for photo test');await loadModel();
  const img=new Image();img.src=url;await img.decode();
  const frame=document.createElement('canvas');const ratio=Math.min(1,640/img.width);frame.width=Math.round(img.width*ratio);frame.height=Math.round(img.height*ratio);frame.getContext('2d').drawImage(img,0,0,frame.width,frame.height);
  setStage('Locating face in photo');
  let faces=await faceapi.detectAllFaces(frame,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.3}));
  if(!faces.length){setStage('Trying stronger photo detector — this can take up to a minute');if(!faceapi.nets.ssdMobilenetv1.isLoaded)await faceapi.nets.ssdMobilenetv1.loadFromUri('./models');faces=await faceapi.detectAllFaces(frame,new faceapi.SsdMobilenetv1Options({minConfidence:.4}));}
  if(token!==generation)return;
  if(faces.length!==1){$('prediction').textContent=faces.length?'Choose a photo containing one face.':'No face located in this photo.';return;}
  setStage('Estimating expression in photo');const crops=await faceapi.extractFaces(frame,faces);const expressions=await faceapi.recognizeFaceExpressions(crops[0]);if(token!==generation)return;
  const [label,score]=Object.entries(expressions).sort((a,b)=>b[1]-a[1])[0];$('prediction').textContent=`Photo expression estimate: ${label} (${Math.round(score*100)}%). Does that fit?`;
  $('status').textContent='Photo test complete. Photo stayed in your browser.';setStage('Photo expression updated');
 }catch(error){lastError=error.message;setStage('Photo test failed: '+error.message);}finally{URL.revokeObjectURL(url);scanBusy=false;$('start').disabled=false;event.target.value='';}
};
