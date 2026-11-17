# Random Forest Simulator — Prediksi Peminjaman Buku Perpustakaan

Tugas Pembelajaran Mesin: perhitungan manual Random Forest dan web simulasi langkah demi langkah.

## Isi
| Berkas | Fungsi |
|---|---|
| `index.html`, `style.css`, `app.js` | Antarmuka web simulasi |
| `core.js` | Inti algoritma: bootstrap, entropy, gain, split info, gain ratio, pohon, vote |
| `fonts/` | Font lokal (Schibsted Grotesk, Spline Sans Mono) |
| `vercel.json`, `.vercelignore` | Konfigurasi deploy Vercel |
| `report/` | Skrip pembuat laporan, data hitung (`trace.json`), laporan `.docx` |

## Menjalankan lokal
Buka `index.html` di browser, atau jalankan server statis: `npx serve .`

## Deploy ke Vercel
1. Upload seluruh isi project ke repository GitHub (berkas web berada di root repository).
2. Di vercel.com pilih **Add New → Project**, lalu impor repository.
3. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan. Root Directory: `./`.
4. Klik **Deploy**. Alamat `https://<nama-project>.vercel.app` adalah link deploy.

Atau lewat CLI: `npm i -g vercel`, lalu jalankan `vercel --prod` di folder ini.

## Algoritma
Bootstrap sampling → pilih m atribut acak per node → Entropy, Gain, Split Info, Gain Ratio (C4.5)
→ ulangi sampai data sekelas → mayoritas vote. Seed acak yang sama selalu memberi hasil yang sama
(laporan memakai seed 12, 3 pohon, m = 2).

## Membangun ulang laporan
```
node report/export_trace.js
python3 report/shots.py        # screenshot web (butuh Playwright + Chrome)
python3 report/build_report.py
```
