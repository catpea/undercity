// ── Media / File Upload ────────────────────────────────────────���──────────────
// Provides camera capture and file-upload UI primitives.
import { Actions }                from './actions.js';
import { _pwContainer, _pwCardBody } from './page-helpers.js';

export const Media = (() => {
  function _fileToObj(file) {
    return { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) };
  }
  function _uploadUI({ label='Select a file', accept='*/*', multiple=false, showPreview=false, previewType=null }) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'pw-media-wrap';

      const promptEl = document.createElement('label');
      promptEl.className = 'form-label fw-semibold';
      promptEl.textContent = label;

      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept || '*/*';
      if (multiple) inp.multiple = true;
      inp.className = 'form-control mb-3';

      const previewEl = document.createElement('div');
      previewEl.className = 'pw-media-preview mb-3 d-none';

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn-primary w-100 d-none';
      confirmBtn.textContent = 'Continue';

      wrap.append(promptEl, inp, previewEl, confirmBtn);
      _pwCardBody().appendChild(wrap);

      inp.addEventListener('change', () => {
        const file = inp.files[0];
        if (!file) return;
        if (showPreview && previewType) {
          previewEl.innerHTML = '';
          previewEl.classList.remove('d-none');
          const url = URL.createObjectURL(file);
          if (previewType === 'image') {
            const img = document.createElement('img');
            img.src = url; img.className = 'img-fluid rounded'; img.style.maxHeight = '240px';
            previewEl.appendChild(img);
          } else if (previewType === 'video') {
            const vid = document.createElement('video');
            vid.src = url; vid.controls = true; vid.className = 'w-100 rounded'; vid.style.maxHeight = '240px';
            previewEl.appendChild(vid);
          } else if (previewType === 'audio') {
            const aud = document.createElement('audio');
            aud.src = url; aud.controls = true; aud.className = 'w-100';
            previewEl.appendChild(aud);
          }
          confirmBtn.classList.remove('d-none');
        } else {
          wrap.remove();
          resolve(multiple ? Array.from(inp.files).map(_fileToObj) : _fileToObj(file));
        }
      });

      confirmBtn.addEventListener('click', () => {
        const files = Array.from(inp.files);
        if (!files.length) return;
        wrap.remove();
        resolve(multiple ? files.map(_fileToObj) : _fileToObj(files[0]));
      });
    });
  }

  return {
    askVideoUpload(label='Upload a video', accept='video/*', thumbnailPrompt='', extractThumb=true) {
      return _uploadUI({ label, accept, showPreview: !!extractThumb, previewType: 'video' });
    },
    askImageUpload(label='Upload an image', accept='image/*', preview=true) {
      return _uploadUI({ label, accept, showPreview: !!preview, previewType: 'image' });
    },
    askFileUpload(label='Upload a file', accept='*/*', multiple=false) {
      return _uploadUI({ label, accept, multiple: !!multiple, showPreview: false });
    },
    askAudioUpload(label='Upload audio', accept='audio/*') {
      return _uploadUI({ label, accept, showPreview: true, previewType: 'audio' });
    },
    async captureWebcam(label='Take a photo') {
      return new Promise(async (resolve, reject) => {
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
        catch (e) { Actions.toast('Camera access denied', 'danger'); reject(e); return; }

        const wrap = document.createElement('div');
        wrap.className = 'pw-media-wrap';

        const promptEl = document.createElement('label');
        promptEl.className = 'form-label fw-semibold';
        promptEl.textContent = label;

        const vid = document.createElement('video');
        vid.autoplay = true; vid.muted = true;
        vid.className = 'w-100 rounded mb-2';
        vid.srcObject = stream;

        const captureBtn = document.createElement('button');
        captureBtn.type = 'button';
        captureBtn.className = 'btn btn-primary w-100';
        captureBtn.textContent = 'Capture';

        wrap.append(promptEl, vid, captureBtn);
        _pwCardBody().appendChild(wrap);

        captureBtn.addEventListener('click', () => {
          const canvas = document.createElement('canvas');
          canvas.width = vid.videoWidth; canvas.height = vid.videoHeight;
          canvas.getContext('2d').drawImage(vid, 0, 0);
          const url = canvas.toDataURL('image/png');
          stream.getTracks().forEach(t => t.stop());
          wrap.remove();
          resolve({ url, type: 'image/png' });
        });
      });
    },
  };
})();
