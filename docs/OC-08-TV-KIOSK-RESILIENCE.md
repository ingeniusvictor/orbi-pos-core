# OC-08 — TV Kiosk & Pilot Resilience

## Goal

Make ORBI Showcase practical for an unattended wall TV during a real business day.

## Showcase runtime

The full-screen /showcase route now supports:

- automatic slide rotation;
- pause/resume;
- previous/next slide controls;
- fullscreen toggle;
- keyboard shortcuts;
- automatic control hiding after inactivity;
- hidden mouse cursor while idle;
- pausing rotation while the browser tab is hidden;
- reduced-motion accessibility;
- a compact connection warning only when synchronization is not healthy.

Keyboard controls:

~~~text
Right Arrow  -> next presentation
Left Arrow   -> previous presentation
Space        -> pause/resume
F            -> enter/exit browser fullscreen
~~~

When the TV is synchronized normally, no network-status badge distracts customers.

If the sync server becomes unavailable, Showcase keeps displaying the last locally cached catalog and shows a small warning instead of replacing the customer presentation with an error page.

## Diagnostics

The ORBI admin application now includes an **Estado** section with:

- sync status;
- current catalog revision;
- store id;
- last catalog synchronization;
- active product count;
- Showcase-visible product count;
- products with assigned images;
- shared image-library count;
- mapped RM-60 PLU count;
- server/image capability check.

It refreshes the health view automatically every 10 seconds.

## Windows pilot scripts

Three PowerShell helpers are included.

Start only the ORBI host:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-orbi-pos.ps1
~~~

Open an already-running Showcase in Microsoft Edge kiosk mode:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\open-showcase-kiosk.ps1
~~~

For a single Windows mini-PC connected directly to the TV, start the complete pilot:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-tv-pilot.ps1
~~~

That script installs dependencies if needed, builds ORBI if necessary, launches the sync/web server, waits for /api/health and then opens /showcase in Edge kiosk mode.

## Separate TV device

When the TV/browser is a separate device on the same LAN, start ORBI on the host computer and open:

~~~text
http://HOST-LAN-IP:8787/showcase
~~~

The exact host LAN address is intentionally not hard-coded.

## Operational boundary

OC-08 improves unattended presentation reliability but does not make the LAN server suitable for public-internet exposure.

For the first pilot, keep the ORBI host and TV on the trusted shop LAN, keep the host powered while Showcase is in use, do not port-forward TCP 8787 to the internet, and keep the existing RM-60 / SII workflow independent.

## Pilot-day check

Before leaving the TV unattended:

- Estado -> Servidor ORBI shows Disponible;
- catalog revision is greater than zero;
- expected products are visible in Showcase;
- premium images load;
- the TV URL is /showcase;
- changing one test price on admin appears on TV;
- the test price is restored after validation.
