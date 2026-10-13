"""Prosty zapis i odczyt plików .xlsx bez dodatkowych bibliotek (tylko biblioteka standardowa Pythona).

Używają go skrypty w folderze pytania/: szablon-z-przykladami.py (tworzy pytania.xlsx)
oraz excel-na-js.py (zamienia pytania.xlsx na baza-pytan.js dla gry).
"""
import re
import zipfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'


def _col(n):
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def zapisz(sciezka, arkusze):
    """arkusze: lista słowników {nazwa, wiersze, szerokosci, naglowek, walidacje}.
    Pierwszy wiersz to nagłówek (pogrubiony, granatowe tło). walidacje: [(zakres, 'A,B,C,D'), ...]."""
    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF55617F"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF00276F"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""
    sheets_xml, rels_xml, ct_xml = [], [], []
    with zipfile.ZipFile(sciezka, 'w', zipfile.ZIP_DEFLATED) as z:
        for i, a in enumerate(arkusze, 1):
            rows = []
            for r, wiersz in enumerate(a['wiersze'], 1):
                cells = []
                for c, v in enumerate(wiersz, 1):
                    if v is None or v == '':
                        continue
                    ref = f'{_col(c)}{r}'
                    s = 1 if (r == 1 and a.get('naglowek', True)) else a.get('styl_kolumn', {}).get(c, 0)
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        cells.append(f'<c r="{ref}" s="{s}"><v>{v}</v></c>')
                    else:
                        cells.append(f'<c r="{ref}" t="inlineStr" s="{s}"><is><t xml:space="preserve">{escape(str(v))}</t></is></c>')
                ht = ' ht="30" customHeight="1"' if r == 1 and a.get('naglowek', True) else ''
                rows.append(f'<row r="{r}"{ht}>{"".join(cells)}</row>')
            cols = ''.join(f'<col min="{k}" max="{k}" width="{w}" customWidth="1"/>' for k, w in enumerate(a.get('szerokosci', []), 1))
            pane = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' if a.get('naglowek', True) else '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
            dv = ''
            if a.get('walidacje'):
                items = ''.join(f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="{zakres}"><formula1>"{lista}"</formula1></dataValidation>' for zakres, lista in a['walidacje'])
                dv = f'<dataValidations count="{len(a["walidacje"])}">{items}</dataValidations>'
            sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                     '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                     f'{pane}<sheetFormatPr defaultRowHeight="16"/>{f"<cols>{cols}</cols>" if cols else ""}'
                     f'<sheetData>{"".join(rows)}</sheetData>{dv}</worksheet>')
            z.writestr(f'xl/worksheets/sheet{i}.xml', sheet)
            sheets_xml.append(f'<sheet name="{escape(a["nazwa"])}" sheetId="{i}" r:id="rId{i}"/>')
            rels_xml.append(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>')
            ct_xml.append(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
        n = len(arkusze)
        rels_xml.append(f'<Relationship Id="rId{n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>')
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                   f'{"".join(ct_xml)}</Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                   f'<sheets>{"".join(sheets_xml)}</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{"".join(rels_xml)}</Relationships>')
        z.writestr('xl/styles.xml', styles)


def czytaj(sciezka):
    """Zwraca {nazwa_arkusza: [[wartości wiersza], ...]}. Obsługuje pliki zapisane przez Excela i Numbers."""
    wynik = {}
    with zipfile.ZipFile(sciezka) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('m:si', NS):
                shared.append(''.join(t.text or '' for t in si.iter(f'{{{NS["m"]}}}t')))
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        cel = {r.get('Id'): r.get('Target') for r in rels.findall(f'{{{REL_NS}}}Relationship')}
        for s in wb.find('m:sheets', NS):
            target = cel[s.get(f'{{{NS["r"]}}}id')].lstrip('/')
            path = target if target.startswith('xl/') else f'xl/{target}'
            root = ET.fromstring(z.read(path))
            wiersze = []
            for row in root.iter(f'{{{NS["m"]}}}row'):
                vals = {}
                for c in row.findall('m:c', NS):
                    ref = re.match(r'([A-Z]+)', c.get('r')).group(1)
                    k = 0
                    for ch in ref:
                        k = k * 26 + ord(ch) - 64
                    t = c.get('t')
                    if t == 'inlineStr':
                        v = ''.join(x.text or '' for x in c.iter(f'{{{NS["m"]}}}t'))
                    else:
                        ve = c.find('m:v', NS)
                        v = ve.text if ve is not None else ''
                        if t == 's' and v != '':
                            v = shared[int(v)]
                    vals[k] = v
                if vals:
                    wiersze.append([vals.get(k, '') for k in range(1, max(vals) + 1)])
            wynik[s.get('name')] = wiersze
    return wynik
