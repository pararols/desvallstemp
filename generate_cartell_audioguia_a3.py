import os
import sys
import base64
import subprocess
import fitz  # PyMuPDF
import qrcode
from PIL import Image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def img_to_b64(path):
    with open(path, "rb") as f:
        ext = os.path.splitext(path)[1].lower().replace(".", "")
        mime = "image/svg+xml" if ext == "svg" else f"image/{ext}"
        b64_str = base64.b64encode(f.read()).decode("utf-8")
        return f"data:{mime};base64,{b64_str}"

def generate_qr_svg(url, output_path):
    import qrcode.image.svg
    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(
        image_factory=factory,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        border=2
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image()
    img.save(output_path)
    return output_path

def main():
    print("=== Generant Cartell A3 PDF Audioguia Festival Luminic ===")
    
    # 1. Assegurar QR SVG d'alta qualitat
    qr_svg_path = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "img", "qr_audioguia_vector.svg")
    generate_qr_svg("https://desvallscultura.cat/audioguia.html", qr_svg_path)
    
    # 2. Fitxers d'origen
    medusa_path = os.path.join(BASE_DIR, "img", "medusa_espectacular_art.jpg")
    logos_path = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "img", "logo_banner_pill.png")
    
    medusa_b64 = img_to_b64(medusa_path)
    qr_b64 = img_to_b64(qr_svg_path)
    logos_b64 = img_to_b64(logos_path)
    
    # 3. Plantilla HTML A3 (297 x 420 mm)
    html_content = f"""<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="utf-8">
<title>Cartell A3 Audioguia · Festival d'Art Luminic 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet">
<style>
  @page {{
    size: 297mm 420mm;
    margin: 0;
  }}
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}
  body {{
    width: 297mm;
    height: 420mm;
    margin: 0;
    padding: 0;
    background-color: #01060f;
    font-family: 'Outfit', sans-serif;
    color: #f1f5f9;
    overflow: hidden;
    position: relative;
  }}

  /* Gran Fons Mari i Llums Bioluminescents */
  .poster-container {{
    width: 297mm;
    height: 420mm;
    position: relative;
    padding: 13mm 16mm 9mm 16mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    background: radial-gradient(ellipse at 50% 28%, #082f56 0%, #031427 48%, #01060e 100%);
    box-sizing: border-box;
  }}

  /* Halos de llum ambiental */
  .glow-top {{
    position: absolute;
    top: -40mm;
    left: 50%;
    transform: translateX(-50%);
    width: 200mm;
    height: 120mm;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(6, 182, 212, 0) 70%);
    pointer-events: none;
    z-index: 1;
  }}
  .glow-center {{
    position: absolute;
    top: 130mm;
    left: 50%;
    transform: translateX(-50%);
    width: 220mm;
    height: 140mm;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, rgba(6, 182, 212, 0.15) 40%, rgba(2, 6, 23, 0) 70%);
    pointer-events: none;
    z-index: 1;
  }}

  /* Capcalera */
  .header-section {{
    position: relative;
    z-index: 2;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }}

  .event-tag {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1.5px solid rgba(251, 191, 36, 0.6);
    color: #fbbf24;
    padding: 5px 22px;
    border-radius: 30px;
    font-size: 11.5pt;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 6mm;
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
  }}

  .main-title {{
    font-size: 38pt;
    font-weight: 900;
    letter-spacing: 3px;
    color: #ffffff;
    line-height: 1.05;
    text-transform: uppercase;
    text-shadow: 0 0 25px rgba(56, 189, 248, 0.8), 0 0 50px rgba(6, 182, 212, 0.4);
    margin-bottom: 2mm;
  }}

  .theme-title {{
    font-family: 'Playfair Display', serif;
    font-size: 24pt;
    font-weight: 700;
    font-style: italic;
    letter-spacing: 3px;
    color: #38bdf8;
    text-shadow: 0 0 15px rgba(56, 189, 248, 0.5);
    margin-bottom: 1.5mm;
  }}

  .location-date {{
    font-size: 13pt;
    font-weight: 600;
    letter-spacing: 2.5px;
    color: #cbd5e1;
    text-transform: uppercase;
  }}
  .location-date span {{
    color: #fbbf24;
    font-weight: 700;
  }}

  /* Imatge Hero Simbol Medusa */
  .medusa-section {{
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 2mm 0;
  }}

  .medusa-frame {{
    position: relative;
    width: 250mm;
    height: 105mm;
    border-radius: 26px;
    overflow: hidden;
    border: 2px solid rgba(56, 189, 248, 0.45);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8), 0 0 35px rgba(6, 182, 212, 0.35);
    background: #020712;
  }}

  .medusa-img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 30%;
    display: block;
    filter: saturate(1.15) contrast(1.1);
  }}

  .medusa-overlay-badge {{
    position: absolute;
    bottom: 5mm;
    right: 6mm;
    background: rgba(2, 6, 23, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(56, 189, 248, 0.5);
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 9.5pt;
    font-weight: 600;
    color: #7dd3fc;
    letter-spacing: 1px;
    text-transform: uppercase;
  }}

  /* Seccio Audioguia */
  .audioguia-section {{
    position: relative;
    z-index: 2;
    text-align: center;
    width: 100%;
    margin-top: 1mm;
  }}

  .audioguia-header {{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 1mm;
  }}

  .audioguia-title {{
    font-size: 31pt;
    font-weight: 900;
    letter-spacing: 2px;
    color: #ffffff;
    text-transform: uppercase;
    text-shadow: 0 0 20px rgba(56, 189, 248, 0.7);
  }}

  .audioguia-icon {{
    font-size: 28pt;
    line-height: 1;
    filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.6));
  }}

  .audioguia-quote {{
    font-family: 'Playfair Display', serif;
    font-size: 13.5pt;
    font-style: italic;
    color: #94a3b8;
    margin-bottom: 3.5mm;
  }}

  /* Targeta Principal QR + Instruccions */
  .qr-main-card {{
    position: relative;
    z-index: 2;
    width: 250mm;
    background: linear-gradient(135deg, rgba(6, 26, 54, 0.95) 0%, rgba(2, 14, 32, 0.98) 100%);
    border: 2px solid rgba(56, 189, 248, 0.55);
    border-radius: 24px;
    padding: 5.5mm 9mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8mm;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.85), 0 0 35px rgba(6, 182, 212, 0.25);
    box-sizing: border-box;
  }}

  .qr-box {{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    padding: 3.5mm;
    border-radius: 18px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.4);
    flex-shrink: 0;
  }}

  .qr-img {{
    width: 46mm;
    height: 46mm;
    display: block;
  }}

  .qr-box-label {{
    margin-top: 2mm;
    font-size: 8.5pt;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #0284c7;
    text-transform: uppercase;
  }}

  .instructions-box {{
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2.8mm;
  }}

  .inst-title {{
    font-size: 18pt;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.5px;
    line-height: 1.2;
  }}

  .inst-steps {{
    display: flex;
    flex-direction: column;
    gap: 2mm;
  }}

  .step-row {{
    display: flex;
    align-items: center;
    gap: 3mm;
    font-size: 11.5pt;
    color: #e2e8f0;
    font-weight: 500;
    line-height: 1.3;
  }}

  .step-num {{
    width: 23px;
    height: 23px;
    border-radius: 50%;
    background: #0284c7;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9.5pt;
    font-weight: 800;
    flex-shrink: 0;
  }}

  .url-badge-row {{
    display: flex;
    align-items: center;
    gap: 4mm;
    margin-top: 1mm;
  }}

  .url-pill {{
    background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%);
    color: #ffffff;
    font-size: 12.5pt;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 6px 18px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(6, 182, 212, 0.4);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }}

  .free-pill {{
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.6);
    color: #34d399;
    font-size: 10pt;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}

  /* Pilars / Badges destacats */
  .features-strip {{
    position: relative;
    z-index: 2;
    width: 250mm;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 3mm;
    margin: 2.5mm 0 1mm 0;
  }}

  .feat-card {{
    background: rgba(5, 20, 42, 0.7);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 14px;
    padding: 3mm 2mm;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5mm;
  }}

  .feat-icon {{
    font-size: 15pt;
  }}

  .feat-title {{
    font-size: 9.5pt;
    font-weight: 800;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}

  .feat-desc {{
    font-size: 7.8pt;
    color: #94a3b8;
    line-height: 1.25;
  }}

  /* Banner de Logos Institucionals */
  .logos-section {{
    position: relative;
    z-index: 2;
    width: 250mm;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 1mm;
  }}

  .logos-img {{
    width: 100%;
    max-height: 17mm;
    object-fit: contain;
    filter: drop-shadow(0 6px 15px rgba(0, 0, 0, 0.7));
  }}
</style>
</head>
<body>
  <div class="poster-container">
    <div class="glow-top"></div>
    <div class="glow-center"></div>

    <!-- CAPCALERA -->
    <div class="header-section">
      <div class="event-tag">✦ 5a FIRA PLUJA D'ART · SANT JORDI DESVALLS ✦</div>
      <h1 class="main-title">FESTIVAL D'ART LUMÍNIC</h1>
      <div class="theme-title">«Mar Mediterrània»</div>
      <div class="location-date">DISSABTE <span>19 DE SETEMBRE</span> · 21:30 H A 01:30 H</div>
    </div>

    <!-- HERO VISUAL: SIMBOL MEDUSA -->
    <div class="medusa-section">
      <div class="medusa-frame">
        <img src="{medusa_b64}" class="medusa-img" alt="Simbol Medusa Art Luminic" />
        <div class="medusa-overlay-badge">Instal·lació Airearte · Medusa Bioluminescent</div>
      </div>
    </div>

    <!-- AUDIOGUIA POETICA -->
    <div class="audioguia-section">
      <div class="audioguia-header">
        <span class="audioguia-icon">🎧</span>
        <h2 class="audioguia-title">AUDIOGUIA POÈTICA GPS</h2>
        <span class="audioguia-icon">🪼</span>
      </div>
      <div class="audioguia-quote">«La llum feta paraula: una travessa immersiva de poesia i mar»</div>
    </div>

    <!-- TARGETA QR + INSTRUCCIONS -->
    <div class="qr-main-card">
      <div class="qr-box">
        <img src="{qr_b64}" class="qr-img" alt="QR Audioguia" />
        <span class="qr-box-label">📲 ESCANEJA'M</span>
      </div>

      <div class="instructions-box">
        <div class="inst-title">Escaneja el codi amb el teu mòbil</div>
        <div class="inst-steps">
          <div class="step-row">
            <div class="step-num">1</div>
            <div>Enfoca el codi QR amb la càmera del smartphone (100% web).</div>
          </div>
          <div class="step-row">
            <div class="step-num">2</div>
            <div>Posa't els <b>auriculars</b> per a la màxima experiència sonora.</div>
          </div>
          <div class="step-row">
            <div class="step-num">3</div>
            <div>Passeja lliurement: <b>la veu s'activa sola per GPS</b> a cada punt.</div>
          </div>
        </div>
        <div class="url-badge-row">
          <div class="url-pill">🌐 desvallscultura.cat/audioguia</div>
          <div class="free-pill">✓ Entrada i accés lliure</div>
        </div>
      </div>
    </div>

    <!-- 4 DESTACATS / CARACTERISTIQUES -->
    <div class="features-strip">
      <div class="feat-card">
        <span class="feat-icon">🎧</span>
        <span class="feat-title">Auriculars</span>
        <span class="feat-desc">Immersió total en l'ambient sonor i marí</span>
      </div>
      <div class="feat-card">
        <span class="feat-icon">📍</span>
        <span class="feat-title">GPS Automàtic</span>
        <span class="feat-desc">S'activa sense prémer res a cada instal·lació</span>
      </div>
      <div class="feat-card">
        <span class="feat-icon">🎙️</span>
        <span class="feat-title">Margarida Codina</span>
        <span class="feat-desc">Locució poètica acompanyada de música en directe</span>
      </div>
      <div class="feat-card">
        <span class="feat-icon">⚡</span>
        <span class="feat-title">Sense Apps</span>
        <span class="feat-desc">Obre a l'instant a Safari, Chrome o qualsevol navegador</span>
      </div>
    </div>

    <!-- LOGOS INSTITUCIONALS -->
    <div class="logos-section">
      <img src="{logos_b64}" class="logos-img" alt="Logos Institucionals i Patrocinadors" />
    </div>
  </div>
</body>
</html>
"""

    temp_html = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "cartell_audioguia_medusa_a3.html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML creat: {temp_html}")
    
    # 4. Compilar a PDF A3 amb Chrome Headless
    chrome_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    target_pdf = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "cartell-festival-luminic-audioguia-medusa-a3.pdf")
    
    cmd = [
        chrome_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={target_pdf}",
        temp_html
    ]
    print("Executant Chrome Headless per generar PDF A3...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Error al compilar PDF:", res.stderr)
        return
    print(f"PDF A3 generat correctament: {target_pdf}")
    
    # 5. Renderitzar el PDF a imatges A3 a 300 DPI (3508 x 4961 px)
    print("Convertint PDF A3 a imatges 300 DPI amb PyMuPDF...")
    doc = fitz.open(target_pdf)
    page = doc[0]
    pix = page.get_pixmap(dpi=300)
    
    target_png = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "cartell-festival-luminic-audioguia-medusa-a3.png")
    target_jpg = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "cartell-festival-luminic-audioguia-medusa-a3.jpg")
    
    pix.save(target_png)
    im_rendered = Image.open(target_png).convert("RGB")
    im_rendered.save(target_jpg, quality=95)
    doc.close()
    print(f"Imatges 300 DPI generades: {target_png} ({pix.width}x{pix.height}) i {target_jpg}")
    
    # 6. Generar tambe el PDF del cartell infografic complet existent (cartell-audioguia-a3-watsap-300dpi.png)
    existing_png = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "cartell-audioguia-a3-watsap-300dpi.png")
    existing_pdf = os.path.join(BASE_DIR, "esborranys_i_propostes", "cartell", "cartell-audioguia-poetica-complet-a3.pdf")
    if os.path.exists(existing_png):
        doc_ex = fitz.open()
        rect = fitz.Rect(0, 0, 841.89, 1190.55)
        p = doc_ex.new_page(width=841.89, height=1190.55)
        p.insert_image(rect, filename=existing_png)
        doc_ex.save(existing_pdf, deflate=True)
        doc_ex.close()
        print(f"PDF del cartell infografic complet generat: {existing_pdf}")

    # 7. Copiar els resultats a docs/ i img/ per a acces rapid i publicacio web
    import shutil
    destinations = [
        (target_pdf, os.path.join(BASE_DIR, "docs", "cartell-festival-luminic-audioguia-medusa-a3.pdf")),
        (target_pdf, os.path.join(BASE_DIR, "web", "docs", "cartell-festival-luminic-audioguia-medusa-a3.pdf")),
        (target_jpg, os.path.join(BASE_DIR, "img", "cartell-festival-luminic-audioguia-medusa-a3.jpg")),
        (target_jpg, os.path.join(BASE_DIR, "web", "img", "cartell-festival-luminic-audioguia-medusa-a3.jpg")),
        (target_png, os.path.join(BASE_DIR, "img", "cartell-festival-luminic-audioguia-medusa-a3.png")),
        (target_png, os.path.join(BASE_DIR, "web", "img", "cartell-festival-luminic-audioguia-medusa-a3.png")),
        (existing_pdf, os.path.join(BASE_DIR, "docs", "cartell-audioguia-poetica-complet-a3.pdf")),
        (existing_pdf, os.path.join(BASE_DIR, "web", "docs", "cartell-audioguia-poetica-complet-a3.pdf"))
    ]
    for src, dst in destinations:
        if os.path.exists(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            print(f"Copia creada: {dst}")

    print("=== Tot el proces ha finalitzat amb exit! ===")

if __name__ == "__main__":
    main()
