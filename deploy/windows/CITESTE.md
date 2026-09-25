# Managerul de comenzi pe serverul Windows

Instalarea se face o singură dată. După aceea, update-urile se fac cu un dublu-clic.

## Ce face instalarea (`instaleaza.bat`)

1. **Node.js.** Dacă lipseşte sau e mai vechi de 22.5, instalează ultimul Node 24 LTS de pe nodejs.org. Instalatorul e verificat după amprenta SHA-256 oficială.
2. **Git.** Dacă lipseşte, instalează ultimul Git for Windows, verificat la fel.
3. **Folderele.** Creează `C:\Aplicatii\SDK\`:
   - `cod\` pentru aplicaţie;
   - `date\` pentru bază, backup-uri şi jurnale;
   - `deploy-key\` pentru cheia GitHub.
4. **Cheia de acces la GitHub.** Generează o cheie *doar pentru citire* şi îţi spune unde s-o adaugi.
5. **Codul.** Aduce de pe GitHub **doar** `manager\` şi `configurator_usi\`.
6. **Construirea şi testele.** Construieşte configuratorul şi rulează testele. Dacă pică ceva, se opreşte şi nu porneşte serverul.
7. **Baza de date.** Foloseşte baza copiată de pe laptop sau creează una nouă, cu un cont de administrator.
8. **Firewall şi pornire.** Deschide portul doar în reţeaua internă şi face ca serverul să pornească singur odată cu Windows-ul (sarcina „SDK Manager”).

## Paşi

**Înainte, pe laptop.** Fă o copie curată a bazei, ca să păstrezi ofertele şi conturile. Din folderul `SDK`, rulează:

```
node deploy/windows/backup-baza.js manager/date/manager.sqlite manager.sqlite
```

Fişierul `manager.sqlite` rezultat îl duci pe server la pasul 3.

**Pe server** (prin Remote Desktop, cu un cont de administrator):

1. Copiază pe server tot folderul `deploy\windows` de pe laptop, de exemplu pe Desktop. Merge prin copy-paste în fereastra Remote Desktop.
2. Dublu-clic pe **`instaleaza.bat`** şi acceptă cererea de administrator.
3. Urmează ce îţi cere scriptul:
   - **Cheia:** o adaugi în GitHub la `anghel-ii/sdkmanager` → **Settings → Deploy keys → Add deploy key**. Ca titlu pui `Server rack`. **Nu** bifa „Allow write access”.
   - **Baza:** copiezi `manager.sqlite` de pe laptop în `C:\Aplicatii\SDK\date\` şi apeşi Enter. Dacă vrei o bază nouă, scrii `N`.
4. La final, scriptul afişează adresa, de exemplu `http://192.168.x.x:8080`.

**După instalare:** pe telefoane, excepţia din Chrome trebuie refăcută cu adresa nouă a serverului. Pe laptop, opreşte managerul, ca să nu lucreze nimeni pe baza veche.

### Opţiuni (pentru `instaleaza.bat`)

```
instaleaza.bat -Port 8080 -Backup D:\Backup\SDK
```

`-Backup` mută backup-urile zilnice pe alt disc. E recomandat: dacă se strică discul cu baza, nu pierzi şi copiile.

## Update-uri

Dublu-clic pe **`C:\Aplicatii\SDK\Actualizeaza aplicatia.bat`**, când nu lucrează nimeni în aplicaţie. Scriptul face aceşti paşi:

1. arată ce e nou pe GitHub şi se opreşte dacă nu e nimic nou;
2. face **backup la bază** (`inainte-update-<data>.sqlite`);
3. aduce codul nou, îl construieşte şi rulează testele;
4. reporneşte serverul şi verifică dacă răspunde.

Dacă testele sau pornirea pică, **revine singur la versiunea de dinainte**. Tot ce se întâmplă se scrie în `date\actualizari.log`.

## Utile

| Ce | Cum |
|---|---|
| Jurnalul serverului | `C:\Aplicatii\SDK\date\server.log` |
| Oprire / pornire manuală | Task Scheduler → „SDK Manager” → End / Run |
| Setări (port, backup, Node) | `C:\Aplicatii\SDK\setari.cmd` |
| Backup-uri | `date\backup\`: zilnice (30 de zile) + cele de dinainte de fiecare update |
