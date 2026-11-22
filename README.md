# FitNapló 1.1 — testsúly-, testösszetétel- és edzéskövető PWA

Saját használatra készített, magyar nyelvű, mobileszközön is futó **offline-first** webalkalmazás.

## Újdonságok az 1.1-es verzióban

- **Edzéstervek:** több elnevezett edzésterv, előre rögzített gyakorlatok, tetszőleges sorrend, dátumhoz tartozó tömeges edzésnaplózás. Egy napi/terves gyakorlatsor mentése felülírja az aznap korábban rögzített megfelelő tervadatot, de más napokat nem érint.
- **Értelmezés:** a BMI-hez felnőtt kategória, a Navy-testzsírbecsléshez a hagyományos ACE-referencia szerinti, **nem diagnosztikus** leírás.
- **Mobil dátummezők:** megerősített, mobil Safari-kompatibilis méretkorlátok. Új appindításnál a dátumok az aktuális helyi napra állnak; napváltáskor az üres űrlapok frissülnek.
- **Adatmegőrzés:** a régi adatbázis automatikusan új verzióra frissül. A v1 JSON mentések változatlanul visszaállíthatók, az új JSON export a terveket is tartalmazza.

**Frissítés előtt** az iPhone-on készíts JSON biztonsági mentést. A GitHub Pages `index.html`, `app.js`, `styles.css`, `sw.js` és `README.md` állományait cseréld le az új csomag megfelelő fájljaira, vagy töltsd fel az összes új fájlt. A telepített PWA-t ne töröld: az azzal együtt helyben tárolt adatok elveszhetnek. A frissítéshez nyisd meg az appot online és szükség esetén zárd be, majd nyisd meg újra (a service worker lecserélődéséhez).

## Mit tud?

- **Testsúly:** napi egy mérés, dátummal; szerkesztés, törlés.
- **Heti súlyátlag:** hétfő–vasárnap időszak, csak a rögzített napokból. A lefedettség 1–7/7 formában látszik. Hiányzó napot nem pótol automatikusan.
- **BMI:** testsúly / testmagasság². A testmagasságot a Beállítások lapon add meg.
- **Körfogatok:** nyak, derék/has, női képletnél csípő; dátumozott mérések, szerkesztés és törlés.
- **US Navy testzsír:** becslés az eredeti Hodgdon–Beckett egyenletek alapján, centiméterről hüvelykre váltással; a képlet kiválasztása a profilban.
- **Edzéstervek:** menthető, kiválasztható gyakorlatlista. Az edzésnapon csak az új sorozatot, ismétlést és súlyt kell felvinni.
- **Edzés:** gyakorlatnév, dátum, sorozatszám, sorozatonkénti ismétlésszám, súly (kg), megjegyzés; szerkesztés, törlés.
- **Grafikonok:** napi testsúly, heti átlag, BMI, testzsír, nyak, derék/has, gyakorlatonként heti maximális súly, heti volumen, becsült 1RM.
- **Adatvédelem:** nincs szerveroldali adatbázis, fiók, analitika, követőkód vagy külső JavaScript-könyvtár.
- **Adatmentés:** egy JSON fájlban az egész adatbázis exportálható és importálható; CSV export az Excel/LibreOffice számára.

## 1. Fejlesztés Windows alatt

Telepítsd a **Visual Studio Code** alkalmazást és a Python 3-at.

Bontsd ki a ZIP-fájlt, nyisd meg a `fitnaplo_pwa` könyvtárat a VS Code-ban, majd az integrált terminálban:

```powershell
python -m http.server 8000
```

Ha a Python parancs nem működik, próbáld:

```powershell
py -m http.server 8000
```

Böngészőben: **http://localhost:8000**.

> A `file:///.../index.html` megnyitás **nem egyenértékű** a webkiszolgálón futtatással. Az offline PWA funkcióhoz és a biztos működéshez HTTP `localhost` vagy HTTPS szükséges.

## 2. Telepítés iPhone-ra ingyen

1. Hozz létre új **nyilvános** GitHub repositoryt, például `fitnaplo` néven.
2. Töltsd fel a kicsomagolt könyvtár **tartalmát** közvetlenül a repository gyökerébe (`index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, ikonok).
3. A repository **Settings → Pages → Build and deployment** menüjében válaszd a `Deploy from a branch`, `main` és `/ (root)` beállítást.
4. Nyisd meg a kapott HTTPS-címet az iPhone **Safari** böngészőjében. Példa: `https://FELHASZNALONEV.github.io/fitnaplo/`.
5. Safari megosztási menü → **Főképernyőhöz adás** → **Megnyitás webalkalmazásként** (ha megjelenik) → **Hozzáadás**.
6. Indítsd el a főképernyőről, állítsd be a magasságodat és a kívánt képletet, majd rögzítsd a méréseket.
7. Indítsd el egyszer internet mellett, utána próbáld ki repülőgép üzemmódban. Az offline használathoz az alkalmazásfájloknak előzetesen gyorsítótárba kell kerülniük.

**A GitHubra csak a programkód kerül, a beírt egészségügyi adatok nem.** Azok a telefon helyi IndexedDB adatbázisában maradnak. A GitHub Pages nyilvánossá teszi a programkódot; a programot mindenki megnyithatja a címen, de mások nem kapják meg az iPhone-odon tárolt adataidat. Nincs többkészülékes szinkronizálás.

## 3. Fontos: adatvesztés és biztonsági mentés

A PWA helyi IndexedDB-t használ. Az adatok a telepített webapphoz és annak böngészős tárolókörnyezetéhez kötődnek, és **nem garantáltan örök életűek**. Az app eltávolítása, webhelyadatok törlése, tárhelykezelési műveletek vagy böngészőhibák adatvesztést okozhatnak.

**Minden héten készíts mentést:** Beállítások → **Teljes mentés (.json)** → mentsd a Fájlok alkalmazásba, például iCloud Drive-ba. A JSON importálás a helyi adatbázis *összes* adatát lecseréli: ezt a program külön megerősítteti.

**Nem titkosított adattárolás:** az IndexedDB a böngésző által kezelt tárhelyen található. Ha más is hozzáfér a feloldott telefonhoz vagy a webalkalmazáshoz, az adatok láthatók lehetnek. Használj képernyőzárat. A JSON exportot kezeld személyes adatként.

## 4. Matematikai képletek

A BMI képlete:

`BMI = testsúly [kg] / (testmagasság [m])²`

Az alkalmazás az eredeti, **hüvelyk** alapú US Navy-körfogatbecslést használja:

**Férfi:**

`testzsír (%) = 86.010 * log10((has - nyak) / 2.54) - 70.041 * log10(magasság / 2.54) + 36.76`

**Nő:**

`testzsír (%) = 163.205 * log10((derék + csípő - nyak) / 2.54) - 97.684 * log10(magasság / 2.54) - 78.387`

Minden mérés centiméterben történik, a belső számítás 2,54-gyel átszámít hüvelykre.

**Mérési pontok:** férfi haskörfogat köldökmagasságban, női derék a legkeskenyebb ponton és csípő a legszélesebb ponton, nyak a gége alatt. Célszerű hasonló napszakban, azonos mérési módszerrel mérni.

A képlet **becslés**, gyakran több százalékpontot is tévedhet egy pontosabb testösszetétel-méréshez képest. Egészségügyi diagnózist nem ad. Fiziológiailag értelmezhetetlen, 0% alatti vagy 75% feletti becslést az alkalmazás nem jelenít meg, hanem `—`-t mutat. Ha nincs érvényes profiladat, szintén `—` jelenik meg. A profiladatok megváltoztatásakor a számított értékek újraszámolódnak, de a mért adatok változatlanok maradnak.

**Edzésvolumen:** `sorozatok × ismétlések/sorozat × súly [kg]`.

**Becsült 1RM (Epley):** `súly × (1 + ismétlések / 30)`, kizárólag 1–12 ismétlést tartalmazó adatokon, nem a tényleges egyismétléses maximum. Egy gyakorlat adott heti becsült 1RM-e a megfelelő bejegyzések közül a legmagasabb érték.

**Figyelem:** testsúlyos gyakorlatoknál a volumenbe kizárólag a beírt kg kerül; az egyéni testsúly hozzáadását a program nem feltételezi. Ugyanarra a gyakorlatra több külön sorozatcsoport felvihető ugyanazon a napon.

## 5. Fájlok

- `index.html` — felület és űrlapok
- `styles.css` — mobilbarát megjelenés
- `app.js` — IndexedDB, számítások, grafikonok, export/import
- `sw.js` — offline alkalmazásgyorsítótár
- `manifest.webmanifest` — telepíthető PWA manifest
- `icon-192.png`, `icon-512.png` — alkalmazásikonok

## 6. Ismert korlátok, továbbfejlesztés

Ez egy **első, használható MVP**, nem éles, szinkronizált termékszolgáltatás. Nincs bejelentkezés, felhőmentés, iCloud szinkron, adatok automatikus telefonok közti átadása, RPE/RIR követése vagy Apple Health-integráció. Az alkalmazás nem tud helyi értesítést küldeni beállítás nélkül. A testsúlyadatokat napi egy értékre korlátoztuk; több mérés ugyanarra a napra felülírja az aznapi sort.

A fejlesztés további logikus iránya: GitHub Pages + Supabase (bejelentkezés és szinkronizált adatbázis), vagy natív React Native kiadás. Felhőszinkronizálás előtt külön adatvédelmi terv szükséges.

## 7. Hivatkozások

- U.S. Army Regulation 600–9, B függelék: férfi és női képletek: https://desmond-doss.tricare.mil/Portals/109/ARN43120-AR_600-9-001-WEB-3.pdf
- Navy és egyéb szolgálatok becslésének vizsgálata: https://www.ncbi.nlm.nih.gov/books/NBK233769/
- Apple: Weboldal hozzáadása a főképernyőhöz: https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios
- Offline adatok PWA-ban: https://web.dev/learn/pwa/offline-data

## 8. Opcionális fejlesztői ellenőrzés

Ha telepítve van a Node.js, akkor a projekt gyökeréből:

```powershell
node tests/teszt_kepletek.cjs
```

A teszt ellenőrzi többek között a BMI-t, a férfi és női Navy-képletet, a hét kezdőnapját, a heti átlagolást, az edzésvolument és a becsült 1RM-et. Ez **nem** helyettesíti az iOS Safari készülékes funkcionális tesztelését.

## Mutatók értelmezési forrásai

- Felnőtt BMI-kategóriák (CDC): https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html
- A hagyományos American Council on Exercise (ACE) testzsír-referenciatartományok reprodukciója egy egészségügyi szakmai összefoglalóban: https://www.bcm.edu/sites/default/files/f-9-213-16479100_VkUjK61I_Obesity_in_Adults_2020_08.pdf

A testzsír-besorolások módszer- és populációfüggők, és nem alkalmasak betegség megállapítására vagy személyes orvosi céltartomány meghatározására.
