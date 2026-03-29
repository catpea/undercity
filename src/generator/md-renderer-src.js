// ── Markdown renderer (embedded, zero-dependency) ─────────────────────────────
// This file is read by src/generator/runtime.js and embedded verbatim into the
// generated runtime bundle.  It must NOT use ES module syntax (import/export).
function _mdEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _mdInline(text) {
  const codes = [];
  text = text.replace(/`([^`\n]+)`/g, function(_,c){codes.push(_mdEsc(c));return '\x00c'+(codes.length-1)+'\x00';});
  text = _mdEsc(text);
  text = text.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/___(.+?)___/g,'<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/__(.+?)__/g,'<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/(?<!\w)_(.+?)_(?!\w)/g,'<em>$1</em>');
  text = text.replace(/~~(.+?)~~/g,'<del>$1</del>');
  text = text.replace(/!\[([^\]]*)\]\(([^)"]+)(?:\s+"([^"]*)")?\)/g,function(_,alt,src,t){return '<img alt="'+alt+'" src="'+src+'"'+(t?' title="'+t+'"':'')+'>';});
  text = text.replace(/\[([^\]]+)\]\(([^)"]+)(?:\s+"([^"]*)")?\)/g,function(_,label,href,t){return '<a href="'+href+'"'+(t?' title="'+t+'"':'')+'>'+label+'</a>';});
  text = text.replace(/\x00c(\d+)\x00/g,function(_,i){return '<code>'+codes[+i]+'</code>';});
  text = text.replace(/  \n/g,'<br>\n');
  return text;
}
function _renderMd(md) {
  const lines = md.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  const out=[]; let i=0;
  while(i<lines.length){
    const line=lines[i];
    const fence=line.match(/^(`{3,}|~{3,})(.*)/);
    if(fence){
      const f=fence[1],lang=fence[2].trim().split(/\s+/)[0]||''; i++;
      const cl=[];
      while(i<lines.length&&!lines[i].startsWith(f)){cl.push(lines[i]);i++;}
      if(i<lines.length)i++;
      out.push('<pre><code'+(lang?' class="language-'+_mdEsc(lang)+'"':'')+'>'+_mdEsc(cl.join('\n'))+'</code></pre>');
      continue;
    }
    const hM=line.match(/^(#{1,6})\s+(.*?)(?:\s+#+\s*)?$/);
    if(hM){out.push('<h'+hM[1].length+'>'+_mdInline(hM[2])+'</h'+hM[1].length+'>');i++;continue;}
    if(/^[ ]{0,3}(?:[-]{3,}|[*]{3,}|[_]{3,})\s*$/.test(line)){out.push('<hr>');i++;continue;}
    if(/^>\s?/.test(line)){
      const bl=[];
      while(i<lines.length&&(/^>\s?/.test(lines[i])||lines[i]==='>')){bl.push(lines[i].replace(/^>\s?/,''));i++;}
      out.push('<blockquote>\n'+_renderMd(bl.join('\n'))+'\n</blockquote>');
      continue;
    }
    if(/^[-*+] /.test(line)){
      out.push('<ul>');
      while(i<lines.length&&/^[-*+] /.test(lines[i])){out.push('<li>'+_mdInline(lines[i].replace(/^[-*+] /,''))+'</li>');i++;}
      out.push('</ul>'); continue;
    }
    if(/^\d+\. /.test(line)){
      out.push('<ol>');
      while(i<lines.length&&/^\d+\. /.test(lines[i])){out.push('<li>'+_mdInline(lines[i].replace(/^\d+\. /,''))+'</li>');i++;}
      out.push('</ol>'); continue;
    }
    if(line.trim()===''){i++;continue;}
    if(i+1<lines.length){
      if(/^=+\s*$/.test(lines[i+1])){out.push('<h1>'+_mdInline(line)+'</h1>');i+=2;continue;}
      if(/^-+\s*$/.test(lines[i+1])&&lines[i+1].length>=2){out.push('<h2>'+_mdInline(line)+'</h2>');i+=2;continue;}
    }
    const pl=[];
    while(i<lines.length){
      const l=lines[i];
      if(l.trim()==='')break;
      if(/^(`{3,}|~{3,}|#{1,6} |>\s?|[-*+] |\d+\. )/.test(l))break;
      if(/^[ ]{0,3}(?:[-]{3,}|[*]{3,}|[_]{3,})\s*$/.test(l))break;
      if(i+1<lines.length&&/^[=-]{2,}\s*$/.test(lines[i+1]))break;
      pl.push(l);i++;
    }
    if(pl.length)out.push('<p>'+_mdInline(pl.join('\n'))+'</p>');
  }
  return out.join('\n');
}

// ── HTML sanitiser (for display.safeHtml) ─────────────────────────────────────
function _sanitizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');
}
