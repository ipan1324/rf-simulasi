(function () {
  'use strict';
  const F = RF.fmt;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let data = JSON.parse(JSON.stringify(RF.DEFAULT_DATA));
  let sample = RF.DEFAULT_SAMPLE.slice();
  const params = { nT: 3, m: 2, seed: 12 };
  let res = null, activeTree = 0, lastFinal = null;
  const activeNode = {};

  const nAttr = () => data.attrs.length;
  const chip = (c) => '<span class="chip ' + esc(c) + '">' + esc(c) + '</span>';

  /* ====================== input ====================== */
  function renderTable() {
    let h = '<tr><th class="n">No</th>' + data.attrs.map((a) => '<th>' + esc(a.name) + '</th>').join('') + '<th>' + esc(data.target) + '</th></tr>';
    data.rows.forEach((r, i) => {
      h += '<tr><td class="n">' + (i + 1) + '</td>';
      r.forEach((v, j) => {
        const opts = j < nAttr() ? data.attrs[j].values : data.classes;
        h += '<td><select aria-label="' + esc((j < nAttr() ? data.attrs[j].name : data.target) + ' data ' + (i + 1)) + '" data-r="' + i + '" data-c="' + j + '"' + (j === nAttr() ? ' class="cls-' + esc(v) + '"' : '') + '>' +
          opts.map((o) => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></td>';
      });
      h += '</tr>';
    });
    $('tbl-data').innerHTML = h;
  }
  function renderSample() {
    $('sample-box').innerHTML = data.attrs.map((a, i) =>
      '<fieldset><legend>' + esc(a.name) + '</legend><div class="seg">' + a.values.map((o) =>
        '<label><input type="radio" name="smp' + i + '" value="' + esc(o) + '" data-s="' + i + '"' + (o === sample[i] ? ' checked' : '') + '><span>' + esc(o) + '</span></label>').join('') + '</div></fieldset>').join('');
  }
  function stepper(el, label, hint, key, min, max) {
    el.innerHTML = '<div class="stepper__lab">' + label + '<small>' + hint + '</small></div><div class="stepper__ctl"><button type="button" data-d="-1" aria-label="Kurangi ' + esc(label) + '">−</button><output>' + params[key] + '</output><button type="button" data-d="1" aria-label="Tambah ' + esc(label) + '">+</button></div>';
    const out = el.querySelector('output'), bs = el.querySelectorAll('button');
    const sync = () => { out.textContent = params[key]; bs[0].disabled = params[key] <= min; bs[1].disabled = params[key] >= max; };
    bs.forEach((b) => b.addEventListener('click', () => { params[key] = Math.max(min, Math.min(max, params[key] + (+b.dataset.d))); sync(); run(); }));
    sync();
  }
  function renderSteppers() {
    stepper($('st-trees'), 'Jumlah pohon', 'Satu pohon per bootstrap', 'nT', 1, 7);
    stepper($('st-m'), 'Atribut acak per node (m)', 'Dipilih acak di setiap node', 'm', 1, nAttr());
  }

  /* ====================== tabel data ====================== */
  function dataTable(tree, idxs, hiCols) {
    let h = '<div class="scroll"><table class="tbl"><tr><th class="n">No</th>' + data.attrs.map((a, i) => '<th' + (hiCols && hiCols.indexOf(i) >= 0 ? ' class="hi"' : '') + '>' + esc(a.name) + '</th>').join('') + '<th>' + esc(data.target) + '</th></tr>';
    idxs.forEach((i) => {
      const r = tree.bdata[i];
      h += '<tr><td class="n">' + (tree.bootstrap[i] + 1) + '</td>' + r.map((v, j) => '<td' + (j === nAttr() ? ' class="cls-' + esc(v) + '"' : '') + '>' + esc(v) + '</td>').join('') + '</tr>';
    });
    return h + '</table></div>';
  }

  /* ====================== cap & rel ====================== */
  function renderStamp() {
    const maj = res.votes[res.final], tot = res.trees.length;
    const neg = res.final !== data.classes[0];
    $('stamp').innerHTML = '<div class="stamp ' + (neg ? 'stamp--tidak' : '') + (lastFinal !== null ? ' stamp--in' : '') + '"><small>' + esc(data.target) + '</small><b>' + esc(res.final.toUpperCase()) + '</b><small>' + maj + ' dari ' + tot + ' pohon</small></div>';
    lastFinal = res.final;
  }
  function renderRail() {
    let h = '<li><a href="#s-data">Data dan parameter</a></li><li><a href="#s-boot">Bootstrap sampling</a></li><li><a href="#s-trees">Pohon keputusan</a><ul class="rail__sub">';
    res.trees.forEach((t, i) => (h += '<li><a href="#s-trees" data-tree="' + i + '">Pohon ' + t.index + '</a></li>'));
    h += '</ul></li><li><a href="#s-vote">Mayoritas vote</a></li>';
    $('rail').innerHTML = h;
    markRail();
  }
  let spyId = 's-data';
  function markRail() {
    document.querySelectorAll('#rail > li > a').forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + spyId ? 'true' : 'false'));
    document.querySelectorAll('#rail .rail__sub a').forEach((a) => a.setAttribute('aria-current', spyId === 's-trees' && +a.dataset.tree === activeTree ? 'true' : 'false'));
  }
  function setupSpy() {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { spyId = e.target.id; markRail(); } });
    }, { rootMargin: '-20% 0px -65% 0px' });
    ['s-data', 's-boot', 's-trees', 's-vote'].forEach((id) => io.observe($(id)));
  }

  /* ====================== bootstrap ====================== */
  function renderBoot() {
    const total = data.rows.length;
    $('n-total').textContent = total;
    const cnt = data.classes.map((c) => data.rows.filter((r) => r[nAttr()] === c).length);
    let h = '<div class="legend"><span>Terambil</span><span class="lg-oob">Tidak terambil (OOB)</span><span style="margin-left:auto" class="mono">' + data.classes.map((c, i) => esc(c) + ' = ' + cnt[i]).join(', ') + '</span></div>';
    res.trees.forEach((t) => {
      const c = new Array(total).fill(0); t.bootstrap.forEach((i) => c[i]++);
      const uniq = c.filter((x) => x > 0).length;
      h += '<div class="boot__row"><div class="boot__head"><b>Pohon ' + t.index + '</b><span>' + uniq + ' data berbeda terambil, ' + (total - uniq) + ' tidak terambil</span></div><div class="tiles">';
      c.forEach((k, i) => (h += '<div class="tile tile--' + (k ? 'in' : '0') + '" title="Data ' + (i + 1) + (k ? ' terambil ' + k + ' kali' : ' tidak terambil') + '">' + (i + 1) + (k > 1 ? '<i>×' + k + '</i>' : '') + '</div>'));
      h += '</div><details class="fold"><summary>Lihat tabel data bootstrap pohon ' + t.index + '</summary>' + dataTable(t, t.root.rows) + '</details></div>';
    });
    $('boot').innerHTML = h;
  }

  /* ====================== diagram ====================== */
  function layout(root) {
    let leaf = 0, maxD = 0; const pos = {};
    (function walk(n, d) {
      maxD = Math.max(maxD, d);
      if (n.leaf) { pos[n.id] = { x: leaf++, y: d }; return; }
      n.children.forEach((c) => walk(c.node, d + 1));
      const xs = n.children.map((c) => pos[c.node.id].x);
      pos[n.id] = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: d };
    })(root, 0);
    return { pos: pos, leaves: leaf, depth: maxD };
  }
  function diagram(tree, selId) {
    const L = layout(tree.root), SX = 128, SY = 96, PX = 10, PY = 30;
    const W = Math.max(L.leaves, 2) * SX + PX * 2, H = L.depth * SY + PY * 2 + 40;
    const X = (n) => PX + 64 + L.pos[n.id].x * SX, Y = (n) => PY + 20 + L.pos[n.id].y * SY;
    const hot = {}; tree.prediction.path.forEach((p) => (hot[p.id] = true));
    let edges = '', labels = '', nodes = '';
    (function walk(n) {
      if (n.leaf) return;
      n.children.forEach((c) => {
        const x1 = X(n), y1 = Y(n) + 23, x2 = X(c.node), y2 = Y(c.node) - (c.node.leaf ? 19 : 23), ym = (y1 + y2) / 2;
        const isHot = hot[n.id] && hot[c.node.id];
        const d = 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + ym + ' ' + x2 + ' ' + ym + ' ' + x2 + ' ' + y2;
        edges += (isHot ? '' : '<path class="e" d="' + d + '"/>');
        if (isHot) labels += '<path class="e e--hot" d="' + d + '"/>';
        const lx = (x1 + x2) / 2, ly = ym, w = c.value.length * 7.6 + 16;
        labels += '<rect class="el-bg" x="' + (lx - w / 2) + '" y="' + (ly - 10) + '" width="' + w + '" height="19" rx="9"/><text class="el" x="' + lx + '" y="' + (ly + 3.5) + '">' + esc(c.value) + '</text>';
        walk(c.node);
      });
    })(tree.root);
    (function walk(n) {
      const x = X(n), y = Y(n), cls = ['nd', hot[n.id] ? 'nd--hot' : '', n.id === selId ? 'nd--sel' : '', n.leaf ? 'nd--leaf-' + n.label : ''].join(' ');
      if (n.leaf) {
        nodes += '<g class="' + cls + '" data-id="' + n.id + '" tabindex="0" role="button" aria-label="Node ' + n.id + ', daun ' + esc(n.label) + '"><rect x="' + (x - 40) + '" y="' + (y - 19) + '" width="80" height="38" rx="9"/><text x="' + x + '" y="' + (y + 5.5) + '" font-size="17">' + esc(n.label) + '</text></g>';
      } else {
        const nm = n.featureName.length > 15 ? n.featureName.slice(0, 14) + '…' : n.featureName;
        nodes += '<g class="' + cls + '" data-id="' + n.id + '" tabindex="0" role="button" aria-label="Node ' + n.id + ', atribut ' + esc(n.featureName) + '"><rect x="' + (x - 62) + '" y="' + (y - 23) + '" width="124" height="46" rx="9"/><text class="id" x="' + x + '" y="' + (y - 7) + '">' + n.id + '</text><text class="ft" x="' + x + '" y="' + (y + 11) + '">' + esc(nm) + '</text></g>';
        n.children.forEach((c) => walk(c.node));
      }
    })(tree.root);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Diagram pohon keputusan ' + tree.index + '">' + edges + labels + nodes + '</svg>';
  }

  /* ====================== inspektur node ====================== */
  function inspector(tree, n) {
    const ids = tree.nodes.map((x) => x.id), pos = ids.indexOf(n.id);
    let h = '<div class="insp__bar"><button class="btn" type="button" data-step="-1"' + (pos === 0 ? ' disabled' : '') + '>Sebelumnya</button><button class="btn" type="button" data-step="1"' + (pos === ids.length - 1 ? ' disabled' : '') + '>Berikutnya</button>' +
      '<select aria-label="Pilih node" id="node-pick">' + tree.nodes.map((x) => '<option value="' + x.id + '"' + (x.id === n.id ? ' selected' : '') + '>Node ' + x.id + (x.leaf ? ' (daun ' + x.label + ')' : ' (' + x.featureName + ')') + '</option>').join('') + '</select><span class="pos">' + (pos + 1) + ' dari ' + ids.length + '</span></div>';
    h += '<h3>Node ' + n.id + '</h3><p class="sub">' + (n.branch ? 'Cabang ' + esc(n.branch) + ', berisi ' : 'Akar pohon, berisi ') + n.n + ' data.</p>';
    h += '<div class="mix" aria-hidden="true">' + data.classes.map((c, i) => '<i class="m-' + esc(c) + '" style="width:' + (n.counts[i] / n.n * 100) + '%"></i>').join('') + '</div><div class="mixlab">' + data.classes.map((c, i) => '<span>' + esc(c) + ': <b>' + n.counts[i] + '</b></span>').join('') + '</div>';

    const hi = n.leaf ? [] : n.candidates.map((c) => c.feature);
    h += '<details class="fold"><summary>Data pada node ini</summary>' + (n.leaf ? '' : '<p class="hint">Kolom yang disorot adalah atribut yang terpilih acak.</p>') + dataTable(tree, n.rows, hi) + '</details>';

    if (n.leaf) {
      h += '<div class="decide decide--leaf t-' + esc(n.label) + '"><b>Daun: ' + esc(n.label) + '.</b> ' + esc(n.reason) + '. Perhitungan berhenti di node ini.</div>';
    } else {
      h += '<div class="cal"><h4>Entropy total</h4><div class="fm">Entropy(Total) = ' + esc(n.totalStr) + '</div></div>';
      n.candidates.forEach((c) => {
        h += '<div class="cand"><h5>' + esc(c.name) + '<em>Gain Ratio ' + F(c.gainRatio, 5) + '</em></h5><div class="scroll"><table class="tbl"><tr><th>Nilai</th><th class="num">Jumlah</th>' + data.classes.map((k) => '<th class="num">' + esc(k) + '</th>').join('') + '<th class="num">Entropy</th></tr>';
        c.values.forEach((v) => (h += '<tr><td>' + esc(v.value) + '</td><td class="num">' + v.n + '</td>' + v.counts.map((x) => '<td class="num">' + x + '</td>').join('') + '<td class="num">' + F(v.entropy) + '</td></tr>'));
        h += '</table></div><details class="fold" open><summary>Rumus ' + esc(c.name) + '</summary>';
        c.values.forEach((v) => (h += '<div class="fm">Entropy ' + esc(c.name) + ' = ' + esc(v.value) + ' : ' + esc(v.entropyStr) + '</div>'));
        h += '<div class="fm"><b>Gain</b> = ' + esc(c.gainStr) + '</div><div class="fm"><b>Split Info</b> = ' + esc(c.splitStr) + '</div><div class="fm"><b>Gain Ratio</b> = ' + esc(c.grStr) + '</div></details></div>';
      });
      const mx = Math.max.apply(null, n.candidates.map((c) => c.gainRatio)) || 1;
      h += '<div class="cal"><h4>Membandingkan Gain Ratio</h4><div class="bars">' + n.candidates.map((c) =>
        '<div class="bar' + (c.feature === n.feature ? ' bar--win' : '') + '"><span>' + esc(c.name) + (c.feature === n.feature ? ' (dipilih)' : '') + '</span><div class="bar__t"><i style="width:' + (c.gainRatio / mx * 100) + '%"></i></div><span>' + F(c.gainRatio, 4) + '</span></div>').join('') + '</div></div>';
      const ties = n.candidates.filter((c) => Math.abs(c.gainRatio - Math.max.apply(null, n.candidates.map((x) => x.gainRatio))) < 1e-9);
      h += '<div class="decide">Gain Ratio tertinggi dimiliki <b>' + esc(n.featureName) + '</b>, jadi node ' + n.id + ' dipecah berdasarkan atribut itu.' + (ties.length > 1 ? ' Nilainya sama dengan ' + ties.filter((c) => c.feature !== n.feature).map((c) => esc(c.name)).join(', ') + ', maka dipilih atribut yang urutannya paling awal.' : '') +
        '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' + n.children.map((c) => '<button type="button" class="btn" style="height:32px;padding:0 12px;font-size:13.5px" data-goto="' + c.node.id + '">Node ' + c.node.id + ' (' + esc(c.value) + ')</button>').join('') + '</div></div>';
    }
    const pth = tree.prediction.path.map((p) => p.leaf ? '<b>' + esc(p.label) + '</b>' : esc(p.feature) + ' = ' + esc(p.value)).join(', lalu ');
    h += '<p class="pathline">Jalur data uji di pohon ini: ' + pth + '.</p>';
    return h;
  }

  function renderTrees() {
    const t = res.trees[activeTree];
    if (!activeNode[t.index] || !t.nodes.some((x) => x.id === activeNode[t.index])) activeNode[t.index] = '1';
    const nid = activeNode[t.index], node = t.nodes.find((x) => x.id === nid);
    let h = '<div class="tabs" role="tablist" aria-label="Pilih pohon">' + res.trees.map((x, i) => '<button class="tab" role="tab" id="tab' + i + '" aria-selected="' + (i === activeTree) + '" tabindex="' + (i === activeTree ? 0 : -1) + '" data-tab="' + i + '">Pohon ' + x.index + ' ' + chip(x.prediction.label) + '</button>').join('') + '</div>';
    h += '<div class="tree-grid" role="tabpanel" aria-labelledby="tab' + activeTree + '"><div class="diagram">' + diagram(t, nid) + '<div class="meta"><span>Jalur data uji</span><span class="m2">Node yang dibuka</span></div></div><div class="insp" id="insp">' + inspector(t, node) + '</div></div>';
    $('trees').innerHTML = h;
  }

  /* ====================== vote ====================== */
  function renderVote() {
    const tot = res.trees.length;
    let h = '<p class="sec__lead">Data uji: ' + data.attrs.map((a, i) => esc(a.name) + ' <b>' + esc(sample[i]) + '</b>').join(', ') + '. Setiap pohon memberi satu suara.</p><div class="ballots">';
    res.trees.forEach((t) => {
      const pth = t.prediction.path.filter((p) => !p.leaf).map((p) => esc(p.feature) + ' = ' + esc(p.value)).join(', ');
      h += '<div class="ballot ' + esc(t.prediction.label) + '"><b>Pohon ' + t.index + '</b>' + chip(t.prediction.label) + '<p>' + (pth || 'Langsung ke daun.') + '</p></div>';
    });
    h += '</div><div class="tally">' + data.classes.map((c, i) => '<div class="bar bar--' + (i === 0 ? 'ya' : 'tidak') + '"><span>' + esc(c) + '</span><div class="bar__t"><i style="width:' + (res.votes[c] / tot * 100) + '%"></i></div><span>' + res.votes[c] + ' suara</span></div>').join('') + '</div>';
    h += '<p class="verdict">Suara terbanyak: ' + chip(res.final) + ' Untuk data uji ini, <b>' + esc(data.target) + '</b> diprediksi <b>' + esc(res.final) + '</b>.</p>';
    $('vote').innerHTML = h;
  }

  /* ====================== alur utama ====================== */
  function run() {
    params.seed = Math.max(0, Math.floor(+$('p-seed').value || 0));
    params.m = Math.min(params.m, nAttr());
    res = RF.runForest({ data: data, nTrees: params.nT, m: params.m, seed: params.seed, sample: sample });
    res.trees.forEach((t) => (t.bdata = t.bootstrap.map((i) => data.rows[i])));
    activeTree = Math.min(activeTree, res.trees.length - 1);
    renderStamp(); renderRail(); renderBoot(); renderTrees(); renderVote();
    document.title = 'Random Forest Simulator, prediksi ' + res.final;
  }
  function selectNode(id, keepFocus) {
    const t = res.trees[activeTree]; activeNode[t.index] = id; renderTrees();
    if (keepFocus) { const g = document.querySelector('.nd[data-id="' + id + '"]'); if (g) g.focus(); }
  }

  document.addEventListener('click', (e) => {
    const nd = e.target.closest('.nd'); if (nd) return selectNode(nd.dataset.id, true);
    const tab = e.target.closest('[data-tab]'); if (tab) { activeTree = +tab.dataset.tab; markRail(); return renderTrees(); }
    const rt = e.target.closest('#rail [data-tree]'); if (rt) { activeTree = +rt.dataset.tree; renderTrees(); markRail(); return; }
    const gt = e.target.closest('[data-goto]'); if (gt) return selectNode(gt.dataset.goto);
    const st = e.target.closest('[data-step]');
    if (st) { const t = res.trees[activeTree], ids = t.nodes.map((x) => x.id); selectNode(ids[ids.indexOf(activeNode[t.index]) + (+st.dataset.step)]); }
  });
  document.addEventListener('keydown', (e) => {
    const nd = e.target.closest && e.target.closest('.nd');
    if (nd && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectNode(nd.dataset.id, true); }
    const tab = e.target.closest && e.target.closest('[data-tab]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const n = res.trees.length; activeTree = (activeTree + (e.key === 'ArrowRight' ? 1 : n - 1)) % n; renderTrees(); markRail(); $('tab' + activeTree).focus();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'node-pick') return selectNode(t.value);
    if (t.dataset && t.dataset.s !== undefined) { sample[+t.dataset.s] = t.value; return run(); }
    if (t.dataset && t.dataset.r !== undefined) {
      data.rows[+t.dataset.r][+t.dataset.c] = t.value;
      if (+t.dataset.c === nAttr()) t.className = 'cls-' + t.value;
      return run();
    }
    if (t.id === 'p-seed') run();
  });
  $('btn-rand').addEventListener('click', () => { $('p-seed').value = Math.floor(Math.random() * 9000) + 1; run(); });
  $('btn-reset').addEventListener('click', () => {
    data = JSON.parse(JSON.stringify(RF.DEFAULT_DATA)); sample = RF.DEFAULT_SAMPLE.slice();
    params.nT = 3; params.m = 2; $('p-seed').value = 12; lastFinal = null;
    Object.keys(activeNode).forEach((k) => delete activeNode[k]); activeTree = 0;
    renderTable(); renderSample(); renderSteppers(); run();
  });

  renderTable(); renderSample(); renderSteppers(); run(); setupSpy();
  window.__rf = { get res() { return res; }, selectNode: selectNode, setTree: (i) => { activeTree = i; renderTrees(); markRail(); } };
})();
