// theme, navigation, syntax highlighting, code blocks, status bar (offline, no deps)
(function(){
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const page = (location.pathname.split('/').pop() || 'index.html').split(/[?#]/)[0] || 'index.html';
  const isHome = page === 'index.html';

  // ---- theme (initial value is applied in <head> to avoid a flash) ----
  function setTheme(t){
    root.setAttribute('data-theme', t);
    try{ localStorage.setItem('cpp-theme', t); }catch(e){}
  }
  $$('[data-theme-btn]').forEach(b => b.addEventListener('click', () => {
    setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  }));

  // ---- syntax highlighting ----
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const KEYWORDS = new Set(("alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq override final").split(/\s+/));
  const CONTROL = new Set("if else for while do switch case default break continue return goto try catch throw co_await co_return co_yield".split(/\s+/));
  const TYPES = new Set(("string vector map set unordered_map unordered_set array deque list stack queue pair tuple optional filesystem size_t uint int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t Matrix Point Color Animal Dog Cat Shape").split(/\s+/));
  const NAMESPACES = new Set(["std"]);
  const CPP_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[^\n]*)|\b(0[xX][0-9a-fA-F_']+|0[bB][01_']+|\d[\d_']*(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlLuU]*)\b|([A-Za-z_]\w*)/gm;

  function highlightCpp(src){
    const re = new RegExp(CPP_RE.source, 'gm');
    let out = '', last = 0, m;
    while((m = re.exec(src)) !== null){
      out += esc(src.slice(last, m.index));
      last = m.index + m[0].length;
      const [full, com, str, pre, num, ident] = m;
      if(com) out += '<span class="tok-c">'+esc(full)+'</span>';
      else if(str) out += '<span class="tok-s">'+esc(full)+'</span>';
      else if(pre) out += '<span class="tok-p">'+esc(full)+'</span>';
      else if(num) out += '<span class="tok-n">'+esc(full)+'</span>';
      else if(ident){
        if(CONTROL.has(ident)) out += '<span class="tok-cf">'+ident+'</span>';
        else if(KEYWORDS.has(ident)) out += '<span class="tok-k">'+ident+'</span>';
        else if(TYPES.has(ident)) out += '<span class="tok-t">'+ident+'</span>';
        else if(NAMESPACES.has(ident)) out += '<span class="tok-ns">'+ident+'</span>';
        else if(/^\s*\(/.test(src.slice(re.lastIndex, re.lastIndex + 40))) out += '<span class="tok-f">'+ident+'</span>';
        else out += ident;
      } else out += esc(full);
    }
    return out + esc(src.slice(last));
  }

  const SHELL_RE = /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'[^'\n]*')|(-{1,2}[A-Za-z][\w-]*)|(\$\{[^}]*\}|\$\w+)|([^\s"'#$|&;]+)|(\s+)|([\s\S])/g;

  function highlightShell(src){
    const re = new RegExp(SHELL_RE.source, 'g');
    let out = '', cmd = true, m;
    while((m = re.exec(src)) !== null){
      const [t, com, str, flag, vr, word, ws] = m;
      if(com){ out += '<span class="tok-c">'+esc(t)+'</span>'; }
      else if(str){ out += '<span class="tok-s">'+esc(t)+'</span>'; cmd = false; }
      else if(flag){ out += '<span class="sh-flag">'+esc(t)+'</span>'; }
      else if(vr){ out += '<span class="sh-var">'+esc(t)+'</span>'; }
      else if(word){
        if(cmd){ out += '<span class="sh-cmd">'+esc(t)+'</span>'; cmd = false; }
        else out += esc(t);
      }
      else if(ws){ if(ws.includes('\n')) cmd = true; out += ws; }
      else {
        if(t === '|' || t === ';' || t === '&') cmd = true;
        out += esc(t);
      }
    }
    return out;
  }

  const SHELL_START = /^(?:(?:g\+\+|clang\+\+|gcc|cd|ls|pwd|sudo|apt|pacman|brew|xcode-select|echo|where|which|cmake|make|gdb|valgrind|git|mkdir|cp|mv|rm|cat|python3?|pip|PS)(?:\s|$)|\$\s|\.\/|\.\\|~\/)/;
  function detectLang(src){
    const lines = src.split('\n').map(l => l.trim()).filter(l => l && !/^(#|\/\/)/.test(l));
    const shellHits = lines.filter(l => SHELL_START.test(l)).length;
    const cppHint = /^\s*#\s*(include|define|pragma|ifdef|ifndef)\b/m.test(src) || /\bint\s+main\b|std::|[;{}]/.test(lines.join('\n'));
    if(shellHits && !cppHint && shellHits / lines.length >= 0.3) return 'shell';
    if(cppHint) return 'cpp';
    if(/^\s*#?\s*(import\s+\w|from\s+\w+\s+import\s|def\s+\w+\s*\(|print\()/m.test(src)) return 'python';
    return 'text';
  }
  const LANG_LABEL = { cpp: 'C++', shell: 'Terminal', python: 'Python', text: 'Text' };
  const COPY_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.6"/><path d="M3 10.5V3.6C3 2.7 3.7 2 4.6 2H11"/></svg>';
  const UP_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5"/></svg>';

  async function copyText(text){
    try{ await navigator.clipboard.writeText(text); return true; }
    catch(e){
      const ta = document.createElement('textarea');
      ta.value = text; ta.className = 'sr-only-copy';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try{ ok = document.execCommand('copy'); }catch(err){}
      ta.remove();
      return ok;
    }
  }
  function flash(btn, ok){
    const label = btn.querySelector('span');
    label.textContent = ok ? 'Copied' : 'Failed';
    btn.classList.toggle('done', ok);
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { label.textContent = 'Copy'; btn.classList.remove('done'); }, 1400);
  }

  $$('pre').forEach(pre => {
    const code = pre.querySelector('code') || pre;
    const src = code.textContent.replace(/\n$/, '');
    const kind = detectLang(src);
    if(kind === 'cpp') code.innerHTML = highlightCpp(src);
    else if(kind === 'shell') code.innerHTML = highlightShell(src);
    else code.textContent = src;

    const wrap = document.createElement('div');
    wrap.className = 'codeblock';
    wrap.dataset.lang = kind;
    const bar = document.createElement('div');
    bar.className = 'codebar';
    const label = document.createElement('span');
    label.className = 'codelang';
    label.textContent = LANG_LABEL[kind];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copybtn';
    btn.innerHTML = COPY_ICON + '<span>Copy</span>';
    btn.setAttribute('aria-label', 'Copy code');
    btn.addEventListener('click', async () => {
      flash(btn, await copyText(pre.innerText.replace(/\n+$/, '')));
    });
    bar.append(label, btn);
    pre.parentNode.insertBefore(wrap, pre);
    wrap.append(bar, pre);
  });

  $$('table').forEach(t => {
    const w = document.createElement('div');
    w.className = 'tablewrap';
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
  });

  // ---- heading anchors ----
  const slug = s => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  $$('.content h2, .content h3').forEach(h => {
    if(!h.id){
      const base = slug(h.textContent) || 'section';
      let id = base, n = 2;
      while(document.getElementById(id)) id = base + '-' + (n++);
      h.id = id;
    }
    const a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + h.id;
    a.textContent = '#';
    a.setAttribute('aria-label', 'Link to this section');
    h.appendChild(a);
  });

  // ---- explorer tree: active page, collapse, filter ----
  $$('.tree-item, .navlinks a').forEach(a => {
    if(a.getAttribute('href') === page) a.classList.add('active');
  });

  function setCollapsed(group, collapsed){
    group.classList.toggle('collapsed', collapsed);
    $('.tree-head', group).setAttribute('aria-expanded', String(!collapsed));
  }
  $$('.tree-head').forEach(b => b.addEventListener('click', () => {
    const g = b.parentElement;
    setCollapsed(g, !g.classList.contains('collapsed'));
  }));

  const search = $('#search');
  function applyFilter(){
    const v = search.value.trim().toLowerCase();
    $$('.tree-group').forEach(g => {
      let hits = 0;
      $$('.tree-item', g).forEach(a => {
        const hit = !v || a.textContent.toLowerCase().includes(v);
        a.hidden = !hit;
        if(hit) hits++;
      });
      g.classList.toggle('empty', hits === 0);
      if(v && hits) setCollapsed(g, false);
    });
  }
  if(search){
    search.addEventListener('input', applyFilter);
    document.addEventListener('keydown', e => {
      const el = document.activeElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
      if(e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey){
        e.preventDefault();
        search.focus();
        search.select();
      } else if(e.key === 'Escape'){
        if(el === search){ search.value = ''; applyFilter(); search.blur(); }
        setNav(false);
      }
    });
  }

  // ---- mobile lessons drawer ----
  const menuBtn = $('[data-menu-btn]');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.addEventListener('click', () => setNav(false));
  document.body.appendChild(scrim);
  function setNav(open){
    document.body.classList.toggle('nav-open', open);
    if(menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  }
  if(menuBtn) menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  const sidebar = $('#sidebar');
  if(sidebar) sidebar.addEventListener('click', e => { if(e.target.closest('.tree-item')) setNav(false); });

  // ---- breadcrumb ----
  const activeItem = $('.tree-item.active');
  const content = $('.content');
  if(content && activeItem && !isHome){
    const group = activeItem.closest('.tree-group');
    const groupName = group ? $('.tree-head', group).textContent.trim() : '';
    const crumbs = document.createElement('nav');
    crumbs.className = 'crumbs';
    crumbs.setAttribute('aria-label', 'Breadcrumb');
    const sep = () => { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; crumbs.appendChild(s); };
    const home = document.createElement('a');
    home.href = 'index.html';
    home.textContent = 'Learn C++';
    crumbs.appendChild(home);
    if(groupName){
      sep();
      const g = document.createElement('span');
      g.textContent = groupName;
      crumbs.appendChild(g);
    }
    sep();
    const cur = document.createElement('span');
    cur.className = 'cur';
    cur.textContent = $('.ti-title', activeItem).textContent;
    crumbs.appendChild(cur);
    content.prepend(crumbs);
  }

  // ---- pager: "Previous / Next" cards ----
  $$('.pager a').forEach(a => {
    const raw = a.textContent.trim();
    const prev = /^←/.test(raw);
    const next = !prev && (/^Next/i.test(raw) || /→$/.test(raw));
    const title = raw
      .replace(/^←\s*/, '')
      .replace(/^Next:\s*/i, '')
      .replace(/\s*→$/, '')
      .replace(/\s*↑$/, '');
    a.className = 'pg ' + (prev ? 'pg-prev' : 'pg-next');
    a.textContent = '';
    if(prev || next){
      const l = document.createElement('span');
      l.className = 'pg-label';
      l.textContent = prev ? 'Previous' : 'Next';
      a.appendChild(l);
    }
    const t = document.createElement('span');
    t.className = 'pg-title';
    t.textContent = title;
    a.appendChild(t);
  });

  // ---- status bar, progress, back to top ----
  const totalLessons = $$('.tree-item .ti-num').filter(n => n.textContent.trim()).length;
  const num = activeItem ? $('.ti-num', activeItem).textContent.trim() : '';
  const bar = $('#progress');

  const sb = document.createElement('div');
  sb.className = 'statusbar';
  sb.setAttribute('role', 'status');
  sb.innerHTML =
    '<div class="sb-group"><span class="sb-item sb-mode">C++17</span>' +
    '<span class="sb-item">' + (num ? 'Lesson ' + num + ' of ' + totalLessons : 'Course overview') + '</span></div>' +
    '<div class="sb-group"><span class="sb-item sb-optional" id="sb-pct">0% read</span>' +
    '<span class="sb-item sb-optional">Spaces: 4</span>' +
    '<span class="sb-item sb-optional">UTF-8</span></div>';

  const toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.innerHTML = UP_ICON;
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.append(sb, toTop);

  const pct = $('#sb-pct');
  let ticking = false;
  function onScroll(){
    ticking = false;
    const h = document.documentElement;
    const max = (h.scrollHeight - h.clientHeight) || 1;
    const p = Math.min(1, Math.max(0, h.scrollTop / max));
    if(bar) bar.style.transform = 'scaleX(' + p + ')';
    if(pct) pct.textContent = Math.round(p * 100) + '% read';
    toTop.classList.toggle('show', h.scrollTop > 400);
  }
  addEventListener('scroll', () => {
    if(!ticking){ ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();
})();
