import json, math, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

T = json.load(open('trace.json'))
D = T['data']; ATTRS = [a['name'] for a in D['attrs']]; CLS = D['classes']; TARGET = D['target']
IMG = 'img/'
os.makedirs(IMG, exist_ok=True)

# ---------------- gambar pohon ----------------
def visible(n, expanded):
    if n['leaf']: return {'n': n, 'ch': []}
    if expanded is not None and n['id'] not in expanded: return {'n': n, 'ch': [], 'unexp': True}
    return {'n': n, 'ch': [(c['value'], visible(c['node'], expanded)) for c in n['children']]}

def draw_tree(root, fname, expanded=None, path=None):
    v = visible(root, expanded)
    pos = {}; leaf = [0]; maxd = [0]
    def lay(t, d):
        maxd[0] = max(maxd[0], d)
        if not t['ch']:
            pos[t['n']['id']] = (leaf[0], d); leaf[0] += 1; return
        for _, c in t['ch']: lay(c, d + 1)
        xs = [pos[c['n']['id']][0] for _, c in t['ch']]
        pos[t['n']['id']] = ((min(xs) + max(xs)) / 2, d)
    lay(v, 0)
    W = max(leaf[0], 2) * 1.9; H = (maxd[0] + 1) * 1.6 + 0.4
    fig, ax = plt.subplots(figsize=(W, H)); ax.set_xlim(-0.6, max(leaf[0], 2) - 0.4); ax.set_ylim(-(maxd[0]) - 0.6, 0.6); ax.axis('off')
    onp = set(path or [])
    def edges(t):
        x1, d1 = pos[t['n']['id']]
        for val, c in t['ch']:
            x2, d2 = pos[c['n']['id']]
            hot = t['n']['id'] in onp and c['n']['id'] in onp
            ax.plot([x1, x2], [-d1 - .18, -d2 + .18], color='#e07b1a' if hot else '#9ccc65', lw=2.6 if hot else 1.6, zorder=1)
            ax.text((x1 + x2) / 2, (-d1 - d2) / 2, val, fontsize=8, ha='center', va='center', bbox=dict(fc='white', ec='none', pad=0.5), zorder=3)
            edges(c)
    edges(v)
    def nodes(t):
        n = t['n']; x, d = pos[n['id']]
        if n['leaf']:
            col = '#7cc576' if n['label'] == CLS[0] else '#e57373'
            ax.add_patch(FancyBboxPatch((x - .38, -d - .16), .76, .32, boxstyle='round,pad=0.02,rounding_size=0.08', fc=col, ec='none', zorder=2))
            ax.text(x, -d, n['label'], ha='center', va='center', fontsize=10, color='white', weight='bold', zorder=4)
        else:
            lab = (n['id'] + ' ' + n['featureName']) if not t.get('unexp') else (n['id'] + ' ?')
            if t.get('unexp'): lab = n['id'] + ' ?'
            ax.add_patch(Ellipse((x, -d), .98, .4, fc='#92d050', ec='#e07b1a' if n['id'] in onp else 'none', lw=2.2, zorder=2))
            ax.text(x, -d, lab if not t.get('unexp') else lab, ha='center', va='center', fontsize=7.5, weight='bold', zorder=4, color='#1d2a22')
        for _, c in t['ch']: nodes(c)
    nodes(v)
    fig.savefig(IMG + fname, dpi=170, bbox_inches='tight', facecolor='white'); plt.close(fig)

# ---------------- helper docx ----------------
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
sec.left_margin = sec.right_margin = Cm(2.5); sec.top_margin = sec.bottom_margin = Cm(2.2)
st = doc.styles['Normal']; st.font.name = 'Times New Roman'; st.font.size = Pt(12)
st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')
for h, sz in (('Heading 1', 16), ('Heading 2', 13), ('Heading 3', 12)):
    s = doc.styles[h]; s.font.name = 'Times New Roman'; s.font.size = Pt(sz); s.font.bold = True; s.font.color.rgb = RGBColor(0, 0, 0)
    rf = s.element.rPr.rFonts
    for a in ('w:asciiTheme','w:hAnsiTheme','w:eastAsiaTheme','w:cstheme'):
        if rf.get(qn(a)) is not None: del rf.attrib[qn(a)]
    for a in ('w:ascii','w:hAnsi','w:eastAsia','w:cs'): rf.set(qn(a), 'Times New Roman')

def para(text='', bold=False, italic=False, align=None, size=None, space=6, indent=None, keep=False):
    p = doc.add_paragraph(); r = p.add_run(text); r.bold = bold; r.italic = italic
    if size: r.font.size = Pt(size)
    if align == 'c': p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif align == 'j': p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(space)
    if indent: p.paragraph_format.left_indent = Cm(indent)
    if keep: p.paragraph_format.keep_with_next = True
    return p

def rich(parts, align='j', indent=None, space=6):
    p = doc.add_paragraph()
    for t, f in parts:
        r = p.add_run(t); r.italic = 'i' in f; r.bold = 'b' in f
    if align == 'j': p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(space)
    if indent: p.paragraph_format.left_indent = Cm(indent)
    return p

def check(text, indent=1.0):
    p = doc.add_paragraph(); p.paragraph_format.left_indent = Cm(indent + .6); p.paragraph_format.first_line_indent = Cm(-.6)
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run('✓ '); r.font.name = 'Segoe UI Symbol'
    r2 = p.add_run(text); r2.italic = True
    return p

def line(text, indent=1.6):
    p = doc.add_paragraph(); p.paragraph_format.left_indent = Cm(indent); p.paragraph_format.space_after = Pt(2)
    r = p.add_run(text); r.italic = True; r.font.size = Pt(11)
    return p

def shade(cell, hexcol):
    tcPr = cell._tc.get_or_add_tcPr(); s = OxmlElement('w:shd')
    s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), hexcol); tcPr.append(s)

def table(header, rows, widths=None, size=10, bold_rows=(), center=True, shade_rows=()):
    t = doc.add_table(rows=1, cols=len(header)); t.style = 'Table Grid'
    if center: t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(header):
        c = t.rows[0].cells[i]; c.text = ''; r = c.paragraphs[0].add_run(str(h)); r.bold = True; r.font.size = Pt(size)
        c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER; shade(c, 'D9D9D9')
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ''; r = cells[i].paragraphs[0].add_run(str(v)); r.font.size = Pt(size); r.bold = ri in bold_rows
            if ri in shade_rows: shade(cells[i], 'FFF2CC')
    if widths:
        t.autofit = False
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Cm(w)
    for ri_, row in enumerate(t.rows):
        trPr = row._tr.get_or_add_trPr(); cs = OxmlElement('w:cantSplit'); trPr.append(cs)
        for c in row.cells:
            for p in c.paragraphs:
                p.paragraph_format.space_after = Pt(0)
                if len(t.rows) <= 16 and ri_ < len(t.rows) - 1: p.paragraph_format.keep_with_next = True
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

tn = [0]; fn = [0]
def caption_t(text):
    tn[0] += 1; p = para('Tabel %d. %s' % (tn[0], text), space=3, indent=0.5, keep=True); return p
def figure(fname, text, width=14):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.add_run().add_picture(IMG + fname, width=Cm(width)); p.paragraph_format.space_after = Pt(2); p.paragraph_format.keep_with_next = True
    fn[0] += 1; para('Gambar %d. %s' % (fn[0], text), align='c', space=10)

def pagebreak(): doc.add_page_break()

# ---------------- sampul ----------------
para('PROGRAM STUDI TEKNIK INFORMATIKA', bold=True, align='c', size=14, space=4)
para('FAKULTAS TEKNIK', bold=True, align='c', size=13, space=24)
para('TUGAS PEMBELAJARAN MESIN', bold=True, align='c', size=14, space=10)
para('Algoritma Random Forest', italic=True, align='c', size=20, space=4)
para('Perhitungan Manual dan Web Simulasi', align='c', size=14, space=4)
para('Studi Kasus: Prediksi Mahasiswa Meminjam Buku di Perpustakaan', align='c', size=13, space=70)
para('Disusun Oleh :', bold=True, align='c', space=6)
para('Irfan', bold=True, align='c', size=18, space=4)
p = para('NIM : ', align='c', space=60); r = p.add_run('[isi NIM]'); r.font.highlight_color = 7
para('UNIVERSITAS BALE BANDUNG', bold=True, align='c', size=14, space=2)
para('TEKNIK INFORMATIKA', bold=True, align='c', size=14, space=2)
para('2026', bold=True, align='c', size=14)
pagebreak()

# ---------------- daftar ringkas ----------------
doc.add_heading('Ringkasan Tugas', 1)
para('Laporan ini terdiri atas dua bagian: (A) perhitungan manual algoritma Random Forest dengan studi kasus prediksi mahasiswa meminjam buku di perpustakaan, dan (B) tutorial web simulasi yang menghitung langkah yang sama secara otomatis.', align='j')
para('Tautan pengumpulan:', bold=True, space=3)
for lab in ('Repository GitHub : ', 'Link deploy web simulasi : ', 'Video tutorial (YouTube) : '):
    p = para(lab, space=3, indent=0.8); r = p.add_run('[isi tautan]'); r.font.highlight_color = 7
pagebreak()

# ---------------- A. perhitungan manual ----------------
doc.add_heading('A. Perhitungan Manual Algoritma Random Forest', 1)
para('Langkah-langkah perhitungan manual Algoritma Random Forest', align='j')
n_data = len(D['rows'])
cnt = [sum(1 for r in D['rows'] if r[-1] == c) for c in CLS]

rich([('1.  Lakukan ', ''), ('bootstrap sampling', 'i'), (' untuk training data sebanyak n, yaitu %d. Data tersebut akan digunakan untuk membuat pohon keputusan. Dibawah ini merupakan data dengan lima (5) buah atribut yang terdiri atas ' % n_data, ''), ('tugas, cuaca, waktu luang, wajib referensi', 'i'), (' dan ', ''), ('meminjam buku', 'i'), ('.', '')], indent=0)
caption_t('Data mahasiswa dan peminjaman buku perpustakaan')
table(['No'] + ATTRS + [TARGET], [[i + 1] + r for i, r in enumerate(D['rows'])], widths=[1.2, 2.3, 2.5, 2.7, 3.3, 3.0])

def rows_tbl(tree, idxs, cols=None):
    cols = list(range(len(ATTRS))) if cols is None else cols
    hdr = ['No'] + [ATTRS[c] for c in cols] + [TARGET]
    rr = []
    for i in idxs:
        orig = tree['bootstrap'][i]
        rr.append([orig + 1] + [D['rows'][orig][c] for c in cols] + [D['rows'][orig][-1]])
    return hdr, rr

def all_nodes(n, acc):
    acc.append(n)
    if not n['leaf']:
        for c in n['children']: all_nodes(c['node'], acc)
    return acc

def tie_note(n):
    best = max(c['gainRatio'] for c in n['candidates'])
    ties = [c['name'] for c in n['candidates'] if abs(c['gainRatio'] - best) < 1e-9]
    return ties if len(ties) > 1 else None

def node_block(tree, n):
    boot_all = list(range(len(tree['bootstrap'])))
    label = 'Node %s' % n['id'] + ('' if n['branch'] is None else ' (cabang %s)' % n['branch'])
    doc.add_heading(label, 3)
    dist = ', '.join('%s = %d' % (c, k) for c, k in zip(CLS, n['counts']))
    if n['leaf']:
        para('Data pada node ini: %d data (%s). %s, sehingga node ini menjadi daun dengan kelas %s.' % (n['n'], dist, n['reason'], n['label']), align='j')
        hdr, rr = rows_tbl(tree, n['rows'], [])
        return
    cols = [c['feature'] for c in n['candidates']]
    names = ' dan '.join('%s' % c['name'] for c in n['candidates'])
    para('Untuk setiap node yang dibuat, dipilih m = %d kolom secara random. Pada node ini terpilih %s, kemudian dicari Entropy dan nilai gain-nya.' % (len(cols), names), align='j')
    caption_t('Data yang digunakan pada node %s' % n['id'])
    hdr, rr = rows_tbl(tree, n['rows'], cols)
    table(hdr, rr, size=9.5)
    para('a.  Mencari nilai Entropy dengan rumus Entropy (S) = Σ −pi · log₂(pi)', space=3)
    check('Entropy (Total) = ' + n['totalStr'])
    for c in n['candidates']:
        check('Entropy ' + c['name'])
        for v in c['values']: line('%s  = %s' % (v['value'], v['entropyStr']))
    para('b.  Mencari nilai gain, untuk memperoleh gain tertinggi dengan rumus Gain(S, A) = Entropy(S) − Σ (|Si|/|S|) · Entropy(Si)', space=3)
    for c in n['candidates']: check('Gain Total %s = %s' % (c['name'], c['gainStr']))
    para('c.  Setelah itu lakukan perhitungan Split Info dengan rumus SplitInfo(S, A) = Σ (|Si|/|S|) · log₂(|Si|/|S|)', space=3)
    for c in n['candidates']: check('Split info %s = %s' % (c['name'], c['splitStr']))
    para('d.  Setelah itu lakukan perhitungan Gain Ratio = Gain(S, A) / SplitInfo(S, A)', space=3)
    for c in n['candidates']: check('Gain Ratio %s = %s' % (c['name'], c['grStr']))
    caption_t('Perhitungan Entropy, Gain, Split Info dan Gain Ratio Node %s' % n['id'])
    hdr = ['Node %s' % n['id'], '', 'Jumlah'] + CLS + ['Entropy', 'Gain', 'Split Info', 'Gain Ratio']
    body = [['Total', '', n['n']] + n['counts'] + [('%.6f' % n['entropy']).replace('.', ','), '', '', '']]
    boldr = []; shr = []
    for c in n['candidates']:
        boldr.append(len(body)); 
        if c['feature'] == n['feature']: shr.append(len(body))
        body.append([c['name'], '', '', '', '', '', ('%.6f' % c['gain']).replace('.', ','), ('%.5f' % c['split']).replace('.', ','), ('%.5f' % c['gainRatio']).replace('.', ',')])
        for v in c['values']:
            body.append(['', v['value'], v['n']] + v['counts'] + [('%.6f' % v['entropy']).replace('.', ','), '', ('%.5f' % v['splitTerm']).replace('.', ','), ''])
    table(hdr, body, widths=[2.5, 2.0, 1.5, 1.1, 1.1, 1.9, 1.7, 1.8, 1.9], size=9, bold_rows=boldr, shade_rows=shr)
    tn_ = tie_note(n)
    extra = ''
    if tn_: extra = ' Nilai Gain Ratio atribut %s sama besar, sehingga dipilih atribut yang urutannya paling awal.' % ' dan '.join(tn_)
    ch = ', '.join('%s → node %s' % (c['value'], c['node']['id']) for c in n['children'])
    para('Gain Ratio tertinggi dimiliki atribut %s, sehingga node %s dipecah berdasarkan %s.%s Cabang yang terbentuk: %s.' % (n['featureName'], n['id'], n['featureName'], extra, ch), align='j')

cnt_fig = [0]
for tree in T['trees']:
    idx = tree['index']
    root = tree['root']
    if idx == 1:
        para('Bootstrap sampling pohon 1: dari %d data diambil secara acak dengan pengembalian sebanyak %d kali, sehingga ada data yang muncul lebih dari satu kali (misalnya data nomor %s) dan ada yang tidak terpilih (nomor %s).' % (
            n_data, n_data, ', '.join(str(k) for k in sorted(set(i + 1 for i in tree['bootstrap'] if tree['bootstrap'].count(i) > 1))), ', '.join(str(i + 1) for i in tree['oob']) or '-'), align='j')
    else:
        doc.add_heading('Pohon Keputusan %d' % idx, 2)
        rich([('Langkah 1–3 diulang dengan ', ''), ('bootstrap sampling', 'i'), (' baru dan pemilihan m = 2 kolom acak pada setiap node.', '')])
        para('Data hasil bootstrap sampling pohon %d: nomor data terpilih = %s. Data tidak terpilih (out-of-bag) = %s.' % (idx, ', '.join(str(i + 1) for i in tree['bootstrap']), ', '.join(str(i + 1) for i in tree['oob']) or '-'), align='j')
    caption_t('Data mahasiswa setelah dilakukan bootstrap sampling (pohon %d)' % idx)
    hdr, rr = rows_tbl(tree, list(range(n_data)))
    table(hdr, rr, widths=[1.2, 2.3, 2.5, 2.7, 3.3, 3.0], size=9.5)
    if idx == 1:
        rich([('2.  Untuk setiap node yang dibuat, kita memilih m kolom secara random yang kemudian akan dihitung informasi gainnya untuk membagi data menjadi beberapa kelas. Misal kita gunakan m = 2. Setelah itu kita mencari ', ''), ('Entropy', 'i'), (' dan nilai gainnya.', '')], indent=0)
    nodes = all_nodes(root, [])
    expanded = set()
    for n in nodes:
        node_block(tree, n)
        if not n['leaf']:
            expanded.add(n['id'])
            cnt_fig[0] += 1
            fname = 'tree%d_step%d.png' % (idx, cnt_fig[0])
            draw_tree(root, fname, expanded=set(expanded))
            figure(fname, 'Pohon Keputusan %d setelah node %s ditentukan' % (idx, n['id']), width=11 if len(nodes) > 5 else 9)
    if idx == 1:
        rich([('3.  Ulangi proses perhitungan ', ''), ('Gain Ratio', 'i'), (' sampai semua data telah termasuk dalam kelas yang sama. Semua data telah masuk dalam kelas masing-masing, maka perhitungan selesai, sehingga diperoleh pohon keputusan pertama sebagai berikut.', '')], indent=0)
    draw_tree(root, 'tree%d_final.png' % idx)
    figure('tree%d_final.png' % idx, 'Pohon Keputusan %s (%d)' % (['Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima'][idx - 1], idx), width=13)
    if idx == 1:
        rich([('4.  Ulangi langkah 1–3 (', ''), ('bootstrap sampling', 'i'), (', memilih m kolom = 2, mencari entropy, gain dan menentukan gain tertinggi) untuk membentuk pohon keputusan kedua dan ketiga.', '')], indent=0)

para('Perlu diketahui, setiap pohon keputusan dapat berbeda-beda karena dilakukan secara random, yang mempengaruhi pohon keputusan di antaranya data hasil sampel bootstrapping dan variabel yang dipilih ketika pembuatan setiap node.', align='j')

# ---------------- langkah 5 ----------------
rich([('5.  Mengklasifikasikan data baru dengan mayoritas vote. Dengan data berikut apakah seorang mahasiswa akan meminjam buku di perpustakaan?', '')], indent=0)
caption_t('Kondisi data mahasiswa yang diuji')
table(['Atribut', 'Nilai'], [[a, s] for a, s in zip(ATTRS, T['sample'])], widths=[5, 4], size=11)
para('Dari data diatas dapat digambarkan dengan pohon keputusan 1, 2, dan 3 sebagai berikut (garis oranye menunjukkan jalur data uji):', align='j')
res_rows = []
for tree in T['trees']:
    path_ids = [p['id'] for p in tree['pred']['path']]
    draw_tree(tree['root'], 'tree%d_path.png' % tree['index'], path=path_ids)
    steps = ' → '.join(('%s = %s' % (p['feature'], p['value'])) if not p.get('leaf') else p['label'] for p in tree['pred']['path'])
    figure('tree%d_path.png' % tree['index'], 'Pohon Keputusan %s (%d) — %s' % (['Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima'][tree['index'] - 1], tree['index'], steps), width=12)
    res_rows.append([tree['index'], tree['pred']['label']])
para('Berdasarkan pohon keputusan 1, 2 dan 3 yang telah diperoleh maka, akan menghasilkan data sebagai berikut :', align='j', keep=True)
caption_t('Hasil Mayoritas Vote')
table(['Pohon Keputusan', 'Y/N'], res_rows, widths=[5, 3], size=11)
v = T['votes']
para('Sehingga dengan tiga pohon keputusan tersebut %d pohon keputusan menghasilkan %s dan %d pohon keputusan menghasilkan %s, maka dengan atribut %s dan %s diprediksi %s.' % (
    v['Ya'], 'Ya', v['Tidak'], 'Tidak',
    ', '.join('%s: %s' % (a, s) for a, s in zip(ATTRS[:-1], T['sample'][:-1])), '%s: %s' % (ATTRS[-1], T['sample'][-1]),
    'meminjam buku' if T['final'] == 'Ya' else 'tidak meminjam buku'), align='j')
pagebreak()

# ---------------- B. tutorial web ----------------
doc.add_heading('B. Tutorial Web Simulasi Random Forest', 1)
para('Web simulasi dibuat dengan HTML, CSS dan JavaScript murni (tanpa server). Seluruh perhitungan — bootstrap sampling, entropy, gain, split info, gain ratio, pembentukan pohon, dan mayoritas vote — dijalankan di browser dan hasilnya sama dengan perhitungan manual pada bagian A (seed acak = 12).', align='j')
doc.add_heading('1. Menjalankan web simulasi', 2)
for s in ['Buka link deploy web simulasi di Vercel, atau buka berkas index.html dari repository di browser.',
          'Bagian Data dan parameter menampilkan tabel data latih (14 mahasiswa), jumlah pohon, jumlah atribut acak per node (m), dan seed acak. Cap di bagian atas halaman selalu menunjukkan prediksi akhir yang sedang berlaku.',
          'Pilih data uji (yang akan diprediksi) dengan menekan nilai atributnya. Tidak ada tombol hitung: seluruh hasil dihitung ulang otomatis setiap ada perubahan.']:
    p = doc.add_paragraph(s, style='List Number'); p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
figure('web1_input.png', 'Tampilan awal: cap prediksi, data latih, parameter dan data uji', width=14)
doc.add_heading('2. Bootstrap sampling', 2)
para('Setelah dihitung, bagian Bootstrap Sampling menampilkan nomor data yang terambil untuk setiap pohon beserta data yang tidak terpilih (out-of-bag).', align='j')
figure('web2_bootstrap.png', 'Hasil bootstrap sampling tiap pohon (angka berlabel ×n berarti terambil lebih dari sekali, kotak putus-putus berarti tidak terambil)', width=14)
doc.add_heading('3. Pohon keputusan dan perhitungan tiap node', 2)
para('Pilih pohon pada tab, lalu klik sebuah node pada diagram. Garis ungu adalah jalur yang dilalui data uji. Panel di sebelah kanan menampilkan perhitungan entropy, gain, split info dan gain ratio lengkap dengan rumus yang sudah disubstitusi angka, dan tombol Sebelumnya/Berikutnya berpindah antar node sesuai urutan pembentukan pohon.', align='j')
figure('web3_tree1.png', 'Diagram pohon keputusan 1 pada web simulasi', width=13)
figure('web4_node1.png', 'Panel perhitungan node akar pohon 1 beserta perbandingan Gain Ratio', width=14)
doc.add_heading('4. Mayoritas vote', 2)
para('Bagian terakhir merangkum suara tiap pohon, jumlah suara, dan prediksi akhir berdasarkan suara terbanyak.', align='j')
figure('web5_vote.png', 'Hasil mayoritas vote pada web simulasi', width=14)
doc.add_heading('5. Mengubah studi kasus', 2)
para('Nilai pada tabel data latih dapat diubah langsung (klik sel). Parameter jumlah pohon, nilai m, dan seed juga dapat diganti; tombol Acak seed menghasilkan hutan acak yang berbeda, sedangkan seed yang sama selalu menghasilkan hasil yang sama sehingga dapat diperiksa ulang.', align='j')
doc.add_heading('6. Deploy ke Vercel', 2)
for s in ['Upload seluruh isi project ke repository GitHub. Berkas index.html, style.css, app.js, core.js, vercel.json dan folder fonts harus berada di root repository.',
          'Buka vercel.com, masuk dengan akun GitHub, lalu pilih Add New → Project dan impor repository tersebut.',
          'Pada pengaturan project, Framework Preset = Other, Build Command dan Output Directory dikosongkan, Root Directory = ./ (bawaan). Klik Deploy.',
          'Setelah selesai, salin alamat https://<nama-project>.vercel.app sebagai link deploy web simulasi.']:
    p = doc.add_paragraph(s, style='List Number'); p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
doc.add_heading('Tautan', 2)
for lab in ('GitHub : ', 'Web simulasi : ', 'Video tutorial : '):
    p = para(lab, space=3, indent=0.8); r = p.add_run('[isi tautan]'); r.font.highlight_color = 7

doc.save('Laporan_Random_Forest_Irfan.docx')
print('saved')
