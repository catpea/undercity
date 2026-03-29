/** media.askVideoUpload — Show video file picker with optional preview */
import { _container } from '../../_shared/container.js';

export function askVideoUpload(label = 'Upload a video', accept = 'video/*', thumbnailPrompt = '', extractThumb = true) {
  return _uploadUI({ label, accept, showPreview: !!extractThumb, previewType: 'video' });
}

function _fileToObj(file) {
  return { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) };
}

function _uploadUI({ label, accept, multiple = false, showPreview, previewType }) {
  return new Promise(resolve => {
    const ct = _container();
    const wrap = document.createElement('div');
    wrap.className = 'pw-media-wrap card border-secondary bg-transparent p-4 text-center mx-auto my-3';
    wrap.style.maxWidth = '420px';

    const promptEl = document.createElement('p');
    promptEl.className = 'fw-semibold mb-3';
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
    ct.appendChild(wrap);

    inp.addEventListener('change', () => {
      const file = inp.files[0];
      if (!file) return;
      if (showPreview && previewType) {
        previewEl.innerHTML = '';
        previewEl.classList.remove('d-none');
        const url = URL.createObjectURL(file);
        if (previewType === 'video') {
          const vid = document.createElement('video');
          vid.src = url; vid.controls = true; vid.className = 'w-100 rounded'; vid.style.maxHeight = '240px';
          previewEl.appendChild(vid);
        } else if (previewType === 'image') {
          const img = document.createElement('img');
          img.src = url; img.className = 'img-fluid rounded'; img.style.maxHeight = '240px';
          previewEl.appendChild(img);
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
