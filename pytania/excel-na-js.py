"""Zamienia pytania/pytania.xlsx na pytania/baza-pytan.js, z którego korzysta gra.
Uruchom w folderze projektu:   python3 pytania/excel-na-js.py
"""
import json
import os
import sys
from xlsx_prosty import czytaj

TU = os.path.dirname(os.path.abspath(__file__))
LITERY = 'ABCD'


def tekst(v):
    v = str(v).strip()
    return v[:-2] if v.endswith('.0') and v[:-2].isdigit() else v


arkusze = czytaj(os.path.join(TU, 'pytania.xlsx'))
uwagi = []
semestry = {str(s): [] for s in range(1, 8)}
for nr, w in enumerate(arkusze.get('Pytania', [])[1:], start=2):
    w = [tekst(x) for x in w] + [''] * 9
    sem, przedmiot, prowadzacy, q, a, b, c, d, ok = w[:9]
    if not any(w[:9]):
        continue
    if sem not in semestry:
        uwagi.append(f'Pytania, wiersz {nr}: semestr musi być od 1 do 7 (jest „{sem}”).'); continue
    if not q or not all([a, b, c, d]):
        uwagi.append(f'Pytania, wiersz {nr}: brakuje pytania albo którejś odpowiedzi.'); continue
    if ok.upper() not in LITERY:
        uwagi.append(f'Pytania, wiersz {nr}: poprawna odpowiedź musi być literą A, B, C albo D.'); continue
    semestry[sem].append({'q': q, 'a': [a, b, c, d], 'ok': LITERY.index(ok.upper()), 'przedmiot': przedmiot, 'prowadzacy': prowadzacy})

dziekanat = []
for nr, w in enumerate(arkusze.get('Dziekanat', [])[1:], start=2):
    w = [tekst(x) for x in w] + [''] * 6
    q, a, b, c, d, ok = w[:6]
    if not any(w[:6]):
        continue
    if not q or not all([a, b, c, d]) or ok.upper() not in LITERY:
        uwagi.append(f'Dziekanat, wiersz {nr}: sprawdź pytanie, 4 odpowiedzi i literę poprawnej odpowiedzi.'); continue
    dziekanat.append({'q': q, 'a': [a, b, c, d], 'ok': LITERY.index(ok.upper())})

for s, lista in semestry.items():
    if not lista:
        uwagi.append(f'Semestr {s} nie ma żadnych pytań. W grze z tym semestrem padną pytania mieszane.')

baza = {'semestry': semestry, 'dziekanat': dziekanat}
with open(os.path.join(TU, 'baza-pytan.js'), 'w', encoding='utf-8') as f:
    f.write('// Plik wygenerowany z pytania/pytania.xlsx skryptem pytania/excel-na-js.py. Nie edytuj ręcznie.\n')
    f.write('window.BAZA_PYTAN = ')
    json.dump(baza, f, ensure_ascii=False, indent=1)
    f.write(';\n')

razem = sum(len(v) for v in semestry.values())
print(f'Zapisano pytania/baza-pytan.js: {razem} pytań z semestrów 1–7 i {len(dziekanat)} pytań dziekanatu.')
for u in uwagi:
    print('Uwaga:', u)
sys.exit(0)
