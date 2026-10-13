"""Tworzy pytania/pytania.xlsx z przykładowymi pytaniami (do podmiany na pytania od wykładowców).
Uruchom tylko raz: nadpisze plik pytania.xlsx!   python3 pytania/szablon-z-przykladami.py
"""
import os
from xlsx_prosty import zapisz

TU = os.path.dirname(os.path.abspath(__file__))

# Semestr, przedmiot, prowadzący, pytanie, A, B, C, D, poprawna
P = [
    (1, 'Podstawy informatyki', 'dr Jan Kowalski', 'Ile bitów ma jeden bajt?', '4', '8', '16', '32', 'B'),
    (1, 'Podstawy informatyki', 'dr Jan Kowalski', 'Ile wynosi liczba 1010 zapisana dwójkowo w systemie dziesiętnym?', '8', '10', '12', '5', 'B'),
    (1, 'Podstawy informatyki', 'dr Jan Kowalski', 'Która pamięć traci dane po wyłączeniu zasilania?', 'ROM', 'SSD', 'RAM', 'HDD', 'C'),
    (1, 'Podstawy informatyki', 'dr Jan Kowalski', 'Ile wynosi 2 do potęgi 10?', '1000', '512', '2048', '1024', 'D'),
    (1, 'Podstawy informatyki', 'dr Jan Kowalski', 'Jak zapisać liczbę 15 w systemie szesnastkowym?', 'F', 'E', '10', '1F', 'A'),
    (1, 'Podstawy informatyki', 'dr Jan Kowalski', 'Który układ komputera wykonuje instrukcje programów?', 'procesor', 'zasilacz', 'karta sieciowa', 'dysk', 'A'),
    (2, 'Algorytmy i struktury danych', 'dr Jan Kowalski', 'Która struktura danych działa według zasady LIFO (ostatni wchodzi, pierwszy wychodzi)?', 'kolejka', 'stos', 'lista', 'drzewo', 'B'),
    (2, 'Algorytmy i struktury danych', 'dr Jan Kowalski', 'Która struktura danych działa według zasady FIFO (pierwszy wchodzi, pierwszy wychodzi)?', 'stos', 'kolejka', 'kopiec', 'graf', 'B'),
    (2, 'Algorytmy i struktury danych', 'dr Jan Kowalski', 'Jaką złożoność ma wyszukiwanie binarne w posortowanej tablicy?', 'O(n)', 'O(log n)', 'O(n²)', 'O(1)', 'B'),
    (2, 'Algorytmy i struktury danych', 'dr Jan Kowalski', 'Ile krawędzi ma drzewo o 10 wierzchołkach?', '9', '10', '11', '20', 'A'),
    (2, 'Algorytmy i struktury danych', 'dr Jan Kowalski', 'Które sortowanie dzieli tablicę na połowy, sortuje je i scala?', 'bąbelkowe', 'przez scalanie', 'przez wybór', 'przez wstawianie', 'B'),
    (2, 'Algorytmy i struktury danych', 'dr Jan Kowalski', 'Jak nazywa się funkcja, która wywołuje samą siebie?', 'rekurencyjna', 'iteracyjna', 'statyczna', 'anonimowa', 'A'),
    (3, 'Bazy danych', 'dr Jan Kowalski', 'Które polecenie SQL pobiera dane z tabeli?', 'INSERT', 'UPDATE', 'SELECT', 'DELETE', 'C'),
    (3, 'Bazy danych', 'dr Jan Kowalski', 'Które polecenie SQL usuwa wiersze z tabeli?', 'DROP', 'DELETE', 'REMOVE', 'CLEAR', 'B'),
    (3, 'Bazy danych', 'dr Jan Kowalski', 'Jak nazywa się kolumna, która jednoznacznie identyfikuje wiersz?', 'klucz obcy', 'klucz główny', 'indeks', 'widok', 'B'),
    (3, 'Bazy danych', 'dr Jan Kowalski', 'Która klauzula SQL filtruje wiersze?', 'ORDER BY', 'GROUP BY', 'WHERE', 'JOIN', 'C'),
    (3, 'Bazy danych', 'dr Jan Kowalski', 'Która funkcja SQL liczy wiersze?', 'SUM', 'COUNT', 'MAX', 'AVG', 'B'),
    (3, 'Bazy danych', 'dr Jan Kowalski', 'Które polecenie SQL dodaje nowy wiersz do tabeli?', 'INSERT', 'SELECT', 'ALTER', 'GRANT', 'A'),
    (4, 'Sieci komputerowe', 'dr Jan Kowalski', 'Ile bitów ma adres IPv4?', '32', '64', '128', '16', 'A'),
    (4, 'Sieci komputerowe', 'dr Jan Kowalski', 'Ile bitów ma adres IPv6?', '32', '64', '128', '256', 'C'),
    (4, 'Sieci komputerowe', 'dr Jan Kowalski', 'Który protokół zamienia nazwy domen na adresy IP?', 'DHCP', 'DNS', 'FTP', 'SMTP', 'B'),
    (4, 'Sieci komputerowe', 'dr Jan Kowalski', 'Który protokół automatycznie przydziela adresy IP w sieci?', 'DNS', 'HTTP', 'DHCP', 'SSH', 'C'),
    (4, 'Sieci komputerowe', 'dr Jan Kowalski', 'Na którym porcie domyślnie działa HTTPS?', '80', '21', '443', '25', 'C'),
    (4, 'Sieci komputerowe', 'dr Jan Kowalski', 'Ile warstw ma model OSI?', '4', '5', '7', '9', 'C'),
    (5, 'Programowanie obiektowe', 'dr Jan Kowalski', 'Jak nazywa się ukrywanie danych obiektu przed dostępem z zewnątrz?', 'hermetyzacja', 'dziedziczenie', 'polimorfizm', 'rekurencja', 'A'),
    (5, 'Programowanie obiektowe', 'dr Jan Kowalski', 'Jak nazywa się przejmowanie cech klasy bazowej przez inną klasę?', 'kompozycja', 'dziedziczenie', 'agregacja', 'serializacja', 'B'),
    (5, 'Programowanie obiektowe', 'dr Jan Kowalski', 'Jak nazywa się metoda, która tworzy nowy obiekt klasy?', 'destruktor', 'konstruktor', 'akcesor', 'iterator', 'B'),
    (5, 'Programowanie obiektowe', 'dr Jan Kowalski', 'Jak nazywa się konkretny egzemplarz klasy?', 'obiekt', 'interfejs', 'pakiet', 'moduł', 'A'),
    (5, 'Programowanie obiektowe', 'dr Jan Kowalski', 'Który modyfikator dostępu ogranicza dostęp tylko do wnętrza klasy?', 'public', 'protected', 'private', 'static', 'C'),
    (5, 'Programowanie obiektowe', 'dr Jan Kowalski', 'Jak nazywa się różne działanie tej samej metody w różnych klasach?', 'polimorfizm', 'hermetyzacja', 'abstrakcja', 'delegacja', 'A'),
    (6, 'Inżynieria oprogramowania', 'dr Jan Kowalski', 'Która metodyka dzieli pracę zespołu na krótkie sprinty?', 'kaskadowa', 'Scrum', 'spiralna', 'model V', 'B'),
    (6, 'Inżynieria oprogramowania', 'dr Jan Kowalski', 'Jak nazywa się system kontroli wersji, z którego korzysta GitHub?', 'Git', 'SVN', 'CVS', 'FTP', 'A'),
    (6, 'Inżynieria oprogramowania', 'dr Jan Kowalski', 'Jak nazywa się test, który sprawdza pojedynczą funkcję w izolacji?', 'jednostkowy', 'integracyjny', 'akceptacyjny', 'obciążeniowy', 'A'),
    (6, 'Inżynieria oprogramowania', 'dr Jan Kowalski', 'Który diagram UML pokazuje klasy i relacje między nimi?', 'klas', 'sekwencji', 'aktywności', 'przypadków użycia', 'A'),
    (6, 'Inżynieria oprogramowania', 'dr Jan Kowalski', 'Która komenda Git wysyła zmiany do zdalnego repozytorium?', 'push', 'pull', 'clone', 'merge', 'A'),
    (6, 'Inżynieria oprogramowania', 'dr Jan Kowalski', 'Jak nazywa się codzienne krótkie spotkanie zespołu w Scrumie?', 'daily', 'retrospektywa', 'review', 'planning', 'A'),
    (7, 'Bezpieczeństwo systemów', 'dr Jan Kowalski', 'Który protokół szyfruje połączenie ze stroną internetową?', 'HTTP', 'FTP', 'HTTPS', 'SMTP', 'C'),
    (7, 'Bezpieczeństwo systemów', 'dr Jan Kowalski', 'Jak nazywa się podszywanie się pod zaufaną instytucję, żeby wyłudzić dane?', 'phishing', 'DDoS', 'brute force', 'keylogger', 'A'),
    (7, 'Bezpieczeństwo systemów', 'dr Jan Kowalski', 'Jak nazywa się atak, który przeciąża serwer ogromną liczbą żądań?', 'DDoS', 'phishing', 'SQL injection', 'XSS', 'A'),
    (7, 'Bezpieczeństwo systemów', 'dr Jan Kowalski', 'Który typ szyfrowania używa pary kluczy: publicznego i prywatnego?', 'symetryczne', 'asymetryczne', 'haszowanie', 'Base64', 'B'),
    (7, 'Bezpieczeństwo systemów', 'dr Jan Kowalski', 'Jak nazywa się wstrzyknięcie złośliwego kodu do zapytania SQL?', 'SQL injection', 'phishing', 'DDoS', 'keylogger', 'A'),
    (7, 'Bezpieczeństwo systemów', 'dr Jan Kowalski', 'Co oznacza skrót 2FA?', 'logowanie dwuetapowe', 'dwa firewalle', 'dwie kopie zapasowe', 'dwa procesory', 'A'),
]
D = [
    ('Ile punktów ECTS zwykle trzeba zdobyć w jednym semestrze?', '15', '30', '45', '60', 'B'),
    ('Jak nazywa się dokument, który potwierdza status studenta?', 'legitymacja studencka', 'dowód osobisty', 'świadectwo', 'paszport', 'A'),
    ('Kto stoi na czele wydziału?', 'rektor', 'dziekan', 'kanclerz', 'kwestor', 'B'),
    ('Kto kieruje całą uczelnią?', 'dziekan', 'prodziekan', 'rektor', 'promotor', 'C'),
    ('Jak nazywa się nauczyciel, który prowadzi pracę dyplomową studenta?', 'promotor', 'recenzent', 'opiekun roku', 'dziekan', 'A'),
    ('Jak nazywa się przerwa w studiach, której udziela dziekan?', 'urlop dziekański', 'wakacje', 'sesja', 'wymiana', 'A'),
    ('Co oznacza wpis warunkowy na kolejny semestr?', 'powtarzasz cały rok', 'zaliczasz przedmiot później', 'rezygnujesz ze studiów', 'zmieniasz kierunek', 'B'),
    ('Kiedy zwykle jest sesja poprawkowa?', 'przed zajęciami', 'po sesji zasadniczej', 'w pierwszym tygodniu semestru', 'nigdy', 'B'),
]

naglowek = ['Semestr (1–7)', 'Przedmiot', 'Prowadzący', 'Pytanie', 'Odpowiedź A', 'Odpowiedź B', 'Odpowiedź C', 'Odpowiedź D', 'Poprawna (A–D)']
zapisz(os.path.join(TU, 'pytania.xlsx'), [
    {'nazwa': 'Pytania', 'wiersze': [naglowek] + [list(p) for p in P],
     'szerokosci': [13, 26, 20, 60, 18, 18, 18, 18, 15], 'styl_kolumn': {1: 3, 9: 3},
     'walidacje': [('A2:A2000', '1,2,3,4,5,6,7'), ('I2:I2000', 'A,B,C,D')]},
    {'nazwa': 'Dziekanat', 'wiersze': [['Pytanie', 'Odpowiedź A', 'Odpowiedź B', 'Odpowiedź C', 'Odpowiedź D', 'Poprawna (A–D)']] + [list(d) for d in D],
     'szerokosci': [60, 22, 22, 22, 22, 15], 'styl_kolumn': {6: 3},
     'walidacje': [('F2:F2000', 'A,B,C,D')]},
    {'nazwa': 'Instrukcja', 'naglowek': False, 'szerokosci': [100], 'styl_kolumn': {1: 0},
     'wiersze': [
         ['Baza pytań do gry WSiZ Tour'],
         [''],
         ['Arkusz „Pytania”: jeden wiersz to jedno pytanie. Semestr od 1 do 7, przedmiot, prowadzący, treść pytania, 4 odpowiedzi i litera dobrej odpowiedzi (A, B, C albo D).'],
         ['Arkusz „Dziekanat”: pytania, które padają, gdy gracz stanie na polu Dziekanat. Bez semestru i przedmiotu.'],
         ['Pytanie najlepiej do ok. 90 znaków, odpowiedzi do ok. 15–25 znaków, żeby dobrze wyglądały w grze i na kartach.'],
         ['Obecne pytania są przykładowe. Zastąp je pytaniami od wykładowców.'],
         [''],
         ['Po zmianach uruchom w folderze projektu:  python3 pytania/excel-na-js.py'],
         ['Skrypt sprawdzi pytania i zapisze je do pliku pytania/baza-pytan.js, z którego korzysta gra.'],
     ]},
])
print('Zapisano pytania/pytania.xlsx')
