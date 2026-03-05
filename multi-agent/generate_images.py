#!/usr/bin/env python3
"""
generate_images.py — Generador de imágenes profesionales para informes Adeptify
Genera: logo, mockup dashboard, diagrama arquitectura, cronograma Gantt,
infografía workflow, y portada. Todo con identidad visual Adeptify.

Uso:
  python generate_images.py <consolidado_final.json> <output_dir>

Output: JSON con rutas base64 de cada imagen generada.
"""

import sys
import os
import json
import base64
import math
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

# ─── BRAND CONSTANTS ──────────────────────────────────────────────────────────

COLORS = {
    # Paleta principal Adeptify (púrpura)
    'primary':       '#673DE6',   # Púrpura principal Adeptify
    'primary_dark':  '#2F1C6A',   # Púrpura oscuro (meteorite dark)
    'primary_light': '#8C85FF',   # Púrpura claro (meteorite light)

    # Acentos
    'accent':        '#00BCD4',   # Cyan/turquesa para acentos
    'accent_green':  '#4CAF50',   # Verde para métricas positivas
    'accent_orange': '#F9AB00',   # Naranja para highlights

    # Fondos
    'bg_light':      '#F3F0FF',   # Fondo lavanda claro
    'bg_dark':       '#2F1C6A',   # Fondo oscuro (igual que primary_dark)
    'bg_section':    '#F5F7FA',   # Fondo de secciones neutro

    # Texto
    'text_dark':     '#333333',   # Texto principal
    'text_medium':   '#666666',   # Texto secundario
    'text_white':    '#FFFFFF',   # Texto sobre fondos oscuros

    # Bordes y decoración
    'border_light':  '#D4CCFF',   # Bordes lavanda
    'border_medium': '#E0E6ED',   # Bordes neutros

    # Alertas
    'alert':         '#EA4335',   # Rojo para hitos/alertas

    # Tabla
    'table_header':  '#2F1C6A',
    'row_even':      '#F3F0FF',
    'row_odd':       '#FFFFFF',
}

def hex_to_rgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def hex_to_rgba(hex_color, alpha=255):
    r, g, b = hex_to_rgb(hex_color)
    return (r, g, b, alpha)

# ─── FONT HELPERS ─────────────────────────────────────────────────────────────

def get_font(size, bold=False):
    """Get best available font."""
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()

# ─── DRAWING HELPERS ──────────────────────────────────────────────────────────

def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = xy
    r = min(radius, (x1 - x0) // 2, (y1 - y0) // 2)
    if fill:
        draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
        draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
        draw.pieslice([x0, y0, x0 + 2*r, y0 + 2*r], 180, 270, fill=fill)
        draw.pieslice([x1 - 2*r, y0, x1, y0 + 2*r], 270, 360, fill=fill)
        draw.pieslice([x0, y1 - 2*r, x0 + 2*r, y1], 90, 180, fill=fill)
        draw.pieslice([x1 - 2*r, y1 - 2*r, x1, y1], 0, 90, fill=fill)
    if outline:
        draw.arc([x0, y0, x0 + 2*r, y0 + 2*r], 180, 270, fill=outline, width=width)
        draw.arc([x1 - 2*r, y0, x1, y0 + 2*r], 270, 360, fill=outline, width=width)
        draw.arc([x0, y1 - 2*r, x0 + 2*r, y1], 90, 180, fill=outline, width=width)
        draw.arc([x1 - 2*r, y1 - 2*r, x1, y1], 0, 90, fill=outline, width=width)
        draw.line([x0 + r, y0, x1 - r, y0], fill=outline, width=width)
        draw.line([x0 + r, y1, x1 - r, y1], fill=outline, width=width)
        draw.line([x0, y0 + r, x0, y1 - r], fill=outline, width=width)
        draw.line([x1, y0 + r, x1, y1 - r], fill=outline, width=width)

def draw_hexagon(draw, cx, cy, size, fill, outline=None):
    points = []
    for i in range(6):
        angle = math.radians(60 * i - 30)
        points.append((cx + size * math.cos(angle), cy + size * math.sin(angle)))
    draw.polygon(points, fill=fill, outline=outline)
    return points

def draw_gradient_rect(img, xy, color_start, color_end, horizontal=True):
    x0, y0, x1, y1 = xy
    r1, g1, b1 = hex_to_rgb(color_start)
    r2, g2, b2 = hex_to_rgb(color_end)
    w = x1 - x0
    h = y1 - y0
    steps = w if horizontal else h
    if steps <= 0:
        return
    for i in range(steps):
        ratio = i / max(steps - 1, 1)
        r = int(r1 + (r2 - r1) * ratio)
        g = int(g1 + (g2 - g1) * ratio)
        b = int(b1 + (b2 - b1) * ratio)
        draw = ImageDraw.Draw(img)
        if horizontal:
            draw.line([(x0 + i, y0), (x0 + i, y1)], fill=(r, g, b))
        else:
            draw.line([(x0, y0 + i), (x1, y0 + i)], fill=(r, g, b))

def draw_arrow(draw, start, end, color, width=2, head_size=8):
    draw.line([start, end], fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    x, y = end
    draw.polygon([
        (x, y),
        (x - head_size * math.cos(angle - math.pi/6), y - head_size * math.sin(angle - math.pi/6)),
        (x - head_size * math.cos(angle + math.pi/6), y - head_size * math.sin(angle + math.pi/6)),
    ], fill=color)


# ═══════════════════════════════════════════════════════════════════════════════
# IMAGE GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_logo(width=500, height=120):
    """Logo Adeptify con hexágono-circuito + texto. Fondo transparente."""
    img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Hexágono púrpura principal
    cx, cy = 55, height // 2
    draw_hexagon(draw, cx, cy, 32, hex_to_rgb(COLORS['primary']), hex_to_rgb(COLORS['primary_dark']))

    # Circuito dentro del hexágono
    draw.line([(cx - 14, cy), (cx + 14, cy)], fill=hex_to_rgb(COLORS['text_white']), width=2)
    draw.line([(cx, cy - 14), (cx, cy + 14)], fill=hex_to_rgb(COLORS['text_white']), width=2)
    draw.ellipse([(cx - 5, cy - 5), (cx + 5, cy + 5)], fill=hex_to_rgb(COLORS['text_white']))
    for dx, dy in [(-14, 0), (14, 0), (0, -14), (0, 14)]:
        draw.ellipse([(cx+dx-3, cy+dy-3), (cx+dx+3, cy+dy+3)], fill=hex_to_rgb(COLORS['primary_light']))

    # Texto "adeptify" en púrpura oscuro
    font_main = get_font(38, bold=True)
    font_sub = get_font(14)
    draw.text((100, height // 2 - 26), "adeptify", fill=hex_to_rgb(COLORS['primary_dark']), font=font_main)
    draw.text((100, height // 2 + 18), "Tu socio tecnológico de confianza", fill=hex_to_rgb(COLORS['primary']), font=font_sub)

    return img


def generate_logo_white(width=500, height=120):
    """Logo para fondos oscuros (texto blanco)."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = 55, height // 2
    draw_hexagon(draw, cx, cy, 32, hex_to_rgb(COLORS['primary_light']), hex_to_rgb(COLORS['primary']))

    draw.line([(cx - 14, cy), (cx + 14, cy)], fill=hex_to_rgb(COLORS['text_white']), width=2)
    draw.line([(cx, cy - 14), (cx, cy + 14)], fill=hex_to_rgb(COLORS['text_white']), width=2)
    draw.ellipse([(cx - 5, cy - 5), (cx + 5, cy + 5)], fill=hex_to_rgb(COLORS['text_white']))
    for dx, dy in [(-14, 0), (14, 0), (0, -14), (0, 14)]:
        draw.ellipse([(cx+dx-3, cy+dy-3), (cx+dx+3, cy+dy+3)], fill=hex_to_rgb(COLORS['accent']))

    font_main = get_font(38, bold=True)
    font_sub = get_font(14)
    draw.text((100, height // 2 - 26), "adeptify", fill=hex_to_rgb(COLORS['text_white']), font=font_main)
    draw.text((100, height // 2 + 18), "Tu socio tecnológico de confianza", fill=hex_to_rgb(COLORS['primary_light']), font=font_sub)

    return img


def generate_cover(client_name, sector="", width=800, height=500):
    """Portada profesional con gradiente púrpura Adeptify y logo."""
    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['primary_dark']))
    draw_gradient_rect(img, (0, 0, width, height), COLORS['primary_dark'], COLORS['primary'], horizontal=True)
    draw = ImageDraw.Draw(img)

    # Patrón de puntos decorativos
    for x in range(0, width, 40):
        for y in range(0, height, 40):
            if (x + y) % 80 == 0:
                draw.ellipse([(x-1, y-1), (x+1, y+1)], fill=hex_to_rgba(COLORS['text_white'], 40)[:3])

    # Logo blanco sobre fondo oscuro
    logo = generate_logo_white(400, 90)
    img.paste(logo, (width // 2 - 200, 40), logo)

    # Línea decorativa púrpura claro
    draw.line([(100, 150), (width - 100, 150)], fill=hex_to_rgb(COLORS['primary_light']), width=2)

    # Título
    font_title = get_font(28, bold=True)
    font_subtitle = get_font(18)
    font_client = get_font(36, bold=True)
    font_detail = get_font(14)

    draw.text((width // 2, 180), "Propuesta de Transformación Digital", fill=hex_to_rgb(COLORS['text_white']), font=font_title, anchor="mt")
    draw.text((width // 2, 250), client_name, fill=hex_to_rgb(COLORS['primary_light']), font=font_client, anchor="mt")

    if sector:
        draw.text((width // 2, 310), sector, fill=hex_to_rgb(COLORS['accent']), font=font_subtitle, anchor="mt")

    # Línea inferior decorativa
    draw.line([(100, height - 80), (width - 100, height - 80)], fill=hex_to_rgb(COLORS['primary_light']), width=1)
    draw.text((width // 2, height - 60), "— DOCUMENTO CONFIDENCIAL —", fill=hex_to_rgb(COLORS['primary_light']), font=font_detail, anchor="mt")

    return img


def generate_mockup_dashboard(features=None, client_name="", width=800, height=500):
    """Mockup de un dashboard SaaS profesional."""
    if not features:
        features = ["Panel de control", "Métricas KPI", "Automatización", "Integraciones"]

    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['bg_light']))
    draw = ImageDraw.Draw(img)

    # Barra superior del "navegador"
    draw.rectangle([(0, 0), (width, 35)], fill=hex_to_rgb(COLORS['primary_dark']))
    font_sm = get_font(11)
    font_md = get_font(13, bold=True)
    font_lg = get_font(16, bold=True)
    font_xl = get_font(22, bold=True)
    font_metric = get_font(28, bold=True)

    # Dots del navegador
    for i, color in enumerate(['#FF5F56', '#FFBD2E', '#27C93F']):
        draw.ellipse([(12 + i*20, 10), (24 + i*20, 22)], fill=hex_to_rgb(color))
    draw.text((100, 10), f"dashboard.adeptify.es — {client_name}", fill=hex_to_rgb(COLORS['text_white']), font=font_sm)

    # Sidebar
    sidebar_w = 180
    draw.rectangle([(0, 35), (sidebar_w, height)], fill=hex_to_rgb(COLORS['primary_dark']))

    # Logo en sidebar
    logo_sm = generate_logo_white(160, 45)
    img.paste(logo_sm, (10, 45), logo_sm)

    # Menu items
    menu_items = ["📊 Dashboard", "⚡ Automatización", "🔗 Integraciones", "📈 Analítica", "⚙️ Configuración", "👥 Usuarios"]
    for i, item in enumerate(menu_items):
        y = 110 + i * 38
        if i == 0:
            draw.rectangle([(0, y - 4), (sidebar_w, y + 28)], fill=hex_to_rgb(COLORS['primary']))
        draw.text((20, y), item, fill=hex_to_rgb(COLORS['text_white']), font=font_sm)

    # Content area
    cx = sidebar_w + 20
    cy = 55
    cw = width - sidebar_w - 40

    # Header del content
    draw.text((cx, cy), f"Dashboard — {client_name}", fill=hex_to_rgb(COLORS['text_dark']), font=font_xl)
    cy += 40

    # KPI Cards (4 cards)
    card_w = (cw - 30) // 4
    kpi_data = [
        ("Eficiencia", "+34%", COLORS['accent_green']),
        ("Tiempo ahorro", "128h/mes", COLORS['primary']),
        ("Integraciones", "12 activas", COLORS['accent']),
        ("ROI", "285%", COLORS['accent_green']),
    ]

    for i, (label, value, color) in enumerate(kpi_data):
        x = cx + i * (card_w + 10)
        draw_rounded_rect(draw, (x, cy, x + card_w, cy + 80), 8, fill=hex_to_rgb(COLORS['text_white']))
        draw.line([(x, cy), (x + card_w, cy)], fill=hex_to_rgb(color), width=3)
        draw.text((x + 10, cy + 10), label, fill=hex_to_rgb(COLORS['text_dark']), font=font_sm)
        draw.text((x + 10, cy + 32), value, fill=hex_to_rgb(color), font=font_metric)

    cy += 100

    # Chart area
    chart_w = int(cw * 0.6)
    chart_h = 200
    draw_rounded_rect(draw, (cx, cy, cx + chart_w, cy + chart_h), 8, fill=hex_to_rgb(COLORS['text_white']))
    draw.text((cx + 15, cy + 10), "Rendimiento Mensual", fill=hex_to_rgb(COLORS['text_dark']), font=font_md)

    # Simulated bar chart
    bars_x = cx + 30
    bars_y = cy + 45
    bar_w = (chart_w - 80) // 8
    bar_heights = [60, 80, 55, 90, 75, 110, 95, 130]
    months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago"]
    max_h = max(bar_heights)

    for i, (bh, month) in enumerate(zip(bar_heights, months)):
        bx = bars_x + i * (bar_w + 8)
        scaled = int(bh / max_h * 130)
        bar_color = COLORS['primary'] if i < 6 else COLORS['accent']
        draw_rounded_rect(draw, (bx, bars_y + 130 - scaled, bx + bar_w, bars_y + 130), 3, fill=hex_to_rgb(bar_color))
        draw.text((bx + bar_w // 2, bars_y + 140), month, fill=hex_to_rgb(COLORS['text_dark']), font=get_font(9), anchor="mt")

    # Side panel - Features list
    panel_x = cx + chart_w + 15
    panel_w = cw - chart_w - 15
    draw_rounded_rect(draw, (panel_x, cy, panel_x + panel_w, cy + chart_h), 8, fill=hex_to_rgb(COLORS['text_white']))
    draw.text((panel_x + 10, cy + 10), "Módulos Activos", fill=hex_to_rgb(COLORS['text_dark']), font=font_md)

    for i, feat in enumerate(features[:6]):
        fy = cy + 40 + i * 25
        draw.ellipse([(panel_x + 12, fy + 3), (panel_x + 22, fy + 13)], fill=hex_to_rgb(COLORS['accent_green']))
        draw.text((panel_x + 10, fy + 2), "✓", fill=hex_to_rgb(COLORS['text_white']), font=get_font(9))
        draw.text((panel_x + 28, fy), str(feat)[:25], fill=hex_to_rgb(COLORS['text_dark']), font=font_sm)

    # Footer bar
    draw.rectangle([(sidebar_w, height - 30), (width, height)], fill=hex_to_rgb(COLORS['bg_light']))
    draw.text((cx, height - 22), "© Adeptify Systems · Última actualización: hace 2 min", fill=hex_to_rgb(COLORS['text_dark']), font=get_font(10))

    return img


def generate_architecture_diagram(components=None, flow="", width=800, height=500):
    """Diagrama de arquitectura técnica."""
    if not components:
        components = [
            {"nombre": "Frontend", "tecnologia": "React"},
            {"nombre": "API Gateway", "tecnologia": "Node.js"},
            {"nombre": "Base de Datos", "tecnologia": "PostgreSQL"},
            {"nombre": "Automatización", "tecnologia": "n8n / Zapier"},
        ]

    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['text_white']))
    draw = ImageDraw.Draw(img)

    # Header gradient bar
    draw_gradient_rect(img, (0, 0, width, 50), COLORS['primary_dark'], COLORS['primary'], horizontal=True)
    draw = ImageDraw.Draw(img)

    font_title = get_font(16, bold=True)
    font_comp = get_font(13, bold=True)
    font_tech = get_font(11)
    font_sm = get_font(10)
    font_label = get_font(12, bold=True)

    draw.text((width // 2, 15), "Arquitectura de la Solución — Adeptify", fill=hex_to_rgb(COLORS['text_white']), font=font_title, anchor="mt")

    # Layers
    layers = [
        ("Capa de Presentación", COLORS['primary'], 70),
        ("Capa de Lógica de Negocio", COLORS['primary'], 190),
        ("Capa de Datos e Integraciones", COLORS['accent'], 310),
        ("Infraestructura & Seguridad", COLORS['accent_green'], 410),
    ]

    for label, color, y in layers:
        # Layer background
        draw.rectangle([(20, y), (width - 20, y + 100)], fill=hex_to_rgb(COLORS['bg_light']), outline=hex_to_rgb(color), width=2)
        # Layer label
        draw.rectangle([(20, y), (180, y + 25)], fill=hex_to_rgb(color))
        draw.text((25, y + 4), label, fill=hex_to_rgb(COLORS['text_white']), font=font_sm)

    # Components distributed across layers
    comp_positions = []
    layer_map = {0: 70, 1: 190, 2: 310, 3: 410}

    for i, comp in enumerate(components[:8]):
        layer_idx = min(i // 2, 3)
        col = i % 2
        if i >= 6:
            layer_idx = 3
            col = i - 6

        base_y = layer_map.get(layer_idx, 310)
        x = 200 + col * 280
        y = base_y + 35

        # Component box
        draw_rounded_rect(draw, (x, y, x + 240, y + 55), 8, fill=hex_to_rgb(COLORS['text_white']), outline=hex_to_rgb(COLORS['primary']), width=2)

        nombre = str(comp.get('nombre', f'Componente {i+1}'))[:28]
        tech = str(comp.get('tecnologia', ''))[:30]

        draw.text((x + 10, y + 8), nombre, fill=hex_to_rgb(COLORS['primary_dark']), font=font_comp)
        draw.text((x + 10, y + 30), tech, fill=hex_to_rgb(COLORS['text_dark']), font=font_tech)

        comp_positions.append((x + 120, y + 55))

    # Arrows between layers
    for i in range(len(comp_positions) - 1):
        if i % 2 == 0 and i + 2 < len(comp_positions):
            sx, sy = comp_positions[i]
            ex, ey = comp_positions[i + 2]
            mid_y = (sy + ey) // 2
            draw.line([(sx, sy), (sx, mid_y), (ex, mid_y), (ex, ey - 10)], fill=hex_to_rgb(COLORS['primary']), width=2)
            draw_arrow(draw, (ex, mid_y), (ex, ey - 10), hex_to_rgb(COLORS['primary']), width=2)

    # Adeptify watermark
    draw.text((width - 150, height - 20), "© Adeptify Systems", fill=hex_to_rgb(COLORS['border_light']), font=font_sm)

    return img


def generate_gantt_timeline(phases=None, total_duration="", width=800, height=350):
    """Cronograma visual tipo Gantt simplificado."""
    if not phases:
        phases = [
            {"nombre": "Fase 1: Descubrimiento", "duracion": "2 semanas"},
            {"nombre": "Fase 2: Diseño", "duracion": "3 semanas"},
            {"nombre": "Fase 3: Desarrollo", "duracion": "6 semanas"},
            {"nombre": "Fase 4: Testing", "duracion": "2 semanas"},
            {"nombre": "Fase 5: Despliegue", "duracion": "1 semana"},
        ]

    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['text_white']))
    draw = ImageDraw.Draw(img)

    # Header
    draw_gradient_rect(img, (0, 0, width, 45), COLORS['primary_dark'], COLORS['primary'], horizontal=True)
    draw = ImageDraw.Draw(img)

    font_title = get_font(15, bold=True)
    font_phase = get_font(11, bold=True)
    font_dur = get_font(10)
    font_sm = get_font(9)

    title = f"Cronograma del Proyecto"
    if total_duration:
        title += f" — {total_duration}"
    draw.text((width // 2, 13), title, fill=hex_to_rgb(COLORS['text_white']), font=font_title, anchor="mt")

    # Parse durations to get relative widths
    def parse_weeks(dur_str):
        s = str(dur_str).lower()
        for word in s.split():
            try:
                return int(word)
            except ValueError:
                continue
        return 2  # default

    durations = [parse_weeks(p.get('duracion', '2 semanas')) for p in phases]
    total_weeks = sum(durations) or 1

    # Layout
    margin_left = 200
    margin_right = 30
    chart_width = width - margin_left - margin_right
    bar_height = 30
    bar_gap = 12
    start_y = 70

    # Week markers
    week_width = chart_width / total_weeks
    for w in range(total_weeks + 1):
        x = margin_left + int(w * week_width)
        draw.line([(x, start_y - 15), (x, start_y + len(phases) * (bar_height + bar_gap) + 10)], fill=hex_to_rgb(COLORS['border_light']), width=1)
        if w % max(1, total_weeks // 10) == 0 or w == total_weeks:
            draw.text((x, start_y - 20), f"S{w}", fill=hex_to_rgb(COLORS['text_dark']), font=font_sm, anchor="mt")

    # Phase bars
    bar_colors = [COLORS['primary'], COLORS['primary'], COLORS['accent'], COLORS['accent_green'], COLORS['alert'], COLORS['primary_dark'], COLORS['primary_light'], COLORS['primary']]

    current_week = 0
    for i, phase in enumerate(phases):
        y = start_y + i * (bar_height + bar_gap)
        weeks = durations[i]

        # Phase name
        name = str(phase.get('nombre', f'Fase {i+1}'))[:30]
        draw.text((10, y + 6), name, fill=hex_to_rgb(COLORS['text_dark']), font=font_phase)

        # Bar
        x_start = margin_left + int(current_week * week_width)
        x_end = margin_left + int((current_week + weeks) * week_width)
        color = bar_colors[i % len(bar_colors)]

        draw_rounded_rect(draw, (x_start, y, x_end, y + bar_height), 6, fill=hex_to_rgb(color))

        # Duration text on bar
        bar_text = str(phase.get('duracion', f'{weeks}sem'))
        draw.text(((x_start + x_end) // 2, y + 8), bar_text, fill=hex_to_rgb(COLORS['text_white']), font=font_dur, anchor="mt")

        # Milestone diamond at end
        mx = x_end
        my = y + bar_height // 2
        diamond_size = 6
        draw.polygon([(mx, my - diamond_size), (mx + diamond_size, my), (mx, my + diamond_size), (mx - diamond_size, my)], fill=hex_to_rgb(COLORS['alert']))

        current_week += weeks

    # Footer
    y_footer = start_y + len(phases) * (bar_height + bar_gap) + 25
    draw.line([(10, y_footer), (width - 10, y_footer)], fill=hex_to_rgb(COLORS['border_light']), width=1)
    draw.text((10, y_footer + 5), f"◆ Hito clave  |  Duración total: {total_duration or f'{total_weeks} semanas'}", fill=hex_to_rgb(COLORS['text_dark']), font=font_sm)
    draw.text((width - 150, y_footer + 5), "© Adeptify Systems", fill=hex_to_rgb(COLORS['border_light']), font=font_sm)

    return img


def generate_workflow_infographic(flow_steps=None, title="Flujo de Trabajo", width=800, height=400):
    """Infografía del flujo de trabajo / automatización."""
    if not flow_steps:
        flow_steps = ["Entrada datos", "Procesamiento", "Automatización", "Validación", "Resultado"]

    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['text_white']))
    draw = ImageDraw.Draw(img)

    # Header
    draw_gradient_rect(img, (0, 0, width, 45), COLORS['primary_dark'], COLORS['primary'], horizontal=True)
    draw = ImageDraw.Draw(img)

    font_title = get_font(15, bold=True)
    font_step = get_font(11, bold=True)
    font_num = get_font(18, bold=True)
    font_sm = get_font(9)

    draw.text((width // 2, 13), title, fill=hex_to_rgb(COLORS['text_white']), font=font_title, anchor="mt")

    # Calculate layout
    n_steps = len(flow_steps)
    step_w = min(140, (width - 80) // n_steps - 20)
    total_w = n_steps * step_w + (n_steps - 1) * 50
    start_x = (width - total_w) // 2
    center_y = height // 2 + 10

    step_colors = [COLORS['primary'], COLORS['primary'], COLORS['accent'], COLORS['accent_green'], COLORS['alert'], COLORS['primary_dark'], COLORS['primary_light'], COLORS['primary']]

    positions = []
    for i, step in enumerate(flow_steps[:8]):
        x = start_x + i * (step_w + 50)
        positions.append(x)

        color = step_colors[i % len(step_colors)]

        # Circle with number
        cx = x + step_w // 2
        cy_circle = center_y - 30
        draw.ellipse([(cx - 25, cy_circle - 25), (cx + 25, cy_circle + 25)], fill=hex_to_rgb(color))
        draw.text((cx, cy_circle), str(i + 1), fill=hex_to_rgb(COLORS['text_white']), font=font_num, anchor="mm")

        # Box below
        draw_rounded_rect(draw, (x, center_y + 10, x + step_w, center_y + 60), 8, fill=hex_to_rgb(COLORS['bg_light']), outline=hex_to_rgb(color), width=2)

        # Step text (wrap if needed)
        step_text = str(step)[:25]
        draw.text((x + step_w // 2, center_y + 28), step_text, fill=hex_to_rgb(COLORS['text_dark']), font=font_step, anchor="mt")

        # Arrow to next
        if i < n_steps - 1:
            ax_start = x + step_w + 5
            ax_end = x + step_w + 45
            draw_arrow(draw, (ax_start, center_y - 30), (ax_end, center_y - 30), hex_to_rgb(COLORS['primary']), width=2, head_size=8)

    # Decorative bottom line
    draw.line([(30, height - 40), (width - 30, height - 40)], fill=hex_to_rgb(COLORS['accent']), width=2)
    draw.text((width // 2, height - 25), "Flujo automatizado · Adeptify Systems", fill=hex_to_rgb(COLORS['text_dark']), font=font_sm, anchor="mt")

    return img


def generate_integration_map(integrations=None, width=800, height=450):
    """Mapa de integraciones de sistemas."""
    if not integrations:
        integrations = [
            {"nombre": "CRM", "origen": "Salesforce", "destino": "Sistema Central"},
            {"nombre": "ERP", "origen": "SAP", "destino": "Sistema Central"},
            {"nombre": "Email", "origen": "Outlook", "destino": "Sistema Central"},
        ]

    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['text_white']))
    draw = ImageDraw.Draw(img)

    draw_gradient_rect(img, (0, 0, width, 45), COLORS['primary_dark'], COLORS['primary'], horizontal=True)
    draw = ImageDraw.Draw(img)

    font_title = get_font(15, bold=True)
    font_node = get_font(12, bold=True)
    font_sm = get_font(10)

    draw.text((width // 2, 13), "Mapa de Integraciones", fill=hex_to_rgb(COLORS['text_white']), font=font_title, anchor="mt")

    # Central node
    cx, cy = width // 2, height // 2 + 10
    draw.ellipse([(cx - 55, cy - 55), (cx + 55, cy + 55)], fill=hex_to_rgb(COLORS['primary']), outline=hex_to_rgb(COLORS['primary_dark']), width=3)
    draw.text((cx, cy - 8), "Adeptify", fill=hex_to_rgb(COLORS['text_white']), font=font_node, anchor="mm")
    draw.text((cx, cy + 10), "Hub Central", fill=hex_to_rgb(COLORS['accent']), font=font_sm, anchor="mm")

    # External nodes in circle
    n = len(integrations)
    radius = 160
    node_colors = [COLORS['accent'], COLORS['accent_green'], COLORS['alert'], COLORS['primary'], COLORS['primary_dark'], COLORS['primary_light']]

    for i, integ in enumerate(integrations[:8]):
        angle = (2 * math.pi * i / max(n, 1)) - math.pi / 2
        nx = cx + int(radius * math.cos(angle))
        ny = cy + int(radius * math.sin(angle))

        color = node_colors[i % len(node_colors)]

        # Connection line
        draw.line([(cx, cy), (nx, ny)], fill=hex_to_rgb(COLORS['border_light']), width=2)
        draw_arrow(draw, (cx + int(40 * math.cos(angle)), cy + int(40 * math.sin(angle))),
                   (nx - int(35 * math.cos(angle)), ny - int(35 * math.sin(angle))),
                   hex_to_rgb(color), width=2, head_size=8)

        # Node
        draw.ellipse([(nx - 40, ny - 40), (nx + 40, ny + 40)], fill=hex_to_rgb(color))
        nombre = str(integ.get('nombre', integ.get('origen', f'Sys {i+1}')))[:12]
        draw.text((nx, ny), nombre, fill=hex_to_rgb(COLORS['text_white']), font=font_node, anchor="mm")

    draw.text((width - 150, height - 20), "© Adeptify Systems", fill=hex_to_rgb(COLORS['border_light']), font=font_sm)

    return img


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def img_to_base64(img, format='PNG'):
    buf = BytesIO()
    if img.mode == 'RGBA' and format.upper() == 'PNG':
        img.save(buf, format='PNG')
    else:
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        img.save(buf, format=format)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def save_image(img, path, format='PNG'):
    if img.mode == 'RGBA' and format.upper() != 'PNG':
        img = img.convert('RGB')
    img.save(path, format=format)


def main():
    if len(sys.argv) < 3:
        print("Uso: python generate_images.py <consolidado_final.json> <output_dir>")
        sys.exit(1)

    consolidado_path = sys.argv[1]
    output_dir = sys.argv[2]
    os.makedirs(output_dir, exist_ok=True)

    # Load data
    with open(consolidado_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    datos_cliente = data.get('datos_cliente', {})
    cliente = datos_cliente.get('cliente', {})
    client_name = cliente.get('nombre', 'Cliente')
    sector = cliente.get('sector', '')

    # Extract component info for diagrams
    arq = data.get('ag04_arquitectura', {})
    componentes = arq.get('componentes_solucion', [])
    flujo = arq.get('arquitectura', {}).get('flujo_datos_principal', '')

    # Extract phases for Gantt
    proj = data.get('ag07_proyecto', {})
    cronograma = proj.get('cronograma', {})
    fases = cronograma.get('fases', [])
    duracion_total = cronograma.get('duracion_total', '')

    # Extract UX features for mockup
    ux = data.get('ag05_ux', {})
    dashboard = ux.get('dashboard_principal', {})
    features = dashboard.get('funcionalidades_clave', ['Panel de control', 'Métricas', 'Automatización', 'Integraciones'])

    # Extract integrations
    integ = data.get('ag06_integraciones', {})
    mapa_integ = integ.get('mapa_integraciones', [])

    # Extract flow steps
    flow_steps = []
    if flujo:
        if isinstance(flujo, list):
            flow_steps = [str(s) for s in flujo]
        elif isinstance(flujo, str):
            flow_steps = [s.strip() for s in flujo.split('→') if s.strip()]
    if not flow_steps:
        flow_steps = ["Entrada", "Procesamiento", "Automatización", "Validación", "Salida"]

    results = {}

    # 1. Logo
    print("[IMG] Generando logo...")
    logo = generate_logo()
    save_image(logo, os.path.join(output_dir, 'logo.png'))
    results['logo_base64'] = img_to_base64(logo)

    logo_white = generate_logo_white()
    save_image(logo_white, os.path.join(output_dir, 'logo_white.png'))
    results['logo_white_base64'] = img_to_base64(logo_white)

    # 2. Cover
    print("[IMG] Generando portada...")
    cover = generate_cover(client_name, sector)
    save_image(cover, os.path.join(output_dir, 'cover.png'))
    results['cover_base64'] = img_to_base64(cover)

    # 3. Dashboard Mockup
    print("[IMG] Generando mockup dashboard...")
    mockup = generate_mockup_dashboard(features, client_name)
    save_image(mockup, os.path.join(output_dir, 'mockup_dashboard.png'))
    results['mockup_base64'] = img_to_base64(mockup)

    # 4. Architecture Diagram
    print("[IMG] Generando diagrama de arquitectura...")
    arch = generate_architecture_diagram(componentes, flujo)
    save_image(arch, os.path.join(output_dir, 'architecture.png'))
    results['diagrama_base64'] = img_to_base64(arch)

    # 5. Gantt Timeline
    print("[IMG] Generando cronograma Gantt...")
    gantt = generate_gantt_timeline(fases, duracion_total)
    save_image(gantt, os.path.join(output_dir, 'gantt_timeline.png'))
    results['cronograma_base64'] = img_to_base64(gantt)

    # 6. Workflow Infographic
    print("[IMG] Generando infografía de flujo de trabajo...")
    workflow = generate_workflow_infographic(flow_steps[:7], "Flujo de Automatización")
    save_image(workflow, os.path.join(output_dir, 'workflow.png'))
    results['workflow_base64'] = img_to_base64(workflow)

    # 7. Integration Map
    print("[IMG] Generando mapa de integraciones...")
    integ_map = generate_integration_map(mapa_integ)
    save_image(integ_map, os.path.join(output_dir, 'integrations.png'))
    results['integraciones_base64'] = img_to_base64(integ_map)

    # Save results JSON
    output_json = os.path.join(output_dir, 'images_manifest.json')
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(results, f)

    print(f"\n✅ {len(results)} imágenes generadas en {output_dir}/")
    print(f"   Manifest: {output_json}")

    # Output JSON to stdout for piping
    print("\n--- JSON_OUTPUT_START ---")
    print(json.dumps(results))
    print("--- JSON_OUTPUT_END ---")


if __name__ == '__main__':
    main()
